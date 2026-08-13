/**
 * Finding a church's website through Wikidata.
 *
 * ## Why this works
 *
 * The churches most likely to be searched for are the ones a stranger in a city
 * asks about: the cathedral, the basilica, the famous old parish downtown. Those
 * are exactly the churches with a Wikipedia article — and therefore a Wikidata
 * item, and therefore, very often, property **P856 (official website)**. A great
 * many of them have no `website` tag in OpenStreetMap at all, but do carry a
 * `wikidata` tag, because linking a landmark to its Wikidata item is a thing OSM
 * mappers enjoy doing far more than typing URLs.
 *
 * So one cheap request converts a `wikidata=Q…` tag into a website the extraction
 * pipeline can then read, with no API key, no rate-limit registration, and no
 * per-church curation. It is the closest thing to free coverage this app has.
 *
 * Wikidata's content is CC0, so there is nothing to attribute and nothing to
 * license — though the app credits it anyway, because saying where a fact came
 * from is the whole point.
 */

/** Wikidata's REST endpoint for a single property — kilobytes, not megabytes. */
function statementsUrl(qid: string): string {
  return `https://www.wikidata.org/w/rest.php/wikibase/v1/entities/items/${qid}/statements?property=P856`;
}

interface WikibaseStatement {
  property?: { id?: string };
  value?: { type?: string; content?: unknown };
  rank?: string;
}

export interface WikidataLookupOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * The official website recorded for a Wikidata item, or `undefined`.
 *
 * Never throws: a failure here must degrade to "we have no website for this
 * church", which is a state the rest of the app already handles gracefully. An
 * exception would turn a missing bonus into a failed search.
 */
export async function officialWebsiteFor(
  qid: string,
  opts: WikidataLookupOptions = {},
): Promise<string | undefined> {
  if (!/^Q\d+$/.test(qid)) return undefined;
  const doFetch = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 6_000);

  try {
    const res = await doFetch(statementsUrl(qid), {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'MassFinder/0.1 (Catholic Mass times; +https://github.com/rsarin20/quant)',
      },
      signal: opts.signal ?? controller.signal,
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as Record<string, WikibaseStatement[]>;
    const statements = body.P856 ?? [];

    // Deprecated statements are Wikidata's way of recording a URL that used to be
    // right. Following one would send the crawler at a dead or hijacked domain.
    const usable = statements.filter((s) => s.rank !== 'deprecated');
    for (const statement of usable) {
      const value = statement.value?.content;
      if (typeof value !== 'string') continue;
      try {
        const url = new URL(value);
        if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
      } catch {
        // Not a URL — try the next statement.
      }
    }
    return undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}
