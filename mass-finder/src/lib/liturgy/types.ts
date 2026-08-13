import type { Weekday } from './computus';

/**
 * The Table of Liturgical Days (Universal Norms on the Liturgical Year and the
 * General Roman Calendar, nn. 59). Lower number = higher precedence. When two
 * celebrations fall on the same date, this table decides which one is actually
 * celebrated — and therefore what Mass a person walking into a church will
 * find.
 *
 * We keep the official 13 grades rather than collapsing them, because the
 * collapsing is exactly where a calendar starts being wrong: e.g. a memorial
 * is simply omitted when it lands on a Lenten Sunday, but *is* celebrated (as a
 * commemoration) on a Lenten weekday.
 */
export enum Rank {
  /** 1. The Easter Triduum. */
  TRIDUUM = 1,
  /** 2. Christmas, Epiphany, Ascension, Pentecost; Sundays of Advent/Lent/Easter; Ash Wednesday; Holy Week; Easter Octave. */
  PRIVILEGED = 2,
  /** 3. Solemnities of the Lord, of Mary, and of saints in the General Calendar; All Souls. */
  SOLEMNITY = 3,
  /** 4. Proper solemnities (principal patron, dedication of the church, founder). */
  PROPER_SOLEMNITY = 4,
  /** 5. Feasts of the Lord in the General Calendar. */
  FEAST_OF_THE_LORD = 5,
  /** 6. Sundays of Christmas Time and Sundays in Ordinary Time. */
  SUNDAY = 6,
  /** 7. Feasts of Mary and of the saints in the General Calendar. */
  FEAST = 7,
  /** 8. Proper feasts. */
  PROPER_FEAST = 8,
  /** 9. Weekdays of Advent 17-24 Dec; Christmas Octave; Lenten weekdays. */
  PRIVILEGED_WEEKDAY = 9,
  /** 10. Obligatory memorials in the General Calendar. */
  MEMORIAL = 10,
  /** 11. Proper obligatory memorials. */
  PROPER_MEMORIAL = 11,
  /** 12. Optional memorials. */
  OPTIONAL_MEMORIAL = 12,
  /** 13. Ordinary weekdays. */
  WEEKDAY = 13,
}

export const RANK_LABELS: Record<Rank, string> = {
  [Rank.TRIDUUM]: 'Easter Triduum',
  [Rank.PRIVILEGED]: 'Solemnity',
  [Rank.SOLEMNITY]: 'Solemnity',
  [Rank.PROPER_SOLEMNITY]: 'Solemnity',
  [Rank.FEAST_OF_THE_LORD]: 'Feast',
  [Rank.SUNDAY]: 'Sunday',
  [Rank.FEAST]: 'Feast',
  [Rank.PROPER_FEAST]: 'Feast',
  [Rank.PRIVILEGED_WEEKDAY]: 'Weekday',
  [Rank.MEMORIAL]: 'Memorial',
  [Rank.PROPER_MEMORIAL]: 'Memorial',
  [Rank.OPTIONAL_MEMORIAL]: 'Optional memorial',
  [Rank.WEEKDAY]: 'Weekday',
};

export type Season =
  | 'advent'
  | 'christmas'
  | 'lent'
  | 'triduum'
  | 'easter'
  | 'ordinary';

export const SEASON_LABELS: Record<Season, string> = {
  advent: 'Advent',
  christmas: 'Christmas Time',
  lent: 'Lent',
  triduum: 'the Easter Triduum',
  easter: 'Easter Time',
  ordinary: 'Ordinary Time',
};

/** Liturgical colour, which is what most people actually *see*. */
export type Colour = 'white' | 'red' | 'green' | 'violet' | 'rose' | 'black' | 'gold';

/**
 * One candidate celebration for a date. Several may compete for the same date;
 * `resolveDay` applies the precedence table to pick the celebrated one.
 */
export interface Celebration {
  /**
   * Stable slug, e.g. `easter-sunday`, `assumption`, `st-francis-of-assisi`.
   * Mass-time rules can be keyed to these, so they must not change.
   */
  id: string;
  name: string;
  rank: Rank;
  colour: Colour;
  /** True for celebrations of the Lord (affects precedence over Sundays). */
  ofTheLord?: boolean;
  /** True for celebrations of the Blessed Virgin Mary. */
  ofMary?: boolean;
  /** One-sentence plain-language gloss, shown to users who ask "what is this?". */
  about?: string;
  /**
   * What to call this *kind* of day in the interface, when the rank alone would
   * mislead. Rank 2 covers both genuine solemnities (Christmas, Ascension) and
   * the Sundays of Advent, Lent and Easter — so deriving the label from the rank
   * announces "the Third Sunday of Lent" as a Solemnity, which is wrong and
   * confusing. Set this where the two diverge.
   */
  displayKind?: string;
  /**
   * Where this comes from: the universal calendar, a national/diocesan proper,
   * or a transfer we computed.
   */
  scope?: 'universal' | 'national' | 'diocesan' | 'transferred';
}

/** A single fully-resolved day of the liturgical year. */
export interface LiturgicalDay {
  /** ISO `YYYY-MM-DD`. */
  date: string;
  weekday: Weekday;
  season: Season;
  /** Week number within the season (Ordinary Time: 1-34; Advent: 1-4; etc.). */
  seasonWeek: number;
  /** The celebration actually kept on this day. */
  celebration: Celebration;
  /** Celebrations that lost the precedence contest but may be commemorated. */
  alsoToday: Celebration[];
  colour: Colour;
  /** Sunday lectionary cycle. */
  sundayCycle: 'A' | 'B' | 'C';
  /** Weekday lectionary cycle. */
  weekdayCycle: 'I' | 'II';
  /**
   * True if Catholics in the given region are obliged to attend Mass — Sundays
   * plus the holy days of obligation actually in force there (canon 1246).
   */
  isHolyDayOfObligation: boolean;
  /** True if an evening Mass the day before satisfies the obligation. */
  hasVigil: boolean;
  /**
   * Days on which the Church restricts or forbids Mass. This matters more than
   * it sounds: on Good Friday there is no Mass anywhere in the world, and a
   * Mass finder that cheerfully lists "Friday 10:00" from a parish's ordinary
   * weekday schedule will send someone to a locked church on the most-attended
   * day of the year.
   *
   *  - `none` — no Mass may be celebrated (Good Friday).
   *  - `vigil-only` — no Mass during the day; the Easter Vigil after nightfall.
   *  - `evening-only` — a single evening Mass (Holy Thursday).
   */
  massRestriction?: 'none' | 'vigil-only' | 'evening-only';
  /** How confident we are about the obligation claim, from the region table. */
  obligationConfidence: 'verified' | 'likely' | 'unverified';
  /** Human-readable region the obligation was computed for. */
  regionName: string;
}
