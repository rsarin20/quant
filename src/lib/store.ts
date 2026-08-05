import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type { Profile, MirrorResult, Mode } from "./types";
import { kvEnabled, kvGet, kvSet, kvDel, kvSAdd, kvSRem, kvSMembers } from "./kv";

// ---------------------------------------------------------------------------
// Persistence with a pluggable backend:
//
//   • KV (Vercel KV / Upstash) — private + durable. Used automatically when a
//     KV store is connected. This is what production should use: profiles
//     survive across deploys/instances and groundTruthNotes stays server-side.
//   • Filesystem — local dev writes to ./data. On Vercel (read-only app dir)
//     writes fall back to /tmp, which is EPHEMERAL and per-instance: fine for a
//     quick look, NOT durable. storageMode() reports "ephemeral" so the UI can
//     warn until a KV store is connected.
//
// The committed seed (data/seed/) is always read from the bundle (read-only OK)
// as a fallback, so the demo candidate works in every mode.
// ---------------------------------------------------------------------------

const SEED_DIR = path.join(process.cwd(), "data", "seed");

// Writable base dir for the fs backend.
const WRITABLE_DIR = process.env.VERCEL
  ? path.join("/tmp", "mirror-data")
  : path.join(process.cwd(), "data");
const PROFILES_DIR = path.join(WRITABLE_DIR, "profiles");
const CACHE_DIR = path.join(WRITABLE_DIR, "cache");

const K_PROFILE = (slug: string) => `profile:${slug}`;
const K_INDEX = "profiles:index";
const K_CACHE = (key: string) => `mirror:${key}`;

export type StorageMode = "kv" | "ephemeral" | "local";

export function storageMode(): StorageMode {
  if (kvEnabled()) return "kv";
  return process.env.VERCEL ? "ephemeral" : "local";
}

async function ensureDirs() {
  await fs.mkdir(PROFILES_DIR, { recursive: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

async function readSeedJson<T>(rel: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(SEED_DIR, rel), "utf8")) as T;
  } catch {
    return null;
  }
}

// ------------------------------- Profiles ----------------------------------

export async function saveProfile(profile: Profile): Promise<void> {
  if (kvEnabled()) {
    await kvSet(K_PROFILE(profile.slug), profile);
    await kvSAdd(K_INDEX, profile.slug);
    return;
  }
  await ensureDirs();
  await fs.writeFile(
    path.join(PROFILES_DIR, `${profile.slug}.json`),
    JSON.stringify(profile, null, 2),
    "utf8"
  );
}

export async function getProfile(slug: string): Promise<Profile | null> {
  if (kvEnabled()) {
    const p = await kvGet<Profile>(K_PROFILE(slug));
    if (p) return p;
  } else {
    try {
      const raw = await fs.readFile(path.join(PROFILES_DIR, `${slug}.json`), "utf8");
      return JSON.parse(raw) as Profile;
    } catch {
      /* fall through to seed */
    }
  }
  // Seed fallback (bundled, read-only) — the demo candidate in every mode.
  return readSeedJson<Profile>(`${slug}.json`);
}

export async function deleteProfile(slug: string): Promise<void> {
  if (kvEnabled()) {
    await kvDel(K_PROFILE(slug));
    await kvSRem(K_INDEX, slug);
    return;
  }
  try {
    await fs.unlink(path.join(PROFILES_DIR, `${slug}.json`));
  } catch {
    /* already gone */
  }
}

export async function listProfiles(): Promise<Profile[]> {
  const out: Record<string, Profile> = {};

  // Seed profiles first (so runtime entries win on slug collisions).
  try {
    for (const f of await fs.readdir(SEED_DIR)) {
      if (!f.endsWith(".json")) continue;
      const p = await readSeedJson<Profile>(f);
      if (p) out[p.slug] = p;
    }
  } catch {
    /* no seed dir */
  }

  if (kvEnabled()) {
    const slugs = await kvSMembers(K_INDEX);
    for (const slug of slugs) {
      const p = await kvGet<Profile>(K_PROFILE(slug));
      if (p) out[p.slug] = p;
    }
  } else {
    try {
      for (const f of await fs.readdir(PROFILES_DIR)) {
        if (!f.endsWith(".json")) continue;
        try {
          const p = JSON.parse(await fs.readFile(path.join(PROFILES_DIR, f), "utf8")) as Profile;
          out[p.slug] = p;
        } catch {
          /* skip malformed */
        }
      }
    } catch {
      /* no runtime dir yet */
    }
  }

  return Object.values(out).sort((a, b) => (a.name > b.name ? 1 : -1));
}

// ------------------------------- Cache -------------------------------------
// Key = hash(slug + profileVersion + questionId + mode).

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
  if (kvEnabled()) {
    const hit = await kvGet<MirrorResult>(K_CACHE(key));
    if (hit) return hit;
  } else {
    try {
      const raw = await fs.readFile(path.join(CACHE_DIR, `${key}.json`), "utf8");
      return JSON.parse(raw) as MirrorResult;
    } catch {
      /* fall through to seed cache */
    }
  }
  return readSeedJson<MirrorResult>(path.join("cache", `${key}.json`));
}

export async function setCached(key: string, result: MirrorResult): Promise<void> {
  if (kvEnabled()) {
    await kvSet(K_CACHE(key), result);
    return;
  }
  await ensureDirs();
  await fs.writeFile(
    path.join(CACHE_DIR, `${key}.json`),
    JSON.stringify(result, null, 2),
    "utf8"
  );
}

