import type { SourceRef } from '../churches/types';
import type { LiturgicalDay } from '../liturgy/types';

/**
 * The Mass schedule model.
 *
 * A parish schedule is not a list of times. It is a small set of *rules*, and
 * the rules have shapes that a flat list cannot express:
 *
 *  - "Sundays 8:00, 10:30, 18:00" — weekly, repeating.
 *  - "Saturday 18:00 (Vigil)" — a Sunday Mass celebrated on Saturday. It
 *    satisfies the Sunday obligation, and if we model it as "a Saturday Mass"
 *    we will tell someone who needs Sunday Mass that there isn't one.
 *  - "Christmas Eve 20:00, Midnight" — keyed to a liturgical day, not a date.
 *  - "Ascension 7:00, 19:00" — a date that moves every year, and differs by
 *    country.
 *  - "Mass at 9:00 during school term only" — seasonal validity.
 *  - "10:30 Mass in Polish" — language, which for a migrant is the whole point.
 *
 * So a rule is a small union, and the resolver walks the liturgical calendar to
 * turn rules into concrete instants.
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type MassRuleKind =
  /** Repeats on given weekdays. */
  | 'weekly'
  /** A fixed calendar date every year, e.g. 15 August. */
  | 'annual-date'
  /** Keyed to a liturgical celebration id, wherever it falls this year. */
  | 'liturgical'
  /** A single dated occurrence, e.g. a one-off funeral or feast-day Mass. */
  | 'one-off';

export interface MassRule {
  id: string;
  kind: MassRuleKind;

  /** For `weekly`. */
  weekdays?: Weekday[];
  /** For `annual-date`. */
  monthDay?: { month: number; day: number };
  /** For `liturgical` — a celebration id from the calendar engine. */
  celebrationId?: string;
  /** For `one-off` — ISO date. */
  date?: string;

  /** Local wall-clock start time, `HH:MM`, in the church's timezone. */
  time: string;

  /**
   * When set, this Mass is celebrated on the day given by the rule but *belongs*
   * to the following day's liturgy — an anticipated or vigil Mass. A Saturday
   * 18:00 Mass is `weekdays: [6]` with `anticipates: 'next-day'`, and it
   * satisfies the Sunday obligation.
   */
  anticipates?: 'next-day' | { celebrationId: string };

  /** BCP 47-ish language tag, or `la` for Latin. */
  language?: string;
  /** The liturgical form, where the parish distinguishes it. */
  form?: 'ordinary' | 'traditional-latin' | 'eastern' | 'other';
  /** Free text exactly as the parish put it: "Sung", "Children's Mass", "Quiet". */
  note?: string;

  /** Inclusive ISO dates bounding when this rule applies (summer schedules). */
  validFrom?: string;
  validTo?: string;
  /** Only in this liturgical season. */
  onlyInSeason?: LiturgicalDay['season'][];
  /** ISO dates on which this rule is explicitly cancelled. */
  exceptDates?: string[];

  /**
   * How much we trust this rule, 0-1. Driven by where it came from and whether
   * the extracted time could be found verbatim in the source text.
   */
  confidence: number;
  source: SourceRef;
}

/** A complete schedule for one church. */
export interface ChurchSchedule {
  churchId: string;
  rules: MassRule[];
  /** ISO timestamp of the last successful extraction attempt. */
  lastCheckedAt?: string;
  /** Set when we tried and failed, so the UI can say so rather than show nothing. */
  lastError?: string;
  /**
   * Overall trustworthiness of the schedule as a whole, distinct from
   * per-rule confidence: a schedule read cleanly off a parish's own
   * "Mass Times" page is better than one inferred from a bulletin PDF.
   */
  quality: ScheduleQuality;
}

export type ScheduleQuality =
  /** Confirmed by a human who was there, or by the parish itself. */
  | 'confirmed'
  /** Read from the parish's own website with high confidence. */
  | 'parish-website'
  /** Read from a bulletin or secondary page; times may be stale. */
  | 'secondary'
  /** From OpenStreetMap tags, which are community-maintained and often old. */
  | 'community-tags'
  /** We have nothing. The UI must say so and offer the phone number. */
  | 'unknown';

export const QUALITY_RANK: Record<ScheduleQuality, number> = {
  confirmed: 0,
  'parish-website': 1,
  secondary: 2,
  'community-tags': 3,
  unknown: 4,
};

/** One concrete Mass, resolved to an instant. */
export interface MassOccurrence {
  churchId: string;
  /** Absolute instant, as an ISO string with offset. */
  startsAt: string;
  /** Local wall-clock time in the church's timezone, `HH:MM`. */
  localTime: string;
  /** The date whose liturgy this Mass celebrates — not always its calendar date. */
  liturgicalDate: string;
  /** True when this Mass is celebrated the evening before the day it belongs to. */
  isVigil: boolean;
  /** The liturgy being celebrated. */
  day: LiturgicalDay;
  language?: string;
  form?: MassRule['form'];
  note?: string;
  confidence: number;
  source: SourceRef;
  ruleId: string;
}
