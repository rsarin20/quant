import type { Church } from '../churches/types';
import { addDays, isoDate, parseIsoDate, weekdayOf } from '../liturgy/computus';
import { liturgicalDay } from '../liturgy/calendar';
import type { LiturgicalDay } from '../liturgy/types';
import { localDateIn, parseTime, zonedTimeToInstant } from './timezone';
import type { ChurchSchedule, MassOccurrence, MassRule, Weekday } from './types';

/**
 * Turning rules into Mass times.
 *
 * The resolver walks forward day by day through the church's *local* calendar,
 * asks each rule whether it fires, and works out which liturgy the resulting
 * Mass actually celebrates. Two subtleties carry most of the value:
 *
 * **Vigils.** A Mass on Saturday evening celebrates Sunday. Canon 1248 §1 says
 * a Mass "in the evening of the preceding day" satisfies the obligation, so a
 * person who asks for Sunday Mass must be shown that Saturday Mass. Resolving it
 * as a Saturday event would hide it.
 *
 * **Days when Mass may not be celebrated.** On Good Friday there is no Mass
 * anywhere on earth. On Holy Saturday there is none until the Vigil after
 * nightfall. A parish's ordinary "Friday 10:00" rule must not be projected onto
 * Good Friday — that would send someone to a locked church on one of the
 * highest-attendance days of the year, which is exactly the failure this app
 * exists to prevent.
 */

/** After this hour, a Mass counts as "evening" for vigil and Triduum purposes. */
const EVENING_HOUR = 16;
/** The Easter Vigil must begin after nightfall; earlier is not a Vigil Mass. */
const NIGHTFALL_HOUR = 19;

export interface ResolveOptions {
  /** Start of the window. Defaults to now. */
  from?: Date;
  /** How many local days to scan. */
  days?: number;
  /** Cap on returned occurrences. */
  limit?: number;
  /** Drop rules below this confidence. */
  minConfidence?: number;
}

function ruleAppliesOnDate(
  rule: MassRule,
  localDate: string,
  celebratedDay: LiturgicalDay,
): boolean {
  if (rule.exceptDates?.includes(localDate)) return false;
  if (rule.validFrom && localDate < rule.validFrom) return false;
  if (rule.validTo && localDate > rule.validTo) return false;
  if (rule.onlyInSeason && !rule.onlyInSeason.includes(celebratedDay.season)) return false;

  const date = parseIsoDate(localDate);
  switch (rule.kind) {
    case 'weekly':
      return !!rule.weekdays?.includes(weekdayOf(date) as Weekday);
    case 'annual-date':
      return (
        !!rule.monthDay &&
        date.getUTCMonth() + 1 === rule.monthDay.month &&
        date.getUTCDate() === rule.monthDay.day
      );
    case 'liturgical':
      return !!rule.celebrationId && celebratedDay.celebration.id === rule.celebrationId;
    case 'one-off':
      return rule.date === localDate;
    default:
      return false;
  }
}

/**
 * Whether Mass may be celebrated on this calendar day at this hour.
 *
 * The restriction attaches to the calendar day on which the Mass is physically
 * celebrated, not to the liturgy it belongs to — which is why the Easter Vigil,
 * a Mass of Easter Sunday, is nonetheless governed by Holy Saturday's rule.
 */
function massPermitted(calendarDay: LiturgicalDay, hour: number): boolean {
  switch (calendarDay.massRestriction) {
    case 'none':
      return false;
    case 'vigil-only':
      return hour >= NIGHTFALL_HOUR;
    case 'evening-only':
      return hour >= EVENING_HOUR;
    default:
      return true;
  }
}

/**
 * Which liturgy a Mass celebrates.
 *
 * An explicitly-marked anticipated Mass takes the following day's liturgy. An
 * unmarked evening Mass on the day before a Sunday or holy day is *also* very
 * likely a vigil — parishes routinely list "Saturday 6pm" without the word
 * vigil — so we treat a late Saturday Mass as anticipating Sunday. We do not
 * extend that guess to ordinary weekdays, where an evening Mass is simply an
 * evening Mass.
 */
