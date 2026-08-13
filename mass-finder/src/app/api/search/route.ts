import { NextResponse } from 'next/server';

import { geocode } from '@/lib/churches/geocode';
import { isDemoMode } from '@/lib/demo';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/search?q=`
 *
 * Place-name lookup, so that "type where you are" works for anyone who will not
 * or cannot share their location — which, for the audience this app is built for,
 * is most of them.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q') ?? '';
  if (q.trim().length < 2) {
    return NextResponse.json({ places: [] });
  }

  if (isDemoMode()) {
    return NextResponse.json({
      places: [
        {
          displayName: 'Demo City (example location — demonstration mode)',
          lat: 53.3498,
          lon: -6.2603,
          countryCode: 'IE',
        },
      ],
    });
  }

  try {
    const places = await geocode(q, {
      limit: 5,
      acceptLanguage: request.headers.get('accept-language') ?? undefined,
    });
    return NextResponse.json({ places });
  } catch (err) {
    return NextResponse.json(
      { error: `We could not look up that place just now: ${String(err)}`, places: [] },
      { status: 502 },
    );
  }
}
