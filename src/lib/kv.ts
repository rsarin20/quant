// ---------------------------------------------------------------------------
// Minimal, dependency-free client for Vercel KV / Upstash Redis over their REST
// API. Values live server-side only (unlike public Blob), so private fields such
// as groundTruthNotes never leak. Enabled automatically when a KV store is
// connected to the project (Vercel injects KV_REST_API_URL + KV_REST_API_TOKEN).
// ---------------------------------------------------------------------------

const URL_ENV = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN_ENV =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export function kvEnabled(): boolean {
  return Boolean(URL_ENV && TOKEN_ENV);
}

async function command<T = unknown>(args: (string | number)[]): Promise<T> {
  if (!URL_ENV || !TOKEN_ENV) throw new Error("KV not configured");
  const res = await fetch(URL_ENV, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN_ENV}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`KV ${args[0]} failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  const data = (await res.json()) as { result: T; error?: string };
  if (data.error) throw new Error(`KV ${args[0]} error: ${data.error}`);
  return data.result;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const raw = await command<string | null>(["GET", key]);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await command(["SET", key, JSON.stringify(value)]);
}

export async function kvDel(key: string): Promise<void> {
  await command(["DEL", key]);
}

export async function kvSAdd(key: string, member: string): Promise<void> {
  await command(["SADD", key, member]);
}

export async function kvSRem(key: string, member: string): Promise<void> {
  await command(["SREM", key, member]);
}

export async function kvSMembers(key: string): Promise<string[]> {
  return (await command<string[]>(["SMEMBERS", key])) || [];
}

// Increment a counter and return the new value; sets a TTL on first write so
// daily counters expire on their own.
export async function kvIncrWithTtl(key: string, ttlSeconds: number): Promise<number> {
  const n = await command<number>(["INCR", key]);
  if (n === 1) await command(["EXPIRE", key, ttlSeconds]);
  return n;
}
