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
const FETCH_TIMEOUT_MS = 15_000;

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
  [/worship|liturgy|liturgia|liturgie/i, 50],
  [/service\s*times?/i, 50],
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

  for (const { link } of candidates) {
    try {
      pages.push(await fetchPage(link.url, opts));
    } catch (err) {
      failures.push({ url: link.url, reason: String(err) });
    }
  }

  return { pages, failures };
}
