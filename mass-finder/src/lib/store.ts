import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { Church } from './churches/types';
import type { ChurchSchedule } from './schedule/types';

/**
 * Caching, and the reason it is not optional.
 *
 * Overpass and Nominatim are volunteer-run services with published usage
 * policies. An app that hits them on every page view is both slow and a bad
 * citizen. Parish websites are usually a single small server run by a volunteer,
 * and re-crawling one because two people in the same town opened the app is
 * indefensible.
 *
 * So: everything is cached on disk with a time-to-live tuned to how fast the
 * underlying data actually changes. Church locations move essentially never;
 * Mass schedules change a few times a year, plus around Christmas and Easter.
 */

const ROOT = process.env.MASSFINDER_DATA_DIR ?? path.join(process.cwd(), 'data');

export const TTL = {
  /** Church locations barely change. */
  churches: 30 * 24 * 60 * 60 * 1000,
  /**
   * Schedules change seasonally. Two weeks keeps us close to current without
   * hammering parish servers — and the UI always shows the check date, so a
   * slightly stale answer is a visible one.
   */
  schedules: 14 * 24 * 60 * 60 * 1000,
  /** Place-name lookups are stable. */
  geocode: 30 * 24 * 60 * 60 * 1000,
} as const;

interface Envelope<T> {
  savedAt: string;
  value: T;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/** Filesystem-safe key. Church ids contain `/`, which would create directories. */
function safeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
}

async function readEnvelope<T>(file: string, ttlMs: number): Promise<T | undefined> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const env = JSON.parse(raw) as Envelope<T>;
    if (Date.now() - new Date(env.savedAt).getTime() > ttlMs) return undefined;
    return env.value;
  } catch {
    return undefined;
  }
}

async function writeEnvelope<T>(file: string, value: T): Promise<void> {
  await ensureDir(path.dirname(file));
  const env: Envelope<T> = { savedAt: new Date().toISOString(), value };
  // Write-then-rename so a crash mid-write cannot leave a truncated cache file
  // that would then be parsed as valid-but-empty.
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(env), 'utf8');
  await fs.rename(tmp, file);
}

// ── Churches, keyed by a coarse geographic tile ────────────────────────────

/**
 * Round coordinates to a ~5 km grid so nearby searches share a cache entry.
 * Two people standing on opposite sides of a town should not trigger two
 * Overpass queries.
 */
export function tileKey(lat: number, lon: number, radiusMetres: number): string {
  const q = 0.05; // ≈5.5 km of latitude
  const la = Math.round(lat / q) * q;
  const lo = Math.round(lon / q) * q;
  return `tile_${la.toFixed(2)}_${lo.toFixed(2)}_${Math.round(radiusMetres / 1000)}km`;
}

export async function getCachedChurches(key: string): Promise<Church[] | undefined> {
  return readEnvelope<Church[]>(path.join(ROOT, 'churches', `${safeKey(key)}.json`), TTL.churches);
}

export async function putCachedChurches(key: string, churches: Church[]): Promise<void> {
  await writeEnvelope(path.join(ROOT, 'churches', `${safeKey(key)}.json`), churches);
}

// ── Individual churches, so a detail page works without a nearby search ────

export async function getChurch(id: string): Promise<Church | undefined> {
  return readEnvelope<Church>(path.join(ROOT, 'church', `${safeKey(id)}.json`), TTL.churches);
}

export async function putChurch(church: Church): Promise<void> {
  await writeEnvelope(path.join(ROOT, 'church', `${safeKey(church.id)}.json`), church);
}

// ── Schedules ──────────────────────────────────────────────────────────────

export async function getSchedule(churchId: string): Promise<ChurchSchedule | undefined> {
  return readEnvelope<ChurchSchedule>(
    path.join(ROOT, 'schedule', `${safeKey(churchId)}.json`),
    TTL.schedules,
  );
}

/** Read a schedule regardless of age, so we can show a stale answer with its date. */
export async function getScheduleEvenIfStale(
  churchId: string,
): Promise<{ schedule: ChurchSchedule; savedAt: string } | undefined> {
  try {
    const raw = await fs.readFile(
      path.join(ROOT, 'schedule', `${safeKey(churchId)}.json`),
      'utf8',
    );
    const env = JSON.parse(raw) as Envelope<ChurchSchedule>;
    return { schedule: env.value, savedAt: env.savedAt };
  } catch {
    return undefined;
  }
}

export async function putSchedule(schedule: ChurchSchedule): Promise<void> {
  await writeEnvelope(
    path.join(ROOT, 'schedule', `${safeKey(schedule.churchId)}.json`),
    schedule,
  );
}

// ── User reports ───────────────────────────────────────────────────────────

export interface UserReport {
  churchId: string;
  /** What the person told us. */
  kind: 'times-correct' | 'times-wrong' | 'church-closed' | 'not-catholic' | 'correction';
  /** Free text when they offered a correction. */
  detail?: string;
  reportedAt: string;
}

/**
 * Append a user report.
 *
 * The community-verification loop is what eventually makes this trustworthy: a
 * person who has just walked out of a church knows more than any scraper. Reports
 * are append-only so nothing is ever silently overwritten.
 */
export async function appendUserReport(report: UserReport): Promise<void> {
  const file = path.join(ROOT, 'reports', `${safeKey(report.churchId)}.jsonl`);
  await ensureDir(path.dirname(file));
  await fs.appendFile(file, `${JSON.stringify(report)}\n`, 'utf8');
}

export async function readUserReports(churchId: string): Promise<UserReport[]> {
  try {
    const raw = await fs.readFile(
      path.join(ROOT, 'reports', `${safeKey(churchId)}.jsonl`),
      'utf8',
    );
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as UserReport);
  } catch {
    return [];
  }
}

/**
 * Confidence adjustment from user reports.
 *
 * Deliberately blunt: a single "these times are wrong" is enough to stop the app
 * presenting the schedule as reliable, because the cost of a wrong time is a
 * wasted journey and the cost of an unnecessary caveat is a moment's doubt.
 */
export function reportSummary(reports: UserReport[]): {
  correct: number;
  wrong: number;
  verdict: 'confirmed' | 'disputed' | 'none';
} {
  const correct = reports.filter((r) => r.kind === 'times-correct').length;
  const wrong = reports.filter(
    (r) => r.kind === 'times-wrong' || r.kind === 'church-closed',
  ).length;
  let verdict: 'confirmed' | 'disputed' | 'none' = 'none';
  if (wrong > 0) verdict = 'disputed';
  else if (correct >= 2) verdict = 'confirmed';
  return { correct, wrong, verdict };
}
