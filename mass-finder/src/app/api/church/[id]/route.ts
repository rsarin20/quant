import { NextResponse } from 'next/server';

import { churchDetail } from '@/lib/service';

export const dynamic = 'force-dynamic';
/**
 * Reading a dozen parish websites does not fit in the 10-second default. The
 * service layer stops itself at 22 seconds, well inside this, so the function
 * returns partial results under its own control rather than being killed.
 */
export const maxDuration = 60;

/** `GET /api/church/{id}?refresh=1&days=14` — full schedule for one church. */
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const url = new URL(request.url);
  const refresh = url.searchParams.get('refresh') === '1';
  const days = Math.min(Number(url.searchParams.get('days')) || 14, 60);
  const id = decodeURIComponent(params.id);

  try {
    const detail = await churchDetail({ churchId: id, refresh, days });
    if (!detail) {
      return NextResponse.json(
        {
          error:
            'We do not have a record of that church. Search again from the home page and tap it from the results.',
        },
        { status: 404 },
      );
    }
    return NextResponse.json(detail);
  } catch (err) {
    return NextResponse.json(
      { error: `Something went wrong loading that church: ${String(err)}` },
      { status: 500 },
    );
  }
}
