import { findChurchesNear, OverpassUnavailableError } from './churches/overpass';
import { reverseGeocodeCountry } from './churches/geocode';
import type { LatLon } from './churches/geo';
import { haversineMetres } from './churches/geo';
import { NON_ROMAN_RITES, type Church } from './churches/types';
import { DEMO_CHURCHES, demoChurchById, isDemoMode } from './demo';
import { extractSchedule } from './extract/pipeline';
import { liturgicalDay } from './liturgy/calendar';
import { describeMass, describeReliability, explainDay } from './liturgy/explain';
import { utc } from './liturgy/computus';
import { groupByLocalDate, resolveOccurrences } from './schedule/resolve';
import { localDateIn } from './schedule/timezone';
import type { ChurchSchedule } from './schedule/types';
import {
  getCachedChurches,
  getChurch,
  getSchedule,
  getScheduleEvenIfStale,
  putCachedChurches,
  putChurch,
  putSchedule,
  readUserReports,
  reportSummary,
  tileKey,
} from './store';
import {
  OSM_ATTRIBUTION,
  type ChurchCard,
  type ChurchDetailResponse,
  type NearbyResponse,
} from './api-types';

/**
 * The application service layer: everything the routes need, with caching,
 * graceful degradation, and provenance preserved end to end.
 *
 * The degradation ladder matters as much as the happy path. When Overpass is
 * unreachable we say so rather than showing an empty list; when a schedule is
 * stale we show it *with its age* rather than hiding it; when we have no times at
 * all we say that and offer the parish's phone number. An older user's worst
 * outcome is not a missing feature, it is a confident wrong answer or a blank
 * screen with no explanation.
 */

const MAX_EXTRACTIONS_PER_REQUEST = 3;

function buildCard(
  church: Church,
  schedule: ChurchSchedule | undefined,
  opts: { distanceMetres?: number; now?: Date; disputed?: boolean; staleSince?: string },
): ChurchCard {
  const now = opts.now ?? new Date();
  const occurrences = schedule
    ? resolveOccurrences(church, schedule, { from: now, days: 21, limit: 12 })
    : [];

  const quality = schedule?.quality ?? 'unknown';
  const lastCheckedAt = schedule?.lastCheckedAt ?? opts.staleSince;

  return {
    church,
    distanceMetres: opts.distanceMetres,
    next: occurrences[0],
    upcoming: occurrences.slice(1, 8),
    quality,
    lastCheckedAt,
    reliability: describeReliability({
      quality,
      lastCheckedAt,
      disputed: opts.disputed,
      now,
    }),
    massDescription: occurrences[0]
      ? describeMass(occurrences[0].day, occurrences[0].isVigil)
      : undefined,
    nonRomanCalendar: NON_ROMAN_RITES.has(church.rite),
  };
}

async function loadScheduleFor(
  church: Church,
  opts: { allowExtraction: boolean; serviceTimes?: string },
): Promise<{ schedule?: ChurchSchedule; staleSince?: string; problems: string[] }> {
  const fresh = await getSchedule(church.id);
  if (fresh) return { schedule: fresh, problems: [] };

  if (opts.allowExtraction) {
    try {
      const report = await extractSchedule(church, { serviceTimes: opts.serviceTimes });
      if (report.schedule.rules.length) {
        await putSchedule(report.schedule);
        return { schedule: report.schedule, problems: report.problems };
      }
      // Nothing found. Fall through to any stale copy before giving up.
      const stale = await getScheduleEvenIfStale(church.id);
      if (stale) {
        return {
          schedule: stale.schedule,
          staleSince: stale.savedAt,
          problems: report.problems,
        };
      }
      await putSchedule(report.schedule);
      return { problems: report.problems };
    } catch (err) {
      const stale = await getScheduleEvenIfStale(church.id);
      if (stale) {
        return {
          schedule: stale.schedule,
          staleSince: stale.savedAt,
          problems: [`Could not refresh times: ${String(err)}`],
        };
      }
      return { problems: [`Could not read times: ${String(err)}`] };
    }
  }

  // Better a schedule with a visible date on it than no answer at all.
  const stale = await getScheduleEvenIfStale(church.id);
  if (stale) return { schedule: stale.schedule, staleSince: stale.savedAt, problems: [] };
  return { problems: [] };
}

