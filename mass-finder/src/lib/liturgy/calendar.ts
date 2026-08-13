import {
  addDays,
  isoDate,
  parseIsoDate,
  utc,
  weekdayOf,
  type Weekday,
} from './computus';
import {
  applyProperRank,
  isObligation,
  properFeastsFor,
  regionFor,
  type RegionRule,
} from './regions';
import { sanctoralFor } from './sanctoral';
import {
  anchorsFor,
  lectionaryCycles,
  moveableSanctoral,
  temporalYear,
} from './temporal';
import { Rank, type Celebration, type LiturgicalDay } from './types';

/**
 * Assembling the liturgical year.
 *
 * The temporal cycle and the sanctoral cycle both propose a celebration for
 * many dates. Deciding which one is actually kept is the job of the Table of
 * Liturgical Days, and it is not a simple "highest rank wins":
 *
 *  - A solemnity that lands on a Sunday of Advent, Lent or Easter is not
 *    dropped, it is **transferred** to the next free day. The Annunciation
 *    landing in Holy Week moves to the Monday after the Second Sunday of
 *    Easter, and the Immaculate Conception landing on the Second Sunday of
 *    Advent moves to 9 December.
 *  - All Souls is the one commemoration that outranks a Sunday in Ordinary
 *    Time.
 *  - A memorial impeded by a Lenten weekday or a late-Advent day is not simply
 *    deleted; it survives as a commemoration, which is why parishes still
 *    announce it.
 *
 * Each of those is a case where a naive implementation gives a plausible wrong
 * answer, so each is handled explicitly below.
 */

function isPrivilegedTemporal(rank: Rank): boolean {
  return rank <= Rank.PRIVILEGED;
}

/** A day is free for a transferred solemnity if nothing above rank 8 holds it. */
function isFreeForTransfer(rank: Rank): boolean {
  return rank >= Rank.PRIVILEGED_WEEKDAY;
}

interface Candidates {
  temporal: Celebration;
  season: LiturgicalDay['season'];
  seasonWeek: number;
  sanctoral: Celebration[];
}

/**
 * Build the full liturgical year for one civil year in one region.
 *
 * Returns a map keyed by ISO date. A whole year is computed at once because
 * transfers move celebrations between dates — you cannot resolve 25 March
 * without knowing where Easter falls, and you cannot resolve the Monday after
 * Divine Mercy Sunday without knowing whether the Annunciation was pushed onto
 * it.
 */
