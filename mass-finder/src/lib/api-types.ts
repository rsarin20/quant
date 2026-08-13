import type { Church } from './churches/types';
import type { DayExplanation } from './liturgy/explain';
import type { LiturgicalDay } from './liturgy/types';
import type { MassOccurrence, ScheduleQuality } from './schedule/types';

/** Shared shapes between the API routes and the client, so neither drifts. */

export interface Reliability {
  text: string;
  tone: 'good' | 'fair' | 'poor';
}

export interface ChurchCard {
  church: Church;
  distanceMetres?: number;
  /** The soonest Mass we know of, if any. */
  next?: MassOccurrence;
  /** A short list of Masses after that one. */
  upcoming: MassOccurrence[];
  quality: ScheduleQuality;
  lastCheckedAt?: string;
  reliability: Reliability;
  /** Plain-language description of the liturgy of `next`. */
  massDescription?: string;
  /** True when the church's rite does not follow the Roman calendar. */
  nonRomanCalendar: boolean;
  /**
   * Places the reader can look when we have no times of our own.
   *
   * Present only on a card with no `next`, and the whole point of it. A card that
   * says "we do not have Mass times for this church" and offers nothing else has
   * wasted the reader's trip through the app: they still need to be at Mass this
   * evening and now have one fewer idea about how to find out when. A link to
   * their country's Mass directory, or failing that a search for this church by
   * name, is not an admission of defeat — it is the answer to the question they
   * actually asked.
   */
  whereElseToLook?: Array<{ label: string; url: string }>;
}

export interface NearbyResponse {
  churches: ChurchCard[];
  /** The liturgical day at the search location, for the "what is today" panel. */
  today?: { day: LiturgicalDay; explanation: DayExplanation };
  /** True when any card is bundled example data rather than a real church. */
  containsExampleData: boolean;
  /** Human-readable notes about the search itself (degradations, warnings). */
  notices: string[];
  attribution: string;
}

export interface ChurchDetailResponse {
  card: ChurchCard;
  byDate: Array<{
    date: string;
    day: LiturgicalDay;
    explanation: DayExplanation;
    occurrences: MassOccurrence[];
  }>;
  /** Extraction diagnostics, shown behind a disclosure. */
  diagnostics?: {
    problems: string[];
    observations: string[];
    pagesRead: string[];
    modelUsed?: string;
  };
  notices: string[];
  attribution: string;
}

export const OSM_ATTRIBUTION =
  'Church locations from OpenStreetMap contributors, licensed under the Open Database Licence.';
