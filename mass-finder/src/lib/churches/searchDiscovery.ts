import type { Church } from './types';

/**
 * Finding a parish's website with a search engine.
 *
 * ## Why this, and what it is careful not to do
 *
 * A person who searches the web for "Sankt Peter Zürich Gottesdienste" gets the
 * right answer in one go. The app was instead offering them a link to do that
 * search themselves — which works, but is an admission that we could not.
 *
 * So we do the search. But note precisely *what* is searched for: **the parish's
 * website**, not the Mass times. A search result's title and snippet frequently
 * contain times, and it is very tempting to read them straight out. We do not,
 * for the reason the rest of this app is built around: a snippet is an
 * undated, unattributable fragment written by a search engine's summariser, and a
 * time taken from one cannot be traced back to anything a parish actually
 * published. Search gets us a URL; the existing pipeline then fetches that URL
 * and takes times only with a verbatim quote from the page itself.
 *
 * That means search coverage improves the *hit rate* without touching the
 * accuracy contract at all — the same verification gates apply to a
 * search-discovered site as to one an OSM mapper typed in.
 *
 * ## Providers
 *
 * Keyed, because every general web-search API is. Configure whichever you have:
 *
 *  - `BRAVE_SEARCH_API_KEY` — Brave's Search API. Has a free tier.
 *  - `GOOGLE_API_KEY` + `GOOGLE_CSE_ID` — Google Programmable Search.
 *
 * With neither set this module does nothing and the app behaves exactly as
 * before, still offering the reader the search link. It is a capability that
 * switches on, not a dependency.
 */

export interface SearchResult {
  url: string;
  title: string;
  snippet?: string;
}

export interface SearchProvider {
  name: string;
  search(query: string, opts: { fetchImpl?: typeof fetch; signal?: AbortSignal }): Promise<SearchResult[]>;
}

/**
 * Hosts that are never the answer.
 *
 * Aggregators, encyclopaedias and social networks all rank well for a church's
 * name, and all of them are the wrong thing to crawl: a directory page yields
 * other parishes' times (the failure that `looksLikeMultiParishListing` exists
 * to catch), an encyclopaedia article yields none, and a social page is
 * login-walled. Excluding them here saves a wasted fetch and a wasted guard.
 */
const NOT_A_PARISH_SITE = [
  /(^|\.)wikipedia\.org$/i,
  /(^|\.)wikiwand\.com$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)youtube\.com$/i,
  /(^|\.)tripadvisor\./i,
  /(^|\.)yelp\.com$/i,
  /(^|\.)masstimes\.org$/i,
  /(^|\.)catholicdirectory\.com$/i,
  /(^|\.)catholicclocks\.com$/i,
  /(^|\.)churchservices\.tv$/i,
  /(^|\.)google\./i,
  /(^|\.)bing\.com$/i,
  /(^|\.)mapy?\./i,
  /(^|\.)openstreetmap\.org$/i,
  /(^|\.)booking\.com$/i,
  /(^|\.)eventbrite\./i,
];

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function isPlausibleParishSite(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return !NOT_A_PARISH_SITE.some((p) => p.test(host));
}

/**
 * The query. Deliberately in the local idiom where we can guess it.
 *
 * A German-speaking parish's site says "Gottesdienste", not "Mass times", and a
 * query in the wrong language ranks the English-language aggregators above the
 * parish itself. The country code is the only hint we reliably have, so it picks
 * the schedule word.
 */
const SCHEDULE_WORD_BY_COUNTRY: Record<string, string> = {
  CH: 'Gottesdienste Pfarrei',
  DE: 'Gottesdienste Pfarrei',
  AT: 'Gottesdienste Pfarre',
  FR: 'horaires des messes paroisse',
  BE: 'horaires des messes paroisse',
  IT: 'orari messe parrocchia',
  ES: 'horario de misas parroquia',
  MX: 'horario de misas parroquia',
  AR: 'horario de misas parroquia',
  CO: 'horario de misas parroquia',
  BR: 'horário das missas paróquia',
  PT: 'horário das missas paróquia',
  PL: 'msze święte parafia',
  NL: 'vieringen parochie',
};

export function buildSearchQuery(church: Church): string {
  const place = [church.address?.city, church.address?.state]
    .filter(Boolean)
    .join(' ');
  const country = (church.countryCode ?? '').toUpperCase();
  const scheduleWord = SCHEDULE_WORD_BY_COUNTRY[country] ?? 'Mass times parish';
  return [church.name, place, scheduleWord].filter(Boolean).join(' ');
}

/**
 * Rank a result on how likely it is to be *this church's own* website.
 *
 * The distinctive words of the church's name must appear somewhere — a result
 * that matches only "Saint" and "Church" matches every parish on earth. A short
 * host and a shallow path both suggest a parish's own domain rather than a page
 * about it buried in a larger site.
 */