function celebratedLiturgy(
  rule: MassRule,
  calendarDate: string,
  hour: number,
  countryCode: string | undefined,
): { day: LiturgicalDay; isVigil: boolean } {
  const date = parseIsoDate(calendarDate);
  const sameDay = liturgicalDay(date, countryCode);

  if (rule.anticipates === 'next-day') {
    return { day: liturgicalDay(addDays(date, 1), countryCode), isVigil: true };
  }
  if (typeof rule.anticipates === 'object' && rule.anticipates.celebrationId) {
    // Search a window for the celebration this Mass anticipates.
    for (let i = 0; i <= 2; i += 1) {
      const candidate = liturgicalDay(addDays(date, i), countryCode);
      if (candidate.celebration.id === rule.anticipates.celebrationId) {
        return { day: candidate, isVigil: i > 0 };
      }
    }
    return { day: sameDay, isVigil: false };
  }

  const nextDay = liturgicalDay(addDays(date, 1), countryCode);
  const isSaturdayEveningBeforeSunday =
    sameDay.weekday === 6 && hour >= EVENING_HOUR && nextDay.weekday === 0;
  if (isSaturdayEveningBeforeSunday) {
    return { day: nextDay, isVigil: true };
  }

  return { day: sameDay, isVigil: false };
}

/**
 * Resolve a schedule into concrete Mass occurrences, soonest first.
 */
export function resolveOccurrences(
  church: Church,
  schedule: ChurchSchedule,
  opts: ResolveOptions = {},
): MassOccurrence[] {
  const from = opts.from ?? new Date();
  const days = opts.days ?? 14;
  const limit = opts.limit ?? 40;
  const minConfidence = opts.minConfidence ?? 0;
  const tz = church.timezone || 'UTC';
  const country = church.countryCode;

  const out: MassOccurrence[] = [];
  const seen = new Set<string>();

  // Start from the church's own local date, and step back one day so a vigil
  // Mass celebrated last night but belonging to today is still considered.
  const startLocal = parseIsoDate(localDateIn(from, tz));

  for (let i = -1; i < days; i += 1) {
    const dayDate = addDays(startLocal, i);
    const localDate = isoDate(dayDate);
    const calendarDay = liturgicalDay(dayDate, country);

    for (const rule of schedule.rules) {
      if (rule.confidence < minConfidence) continue;

      const parsed = parseTime(rule.time);
      if (!parsed) continue;

      const { day: celebrated, isVigil } = celebratedLiturgy(
        rule,
        localDate,
        parsed.hour,
        country,
      );

      if (!ruleAppliesOnDate(rule, localDate, celebrated)) continue;
      if (!massPermitted(calendarDay, parsed.hour)) continue;

      const startsAt = zonedTimeToInstant(
        dayDate.getUTCFullYear(),
        dayDate.getUTCMonth() + 1,
        dayDate.getUTCDate(),
        parsed.hour,
        parsed.minute,
        tz,
      );
      if (startsAt.getTime() < from.getTime()) continue;

      // Two rules can describe the same Mass — an OSM tag and a website scrape,
      // say. Keep the higher-confidence one rather than showing it twice.
      const key = `${startsAt.toISOString()}|${rule.language ?? ''}`;
      const existingIndex = out.findIndex(
        (o) => `${o.startsAt}|${o.language ?? ''}` === key,
      );
      if (existingIndex >= 0) {
        if (out[existingIndex].confidence >= rule.confidence) continue;
        out.splice(existingIndex, 1);
      } else if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      out.push({
        churchId: church.id,
        startsAt: startsAt.toISOString(),
        localTime: rule.time.padStart(5, '0'),
        liturgicalDate: celebrated.date,
        isVigil,
        day: celebrated,
        language: rule.language,
        form: rule.form,
        note: rule.note,
        confidence: rule.confidence,
        source: rule.source,
        ruleId: rule.id,
      });
    }
  }

  out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return out.slice(0, limit);
}

/** The single next Mass, or undefined if the schedule yields none in the window. */
export function nextMass(
  church: Church,
  schedule: ChurchSchedule,
  opts: ResolveOptions = {},
): MassOccurrence | undefined {
  return resolveOccurrences(church, schedule, { ...opts, limit: 1 })[0];
}

/**
 * The next Mass that satisfies a Sunday or holy-day obligation — the question
 * most people are actually asking when they look for "Mass". Includes vigils.
 */
export function nextObligationMass(
  church: Church,
  schedule: ChurchSchedule,
  opts: ResolveOptions = {},
): MassOccurrence | undefined {
  return resolveOccurrences(church, schedule, { ...opts, limit: 200 }).find(
    (o) => o.day.isHolyDayOfObligation,
  );
}

/** Group occurrences by the local calendar date on which they are celebrated. */
export function groupByLocalDate(
  occurrences: MassOccurrence[],
  timeZone: string,
): Array<{ date: string; occurrences: MassOccurrence[] }> {
  const map = new Map<string, MassOccurrence[]>();
  for (const o of occurrences) {
    const date = localDateIn(new Date(o.startsAt), timeZone);
    const list = map.get(date);
    if (list) list.push(o);
    else map.set(date, [o]);
  }
  return Array.from(map.entries())
    .map(([date, list]) => ({ date, occurrences: list }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
