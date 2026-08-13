import { withCuratedWebsite } from '../directory/registry';
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
}

export async function discoverWebsite(
  church: Church,
  opts: DiscoverOptions = {},
): Promise<Church> {
  // 1 & 2: no network needed.
  const curated = withCuratedWebsite(church);
  if (curated.website) return curated;

  // 3: one small request, and only when OSM gave us an item to look up.
  if (!church.wikidata || opts.skipWikidata) return curated;

  const website = await officialWebsiteFor(church.wikidata, {
    fetchImpl: opts.fetchImpl,
    signal: opts.signal,
  });
  if (!website) return curated;

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
