import { weekdayOf, type Weekday } from './computus';
import type { TemporalOptions } from './temporal';
import { Rank, type Celebration, type Colour } from './types';

/**
 * Regional liturgical law.
 *
 * Canon 1246 §1 lists ten holy days of obligation besides Sundays. Canon
 * 1246 §2 then lets each episcopal conference, with the approval of the Holy
 * See, suppress them or move them to a Sunday. Almost every conference has used
 * that power, and no two have used it the same way — so "is today a holy day of
 * obligation?" has no universal answer, only a national one (and sometimes a
 * diocesan one).
 *
 * ## Why this file admits what it does not know
 *
 * These decrees change, they are published locally, and several countries vary
 * by ecclesiastical province. A Mass finder that renders a confident
 * "HOLY DAY OF OBLIGATION" banner from a half-remembered table is worse than
 * one that says "this is a solemnity — many countries keep it as a holy day;
 * check with your parish", because the first kind of error is invisible to the
 * person relying on it.
 *
 * So every entry carries a `confidence`, and the UI is required to phrase
 * itself differently for each level. `verified` means the observance is
 * well-established and stable; `likely` means we are confident about the shape
 * but not every edge; `unverified` means we are falling back to universal law
 * and saying so out loud.
 */

export type Confidence = 'verified' | 'likely' | 'unverified';

/** A celebration a country adds to, or promotes within, the universal calendar. */
export interface ProperFeast {
  month: number;
  day: number;
  id: string;
  name: string;
  rank: Rank;
  colour: Colour;
  ofMary?: boolean;
  about?: string;
}

export interface RegionRule {
  /** ISO 3166-1 alpha-2, optionally with a subdivision: `GB-EAW`. */
  code: string;
  name: string;
  temporal: TemporalOptions;
  /**
   * Celebration ids (from the sanctoral/temporal cycles) that are holy days of
   * obligation here, over and above every Sunday.
   */
  holyDays: string[];
  /**
   * Celebrations whose obligation lapses when they fall on a Saturday or a
   * Monday. Several conferences (notably the United States) have this rule to
   * avoid two obligations on consecutive days.
   */
  abrogatedOnSaturdayOrMonday?: string[];
  /**
   * The **proper calendar**: ranks 4, 8 and 11 of the Table of Liturgical Days.
   * A country promotes celebrations that matter to it — Ireland keeps Saint
   * Patrick as a Solemnity where the universal calendar has an optional
   * memorial, Mexico does the same for Our Lady of Guadalupe. Without this
   * layer, a national patronal feast is invisible: the universal optional
   * memorial loses to an ordinary Lenten weekday and the obligation never
   * registers.
   */
  properRanks?: Record<string, Rank>;
  /** Celebrations that exist only in this country's calendar. */
  properFeasts?: ProperFeast[];
  /**
   * Celebrations granted the privilege of outranking a Sunday of Advent, Lent
   * or Easter, rather than being transferred off it. Rare, and always by
   * specific indult — Our Lady of Guadalupe in Mexico is the usual example.
   */
  outranksPrivilegedSunday?: string[];
  confidence: Confidence;
  note?: string;
}

/** Canon 1246 §1 — the ten days of universal law, before any local transfer. */
export const UNIVERSAL_HOLY_DAYS = [
  'christmas',
  'epiphany',
  'ascension',
  'corpus-christi',
  'mary-mother-of-god',
  'immaculate-conception',
  'assumption',
  'st-joseph',
  'ss-peter-paul',
  'all-saints',
];

