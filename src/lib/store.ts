import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type { Profile, MirrorResult, Mode } from "./types";

// ---------------------------------------------------------------------------
// File-based persistence. No heavy DB (per brief): Profiles + cached query
// results live as JSON on disk so re-runs are free and demos are reproducible.
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data");
const PROFILES_DIR = path.join(DATA_DIR, "profiles");
const CACHE_DIR = path.join(DATA_DIR, "cache");
const SEED_DIR = path.join(DATA_DIR, "seed");

async function ensureDirs() {
  await fs.mkdir(PROFILES_DIR, { recursive: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

// ------------------------------- Profiles ----------------------------------

export async function saveProfile(profile: Profile): Promise<void> {
  await ensureDirs();
  const file = path.join(PROFILES_DIR, `${profile.slug}.json`);
  await fs.writeFile(file, JSON.stringify(profile, null, 2), "utf8");
}

export async function getProfile(slug: string): Promise<Profile | null> {
  // First a live/runtime profile, then fall back to a committed seed profile.
  for (const dir of [PROFILES_DIR, SEED_DIR]) {
    try {
      const raw = await fs.readFile(path.join(dir, `${slug}.json`), "utf8");
      return JSON.parse(raw) as Profile;
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function listProfiles(): Promise<Profile[]> {
  await ensureDirs();
  const out: Record<string, Profile> = {};
  for (const dir of [SEED_DIR, PROFILES_DIR]) {
    let files: string[] = [];
    try {
      files = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const p = JSON.parse(await fs.readFile(path.join(dir, f), "utf8")) as Profile;
        out[p.slug] = p; // runtime dir wins over seed for same slug
      } catch {
        /* skip malformed */
      }
    }
  }
  return Object.values(out).sort((a, b) => (a.name > b.name ? 1 : -1));
}

// ------------------------------- Cache -------------------------------------
// Key = hash(slug + profileVersion + questionId + mode). Re-runs are free
// until the profile is edited (version bump changes the key).

export function cacheKey(
  slug: string,
  version: number,
  questionId: string,
  mode: Mode
): string {
  return crypto
    .createHash("sha256")
    .update(`${slug}::${version}::${questionId}::${mode}`)
    .digest("hex")
    .slice(0, 32);
}

export async function getCached(key: string): Promise<MirrorResult | null> {
  // Runtime cache first, then committed seed cache.
  for (const dir of [CACHE_DIR, path.join(SEED_DIR, "cache")]) {
    try {
      const raw = await fs.readFile(path.join(dir, `${key}.json`), "utf8");
      return JSON.parse(raw) as MirrorResult;
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function setCached(key: string, result: MirrorResult): Promise<void> {
  await ensureDirs();
  await fs.writeFile(
    path.join(CACHE_DIR, `${key}.json`),
    JSON.stringify(result, null, 2),
    "utf8"
  );
}
