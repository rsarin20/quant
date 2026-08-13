'use client';

import { useState } from 'react';

import type { ChurchDetailResponse } from '@/lib/api-types';
import { RITE_LABELS } from '@/lib/churches/types';
import { directionsUrl, formatAddress, mapUrl, telUrl } from '@/lib/maps';
import { friendlyTime } from '@/lib/schedule/timezone';

import { relativeDayLabel } from './MassCard';

/**
 * One church's full timetable, day by day, with each day's liturgy explained.
 *
 * This is the page for the person who is planning rather than rushing: which day
 * is the feast, is there a Saturday evening Mass, is anything different this week.
 * Every day carries its own explanation, because "the Third Sunday of Advent" and
 * "Ash Wednesday" mean very different things about whether you need to be there
 * and what will happen when you are.
 */

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  pl: 'Polish',
  pt: 'Portuguese',
  it: 'Italian',
  fr: 'French',
  de: 'German',
  vi: 'Vietnamese',
  tl: 'Tagalog',
  ko: 'Korean',
  zh: 'Chinese',
  ml: 'Malayalam',
  ta: 'Tamil',
  la: 'Latin',
};

export default function ChurchDetail({ detail }: { detail: ChurchDetailResponse }) {
  const { card, byDate } = detail;
  const church = card.church;
  const address = formatAddress(church);
  const todayIso = byDate[0]?.date ?? new Date().toISOString().slice(0, 10);

  const [reportState, setReportState] = useState<string>();
  const [reporting, setReporting] = useState(false);

  async function report(kind: 'times-correct' | 'times-wrong') {
    setReporting(true);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ churchId: church.id, kind }),
      });
      const body = await res.json();
      setReportState(body.message ?? 'Thank you.');
    } catch {
      setReportState('We could not save that just now, but thank you.');
    } finally {
      setReporting(false);
    }
  }

  return (
    <main>
      <a className="btn btn-quiet" href="/">
        ← Back to search
      </a>

      <h1>{church.name}</h1>
      {address ? <p className="church-meta">{address}</p> : null}
      {church.rite !== 'roman' && church.rite !== 'unknown' ? (
        <p className="church-meta">{RITE_LABELS[church.rite]}</p>
      ) : null}

      {church.example ? (
        <p className="notice notice-loud">
          Example data. This is not a real church and these are not real Mass times.
        </p>
      ) : null}

      {detail.notices.map((n) => (
        <p className="notice" key={n}>
          {n}
        </p>
      ))}

      <div className="btn-row btn-row-2">
        <a
          className="btn btn-primary"
          href={directionsUrl(church)}
          target="_blank"
          rel="noreferrer"
        >
          Get directions and travel time
        </a>
        {church.phone ? (
          <a className="btn btn-secondary" href={telUrl(church.phone)}>
            Ring the parish
          </a>
        ) : (
          <a className="btn btn-secondary" href={mapUrl(church)} target="_blank" rel="noreferrer">
            Show on the map
          </a>
        )}
      </div>

      <div
        className={`reliability reliability-${card.reliability.tone}`}
        role={card.reliability.tone === 'poor' ? 'alert' : undefined}
      >
        <strong>
          {card.reliability.tone === 'good'
            ? 'Reliable:'
            : card.reliability.tone === 'fair'
              ? 'Take care:'
              : 'Warning:'}
        </strong>
        <span>{card.reliability.text}</span>
      </div>

      {card.whereElseToLook?.length ? (
        <div className="where-else">
          <p className="where-else-lead">
            We could not find Mass times for this church. Here is where else to look:
          </p>
          <ul className="where-else-list">
            {card.whereElseToLook.map((link) => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          {church.phone ? (
            <p style={{ margin: '0.75rem 0 0' }}>
              The surest answer is the parish itself:{' '}
              <a href={telUrl(church.phone)}>{church.phone}</a>
            </p>
          ) : null}
        </div>
      ) : null}

      {church.website ? (
        <p style={{ marginTop: '1rem' }}>
          <a href={church.website} target="_blank" rel="noreferrer">
            Open the parish’s own website
          </a>
        </p>
      ) : null}

      <h2 style={{ marginTop: '2rem' }}>Mass times</h2>

      {byDate.length === 0 ? (
        <p className="notice">
          We do not have any Mass times for this church.
          {church.phone
            ? ' Please ring the parish on the number above.'
            : ' Please look for the parish’s own website or notice board.'}
        </p>
      ) : null}

      {byDate.map((group) => (
        <section className="day-group" key={group.date}>
          <p className="day-heading">
            {relativeDayLabel(group.date, todayIso)}
            {group.day.isHolyDayOfObligation ? ' — day of obligation' : ''}
          </p>
          <p className="day-sub">
            {group.explanation.title} · {group.explanation.kind}
          </p>

          {group.explanation.warning ? (
            <p className="notice notice-loud">{group.explanation.warning}</p>
          ) : null}

          <ul className="time-list">
            {group.occurrences.map((o) => (
              <li className="time-row" key={`${o.startsAt}-${o.ruleId}`}>
                <span className="time-row-time">{friendlyTime(o.localTime)}</span>
                <span className="time-row-detail">
                  {o.isVigil ? `Vigil — counts for ${o.day.celebration.name}. ` : ''}
                  {o.language ? `In ${LANGUAGE_NAMES[o.language] ?? o.language}. ` : ''}
                  {o.form === 'traditional-latin' ? 'Traditional Latin Mass. ' : ''}
                  {o.note ? `${o.note}. ` : ''}
                  {o.source.quote ? (
                    <details>
                      <summary>Source</summary>
                      <div className="details-body">
                        <p className="source-quote">“{o.source.quote}”</p>
                        {o.source.url ? (
                          <a href={o.source.url} target="_blank" rel="noreferrer">
                            Open the source
                          </a>
                        ) : null}
                      </div>
                    </details>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>

          <details>
            <summary>What is being celebrated?</summary>
            <div className="details-body">
              <p>{group.explanation.what}</p>
              {group.explanation.obligation ? (
                <p>
                  <strong>{group.explanation.obligation}</strong>
                </p>
              ) : null}
              <p>{group.explanation.season}</p>
              {group.day.alsoToday.length ? (
                <p>Also remembered: {group.day.alsoToday.map((c) => c.name).join('; ')}.</p>
              ) : null}
            </div>
          </details>
        </section>
      ))}

      <section style={{ marginTop: '2.5rem' }}>
        <h2>Were these times right?</h2>
        <p>
          Telling us helps the next person. We will warn other people if the times
          turn out to be wrong.
        </p>
        {reportState ? (
          <p className="notice" role="status">
            {reportState}
          </p>
        ) : (
          <div className="btn-row btn-row-2">
            <button
              className="btn btn-secondary"
              onClick={() => report('times-correct')}
              disabled={reporting}
            >
              Yes, these were right
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => report('times-wrong')}
              disabled={reporting}
            >
              No, these were wrong
            </button>
          </div>
        )}
      </section>

      {detail.diagnostics &&
      (detail.diagnostics.problems.length || detail.diagnostics.observations.length) ? (
        <details style={{ marginTop: '1.5rem' }}>
          <summary>How we found these times</summary>
          <div className="details-body">
            {detail.diagnostics.observations.map((o) => (
              <p key={o}>{o}</p>
            ))}
            {detail.diagnostics.pagesRead.length ? (
              <p>Pages read: {detail.diagnostics.pagesRead.join(', ')}</p>
            ) : null}
            {detail.diagnostics.modelUsed ? (
              <p>Read with the help of a language model, then checked against the page text.</p>
            ) : null}
            {detail.diagnostics.problems.length ? (
              <>
                <p>Problems we ran into:</p>
                <ul>
                  {detail.diagnostics.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </details>
      ) : null}

      <footer>
        <p>{detail.attribution}</p>
        <p>
          If a time matters — a funeral, a feast day, a long journey — please ring the
          parish first.
        </p>
      </footer>
    </main>
  );
}
