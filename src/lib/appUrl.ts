import { headers } from "next/headers";

// Resolve the app's own public origin. Used to build the canonical profile URL
// that we tell candidates (and models) to fetch. Priority:
//   1. APP_URL / NEXT_PUBLIC_APP_URL env (set this to your public deploy/tunnel)
//   2. request headers (host + proto) — works on the current host
export function getAppUrl(): string {
  const env = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  try {
    const h = headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    const proto = h.get("x-forwarded-proto") || "http";
    if (host) return `${proto}://${host}`;
  } catch {
    /* headers() unavailable outside request scope */
  }
  return "http://localhost:3000";
}