export function buildYear(year: number, region: RegionRule): Map<string, LiturgicalDay> {
  const temporal = temporalYear(year, region.temporal);
  const moveable = moveableSanctoral(year, region.temporal);
  const anchors = anchorsFor(year, region.temporal);

  // ── Stage 1: gather candidates per date ──────────────────────────────────
  const candidates = new Map<string, Candidates>();
  for (const [iso, td] of temporal) {
    const d = parseIsoDate(iso);
    const month = d.getUTCMonth() + 1;
    const dayOfMonth = d.getUTCDate();
    const fixed = sanctoralFor(month, dayOfMonth).map((c) => applyProperRank(region, c));
    const moved = (moveable.get(iso) ?? []).map((c) => applyProperRank(region, c));
    const national = properFeastsFor(region, month, dayOfMonth);
    // Drop sanctoral entries that duplicate the temporal celebration by id —
    // Christmas, Epiphany and 1 January appear in both cycles by construction.
    const sanctoral = [...fixed, ...moved, ...national].filter(
      (c) => c.id !== td.celebration.id,
    );
    candidates.set(iso, {
      temporal: td.celebration,
      season: td.season,
      seasonWeek: td.seasonWeek,
      sanctoral,
    });
  }

  // ── Stage 2: transfer impeded solemnities ───────────────────────────────
  // Any solemnity — universal or proper — that lands on a day of rank 1 or 2
  // (a Sunday of Advent, Lent or Easter; Ash Wednesday; Holy Week; the Easter
  // Octave) is moved rather than dropped. In practice this catches the
  // Annunciation, Saint Joseph, the Immaculate Conception, and national patrons
  // such as Saint Patrick.
  for (const [iso, c] of Array.from(candidates)) {
    if (!isPrivilegedTemporal(c.temporal.rank)) continue;
    for (const sanct of c.sanctoral.slice()) {
      if (sanct.rank > Rank.PROPER_SOLEMNITY) continue;
      // A handful of celebrations hold their day by indult instead of moving.
      if (region.outranksPrivilegedSunday?.includes(sanct.id)) continue;

      const from = parseIsoDate(iso);
      const target = transferTargetFor(sanct.id, from, candidates, anchors);
      if (!target) continue;

      // Remove from the impeded date and add to the target.
      c.sanctoral = c.sanctoral.filter((x) => x.id !== sanct.id);
      const targetEntry = candidates.get(target);
      if (!targetEntry) continue;
      targetEntry.sanctoral = [
        ...targetEntry.sanctoral,
        {
          ...sanct,
          scope: 'transferred',
          about:
            `${sanct.about ? sanct.about + ' ' : ''}Transferred from ${formatShortDate(from)} because that day was already taken by a greater celebration.`,
        },
      ];
    }
  }

  // ── Stage 3: pick the winner for each date ──────────────────────────────
  const out = new Map<string, LiturgicalDay>();
  for (const [iso, c] of candidates) {
    const d = parseIsoDate(iso);
    const all = [c.temporal, ...c.sanctoral];
    const winner = pickCelebration(c.temporal, c.sanctoral, d, region);
    const alsoToday = all.filter((x) => x.id !== winner.id);
    const { sundayCycle, weekdayCycle } = lectionaryCycles(d, region.temporal);
    const weekday: Weekday = weekdayOf(d);

    const obligation =
      weekday === 0 || isObligation(region, winner.id, d);

    out.set(iso, {
      date: iso,
      weekday,
      season: c.season,
      seasonWeek: c.seasonWeek,
      celebration: winner,
      alsoToday,
      colour: winner.colour,
      sundayCycle,
      weekdayCycle,
      isHolyDayOfObligation: obligation,
      hasVigil: obligation,
      massRestriction: massRestrictionFor(winner.id),
      obligationConfidence: weekday === 0 ? 'verified' : region.confidence,
      regionName: region.name,
    });
  }

  return out;
}

