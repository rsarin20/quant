import { NextResponse } from 'next/server';

import { nearby } from '@/lib/service';

export const dynamic = 'force-dynamic';
/**
 * Reading a dozen parish websites does not fit in the 10-second default. The
 * service layer stops itself at 22 seconds, well inside this, so the function
 * returns partial results under its own control rather than being killed.
 */
export const maxDuration = 60;

/**
 * `GET /api/nearby?lat=&lon=&radius=&limit=&schedules=1`
 *
 * `schedules=1` allows the request to read parish websites for churches whose
 * times we do not have cached. That is slow and hits other people's servers, so
 * the service layer caps how many it will do per request and the client asks for
 * it deliberately rather than by default.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json(
      { error: 'Please give a valid lat and lon.' },
      { status: 400 },
    );
  }

  const radius = Math.min(Number(url.searchParams.get('radius')) || 5_000, 50_000);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 12, 40);
  const fetchSchedules = url.searchParams.get('schedules') === '1';

  try {
    const result = await nearby({ point: { lat, lon }, radiusMetres: radius, limit, fetchSchedules });
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Something went wrong searching for churches: ${String(err)}` },
      { status: 500 },
    );
  }
}