const REGIONS: RegionRule[] = [
  {
    code: 'US',
    name: 'United States',
    temporal: { epiphany: 'sunday', ascension: 'sunday', corpusChristi: 'sunday' },
    holyDays: [
      'mary-mother-of-god',
      'ascension',
      'assumption',
      'all-saints',
      'immaculate-conception',
      'christmas',
    ],
    abrogatedOnSaturdayOrMonday: ['mary-mother-of-god', 'assumption', 'all-saints'],
    confidence: 'verified',
    note:
      'Ascension is kept on Thursday in the provinces of Boston, Hartford, New York, Newark, Omaha and Philadelphia, and on Sunday elsewhere. The Immaculate Conception is the patronal feast of the United States and its obligation is never lifted.',
  },
  {
    code: 'US-THU',
    name: 'United States (provinces keeping Ascension Thursday)',
    temporal: { epiphany: 'sunday', ascension: 'thursday', corpusChristi: 'sunday' },
    holyDays: [
      'mary-mother-of-god',
      'ascension',
      'assumption',
      'all-saints',
      'immaculate-conception',
      'christmas',
    ],
    abrogatedOnSaturdayOrMonday: ['mary-mother-of-god', 'assumption', 'all-saints'],
    confidence: 'verified',
    note: 'Boston, Hartford, New York, Newark, Omaha, Philadelphia, and the Military Archdiocese.',
  },
  {
    code: 'CA',
    name: 'Canada',
    temporal: { epiphany: 'sunday', ascension: 'sunday', corpusChristi: 'sunday' },
    holyDays: ['christmas', 'mary-mother-of-god'],
    confidence: 'verified',
    note: 'Canada keeps only Christmas and 1 January as holy days of obligation besides Sundays.',
  },
  {
    code: 'IE',
    name: 'Ireland',
    temporal: { epiphany: 'jan6', ascension: 'thursday', corpusChristi: 'sunday' },
    holyDays: [
      'mary-mother-of-god',
      'epiphany',
      'st-patrick',
      'ascension',
      'assumption',
      'all-saints',
      'immaculate-conception',
      'christmas',
    ],
    properRanks: {
      // Patron of Ireland: a Solemnity there, an optional memorial elsewhere.
      'st-patrick': Rank.PROPER_SOLEMNITY,
      'st-brigid': Rank.PROPER_FEAST,
      'st-columba': Rank.PROPER_FEAST,
    },
    properFeasts: [
      { month: 2, day: 1, id: 'st-brigid', name: 'Saint Brigid, Virgin', rank: Rank.PROPER_FEAST, colour: 'white' },
      { month: 6, day: 9, id: 'st-columba', name: 'Saint Columba, Abbot', rank: Rank.PROPER_FEAST, colour: 'white' },
    ],
    confidence: 'verified',
    note:
      'Saint Patrick (17 March) is a holy day of obligation in Ireland. When it falls on a Sunday of Lent the Irish bishops have sometimes moved the celebration to the preceding Saturday and lifted the obligation — this calendar applies the general norm and moves it forward instead, so check locally in those years.',
  },
  {
    code: 'GB-EAW',
    name: 'England and Wales',
    temporal: { epiphany: 'jan6', ascension: 'thursday', corpusChristi: 'sunday' },
    holyDays: [
      'mary-mother-of-god',
      'epiphany',
      'ascension',
      'ss-peter-paul',
      'assumption',
      'all-saints',
      'christmas',
    ],
    confidence: 'likely',
    note:
      'Epiphany and Ascension were restored to their traditional days in 2018; Corpus Christi remains on the Sunday.',
  },
  {
    code: 'GB-SCT',
    name: 'Scotland',
    temporal: { epiphany: 'sunday', ascension: 'sunday', corpusChristi: 'sunday' },
    holyDays: ['christmas', 'mary-mother-of-god'],
    confidence: 'unverified',
    note: 'Scottish observance is not fully verified in this dataset — please check locally.',
  },
  {
    code: 'IT',
    name: 'Italy',
    temporal: { epiphany: 'jan6', ascension: 'sunday', corpusChristi: 'sunday' },
    holyDays: [
      'mary-mother-of-god',
      'epiphany',
      'assumption',
      'all-saints',
      'immaculate-conception',
      'christmas',
    ],
    confidence: 'verified',
  },
  {
    code: 'ES',
    name: 'Spain',
    temporal: { epiphany: 'jan6', ascension: 'sunday', corpusChristi: 'sunday' },
    holyDays: [
      'mary-mother-of-god',
      'epiphany',
      'assumption',
      'all-saints',
      'immaculate-conception',
      'christmas',
    ],
    confidence: 'likely',
    note: 'Saint Joseph (19 March) is additionally observed in some regions.',
  },
  {
    code: 'FR',
    name: 'France',
    temporal: { epiphany: 'sunday', ascension: 'thursday', corpusChristi: 'sunday' },
    holyDays: [
      'mary-mother-of-god',
      'ascension',
      'assumption',
      'all-saints',
      'christmas',
    ],
    confidence: 'verified',
  },
  {
    code: 'DE',
    name: 'Germany',
    temporal: { epiphany: 'jan6', ascension: 'thursday', corpusChristi: 'thursday' },
    holyDays: [
      'mary-mother-of-god',
      'epiphany',
      'ascension',
      'corpus-christi',
      'all-saints',
      'christmas',
    ],
    confidence: 'likely',
    note:
      'The Assumption (15 August) is a holy day of obligation in some German dioceses only. Corpus Christi is kept on the Thursday.',
  },
  {
    code: 'AT',
    name: 'Austria',
    temporal: { epiphany: 'jan6', ascension: 'thursday', corpusChristi: 'thursday' },
    holyDays: [
      'mary-mother-of-god',
      'epiphany',
      'ascension',
      'corpus-christi',
      'assumption',
      'all-saints',
      'immaculate-conception',
      'christmas',
    ],
    confidence: 'likely',
  },
  {
    code: 'CH',
    name: 'Switzerland',
    temporal: { epiphany: 'jan6', ascension: 'thursday', corpusChristi: 'thursday' },
    holyDays: [
      'mary-mother-of-god',
      'ascension',
      'assumption',
      'all-saints',
      'immaculate-conception',
      'christmas',
    ],
    confidence: 'unverified',
    note: 'Swiss observance varies considerably by canton — please check locally.',
  },
  {
    code: 'PL',
    name: 'Poland',
    temporal: { epiphany: 'jan6', ascension: 'sunday', corpusChristi: 'thursday' },
    holyDays: [
      'mary-mother-of-god',
      'epiphany',
      'corpus-christi',
      'assumption',
      'all-saints',
      'christmas',
    ],
    properFeasts: [
      {
        month: 5,
        day: 3,
        id: 'our-lady-queen-of-poland',
        name: 'Our Lady, Queen of Poland',
        rank: Rank.PROPER_SOLEMNITY,
        colour: 'white',
        ofMary: true,
        about: 'The principal patroness of Poland.',
      },
    ],
    confidence: 'likely',
    note: 'Corpus Christi is kept on the Thursday, with a public procession.',
  },
  {
    code: 'PT',
    name: 'Portugal',
    temporal: { epiphany: 'sunday', ascension: 'sunday', corpusChristi: 'thursday' },
    holyDays: [
      'mary-mother-of-god',
      'assumption',
      'all-saints',
      'immaculate-conception',
      'christmas',
    ],
    confidence: 'likely',
  },
  {
    code: 'NL',
    name: 'Netherlands',
    temporal: { epiphany: 'sunday', ascension: 'thursday', corpusChristi: 'sunday' },
    holyDays: ['mary-mother-of-god', 'ascension', 'christmas'],
    confidence: 'likely',
  },
  {
    code: 'BE',
    name: 'Belgium',
    temporal: { epiphany: 'sunday', ascension: 'thursday', corpusChristi: 'sunday' },
    holyDays: [
      'mary-mother-of-god',
      'ascension',
      'assumption',
      'all-saints',
      'christmas',
    ],
    confidence: 'likely',
  },
  {
    code: 'PH',
    name: 'Philippines',
    temporal: { epiphany: 'sunday', ascension: 'sunday', corpusChristi: 'sunday' },
    holyDays: ['mary-mother-of-god', 'immaculate-conception', 'christmas'],
    confidence: 'likely',
    note:
      'The Immaculate Conception is the patronal feast of the Philippines. The Assumption and All Saints are transferred to the nearest Sunday.',
  },
  {
    code: 'MX',
    name: 'Mexico',
    temporal: { epiphany: 'sunday', ascension: 'sunday', corpusChristi: 'sunday' },
    holyDays: ['mary-mother-of-god', 'our-lady-of-guadalupe', 'christmas'],
    properRanks: { 'our-lady-of-guadalupe': Rank.PROPER_SOLEMNITY },
    // Guadalupe holds its day even against a Sunday of Advent, by indult.
    outranksPrivilegedSunday: ['our-lady-of-guadalupe'],
    confidence: 'likely',
    note: 'Our Lady of Guadalupe (12 December) is kept as a holy day of obligation in Mexico.',
  },
  {
    code: 'BR',
    name: 'Brazil',
    temporal: { epiphany: 'sunday', ascension: 'sunday', corpusChristi: 'thursday' },
    holyDays: ['mary-mother-of-god', 'immaculate-conception', 'christmas'],
    properFeasts: [
      {
        month: 10,
        day: 12,
        id: 'our-lady-of-aparecida',
        name: 'Our Lady of Aparecida',
        rank: Rank.PROPER_SOLEMNITY,
        colour: 'white',
        ofMary: true,
        about: 'The patroness of Brazil.',
      },
    ],
    confidence: 'unverified',
    note:
      'Brazilian observance is not fully verified in this dataset. Corpus Christi is a national civil holiday and is widely celebrated on the Thursday.',
  },
  {
    code: 'AU',
    name: 'Australia',
    temporal: { epiphany: 'sunday', ascension: 'sunday', corpusChristi: 'sunday' },
    holyDays: ['christmas', 'assumption'],
    confidence: 'likely',
    note: 'Australia keeps Christmas and the Assumption; other days are transferred to Sunday.',
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    temporal: { epiphany: 'sunday', ascension: 'sunday', corpusChristi: 'sunday' },
    holyDays: ['christmas', 'assumption'],
    confidence: 'unverified',
  },
  {
    code: 'IN',
    name: 'India',
    temporal: { epiphany: 'jan6', ascension: 'sunday', corpusChristi: 'sunday' },
    holyDays: ['christmas', 'mary-mother-of-god', 'assumption'],
    confidence: 'unverified',
    note:
      'India has several sui iuris Churches — Latin, Syro-Malabar and Syro-Malankara — each with its own calendar. This entry covers the Latin rite only and is not fully verified.',
  },
  {
    code: 'VN',
    name: 'Vietnam',
    temporal: { epiphany: 'sunday', ascension: 'sunday', corpusChristi: 'sunday' },
    holyDays: ['christmas', 'mary-mother-of-god', 'assumption', 'immaculate-conception'],
    confidence: 'unverified',
  },
  {
    code: 'KR',
    name: 'South Korea',
    temporal: { epiphany: 'sunday', ascension: 'sunday', corpusChristi: 'sunday' },
    holyDays: ['christmas', 'assumption'],
    confidence: 'likely',
  },
  {
    code: 'MT',
    name: 'Malta',
    temporal: { epiphany: 'jan6', ascension: 'sunday', corpusChristi: 'sunday' },
    holyDays: [
      'mary-mother-of-god',
      'epiphany',
      'st-joseph',
      'ss-peter-paul',
      'assumption',
      'immaculate-conception',
      'christmas',
    ],
    confidence: 'likely',
  },
  {
    code: 'NG',
    name: 'Nigeria',
    temporal: { epiphany: 'sunday', ascension: 'thursday', corpusChristi: 'sunday' },
    holyDays: ['christmas', 'mary-mother-of-god', 'ascension', 'assumption', 'all-saints'],
    confidence: 'unverified',
  },
  {
    code: 'CD',
    name: 'Democratic Republic of the Congo',
    temporal: { epiphany: 'sunday', ascension: 'thursday', corpusChristi: 'sunday' },
    holyDays: ['christmas', 'mary-mother-of-god', 'ascension', 'assumption', 'all-saints'],
    confidence: 'unverified',
  },
  {
    code: 'AR',
    name: 'Argentina',
    temporal: { epiphany: 'sunday', ascension: 'sunday', corpusChristi: 'sunday' },
    holyDays: ['christmas', 'mary-mother-of-god', 'immaculate-conception'],
    confidence: 'unverified',
  },
  {
    code: 'CO',
    name: 'Colombia',
    temporal: { epiphany: 'sunday', ascension: 'sunday', corpusChristi: 'sunday' },
    holyDays: [
      'christmas',
      'mary-mother-of-god',
      'ss-peter-paul',
      'assumption',
      'all-saints',
      'immaculate-conception',
    ],
    confidence: 'unverified',
  },
];

