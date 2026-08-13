/**
 * Gregorian Easter and the civil-date helpers the liturgical year is built from.
 *
 * Everything in the Roman calendar that moves, moves relative to one of two
 * anchors: Easter Sunday (the Paschal cycle) or Christmas Day (the Advent /
 * Christmas cycle). Get those two right and the rest is arithmetic.
 */

/** A calendar date with no time and no timezone. The unit of the liturgical year. */
export interface CivilDate {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
}

/** 0 = Sunday … 6 = Saturday, matching JS `getUTCDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/**
 * Dates are handled as UTC-midnight Date objects throughout the liturgy engine.
 * A liturgical day is a calendar day, not an instant, so pinning to UTC keeps
 * arithmetic exact and independent of the server's timezone. Conversion to a
 * parish's local wall clock happens later, in the schedule resolver.
 */
export function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

export function toCivil(d: Date): CivilDate {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function fromCivil(c: CivilDate): Date {
  return utc(c.year, c.month, c.day);
}

const MS_PER_DAY = 86_400_000;

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

export function weekdayOf(d: Date): Weekday {
  return d.getUTCDay() as Weekday;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

/** ISO `YYYY-MM-DD` — the key format used everywhere a date identifies a record. */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseIsoDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Not an ISO date: ${s}`);
  return utc(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** The next `weekday` strictly after `d` (never `d` itself). */
export function nextWeekdayAfter(d: Date, weekday: Weekday): Date {
  const diff = (weekday - weekdayOf(d) + 7) % 7 || 7;
  return addDays(d, diff);
}

/** `d` itself if it is `weekday`, else the next one. */
export function weekdayOnOrAfter(d: Date, weekday: Weekday): Date {
  const diff = (weekday - weekdayOf(d) + 7) % 7;
  return addDays(d, diff);
}

/** `d` itself if it is `weekday`, else the previous one. */
export function weekdayOnOrBefore(d: Date, weekday: Weekday): Date {
  const diff = (weekdayOf(d) - weekday + 7) % 7;
  return addDays(d, -diff);
}

/**
 * Easter Sunday in the Gregorian calendar (the anonymous Gregorian algorithm,
 * as given by Meeus). Valid for all Gregorian years.
 *
 * Easter is the Sunday after the first ecclesiastical full moon on or after
 * 21 March. The algorithm computes that lunar date arithmetically rather than
 * astronomically, which is what the Church actually uses — so the result is the
 * liturgically correct date, not an approximation of one.
 */
export function gregorianEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const g = Math.floor((8 * b + 13) / 25);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 19 * l) / 433);
  const month = Math.floor((h + l - 7 * m + 90) / 25);
  const day = (h + l - 7 * m + 33 * month + 19) % 32;
  return utc(year, month, day);
}

/**
 * Julian-calendar Easter mapped onto the Gregorian calendar — the date most
 * Eastern churches keep. Included because several Eastern Catholic churches
 * (and Latin parishes in places like Greece, Jordan and Israel) follow it, and
 * because a Mass finder that silently assumes Gregorian Easter would be wrong
 * for them roughly four years in five.
 */
export function julianEaster(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  // The result is a Julian date; convert to Gregorian by adding the current
  // offset between the calendars (13 days for 1900-2099).
  const julianDay = utc(year, month, day);
  const century = Math.floor(year / 100);
  const offset = century - Math.floor(century / 4) - 2;
  return addDays(julianDay, offset);
}
