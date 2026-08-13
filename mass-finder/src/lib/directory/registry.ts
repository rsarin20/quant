import type { Church, SourceRef } from '../churches/types';
import type { ChurchSchedule, MassRule } from '../schedule/types';
import { CURATED_PARISHES } from './parishes';
import { normaliseName, type CuratedParish, type CuratedTime, type Weekday } from './types';

/** Index the curated list once, by OSM id, at module load. */
const BY_OSM_ID = new Map<string, CuratedParish>();
/** …and by normalised name + city + country, for entries with no OSM id. */
const BY_NAME = new Map<string, CuratedParish>();

function nameKey(name: string, city: string, country: string): string {
  return `${country.toUpperCase()}|${city.toLowerCase().trim()}|${normaliseName(name)}`;
}

for (const parish of CURATED_PARISHES) {
  if (parish.osmId) BY_OSM_ID.set(parish.osmId, parish);
  if (parish.match) {
    BY_NAME.set(nameKey(parish.match.name, parish.match.city, parish.match.country), parish);
  }
}

/**
 * Find the curated entry for a church, if there is one.
 *
 * OSM id first because it is exact. The name fallback needs both city and country
 * to agree: "St Mary's Cathedral" alone matches hundreds of churches across the
 * world, and attaching the wrong website to one of them is precisely the mistake
 * the identity check in the crawler exists to catch — better not to make it here.
 */
export function curatedFor(church: Church): CuratedParish | undefined {
  const byId = BY_OSM_ID.get(church.id);
  if (byId) return byId;

  const city = church.address?.city;
  const country = church.countryCode ?? church.address?.country;
  if (!city || !country) return undefined;
  return BY_NAME.get(nameKey(church.name, city, country));
}

const DAY_GROUPS: Record<string, Weekday[]> = {
  daily: [0, 1, 2, 3, 4, 5, 6],
  weekdays: [1, 2, 3, 4, 5],
  'mon-sat': [1, 2, 3, 4, 5, 6],
};

function daysOf(time: CuratedTime): Weekday[] {
  return Array.isArray(time.days) ? time.days : DAY_GROUPS[time.days];
}

/**
 * Confidence for a hand-checked time.
 *
 * Higher than the deterministic text pass (0.4) and the model (0.82), because a
 * person read the parish's own page and transcribed it. Not 1.0, and never will
 * be: the parish can change its schedule the day after it was checked and this
 * entry has no way to find out. `checkedOn` is what the interface shows so the
 * reader can weigh that themselves.
 */
const CURATED_CONFIDENCE = 0.9;

/**
 * A schedule from curated times, or `undefined` when the entry only carries a
 * website.
 *
 * Requires `source.url` and `checkedOn`: times with nowhere to be checked and no
 * date are exactly the rumours this app refuses to repeat, so they are dropped
 * rather than shown.
 */
export function curatedScheduleFor(church: Church): ChurchSchedule | undefined {
  const parish = curatedFor(church);
  if (!parish?.times?.length) return undefined;
  if (!parish.source?.url || !parish.checkedOn) return undefined;

  const rules: MassRule[] = [];
  let index = 0;
  for (const time of parish.times) {
    const days = daysOf(time);
    if (!days?.length) continue;
    const source: SourceRef = {
      kind: parish.source.kind ?? 'parish-website',
      url: parish.source.url,
      quote: time.quote,
      // The check date is the honest timestamp here, not "now": pretending a
      // build-time constant was verified this morning would be a lie the
      // reliability banner then repeats.
      fetchedAt: `${parish.checkedOn}T00:00:00.000Z`,
      detail: 'Read and transcribed by hand from the parish’s own page',
    };
    rules.push({
      id: `curated-${church.id}-${index++}`,
      kind: 'weekly',
      weekdays: days,
      time: time.time,
      language: time.language,
      form: time.form,
      anticipates: time.vigil ? 'next-day' : undefined,
      note: time.note,
      confidence: CURATED_CONFIDENCE,
      source,
    });
  }

  if (!rules.length) return undefined;
  return {
    churchId: church.id,
    rules,
    lastCheckedAt: `${parish.checkedOn}T00:00:00.000Z`,
    quality: 'parish-website',
  };
}

/**
 * Fill in a website from the curated list when OSM has none.
 *
 * Marks where it came from, so the crawler knows to insist the page actually
 * mentions this church before trusting a time from it, and so the sources list can
 * say the URL was supplied by us rather than by a mapper.
 */
export function withCuratedWebsite(church: Church): Church {
  if (church.website) return church;
  const parish = curatedFor(church);
  if (!parish?.website) return church;
  return {
    ...church,
    website: parish.website,
    websiteSource: 'curated',
    sources: [
      ...church.sources,
      {
        kind: 'seed-data',
        url: parish.website,
        fetchedAt: new Date().toISOString(),
        detail: `Website for ${parish.label} supplied by Mass Finder’s parish directory`,
      },
    ],
  };
}
