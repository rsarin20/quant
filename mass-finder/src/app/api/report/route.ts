import { NextResponse } from 'next/server';

import { appendUserReport, readUserReports, reportSummary, type UserReport } from '@/lib/store';

export const dynamic = 'force-dynamic';

const KINDS: UserReport['kind'][] = [
  'times-correct',
  'times-wrong',
  'church-closed',
  'not-catholic',
  'correction',
];

/**
 * `POST /api/report` — a person telling us whether the times were right.
 *
 * This is the loop that eventually makes the data trustworthy. Someone walking
 * out of a church knows more than any scraper, and one report of "these times are
 * wrong" is enough for the app to stop presenting that schedule as reliable.
 *
 * Reports are append-only and carry no identity — we want the correction, not the
 * person.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const { churchId, kind, detail } = (body ?? {}) as {
    churchId?: string;
    kind?: string;
    detail?: string;
  };

  if (!churchId || typeof churchId !== 'string') {
    return NextResponse.json({ error: 'churchId is required.' }, { status: 400 });
  }
  if (!kind || !KINDS.includes(kind as UserReport['kind'])) {
    return NextResponse.json(
      { error: `kind must be one of: ${KINDS.join(', ')}` },
      { status: 400 },
    );
  }

  const report: UserReport = {
    churchId,
    kind: kind as UserReport['kind'],
    detail: typeof detail === 'string' ? detail.slice(0, 1_000) : undefined,
    reportedAt: new Date().toISOString(),
  };

  await appendUserReport(report);
  const summary = reportSummary(await readUserReports(churchId));

  return NextResponse.json({
    ok: true,
    summary,
    message:
      report.kind === 'times-wrong' || report.kind === 'church-closed'
        ? 'Thank you. We have flagged these times so other people are warned.'
        : 'Thank you. That helps everyone who looks this church up.',
  });
}