const BY_CODE = new Map(REGIONS.map((r) => [r.code, r]));

/**
 * The fallback used for any country we have no entry for: universal law, kept
 * on its traditional days, flagged `unverified` so the UI hedges appropriately.
 */
export function universalFallback(code: string, name?: string): RegionRule {
  return {
    code,
    name: name ?? code,
    temporal: { epiphany: 'jan6', ascension: 'thursday', corpusChristi: 'thursday' },
    holyDays: UNIVERSAL_HOLY_DAYS,
    confidence: 'unverified',
    note:
      'We do not yet have verified holy-day rules for this country, so this shows universal Church law (canon 1246 §1). Most countries have moved some of these days — please check with the parish.',
  };
}

export function regionFor(code: string | undefined | null): RegionRule {
  if (!code) return universalFallback('XX', 'Unknown country');
  const upper = code.toUpperCase();
  return BY_CODE.get(upper) ?? BY_CODE.get(upper.slice(0, 2)) ?? universalFallback(upper);
}

export function allRegions(): RegionRule[] {
  return REGIONS.slice();
}

/**
 * Celebrations this country adds on a given calendar date, as `Celebration`
 * objects ready to compete in the precedence table.
 */
export function properFeastsFor(
  region: RegionRule,
  month: number,
  day: number,
): Celebration[] {
  if (!region.properFeasts) return [];
  return region.properFeasts
    .filter((f) => f.month === month && f.day === day)
    .map((f) => ({
      id: f.id,
      name: f.name,
      rank: f.rank,
      colour: f.colour,
      ofMary: f.ofMary,
      about: f.about,
      scope: 'national' as const,
    }));
}

/**
 * Re-rank a universal-calendar celebration according to the local proper. The
 * name is kept — a country promotes a saint's day, it does not rename the saint.
 */
export function applyProperRank(region: RegionRule, c: Celebration): Celebration {
  const promoted = region.properRanks?.[c.id];
  if (promoted === undefined || promoted === c.rank) return c;
  return { ...c, rank: promoted, scope: 'national' };
}

/**
 * Whether a given celebration binds the faithful to attend Mass on a given date
 * in a given region — after applying any Saturday/Monday abrogation.
 */
export function isObligation(
  region: RegionRule,
  celebrationId: string,
  date: Date,
): boolean {
  if (!region.holyDays.includes(celebrationId)) return false;
  if (region.abrogatedOnSaturdayOrMonday?.includes(celebrationId)) {
    const wd: Weekday = weekdayOf(date);
    if (wd === 6 || wd === 1) return false;
  }
  return true;
}
