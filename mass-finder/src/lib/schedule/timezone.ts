/**
 * Wall-clock ↔ instant conversion for an arbitrary IANA timezone, using only
 * `Intl` — no timezone library, no data to keep up to date.
 *
 * This matters more than it looks. A Mass time is a wall-clock time in the
 * parish's own zone ("Sunday at 10:30"), but "when is the next Mass" is a
 * question about instants, and the user may be in a different zone, or in the
 * same zone on the morning the clocks changed. Getting this wrong is silent:
 * the app shows a plausible time that is an hour off.
 */

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

/** The zone's offset from UTC, in milliseconds, at a given instant. */
export function offsetMsAt(instant: Date, timeZone: string): number {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  // `asUtc` is the local wall-clock reading treated as if it were UTC, so the
  // difference from the true instant is exactly the offset.
  return asUtc - instant.getTime() + (instant.getMilliseconds() ? 0 : 0);
}

/**
 * A local wall-clock time in `timeZone`, as an absolute instant.
 *
 * Solved by one correction step: guess that the local reading is UTC, measure
 * the offset there, apply it, then re-measure in case the first guess landed on
 * the far side of a daylight-saving transition.
 *
 * Ambiguous and non-existent local times (the hour that repeats, and the hour
 * that vanishes, when clocks change) resolve to a real instant rather than
 * throwing. A parish that genuinely schedules Mass inside the skipped hour is a
 * problem for the parish, not for the person trying to find it.
 */
export function zonedTimeToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstOffset = offsetMsAt(new Date(naive), timeZone);
  let ts = naive - firstOffset;
  const secondOffset = offsetMsAt(new Date(ts), timeZone);
  if (secondOffset !== firstOffset) {
    ts = naive - secondOffset;
  }
  return new Date(ts);
}

/** The calendar date in `timeZone` at a given instant, as `YYYY-MM-DD`. */
export function localDateIn(instant: Date, timeZone: string): string {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** The wall-clock time in `timeZone` at a given instant, as `HH:MM`. */
export function localTimeIn(instant: Date, timeZone: string): string {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('hour')}:${get('minute')}`;
}

/** Parse `HH:MM` (or `H:MM`) into hours and minutes. */
export function parseTime(hhmm: string): { hour: number; minute: number } | undefined {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return undefined;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return undefined;
  return { hour, minute };
}

/**
 * Format a time the way an older reader expects to see it, in their own locale.
 * `12:00` becomes "12 noon" and `00:00` "midnight", because "12:00 AM" is a
 * genuine source of confusion and Christmas Midnight Mass is one of the times
 * people most need to get right.
 */
export function friendlyTime(hhmm: string, locale = 'en-GB'): string {
  const parsed = parseTime(hhmm);
  if (!parsed) return hhmm;
  const { hour, minute } = parsed;
  if (hour === 12 && minute === 0) return '12 noon';
  if (hour === 0 && minute === 0) return 'Midnight';
  const d = new Date(Date.UTC(2000, 0, 1, hour, minute));
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(d);
  } catch {
    return hhmm;
  }
}
