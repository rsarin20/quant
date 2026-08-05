import { kvEnabled, kvIncrWithTtl } from "./kv";

// ---------------------------------------------------------------------------
// Cost + abuse guardrails for the beta. Two layers:
//   1. Global daily cap on LIVE model calls (protects your API spend). Backed by
//      a KV counter when available, else a best-effort in-memory counter.
//   2. Per-IP short-window limit (best-effort, per warm instance) to blunt a
//      single abuser.
// Both are checked only right before a real (paid) call — cached/seeded reads
// are always free and never counted.
// ---------------------------------------------------------------------------

const DAILY_CAP = Number(process.env.MAX_LIVE_QUERIES_PER_DAY || 500);
const IP_WINDOW_MS = 60_000;
const IP_MAX = Number(process.env.MAX_LIVE_QUERIES_PER_MINUTE_PER_IP || 12);

let memDaily = { date: "", count: 0 };
const ipHits = new Map<string, { count: number; resetAt: number }>();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export type GuardResult = { ok: boolean; reason?: string };

export async function guardLiveCall(ip: string): Promise<GuardResult> {
  // Per-IP first (cheap, local).
  const now = Date.now();
  const rec = ipHits.get(ip);
  if (!rec || rec.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + IP_WINDOW_MS });
  } else {
    rec.count += 1;
    if (rec.count > IP_MAX) {
      return {
        ok: false,
        reason: `Rate limit: max ${IP_MAX} live measurements/minute. Give it a moment and try again.`,
      };
    }
  }

  // Global daily cap.
  try {
    if (kvEnabled()) {
      const n = await kvIncrWithTtl(`spend:${today()}`, 60 * 60 * 26);
      if (n > DAILY_CAP) {
        return { ok: false, reason: dailyMessage() };
      }
    } else {
      const d = today();
      if (memDaily.date !== d) memDaily = { date: d, count: 0 };
      memDaily.count += 1;
      if (memDaily.count > DAILY_CAP) return { ok: false, reason: dailyMessage() };
    }
  } catch {
    // If the counter backend fails, don't hard-block the product — fail open.
    return { ok: true };
  }

  return { ok: true };
}

function dailyMessage(): string {
  return `Daily measurement limit reached (${DAILY_CAP}). This keeps API costs bounded during the beta — it resets tomorrow. Cached and seeded results still work.`;
}
