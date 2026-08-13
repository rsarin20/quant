import { slugifyParish, type DioceseDirectory } from '../directory/dioceses';
import { extractLinks, fetchPage, verifyPageIdentity, type CrawlOptions, type FetchedPage } from './crawl';

/**
 * Reading a church's Mass times off its diocese's website.
 *
 * This is the path for the majority of churches — the ones with no website of
 * their own anywhere in OpenStreetMap, Wikidata or our curated list. Their times
 * are not unpublished; they are published on the diocese's parish page, because
 * the diocese maintains a parish finder whether the parish maintains a site or
 * not.
 *
 * Two ways in, cheapest first:
 *
 *  1. **Guess the URL.** Diocesan sites are nearly all a CMS with a predictable
 *     `/parish/{slug}/` shape. When we know the pattern, one request either lands
 *     on the parish page or 404s, and a 404 costs almost nothing.
 *  2. **Read the index.** Fetch the diocese's parish list and match its links
 *     against the church's name. Two requests, works without knowing the pattern.
 *
 * Every page reached this way is checked with `verifyPageIdentity()` before a
 * single time is taken from it. Matching "St Mary's" against a diocesan index of
 * two hundred parishes is exactly the situation where a near-miss is likely, and a
 * near-miss here would put the neighbouring parish's Mass times under this
 * church's name.
 */

/**
 * How well a directory link matches the church we are looking for.
 *
 * Scored on the distinctive words of the name — the ones that are not "saint",
 * "church" or "parish" — because those generic words match every link on the page
 * and would make the best match arbitrary.
 */
export function scoreDirectoryLink(
  link: { url: string; text: string },
  churchName: string,
): number {
  const generic = new Set([
    'saint', 'st', 'the', 'of', 'church', 'catholic', 'roman', 'parish', 'our',
    'lady', 'holy', 'blessed', 'sacred', 'and', 'de', 'la',
  ]);
  const words = churchName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const distinctive = words.filter((w) => w.length > 2 && !generic.has(w));
  if (!distinctive.length) return 0;

  const haystack = `${link.text} ${decodeURIComponent(link.url)}`.toLowerCase();
  let hits = 0;
  for (const word of distinctive) {
    if (haystack.includes(word)) hits += 1;
  }
  if (!hits) return 0;

  // Require most of the distinctive name to be present. "Saint Mary" matching a
  // link to "Saint Mary Magdalene" is a different parish, and a partial match on
  // one word out of three is not evidence.
  const ratio = hits / distinctive.length;
  if (ratio < 0.6) return 0;
  return Math.round(ratio * 100);
}

