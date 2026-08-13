import { NextResponse } from 'next/server';

import { isDemoMode } from '@/lib/demo';
import { isModelConfigured } from '@/lib/extract/llm';
import { liturgicalDay } from '@/lib/liturgy/calendar';
import { explainDay } from '@/lib/liturgy/explain';
import { allRegions } from '@/lib/liturgy/regions';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/status` — what this deployment can and cannot currently do.
 *
 * Exists because most of what can go wrong with this app is a dependency being
 * unreachable, and the failure looks identical to "there are no churches near
 * you". Probing the two upstream services here turns a mystifying empty result
 * into a diagnosable one.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const probe = url.searchParams.get('probe') === '1';

  const services: Record<string, { reachable: boolean; detail: string }> = {};

  if (probe) {
    const checks: Array<[string, string]> = [
      ['overpass', 'https://overpass-api.de/api/status'],
      ['nominatim', 'https://nominatim.openstreetmap.org/status'],
    ];
    await Promise.all(
      checks.map(async ([name, target]) => {
        try {
          const res = await fetch(target, {
            headers: { 'User-Agent': 'MassFinder/0.1 status check' },
            signal: AbortSignal.timeout(8_000),
          });
          services[name] = {
            reachable: res.ok,
            detail: `HTTP ${res.status}`,
          };
        } catch (err) {
          services[name] = { reachable: false, detail: String(err) };
        }
      }),
    );
  }

  const today = liturgicalDay(new Date(), url.searchParams.get('country'));

  return NextResponse.json({
    ok: true,
    demoMode: isDemoMode(),
    modelConfigured: isModelConfigured(),
    modelId: process.env.MASSFINDER_MODEL ?? 'claude-opus-5',
    regionsWithRules: allRegions().length,
    regionConfidence: allRegions().reduce<Record<string, number>>((acc, r) => {
      acc[r.confidence] = (acc[r.confidence] ?? 0) + 1;
      return acc;
    }, {}),
    services: probe ? services : 'pass ?probe=1 to test upstream services',
    today: { day: today, explanation: explainDay(today) },
  });
}