export function scoreSearchResult(result: SearchResult, church: Church): number {
  if (!isPlausibleParishSite(result.url)) return 0;

  const generic = new Set([
    'saint', 'st', 'the', 'of', 'church', 'catholic', 'roman', 'parish', 'our',
    'lady', 'holy', 'blessed', 'sacred', 'kirche', 'pfarrei', 'pfarre', 'paroisse',
    'parrocchia', 'parroquia', 'iglesia', 'chiesa', 'eglise', 'église', 'sankt',
  ]);
  const distinctive = church.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !generic.has(w));

  const host = hostOf(result.url) ?? '';
  const haystack = `${result.title} ${result.snippet ?? ''} ${decodeURIComponent(result.url)}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  let score = 0;
  if (distinctive.length) {
    const hits = distinctive.filter((w) => haystack.includes(w)).length;
    // Nothing distinctive matched: this is a page about some other church.
    if (!hits) return 0;
    score += Math.round((hits / distinctive.length) * 60);
  }

  // The city being present is good evidence, given how many churches share names.
  const city = church.address?.city?.toLowerCase();
  if (city && haystack.includes(city)) score += 15;

  // A distinctive word in the *domain* is much stronger than one in a page title.
  if (distinctive.some((w) => host.includes(w))) score += 25;

  try {
    const depth = new URL(result.url).pathname.split('/').filter(Boolean).length;
    score -= Math.min(depth, 4) * 4;
  } catch {
    /* ignore */
  }
  return score;
}

// ── Providers ──────────────────────────────────────────────────────────────

const braveProvider: SearchProvider = {
  name: 'brave',
  async search(query, opts) {
    const key = process.env.BRAVE_SEARCH_API_KEY;
    if (!key) return [];
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', '10');
    const res = await (opts.fetchImpl ?? fetch)(url, {
      headers: { Accept: 'application/json', 'X-Subscription-Token': key },
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(`Brave search returned ${res.status}`);
    const body = (await res.json()) as {
      web?: { results?: Array<{ url?: string; title?: string; description?: string }> };
    };
    return (body.web?.results ?? [])
      .filter((r): r is { url: string; title?: string; description?: string } => !!r.url)
      .map((r) => ({ url: r.url, title: r.title ?? '', snippet: r.description }));
  },
};

const googleProvider: SearchProvider = {
  name: 'google-cse',
  async search(query, opts) {
    const key = process.env.GOOGLE_API_KEY;
    const cx = process.env.GOOGLE_CSE_ID;
    if (!key || !cx) return [];
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', key);
    url.searchParams.set('cx', cx);
    url.searchParams.set('q', query);
    url.searchParams.set('num', '10');
    const res = await (opts.fetchImpl ?? fetch)(url, {
      headers: { Accept: 'application/json' },
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(`Google search returned ${res.status}`);
    const body = (await res.json()) as {
      items?: Array<{ link?: string; title?: string; snippet?: string }>;
    };
    return (body.items ?? [])
      .filter((r): r is { link: string; title?: string; snippet?: string } => !!r.link)
      .map((r) => ({ url: r.link, title: r.title ?? '', snippet: r.snippet }));
  },
};

export function configuredSearchProvider(): SearchProvider | undefined {
  if (process.env.BRAVE_SEARCH_API_KEY) return braveProvider;
  if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID) return googleProvider;
  return undefined;
}

export function isSearchConfigured(): boolean {
  return !!configuredSearchProvider();
}

/**
 * The best candidate website for a church, or `undefined`.
 *
 * A minimum score is required rather than simply taking the top hit. A search
 * engine always returns *something*, and the top result for a church it has never
 * heard of is some other church — which, crawled, would produce that church's
 * Mass times under this one's name. Returning nothing is the correct answer far
 * more often than the first result is.
 */
export const MINIMUM_SEARCH_SCORE = 45;

export async function findWebsiteBySearch(
  church: Church,
  opts: { fetchImpl?: typeof fetch; signal?: AbortSignal; provider?: SearchProvider } = {},
): Promise<{ url: string; provider: string; query: string } | undefined> {
  const provider = opts.provider ?? configuredSearchProvider();
  if (!provider) return undefined;

  const query = buildSearchQuery(church);
  let results: SearchResult[];
  try {
    results = await provider.search(query, opts);
  } catch {
    // A search failure degrades to "no website found", never to a failed request.
    return undefined;
  }

  const best = results
    .map((result) => ({ result, score: scoreSearchResult(result, church) }))
    .sort((a, b) => b.score - a.score)[0];

  if (!best || best.score < MINIMUM_SEARCH_SCORE) return undefined;
  return { url: best.result.url, provider: provider.name, query };
}