function massRestrictionFor(celebrationId: string): LiturgicalDay['massRestriction'] {
  switch (celebrationId) {
    case 'good-friday':
      return 'none';
    case 'holy-saturday':
      return 'vigil-only';
    case 'holy-thursday':
      return 'evening-only';
    default:
      return undefined;
  }
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/**
 * Where an impeded solemnity goes.
 *
 * The general norm is "the nearest day not itself occupied by a celebration of
 * rank 1-8". The Annunciation has an explicit exception: falling in Holy Week
 * or the Octave of Easter, it is kept on the Monday after the Second Sunday of
 * Easter.
 */
function transferTargetFor(
  celebrationId: string,
  from: Date,
  candidates: Map<string, Candidates>,
  anchors: ReturnType<typeof anchorsFor>,
): string | undefined {
  if (celebrationId === 'annunciation') {
    const inHolyWeek = from >= anchors.palmSunday && from <= anchors.holySaturday;
    const inEasterOctave = from >= anchors.easter && from < anchors.divineMercySunday;
    if (inHolyWeek || inEasterOctave) {
      return isoDate(addDays(anchors.divineMercySunday, 1));
    }
  }

  for (let i = 1; i <= 40; i += 1) {
    const target = addDays(from, i);
    const entry = candidates.get(isoDate(target));
    if (!entry) continue;
    if (!isFreeForTransfer(entry.temporal.rank)) continue;
    // Don't stack two solemnities on one day.
    const hasSolemnity = entry.sanctoral.some((x) => x.rank <= Rank.PROPER_SOLEMNITY);
    if (hasSolemnity) continue;
    return isoDate(target);
  }
  return undefined;
}

/**
 * Apply the precedence table to one date's candidates.
 */
function pickCelebration(
  temporal: Celebration,
  sanctoral: Celebration[],
  date: Date,
  region: RegionRule,
): Celebration {
  // A celebration holding its day by indult wins even against a privileged
  // Sunday — the reason it was granted the indult in the first place.
  if (region.outranksPrivilegedSunday?.length) {
    const privileged = sanctoral.find((c) =>
      region.outranksPrivilegedSunday!.includes(c.id),
    );
    if (privileged) return privileged;
  }

  // All Souls is the single commemoration that displaces a Sunday in Ordinary
  // Time. Every other rank-3 celebration would already win on rank alone, so
  // this exists purely for the Sunday case.
  const allSouls = sanctoral.find((c) => c.id === 'all-souls');
  if (allSouls && weekdayOf(date) === 0 && temporal.rank === Rank.SUNDAY) {
    return allSouls;
  }

  let best = temporal;
  for (const c of sanctoral) {
    // An *optional* memorial never displaces the day it falls on. The priest may
    // choose it, but the weekday Mass is the default — so for the question this
    // app answers ("what Mass will I find if I turn up?") the honest answer is
    // the weekday, with the memorial offered as something the parish may also
    // keep. Ranking it as a winner would announce "Saints Pontian and
    // Hippolytus" as the day's celebration on an ordinary Thursday in August.
    if (c.rank >= Rank.OPTIONAL_MEMORIAL) continue;
    if (c.rank < best.rank) best = c;
    // A tie goes to the temporal cycle, which is already `best`.
  }
  return best;
}

/**
 * Resolve a single date. Convenience wrapper that builds only the years it
 * needs. A liturgical year straddles two civil years, so a date in late
 * December needs its own civil year's build.
 */
const yearCache = new Map<string, Map<string, LiturgicalDay>>();

export function liturgicalDay(date: Date, countryCode?: string | null): LiturgicalDay {
  const region = regionFor(countryCode);
  const year = date.getUTCFullYear();
  const key = `${year}:${region.code}`;
  let built = yearCache.get(key);
  if (!built) {
    built = buildYear(year, region);
    yearCache.set(key, built);
    // Keep the cache from growing without bound in a long-lived server process.
    if (yearCache.size > 64) {
      const oldest = yearCache.keys().next().value;
      if (oldest !== undefined) yearCache.delete(oldest);
    }
  }
  const found = built.get(isoDate(date));
  if (found) return found;

  // Defensive fallback: a date the builder somehow did not cover. Better a
  // correct-shaped generic weekday than a crash in the one screen a person is
  // relying on.
  const weekday = weekdayOf(date);
  const { sundayCycle, weekdayCycle } = lectionaryCycles(date, region.temporal);
  return {
    date: isoDate(date),
    weekday,
    season: 'ordinary',
    seasonWeek: 0,
    celebration: {
      id: 'weekday',
      name: weekday === 0 ? 'Sunday' : 'Weekday',
      rank: weekday === 0 ? Rank.SUNDAY : Rank.WEEKDAY,
      colour: 'green',
    },
    alsoToday: [],
    colour: 'green',
    sundayCycle,
    weekdayCycle,
    isHolyDayOfObligation: weekday === 0,
    hasVigil: weekday === 0,
    obligationConfidence: weekday === 0 ? 'verified' : 'unverified',
    regionName: region.name,
  };
}

/** A run of consecutive liturgical days, for schedule resolution. */
export function liturgicalRange(
  start: Date,
  days: number,
  countryCode?: string | null,
): LiturgicalDay[] {
  const out: LiturgicalDay[] = [];
  for (let i = 0; i < days; i += 1) {
    out.push(liturgicalDay(addDays(start, i), countryCode));
  }
  return out;
}

/** Clear the memoised years — used by tests. */
export function clearCalendarCache(): void {
  yearCache.clear();
}

export { utc };
