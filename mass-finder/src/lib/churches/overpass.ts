import tzlookup from 'tz-lookup';

import { boxAround, haversineMetres, type BoundingBox, type LatLon } from './geo';
import type { Church, ChurchSearchResult, Rite, SourceRef } from './types';

/**
 * Global church discovery via OpenStreetMap.
 *
 * ## Why OpenStreetMap
 *
 * The brief is "every country, city and town in the world". That rules out the
 * obvious candidates:
 *
 *  - **Diocesan directories** are authoritative but there are ~3,000 dioceses,
 *    each with its own site, format and language. Worth harvesting eventually as
 *    a correctness layer, hopeless as a starting point.
 *  - **Google Places** has the best coverage but needs a billed API key, and its
 *    terms forbid storing and redistributing the place data that a fast,
 *    offline-capable app for older users needs.
 *  - **Existing Mass-time sites** (masstimes.org and friends) are regional, have
 *    no public API, and scraping them wholesale is neither polite nor legal.
 *
 * OpenStreetMap is the only dataset that is genuinely global, openly licensed
 * (ODbL — attribution required, which the UI does), free of API keys, and
 * queryable by bounding box. It holds several hundred thousand Catholic places
 * of worship.
 *
 * ## Its weakness, and what we do about it
 *
 * OSM tagging is uneven. Many churches carry `denomination=catholic`; plenty
 * carry only `religion=christian`; some carry nothing but a name. So we run two
 * passes with different confidence, and never silently merge them: a
 * `tagged-catholic` result is presented as a Catholic church, a `name-inferred`
 * result is presented as "possibly Catholic — please confirm".
 */

const DEFAULT_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

function endpoints(): string[] {
  const custom = process.env.OVERPASS_ENDPOINTS?.split(',').map((s) => s.trim()).filter(Boolean);
  return custom?.length ? custom : DEFAULT_ENDPOINTS;
}

/**
 * OSM's `denomination` values, mapped onto the sui iuris churches. The Roman
 * calendar this app computes only applies to the Latin church, so this mapping
 * is what stops us telling a Syro-Malabar congregation that Ascension is next
 * Thursday.
 */
const DENOMINATION_TO_RITE: Array<[RegExp, Rite]> = [
  [/^(roman_catholic|catholic|latin_catholic|roman_catholic_church)$/i, 'roman'],
  [/syro[-_ ]?malabar/i, 'syro-malabar'],
  [/syro[-_ ]?malankara/i, 'syro-malankara'],
  [/ukrainian[-_ ]?greek[-_ ]?catholic/i, 'ukrainian-greek-catholic'],
  [/maronite/i, 'maronite'],
  [/melkite/i, 'melkite'],
  [/chaldean/i, 'chaldean'],
  [/coptic[-_ ]?catholic/i, 'coptic-catholic'],
  [/armenian[-_ ]?catholic/i, 'armenian-catholic'],
  [/ethiopian[-_ ]?catholic|ge.ez/i, 'ethiopian-catholic'],
  [/greek[-_ ]?catholic|byzantine[-_ ]?catholic|byzantine_rite/i, 'byzantine'],
  [/eastern[-_ ]?catholic/i, 'other-eastern'],
];

export function riteFromDenomination(denomination?: string): Rite {
  if (!denomination) return 'unknown';
  for (const [pattern, rite] of DENOMINATION_TO_RITE) {
    if (pattern.test(denomination)) return rite;
  }
  if (/catholic/i.test(denomination)) return 'roman';
  return 'unknown';
}

/**
 * Names that suggest a Catholic church when the denomination tag is missing.
 * Deliberately conservative and multilingual: a false positive here shows a
 * person a church that turns out to be Anglican, which is a real failure for
 * someone who travelled to get there.
 */
const CATHOLIC_NAME_HINTS = [
  /\bcatholic\b/i,
  /\bcat[oó]lica?\b/i,
  /\bcattolica\b/i,
  /\bcatholique\b/i,
  /\bkatholische?\b/i,
  /\bkatolick[aá]\b/i,
  /\bkatolicki\b/i,
  /\bkatolik/i,
  /\br\.?\s?k\.?\s+(kerk|kirche)\b/i,
  /\bparafia\b/i,
  /\bparr[oó]quia\b/i,
  /\bparroquia\b/i,
  /\bparrocchia\b/i,
  /\bparoisse\b/i,
  /\bpfarrkirche\b/i,
];

function looksCatholicByName(tags: Record<string, string>): boolean {
  const haystack = [tags.name, tags['name:en'], tags.operator, tags.short_name]
    .filter(Boolean)
    .join(' ');
  if (!haystack) return false;
  return CATHOLIC_NAME_HINTS.some((r) => r.test(haystack));
}

/**
 * Build the Overpass QL query.
 *
 * Two unions in one query so we pay one round trip:
 *  1. Anything explicitly tagged as a Catholic denomination.
 *  2. Christian places of worship with no denomination at all, which the caller
 *     filters by name. We ask for these separately rather than fetching *all*
 *     Christian churches, because the latter is an order of magnitude more data
 *     for a worse signal.
 */
