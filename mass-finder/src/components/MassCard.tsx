'use client';

import type { ChurchCard } from '@/lib/api-types';
import { formatDistance, usesImperial } from '@/lib/churches/geo';
import { RITE_LABELS } from '@/lib/churches/types';
import { directionsUrl, formatAddress, telUrl } from '@/lib/maps';
import { friendlyTime } from '@/lib/schedule/timezone';
import { themeStyle } from '@/lib/theme';

/**
 * One church, with its next Mass.
 *
 * The layout answers the four questions in the order they are asked, largest
 * first: **when**, **where**, **what** is this Mass, and **how do I get there**.
 * Everything else — later Masses, where the times came from, how to report a
 * mistake — sits below or behind a disclosure, so the first screenful is never
 * more than the four answers.
 */

const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

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

/** "Today", "Tomorrow", or "Sunday 17 August" — never a bare date. */
export function relativeDayLabel(isoDate: string, todayIso: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const today = new Date(Date.UTC(ty, tm - 1, td));
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  const weekday = WEEKDAY_LONG[date.getUTCDay()];
  const dayMonth = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  if (diff > 1 && diff < 7) return `${weekday} ${dayMonth}`;
  return `${weekday} ${dayMonth}`;
}

function minutesUntil(startsAt: string, now: Date): number {
  return Math.round((new Date(startsAt).getTime() - now.getTime()) / 60_000);
}

function urgencyLabel(startsAt: string, now: Date): string | undefined {
  const mins = minutesUntil(startsAt, now);
  if (mins < 0) return undefined;
  if (mins <= 60) return `Starts in ${mins} minute${mins === 1 ? '' : 's'}`;
  if (mins <= 180) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `Starts in ${h} hour${h === 1 ? '' : 's'} ${m} minutes` : `Starts in ${h} hours`;
  }
  return undefined;
}

export interface MassCardProps {
  card: ChurchCard;
  /** The local date at the church, so "Today" means today *there*. */
  todayIso: string;
  now: Date;
  origin?: { lat: number; lon: number };
  lead?: boolean;
  /** Link through to the full schedule. */
  href?: string;
}

