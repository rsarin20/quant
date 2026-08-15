import { withCuratedWebsite } from '../directory/registry';
import { findChurchPhoto } from './photos';
import { findWebsiteBySearch, isSearchConfigured } from './searchDiscovery';
import type { Church } from './types';
import { officialWebsiteFor } from './wikidata';

/**
 * Work out where to read a church's Mass times from.
 *
 * The single biggest cause of an empty result in this app is not a bad extractor —
 * it is not knowing the church's website. A survey of central Dublin found a
 * `website` tag on 7 of 25 Catholic churches. Everything here exists to shrink
 * that 18.
 *
 * Three sources, in descending order of trust:
 *
 *  1. **The OSM tags**, already in hand, read across all of OSM's competing URL
 *     keys rather than just `website`.
 *  2. **Our curated directory** — hand-checked, and the only one that can fix a
 *     church OSM and Wikidata both know nothing about.
 *  3. **Wikidata's P856**, fetched live. Free, keyless, and unreasonably effective
 *     on exactly the churches a stranger in a city searches for, because a
 *     cathedral has an article and a suburban parish does not.
 *
 * Anything found by 2 or 3 is stamped so the crawler knows to make the page prove
 * it belongs to this church before quoting it.
 */
export interface DiscoverOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  /** Skip the network lookup — used by the offline tests. */
  skipWikidata?: boolean;
  /** Skip the search-engine lookup, whatever is configured. */
  skipSearch?: boolean;
}

export async function discoverWebsite(
  church: Church,
  opts: DiscoverOptions = {},
): Promise<Church> {
  // 1 & 2: no network needed.
  const curated = withCuratedWebsite(church);
  if (curated.website) return curated;

  // 3: one small request, and only when OSM gave us an item to look up.
  if (church.wikidata && !opts.skipWikidata) {
    const website = await officialWebsiteFor(church.wikidata, {
      fetchImpl: opts.fetchImpl,
      signal: opts.signal,
    });
    if (website) {
      return {
        ...curated,
        website,
        websiteSource: 'wikidata',
        sources: [
          ...curated.sources,
          {
            kind: 'seed-data',
            url: `https://www.wikidata.org/wiki/${church.wikidata}`,
            fetchedAt: new Date().toISOString(),
            detail: `Official website from Wikidata item ${church.wikidata}`,
          },
        ],
      };
    }
  }

  // 4: ask a search engine, if one is configured. Last because it is the only
  // step that costs money, and because a search engine will confidently return
  // *something* for a church it has never heard of — so it is the step most in
  // need of the verification the crawler then applies.
  if (!opts.skipSearch && isSearchConfigured()) {
    const found = await findWebsiteBySearch(church, {
      fetchImpl: opts.fetchImpl,
      signal: opts.signal,
    });
    if (found) {
      return {
        ...curated,
        website: found.url,
        websiteSource: 'web-search',
        sources: [
          ...curated.sources,
          {
            kind: 'seed-data',
            url: found.url,
            fetchedAt: new Date().toISOString(),
            detail: `Website found by searching the web for “${found.query}”`,
          },
        ],
      };
    }
  }

  return curated;
}

/**
 * Attach a photograph, if one can be found.
 *
 * Separate from the website hunt because it is worth doing even when we already
 * know the website, and because a picture and a schedule fail independently: a
 * church can have an excellent photograph and an unreadable site, or the reverse.
 */
export async function withPhoto(
  church: Church,
  opts: DiscoverOptions = {},
): Promise<Church> {
  if (church.photo) return church;
  if (!church.commonsTag && !church.wikidata) return church;
  const photo = await findChurchPhoto({
    commonsTag: church.commonsTag,
    wikidata: church.wikidata,
    fetchImpl: opts.fetchImpl,
    signal: opts.signal,
  });
  return photo ? { ...church, photo } : church;
}

/**
 * Is it worth spending a network round trip on this church at all?
 *
 * Used to allocate a request's extraction budget. A church with a website, an OSM
 * `service_times` tag, a curated entry or a Wikidata item has somewhere to look;
 * one with none of those has nothing but its diocese, which is still worth trying
 * when the diocese is known. Only a church with no lead whatsoever is skipped —
 * and it is skipped so the budget goes to a church that can actually be answered.
 */
export function hasSomewhereToLook(church: Church, hasDirectory: boolean): boolean {
  return !!(church.website || church.serviceTimes || church.wikidata || hasDirectory);
}