export interface NearbyParams {
  point: LatLon;
  radiusMetres?: number;
  limit?: number;
  /** Whether to spend time (and API calls) reading parish websites now. */
  fetchSchedules?: boolean;
  now?: Date;
}

export async function nearby(params: NearbyParams): Promise<NearbyResponse> {
  const { point } = params;
  const radius = params.radiusMetres ?? 5_000;
  const limit = params.limit ?? 12;
  const now = params.now ?? new Date();
  const notices: string[] = [];

  let results: Array<{ church: Church; distanceMetres: number }> = [];
  let containsExampleData = false;

  if (isDemoMode()) {
    containsExampleData = true;
    notices.push(
      'Demonstration mode: these are invented example parishes, not real churches. Do not travel to them.',
    );
    results = DEMO_CHURCHES.map((d) => ({
      church: d.church,
      distanceMetres: haversineMetres(point, { lat: d.church.lat, lon: d.church.lon }),
    })).sort((a, b) => a.distanceMetres - b.distanceMetres);
  } else {
    const key = tileKey(point.lat, point.lon, radius);
    const cached = await getCachedChurches(key);
    if (cached) {
      results = cached
        .map((church) => ({
          church,
          distanceMetres: haversineMetres(point, { lat: church.lat, lon: church.lon }),
        }))
        .sort((a, b) => a.distanceMetres - b.distanceMetres);
    } else {
      try {
        const found = await findChurchesNear(point, { radiusMetres: radius, limit: 60 });
        results = found.map((f) => ({ church: f.church, distanceMetres: f.distanceMetres }));
        await putCachedChurches(
          key,
          results.map((r) => r.church),
        );
        await Promise.all(results.map((r) => putChurch(r.church)));
      } catch (err) {
        if (err instanceof OverpassUnavailableError) {
          notices.push(
            'We could not reach the OpenStreetMap service that tells us where churches are. Please try again in a few minutes.',
          );
        } else {
          notices.push(`We could not search for churches just now: ${String(err)}`);
        }
        return {
          churches: [],
          containsExampleData: false,
          notices,
          attribution: OSM_ATTRIBUTION,
        };
      }
    }
  }

  // Fill in the country code once for the whole search rather than per church:
  // it decides the holy-day rules, and one reverse lookup is enough.
  let searchCountry = results.find((r) => r.church.countryCode)?.church.countryCode;
  if (!searchCountry && !isDemoMode()) {
    searchCountry = await reverseGeocodeCountry(point);
  }

  const selected = results.slice(0, limit);
  let extractions = 0;
  const cards: ChurchCard[] = [];

  for (const { church, distanceMetres } of selected) {
    const withCountry: Church = church.countryCode
      ? church
      : { ...church, countryCode: searchCountry };

    let schedule: ChurchSchedule | undefined;
    let staleSince: string | undefined;

    if (isDemoMode()) {
      schedule = demoChurchById(church.id)?.schedule;
    } else {
      const allow =
        !!params.fetchSchedules &&
        extractions < MAX_EXTRACTIONS_PER_REQUEST &&
        !!withCountry.website;
      if (allow) extractions += 1;
      const loaded = await loadScheduleFor(withCountry, { allowExtraction: allow });
      schedule = loaded.schedule;
      staleSince = loaded.staleSince;
    }

    const reports = await readUserReports(church.id);
    cards.push(
      buildCard(withCountry, schedule, {
        distanceMetres,
        now,
        staleSince,
        disputed: reportSummary(reports).verdict === 'disputed',
      }),
    );
    if (withCountry.example) containsExampleData = true;
  }

  // Churches with a known next Mass first — that is the question being asked —
  // then by distance.
  cards.sort((a, b) => {
    if (!!a.next !== !!b.next) return a.next ? -1 : 1;
    if (a.next && b.next && a.next.startsAt !== b.next.startsAt) {
      return a.next.startsAt.localeCompare(b.next.startsAt);
    }
    return (a.distanceMetres ?? 0) - (b.distanceMetres ?? 0);
  });

  const todayDay = liturgicalDay(
    (() => {
      const iso = localDateIn(now, selected[0]?.church.timezone ?? 'UTC');
      const [y, m, d] = iso.split('-').map(Number);
      return utc(y, m, d);
    })(),
    searchCountry,
  );

  if (cards.some((c) => c.nonRomanCalendar)) {
    notices.push(
      'Some churches near you belong to an Eastern Catholic Church, which follows a different calendar from the Roman one. Feast days shown here may not apply to them.',
    );
  }

  return {
    churches: cards,
    today: { day: todayDay, explanation: explainDay(todayDay) },
    containsExampleData,
    notices,
    attribution: OSM_ATTRIBUTION,
  };
}

