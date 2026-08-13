/**
 * Finding and reading the page that has the Mass times on it.
 *
 * Parish websites are the least standardised corner of the public web. Times
 * live in a hand-drawn table, an image, a PDF bulletin, a sidebar widget, or a
 * sentence in the middle of a welcome message. There is no schema to rely on and
 * no API. What there *is*, almost always, is a link whose text says some
 * variation of "Mass Times".
 *
 * So the strategy is: fetch the homepage, score its links, fetch the best few,
 * and hand the text to the extractor. Deliberately shallow — one hop — because
 * depth buys very little and costs a parish's small server a great deal.
 */

const MAX_BYTES = 3_000_000;
/**
 * Per-page timeout.
 *
 * Was 15 seconds, which one unresponsive parish server could spend on its own —
 * and it was spending it out of a budget shared with eleven other churches. A page
 * that has not answered in eight seconds is not going to rescue this request, and
 * the churches waiting behind it deserve the time more.
 */
const FETCH_TIMEOUT_MS = 8_000;

/** Link text and URL fragments that suggest a Mass-times page, by language. */
const SCHEDULE_HINTS: Array<[RegExp, number]> = [
  [/mass\s*times?/i, 100],
  [/times?\s*of\s*mass/i, 100],
  [/horarios?\s*(de\s*)?misas?/i, 100],
  [/hor(á|a)rios?\s*(das\s*)?missas?/i, 100],
  [/horaires?\s*(des\s*)?messes?/i, 100],
  [/orari\s*(delle\s*)?messe/i, 100],
  [/gottesdienstzeiten|messzeiten/i, 100],
  [/msze\s*(ś|s)wi(ę|e)te|porz(ą|a)dek\s*nabo(ż|z)e(ń|n)stw/i, 100],
  [/schedule/i, 70],
  [/mass|misas?|missas?|messes?|messe|msze/i, 60],
  // A nav item reading just "Times" or "Hours" is common and used to score zero,
  // which meant the one link on the site that led to the answer was discarded.
  [/\btimes?\b|\bhours\b|\bhorario\b|\bhoraire\b|\borari\b|\bzeiten\b/i, 55],
  [/worship|liturgy|liturgia|liturgie|liturgies|celebrations?/i, 50],
  [/service\s*times?/i, 50],
  [/parish\s*(info|information|life)|welcome/i, 25],
  [/bulletin|boletin|bollettino|biuletyn/i, 40],
  [/sacraments?|sacramentos?/i, 20],
  [/about|contact|home/i, -10],
  [/donate|giving|privacy|cookie|login|register/i, -60],
];

export interface FetchedPage {
  requestedUrl: string;
  finalUrl: string;
  title?: string;
  text: string;
  contentType: string;
  fetchedAt: string;
}

export interface CrawlOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  maxPages?: number;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  ntilde: 'ñ',
  uuml: 'ü',
  ouml: 'ö',
  auml: 'ä',
  ccedil: 'ç',
  egrave: 'è',
  agrave: 'à',
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole);
}

/**
 * HTML → plain text, preserving line structure.
 *
 * Line structure is not cosmetic here: the heuristic extractor works line by
 * line, and a table row flattened into its neighbours turns "Sunday 9:00" and
 * "Monday 18:00" into one unreadable smear. So block-level and table elements
 * become newlines before the tags are stripped.
 */
export function htmlToText(html: string): { text: string; title?: string } {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : undefined;

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|td|th|dt|dd)>/gi, '\n')
    .replace(/<\/?(td|th)[^>]*>/gi, '\t')
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map((line) => decodeEntities(line).replace(/[ \t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');

  return { text, title };
}

/** Extract absolute, same-site links with their anchor text. */
export function extractLinks(
  html: string,
  baseUrl: string,
): Array<{ url: string; text: string }> {
  const out: Array<{ url: string; text: string }> = [];
  const base = new URL(baseUrl);
  const pattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((m = pattern.exec(html)) !== null) {
    const href = m[1].trim();
    if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(href)) continue;
    let resolved: URL;
    try {
      resolved = new URL(href, base);
    } catch {
      continue;
    }
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue;
    // Stay on the parish's own site; an off-site link is someone else's data.
    if (resolved.hostname !== base.hostname) continue;
    resolved.hash = '';
    const key = resolved.toString();
    if (seen.has(key)) continue;
    seen.add(key);

    const anchorText = htmlToText(m[2]).text.replace(/\s+/g, ' ').trim();
    out.push({ url: key, text: anchorText });
  }
  return out;
}

/** Score a link on how likely it leads to Mass times. */
export function scoreLink(link: { url: string; text: string }, baseUrl: string): number {
  const haystack = `${link.text} ${decodeURIComponent(link.url)}`;
  let score = 0;
  for (const [pattern, weight] of SCHEDULE_HINTS) {
    if (pattern.test(haystack)) score += weight;
  }
  if (/\.pdf($|\?)/i.test(link.url)) score += 10;
  // Prefer shallow paths — a top-level /mass-times beats a buried archive page.
  try {
    const depth = new URL(link.url).pathname.split('/').filter(Boolean).length;
    score -= Math.max(0, depth - 1) * 5;
  } catch {
    /* ignore */
  }
  if (link.url === baseUrl) score -= 20;
  return score;
}

async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  outer?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  outer?.addEventListener('abort', onAbort);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onAbort);
  }
}