export default function MassCard({
  card,
  todayIso,
  now,
  origin,
  lead,
  href,
}: MassCardProps) {
  const { church, next } = card;
  const imperial = usesImperial(church.countryCode);
  const address = formatAddress(church);

  return (
    <article
      className={`mass-card${lead ? ' mass-card-lead' : ''}${
        card.theme.fromPhoto ? ' mass-card-photo' : ''
      }`}
      style={themeStyle(card.theme)}
    >
      {/*
        The church's own band: its photograph if Commons has one, otherwise a
        stained-glass field derived from its identity — both tinted by the
        liturgical colour of the Mass being announced. Decorative, so it is hidden
        from assistive technology; the photograph proper, with its credit, sits
        further down where it can be described.
      */}
      <div className="card-crown" aria-hidden="true" />

      {church.example ? (
        <p className="notice notice-loud" style={{ marginBottom: '1rem' }}>
          Example data. This is not a real church and these are not real Mass times.
        </p>
      ) : null}

      {next ? (
        <>
          <p className="eyebrow">{lead ? 'Next Mass' : 'Next Mass here'}</p>
          <p className="mass-time">{friendlyTime(next.localTime)}</p>
          {/* The day label is the day you physically turn up, which for a vigil
              is not the day whose liturgy is celebrated. */}
          <p className="mass-when">
            {relativeDayLabel(localCalendarDate(next.startsAt, church.timezone), todayIso)}
            {urgencyLabel(next.startsAt, now) ? ` · ${urgencyLabel(next.startsAt, now)}` : ''}
          </p>
        </>
      ) : (
        <>
          <p className="eyebrow">Mass times</p>
          <p className="mass-time" style={{ fontSize: '2rem' }}>
            Not known yet
          </p>
        </>
      )}

      <h3 className="church-name">{church.name}</h3>
      {address ? <p className="church-meta">{address}</p> : null}
      {card.distanceMetres !== undefined ? (
        <p className="church-meta">{formatDistance(card.distanceMetres, imperial)}</p>
      ) : null}
      {church.rite !== 'roman' && church.rite !== 'unknown' ? (
        <p className="church-meta">{RITE_LABELS[church.rite]}</p>
      ) : null}

      {next ? (
        <>
          <div className="tag-row">
            {next.isVigil ? <span className="tag">Vigil Mass</span> : null}
            {next.day.isHolyDayOfObligation ? (
              <span className="tag tag-obligation">Day of obligation</span>
            ) : null}
            {next.language ? (
              <span className="tag">
                In {LANGUAGE_NAMES[next.language] ?? next.language}
              </span>
            ) : null}
            {next.form === 'traditional-latin' ? (
              <span className="tag">Traditional Latin Mass</span>
            ) : null}
            {next.note ? <span className="tag">{next.note}</span> : null}
          </div>

          <p className="mass-what">
            <strong>{next.day.celebration.name}.</strong>{' '}
            {card.massDescription}
          </p>
        </>
      ) : null}

      <div className={`btn-row${church.phone ? ' btn-row-2' : ''}`}>
        <a
          className="btn btn-primary"
          href={directionsUrl(church, { origin })}
          target="_blank"
          rel="noreferrer"
        >
          Get directions and travel time
        </a>
        {church.phone ? (
          <a className="btn btn-secondary" href={telUrl(church.phone)}>
            Ring the parish
          </a>
        ) : null}
      </div>

      {church.photo ? (
        <figure className="church-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={church.photo.url}
            alt={`${church.name}, photographed`}
            loading="lazy"
            width={640}
            height={360}
          />
          {/*
            The credit is not optional. Commons images are freely licensed, and
            nearly every one of those licences requires naming the author. An app
            built on showing where its facts came from cannot strip a
            photographer's name off their picture.
          */}
          <figcaption>
            <a href={church.photo.sourceUrl} target="_blank" rel="noreferrer">
              Photo
            </a>
            {church.photo.author ? ` by ${church.photo.author}` : ''}
            {church.photo.license ? ` · ${church.photo.license}` : ''}
            {' · via Wikimedia Commons'}
          </figcaption>
        </figure>
      ) : null}

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
          <p className="where-else-lead">Where else you can look:</p>
          <ul className="where-else-list">
            {card.whereElseToLook.map((link) => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {card.upcoming.length ? (
        <details>
          <summary>Show more Mass times at this church</summary>
          <div className="details-body">
            <ul className="time-list">
              {card.upcoming.map((o) => (
                <li className="time-row" key={`${o.startsAt}-${o.ruleId}`}>
                  <span className="time-row-time">{friendlyTime(o.localTime)}</span>
                  <span className="time-row-detail">
                    {relativeDayLabel(
                      localCalendarDate(o.startsAt, church.timezone),
                      todayIso,
                    )}
                    {o.isVigil ? ' · Vigil' : ''}
                    {o.language ? ` · ${LANGUAGE_NAMES[o.language] ?? o.language}` : ''}
                    {o.note ? ` · ${o.note}` : ''}
                    <br />
                    {o.day.celebration.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}

      {next ? (
        <details>
          <summary>Where did this time come from?</summary>
          <div className="details-body">
            <p>
              {next.source.kind === 'parish-website'
                ? 'Read from the parish’s own website.'
                : next.source.kind === 'parish-bulletin'
                  ? 'Read from a parish bulletin or newsletter.'
                  : next.source.kind === 'openstreetmap'
                    ? 'From OpenStreetMap, a community-maintained map. Not from the parish.'
                    : next.source.kind === 'user-report'
                      ? 'Confirmed by somebody who went to this church.'
                      : 'From bundled example data.'}
            </p>
            {next.source.quote ? (
              <>
                <p>This is exactly what the source said:</p>
                <p className="source-quote">“{next.source.quote}”</p>
              </>
            ) : null}
            {next.source.url ? (
              <p>
                <a href={next.source.url} target="_blank" rel="noreferrer">
                  Open the source page
                </a>
              </p>
            ) : null}
            <p>Last checked: {formatCheckedAt(card.lastCheckedAt)}</p>
          </div>
        </details>
      ) : null}

      {href ? (
        <a className="btn btn-quiet" href={href}>
          See the full timetable for this church
        </a>
      ) : null}
    </article>
  );
}

function formatCheckedAt(iso?: string): string {
  if (!iso) return 'not recorded';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'not recorded';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** The calendar date, in the church's timezone, on which a Mass is celebrated. */
function localCalendarDate(startsAt: string, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(startsAt));
    return parts;
  } catch {
    return startsAt.slice(0, 10);
  }
}