export interface DetailParams {
  churchId: string;
  refresh?: boolean;
  now?: Date;
  days?: number;
}

export async function churchDetail(
  params: DetailParams,
): Promise<ChurchDetailResponse | undefined> {
  const now = params.now ?? new Date();
  const days = params.days ?? 14;
  const notices: string[] = [];

  const demo = demoChurchById(params.churchId);
  let church: Church | undefined = demo?.church ?? (await getChurch(params.churchId));
  if (!church) return undefined;

  let schedule: ChurchSchedule | undefined;
  let staleSince: string | undefined;
  let diagnostics: ChurchDetailResponse['diagnostics'];

  if (demo) {
    schedule = demo.schedule;
    notices.push(
      'This is an invented example parish, not a real church. The times below are not real Mass times.',
    );
  } else if (params.refresh) {
    const report = await extractSchedule(church);
    if (report.schedule.rules.length) {
      await putSchedule(report.schedule);
      schedule = report.schedule;
    } else {
      const stale = await getScheduleEvenIfStale(church.id);
      schedule = stale?.schedule;
      staleSince = stale?.savedAt;
    }
    diagnostics = {
      problems: report.problems,
      observations: report.observations,
      pagesRead: report.pagesRead,
      modelUsed: report.modelUsed,
    };
  } else {
    const loaded = await loadScheduleFor(church, { allowExtraction: true });
    schedule = loaded.schedule;
    staleSince = loaded.staleSince;
    if (loaded.problems.length) diagnostics = { problems: loaded.problems, observations: [], pagesRead: [] };
  }

  const reports = await readUserReports(church.id);
  const summary = reportSummary(reports);
  if (summary.verdict === 'confirmed') {
    schedule = schedule ? { ...schedule, quality: 'confirmed' } : schedule;
  }

  const card = buildCard(church, schedule, {
    now,
    staleSince,
    disputed: summary.verdict === 'disputed',
  });

  const occurrences = schedule
    ? resolveOccurrences(church, schedule, { from: now, days, limit: 120 })
    : [];
  const grouped = groupByLocalDate(occurrences, church.timezone);

  const byDate = grouped.map((g) => {
    const [y, m, d] = g.date.split('-').map(Number);
    const day = liturgicalDay(utc(y, m, d), church!.countryCode);
    return { date: g.date, day, explanation: explainDay(day), occurrences: g.occurrences };
  });

  if (card.nonRomanCalendar) {
    notices.push(
      `This is a ${church.rite.replace(/-/g, ' ')} parish. It follows its own liturgical calendar, so the feast days shown here — which come from the Roman calendar — may not be the ones celebrated.`,
    );
  }
  if (church.identification === 'name-inferred') {
    notices.push(
      'We believe this is a Catholic church from its name, but the map data does not say so outright. Please check before travelling.',
    );
  }

  return { card, byDate, diagnostics, notices, attribution: OSM_ATTRIBUTION };
}