/** A URL with any fragment removed, for comparing "is this the same page". */
function withoutHash(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Is this a page about many parishes rather than about one?
 *
 * The guard that `verifyPageIdentity` cannot provide. A diocesan listing mentions
 * every parish in the diocese, so it passes an "does it mention this church" test
 * trivially — and then donates two hundred parishes' Mass times to whichever church
 * asked. The identity check answers "is this church on the page"; this answers "is
 * this page *about* this church", which is the question that matters.
 *
 * Measured by how many parish-scale schedule blocks the page carries. One parish
 * publishes a handful of Mass rows; a diocese publishes hundreds.
 */
export function looksLikeMultiParishListing(page: { text: string }): boolean {
  const parishMentions = (page.text.match(/\bparish\b/gi) ?? []).length;
  const vigilMentions = (page.text.match(/\bvigil\b/gi) ?? []).length;
  // A single parish says "vigil" once or twice. Twelve means twelve parishes.
  return parishMentions > 25 || vigilMentions > 8;
}

export interface DirectoryCrawlResult {
  pages: FetchedPage[];
  failures: Array<{ url: string; reason: string }>;
  /** The directory that produced these pages, for the sources list. */
  directoryLabel?: string;
  /** Pages that were fetched but rejected as belonging to another church. */
  rejected: Array<{ url: string; reason: string }>;
}

export async function crawlDirectoryForParish(
  directory: DioceseDirectory,
  churchName: string,
  opts: CrawlOptions = {},
): Promise<DirectoryCrawlResult> {
  const pages: FetchedPage[] = [];
  const failures: Array<{ url: string; reason: string }> = [];
  const rejected: Array<{ url: string; reason: string }> = [];

  // ── 1. Guess the parish URL ────────────────────────────────────────────
  if (directory.parishUrlPattern) {
    const guess = directory.parishUrlPattern.replace('{slug}', slugifyParish(churchName));
    try {
      const page = await fetchPage(guess, opts);
      // The guess can redirect to the diocese's full listing, which would be just
      // as wrong as reaching it by link.
      if (looksLikeMultiParishListing(page)) {
        rejected.push({
          url: page.finalUrl,
          reason: `${page.finalUrl} lists many parishes rather than this one`,
        });
      } else if (verifyPageIdentity(page, churchName)) {
        return { pages: [page], failures, rejected, directoryLabel: directory.label };
      }
      rejected.push({
        url: guess,
        reason: `The page at the guessed address does not mention ${churchName}`,
      });
    } catch (err) {
      // A 404 here is the expected outcome much of the time, not a problem worth
      // showing the reader — it just means the slug guess was wrong.
      failures.push({ url: guess, reason: String(err) });
    }
  }

  // ── 2. Read the index and match a link ─────────────────────────────────
  let indexPage: FetchedPage;
  try {
    indexPage = await fetchPage(directory.indexUrl, opts);
  } catch (err) {
    failures.push({ url: directory.indexUrl, reason: String(err) });
    return { pages, failures, rejected, directoryLabel: directory.label };
  }

  // `fetchPage` gives us text, not HTML, so re-fetch the raw markup for links.
  // Cheap in practice: the index was just requested and is almost always cached.
  const doFetch = opts.fetchImpl ?? fetch;
  let html = '';
  try {
    const res = await doFetch(indexPage.finalUrl, {
      headers: {
        'User-Agent':
          'MassFinder/0.1 (Catholic Mass times; +https://github.com/rsarin20/quant)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: opts.signal,
    });
    html = await res.text();
  } catch (err) {
    failures.push({ url: indexPage.finalUrl, reason: String(err) });
    return { pages, failures, rejected, directoryLabel: directory.label };
  }

  const indexKey = withoutHash(indexPage.finalUrl);
  const best = extractLinks(html, indexPage.finalUrl)
    // A link that resolves back to the index is an in-page anchor, not a parish
    // page. Following one hands the extractor the whole diocese's timetable —
    // every parish's rows — and it attributes all of them to this church. That
    // is how Dublin's pro-cathedral acquired five Sunday Masses belonging to
    // five other parishes, quoted and sourced as if they were its own.
    .filter((link) => withoutHash(link.url) !== indexKey)
    .map((link) => ({ link, score: scoreDirectoryLink(link, churchName) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  if (!best.length) {
    failures.push({
      url: indexPage.finalUrl,
      reason: `${directory.label} lists no parish matching ${churchName}`,
    });
    return { pages, failures, rejected, directoryLabel: directory.label };
  }

  const fetched = await Promise.all(
    best.map(async ({ link }) => {
      try {
        return { page: await fetchPage(link.url, opts) };
      } catch (err) {
        return { failure: { url: link.url, reason: String(err) } };
      }
    }),
  );

  for (const result of fetched) {
    if (result.failure) {
      failures.push(result.failure);
      continue;
    }
    const page = result.page!;
    if (looksLikeMultiParishListing(page)) {
      rejected.push({
        url: page.finalUrl,
        reason:
          `${page.finalUrl} lists many parishes rather than this one, so its times were not used`,
      });
      continue;
    }
    if (!verifyPageIdentity(page, churchName)) {
      rejected.push({
        url: page.finalUrl,
        reason: `This page does not mention ${churchName}, so its times were not used`,
      });
      continue;
    }
    pages.push(page);
  }

  return { pages, failures, rejected, directoryLabel: directory.label };
}
