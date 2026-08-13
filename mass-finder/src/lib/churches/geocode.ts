import type { LatLon } from './geo';

/**
 * Place-name lookup, so someone who will not or cannot share their location can
 * still type "Bandra, Mumbai" and get an answer.
 *
 * Uses OpenStreetMap's Nominatim. Its usage policy caps automated use at one
 * request per second and requires a real User-Agent; both are respected here,
 * and results are cached by the caller. A self-hosted or commercial instance can
 * be substituted with `NOMINATIM_ENDPOINT`.
 */

const DEFAULT_ENDPOINT = 'https://nominatim.openstreetmap.org';

function endpoint(): string {
  return (process.env.NOMINATIM_ENDPOINT ?? DEFAULT_ENDPOINT).replace(/\/$/, '');
}

const USER_AGENT =
  'MassFinder/0.1 (Catholic Mass times; +https://github.com/rsarin20/quant)';

export interface Place {
  displayName: string;
  lat: number;
  lon: number;
  countryCode?: string;
}

export interface GeocodeOptions {
  limit?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  /** Bias results towards this language, matching the user's browser. */
  acceptLanguage?: string;
}

interface NominatimPlace {
  display_name: string;
  lat: string;
  lon: string;
  address?: { country_code?: string };
}

/** Free-text place search. */
export async function geocode(
  query: string,
  opts: GeocodeOptions = {},
): Promise<Place[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const doFetch = opts.fetchImpl ?? fetch;
  const url = new URL(`${endpoint()}/search`);
  url.searchParams.set('q', trimmed);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(opts.limit ?? 5));

  const res = await doFetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      ...(opts.acceptLanguage ? { 'Accept-Language': opts.acceptLanguage } : {}),
    },
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`Nominatim search returned ${res.status}`);
  const body = (await res.json()) as NominatimPlace[];
  return body.map((p) => ({
    displayName: p.display_name,
    lat: Number(p.lat),
    lon: Number(p.lon),
    countryCode: p.address?.country_code?.toUpperCase(),
  }));
}

/**
 * Coordinates → country code.
 *
 * This is not cosmetic: the country decides which holy days of obligation are in
 * force and whether Ascension is a Thursday or a Sunday, so a wrong country code
 * produces a confidently wrong answer about whether someone is obliged to be at
 * Mass. When the lookup fails we return `undefined` and the calendar falls back
 * to universal law, labelled as such.
 */
export async function reverseGeocodeCountry(
  point: LatLon,
  opts: GeocodeOptions = {},
): Promise<string | undefined> {
  const doFetch = opts.fetchImpl ?? fetch;
  const url = new URL(`${endpoint()}/reverse`);
  url.searchParams.set('lat', String(point.lat));
  url.searchParams.set('lon', String(point.lon));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('zoom', '3');
  url.searchParams.set('addressdetails', '1');

  try {
    const res = await doFetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: opts.signal,
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as NominatimPlace;
    return body.address?.country_code?.toUpperCase();
  } catch {
    return undefined;
  }
}