/** Fetch one page and reduce it to text. Handles HTML and PDF. */
export async function fetchPage(
  url: string,
  opts: CrawlOptions = {},
): Promise<FetchedPage> {
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await withTimeout(
    (signal) =>
      doFetch(url, {
        signal,
        redirect: 'follow',
        headers: {
          'User-Agent':
            'MassFinder/0.1 (Catholic Mass times; +https://github.com/rsarin20/quant)',
          Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5',
        },
      }),
    opts.signal,
  );

  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  const fetchedAt = new Date().toISOString();

  if (/application\/pdf/i.test(contentType) || /\.pdf($|\?)/i.test(url)) {
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      throw new Error(`${url} is larger than the ${MAX_BYTES}-byte limit`);
    }
    // Bulletins are very often the only place the current schedule appears, so
    // reading PDFs is not an optional extra.
    const { default: pdfParse } = await import('pdf-parse');
    const parsed = await pdfParse(buffer);
    return {
      requestedUrl: url,
      finalUrl: res.url || url,
      text: parsed.text.replace(/\r\n/g, '\n'),
      title: parsed.info?.Title,
      contentType,
      fetchedAt,
    };
  }

  const raw = await res.text();
  if (raw.length > MAX_BYTES) {
    throw new Error(`${url} is larger than the ${MAX_BYTES}-byte limit`);
  }
  const { text, title } = htmlToText(raw);
  return {
    requestedUrl: url,
    finalUrl: res.url || url,
    text,
    title,
    contentType,
    fetchedAt,
  };
}

export interface CrawlResult {
  pages: FetchedPage[];
  /** Pages we tried and could not read, with the reason. */
  failures: Array<{ url: string; reason: string }>;
}

/**
 * Fetch a parish site's homepage plus the most promising schedule pages.
 */
export async function crawlParishSite(
  homepageUrl: string,
  opts: CrawlOptions = {},
): Promise<CrawlResult> {
  const maxPages = opts.maxPages ?? 4;
  const pages: FetchedPage[] = [];
  const failures: Array<{ url: string; reason: string }> = [];

  let homepageHtml = '';
  const doFetch = opts.fetchImpl ?? fetch;

  try {
    const res = await withTimeout(
      (signal) =>
        doFetch(homepageUrl, {
          signal,
          redirect: 'follow',
          headers: {
            'User-Agent':
              'MassFinder/0.1 (Catholic Mass times; +https://github.com/rsarin20/quant)',
            Accept: 'text/html,application/xhtml+xml',
          },
        }),
      opts.signal,
    );
    if (!res.ok) throw new Error(`returned ${res.status}`);
    homepageHtml = await res.text();
    const { text, title } = htmlToText(homepageHtml);
    pages.push({
      requestedUrl: homepageUrl,
      finalUrl: res.url || homepageUrl,
      text,
      title,
      contentType: res.headers.get('content-type') ?? 'text/html',
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    failures.push({ url: homepageUrl, reason: String(err) });
    return { pages, failures };
  }

  const candidates = extractLinks(homepageHtml, pages[0].finalUrl)
    .map((link) => ({ link, score: scoreLink(link, pages[0].finalUrl) }))
    .filter((c) => c.score > 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPages - 1);

  // Fetched together rather than one after another. Three pages at 15s of
  // permitted latency each is 45s serially, which on a serverless function means
  // the request is killed before the answer arrives — the user sees "no times" for
  // a church whose times were sitting on page three. It is also no heavier on the
  // parish's server: the same pages, the same total bytes, just not queued.
  const fetched = await Promise.all(
    candidates.map(async ({ link }) => {
      try {
        return { page: await fetchPage(link.url, opts) };
      } catch (err) {
        return { failure: { url: link.url, reason: String(err) } };
      }
    }),
  );
  for (const result of fetched) {
    if (result.page) pages.push(result.page);
    if (result.failure) failures.push(result.failure);
  }

  return { pages, failures };
}

/**
 * Does this page actually belong to the church we think it does?
 *
 * Only asked of pages reached from a URL we inferred rather than one a mapper
 * recorded — a curated entry, a Wikidata claim, a diocesan index match. Those can
 * be wrong in a uniquely damaging way: a plausible-looking site that belongs to a
 * *different* parish, whose Mass times would then be extracted, quoted, sourced
 * and presented with full confidence under this church's name. The person acts on
 * it and finds a locked door.
 *
 * The test is deliberately loose — one distinctive word from the church's name
 * appearing anywhere in the page — because parishes rename themselves constantly
 * ("St Mary's" on the sign, "Parish of the Assumption" on the site) and a strict
 * check would reject far more real matches than false ones. Loose is enough: it
 * catches the failure that matters, which is a wholly unrelated site.
 */
export function verifyPageIdentity(
  page: { text: string; title?: string },
  churchName: string,
): boolean {
  // Words too common in church names to distinguish one from another.
  const generic = new Set([
    'saint', 'st', 'the', 'of', 'church', 'catholic', 'roman', 'parish', 'our',
    'lady', 'holy', 'blessed', 'sacred', 'cathedral', 'basilica', 'chapel',
    'and', 'de', 'la', 'el', 'iglesia', 'santa', 'san', 'sant', 'kirche',
  ]);
  const distinctive = churchName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !generic.has(w));

  // A name made entirely of generic words ("Holy Cross Church") gives us nothing
  // to verify against, so we do not pretend to have verified it.
  if (!distinctive.length) return true;

  const haystack = `${page.title ?? ''} ${page.text}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return distinctive.some((word) => haystack.includes(word));
}