export function buildOverpassQuery(box: BoundingBox, timeoutSeconds = 25): string {
  const bbox = `${box.south},${box.west},${box.north},${box.east}`;
  const catholic =
    '["amenity"="place_of_worship"]["denomination"~"catholic",i]';
  const undenominated =
    '["amenity"="place_of_worship"]["religion"="christian"][!"denomination"]';
  return `[out:json][timeout:${timeoutSeconds}];
(
  nwr${catholic}(${bbox});
  nwr${undenominated}(${bbox});
);
out center tags;`;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/**
 * Resolve an IANA timezone from coordinates, offline.
 *
 * A Mass time is a wall-clock time in the parish's own timezone. Sending that to
 * a browser without the zone means a traveller three timezones away is told
 * Mass is at the wrong hour — the single most likely way this app misleads
 * someone. `tz-lookup` ships the timezone shapefile locally, so this needs no
 * network and cannot fail at request time.
 */
export function timezoneFor(lat: number, lon: number): string {
  try {
    return tzlookup(lat, lon);
  } catch {
    return 'UTC';
  }
}

function elementToChurch(el: OverpassElement, fetchedAt: string): Church | undefined {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat === undefined || lon === undefined) return undefined;

  const denomination = tags.denomination;
  const tagged = !!denomination && /catholic/i.test(denomination);
  if (!tagged && !looksCatholicByName(tags)) return undefined;

  const name =
    tags.name ?? tags['name:en'] ?? tags.official_name ?? 'Catholic church (unnamed)';

  const source: SourceRef = {
    kind: 'openstreetmap',
    url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    fetchedAt,
    detail: tagged
      ? `Tagged denomination=${denomination}`
      : 'No denomination tag; identified from the name',
  };

  return {
    id: `osm:${el.type}/${el.id}`,
    name,
    lat,
    lon,
    timezone: timezoneFor(lat, lon),
    countryCode: tags['addr:country'] || undefined,
    address: {
      street: tags['addr:street'],
      housenumber: tags['addr:housenumber'],
      city: tags['addr:city'],
      postcode: tags['addr:postcode'],
      state: tags['addr:state'],
      country: tags['addr:country'],
    },
    phone: tags.phone ?? tags['contact:phone'],
    website: tags.website ?? tags['contact:website'] ?? tags.url,
    email: tags.email ?? tags['contact:email'],
    rite: tagged ? riteFromDenomination(denomination) : 'unknown',
    denominationRaw: denomination,
    identification: tagged ? 'tagged-catholic' : 'name-inferred',
    sources: [source],
  };
}

export interface NearbyOptions {
  radiusMetres?: number;
  limit?: number;
  signal?: AbortSignal;
  /** Fetch implementation, injectable so the pipeline can be tested offline. */
  fetchImpl?: typeof fetch;
}

export class OverpassUnavailableError extends Error {
  constructor(
    message: string,
    readonly attempted: string[],
  ) {
    super(message);
    this.name = 'OverpassUnavailableError';
  }
}

/**
 * Churches near a point, nearest first.
 *
 * Tries each Overpass mirror in turn. Overpass is a free, volunteer-run service
 * with an explicit usage policy, so we send a descriptive User-Agent, keep the
 * query tight, and expect the caller to cache the result.
 */
export async function findChurchesNear(
  centre: LatLon,
  opts: NearbyOptions = {},
): Promise<ChurchSearchResult[]> {
  const radius = opts.radiusMetres ?? 5_000;
  const limit = opts.limit ?? 25;
  const doFetch = opts.fetchImpl ?? fetch;
  const query = buildOverpassQuery(boxAround(centre, radius));
  const fetchedAt = new Date().toISOString();

  const attempted: string[] = [];
  let lastError: unknown;

  for (const endpoint of endpoints()) {
    attempted.push(endpoint);
    try {
      const res = await doFetch(endpoint, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // Overpass asks identifiable clients to say who they are.
          'User-Agent': 'MassFinder/0.1 (Catholic Mass times; +https://github.com/rsarin20/quant)',
          Accept: 'application/json',
        },
        signal: opts.signal,
      });
      if (!res.ok) {
        lastError = new Error(`${endpoint} returned ${res.status}`);
        continue;
      }
      const body = (await res.json()) as { elements?: OverpassElement[] };
      const churches: ChurchSearchResult[] = [];
      for (const el of body.elements ?? []) {
        const church = elementToChurch(el, fetchedAt);
        if (!church) continue;
        churches.push({
          church,
          distanceMetres: haversineMetres(centre, { lat: church.lat, lon: church.lon }),
        });
      }
      churches.sort((a, b) => a.distanceMetres - b.distanceMetres);
      // Explicitly-tagged churches first within the same rough distance band, so
      // a confidently-Catholic church a little further away outranks a guess.
      return churches
        .filter((c) => c.distanceMetres <= radius)
        .sort((a, b) => {
          const bandA = Math.floor(a.distanceMetres / 500);
          const bandB = Math.floor(b.distanceMetres / 500);
          if (bandA !== bandB) return bandA - bandB;
          const confA = a.church.identification === 'tagged-catholic' ? 0 : 1;
          const confB = b.church.identification === 'tagged-catholic' ? 0 : 1;
          if (confA !== confB) return confA - confB;
          return a.distanceMetres - b.distanceMetres;
        })
        .slice(0, limit);
    } catch (err) {
      lastError = err;
    }
  }

  throw new OverpassUnavailableError(
    `Could not reach any OpenStreetMap Overpass mirror: ${String(lastError)}`,
    attempted,
  );
}

/** Exposed for the offline test suite. */
export const __testing = { elementToChurch, looksCatholicByName };
