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

/**
 * Where the cache lives — decided by trying, not by guessing.
 *
 * An earlier version sniffed `process.env.VERCEL` to detect serverless and pick
 * `/tmp`. That failed in production: the deployment bundle is read-only, the
 * env var was not exposed, and every search died on
 * `ENOENT: mkdir '/var/task/data'`. Feature-detection beats environment
 * detection — we attempt each candidate in order and keep the first that is
 * actually writable.
 *
 * `/tmp` is per-instance and evaporates when the instance is recycled, which
 * makes the cache a genuine cache: a miss costs an Overpass query, never a wrong
 * answer. For real traffic point `MASSFINDER_DATA_DIR` at a persistent volume,
 * or swap this module for a Redis/KV-backed one — the interface is small and
 * deliberately so.
 */
/**
 * Read the candidates when we resolve rather than at module load, so the
 * environment is consulted at the moment it matters. Module-load-time env reads
 * are a quiet trap: they bake in whatever was set when the import graph was
 * first walked.
 */
function candidateRoots(): string[] {
  return [
    process.env.MASSFINDER_DATA_DIR,
    path.join(process.cwd(), 'data'),
    '/tmp/massfinder-data',
  ].filter((p): p is string => !!p);
}

let resolvedRoot: string | null | undefined;

/** The writable cache root, or `null` when there is none and caching is off. */
async function root(): Promise<string | null> {
  if (resolvedRoot !== undefined) return resolvedRoot;
  const candidates = candidateRoots();
  for (const candidate of candidates) {
    try {
      await fs.mkdir(candidate, { recursive: true });
      resolvedRoot = candidate;
      return candidate;
    } catch {
      // Not writable — try the next candidate.
    }
  }
  // No writable location anywhere. The app still works, just uncached.
  console.warn(
    `[massfinder] No writable cache directory (tried ${candidates.join(', ')}). Running without a cache.`,
  );
  resolvedRoot = null;
  return null;
}

/**
 * Forget the resolved cache root so the next call re-runs the candidate probe.
 * Used by tests, which need to point the store at a fresh temporary directory;
 * the resolution is memoised for the life of the process otherwise.
 */
export function resetCacheRoot(): void {
  resolvedRoot = undefined;
}

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

async function readEnvelope<T>(relative: string, ttlMs: number): Promise<T | undefined> {
  const dir = await root();
  if (!dir) return undefined;
  try {
    const raw = await fs.readFile(path.join(dir, relative), 'utf8');
    const env = JSON.parse(raw) as Envelope<T>;
    if (Date.now() - new Date(env.savedAt).getTime() > ttlMs) return undefined;
    return env.value;
  } catch {
    return undefined;
  }
}

/**
 * Persist a value, best-effort.
 *
 * **This never throws.** A cache write failing is not a reason to fail the
 * request that triggered it — the first production bug in this app was exactly
 * that: an unwritable directory turned a perfectly good church search into
 * "We could not search for churches just now". The caller gets its answer; the
 * cache is a bonus.
 */
async function writeEnvelope<T>(relative: string, value: T): Promise<void> {
  const dir = await root();
  if (!dir) return;
  const file = path.join(dir, relative);
  try {
    await ensureDir(path.dirname(file));
    const env: Envelope<T> = { savedAt: new Date().toISOString(), value };
    // Write-then-rename so a crash mid-write cannot leave a truncated cache file
    // that would then be parsed as valid-but-empty.
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(env), 'utf8');
    await fs.rename(tmp, file);
  } catch (err) {
    console.warn(`[massfinder] Could not cache ${relative}: ${String(err)}`);
  }
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
  return readEnvelope<Church[]>(path.join('churches', `${safeKey(key)}.json`), TTL.churches);
}

export async function putCachedChurches(key: string, churches: Church[]): Promise<void> {
  await writeEnvelope(path.join('churches', `${safeKey(key)}.json`), churches);
}

// ── Individual churches, so a detail page works without a nearby search ────

export async function getChurch(id: string): Promise<Church | undefined> {
  return readEnvelope<Church>(path.join('church', `${safeKey(id)}.json`), TTL.churches);
}

export async function putChurch(church: Church): Promise<void> {
  await writeEnvelope(path.join('church', `${safeKey(church.id)}.json`), church);
}

// ── Schedules ──────────────────────────────────────────────────────────────

export async function getSchedule(churchId: string): Promise<ChurchSchedule | undefined> {
  return readEnvelope<ChurchSchedule>(
    path.join('schedule', `${safeKey(churchId)}.json`),
    TTL.schedules,
  );
}

/** Read a schedule regardless of age, so we can show a stale answer with its date. */
export async function getScheduleEvenIfStale(
  churchId: string,
): Promise<{ schedule: ChurchSchedule; savedAt: string } | undefined> {
  const dir = await root();
  if (!dir) return undefined;
  try {
    const raw = await fs.readFile(
      path.join(dir, 'schedule', `${safeKey(churchId)}.json`),
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
    path.join('schedule', `${safeKey(schedule.churchId)}.json`),
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
  const dir = await root();
  if (!dir) throw new Error('No writable storage, so the report could not be saved.');
  const file = path.join(dir, 'reports', `${safeKey(report.churchId)}.jsonl`);
  await ensureDir(path.dirname(file));
  await fs.appendFile(file, `${JSON.stringify(report)}\n`, 'utf8');
}

export async function readUserReports(churchId: string): Promise<UserReport[]> {
  const dir = await root();
  if (!dir) return [];
  try {
    const raw = await fs.readFile(
      path.join(dir, 'reports', `${safeKey(churchId)}.jsonl`),
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
