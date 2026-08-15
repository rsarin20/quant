/**
 * A photograph of the church.
 *
 * ## Why it earns its place in an app for older users
 *
 * It is not decoration. Somebody arriving in an unfamiliar town has a name, an
 * address and a time, and no way to know which of the three buildings on the
 * square is the one they want. A photograph is how a person confirms they are in
 * the right place — often the only piece of the answer that survives the walk from
 * the bus stop, because it is the piece they can check with their eyes.
 *
 * ## Where the pictures come from
 *
 * **Wikimedia Commons**, reached two ways: the OSM `wikimedia_commons` tag when a
 * mapper set one, and Wikidata's image property (P18) otherwise. Coverage is
 * good for exactly the churches this matters most for — the ones a stranger is
 * looking for.
 *
 * ## Attribution is not optional
 *
 * Commons images are freely licensed, and nearly all of those licences (CC BY,
 * CC BY-SA) *require* naming the author and the licence. So the author, the
 * licence and a link to the file page are fetched alongside the image and
 * displayed with it. An app whose entire argument is that it shows you where its
 * facts came from cannot quietly strip a photographer's credit.
 *
 * Public-domain images have no author to name; the code carries whatever Commons
 * reports and the interface shows what exists.
 */

export interface ChurchPhoto {
  /** A width-limited thumbnail, which is all any view here needs. */
  url: string;
  /** Wider version for the detail page's header. */
  wideUrl: string;
  /** Commons file page — where the licence and full metadata live. */
  sourceUrl: string;
  /** Author as Commons reports it, plain text with markup stripped. */
  author?: string;
  /** Short licence name, e.g. "CC BY-SA 4.0". */
  license?: string;
  /** Where we learned of this file. */
  via: 'osm-tag' | 'wikidata';
}

/** Strip the HTML Commons returns inside its metadata fields. */
function plainText(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return text || undefined;
}

/**
 * Commons' thumbnail endpoint, which resizes on demand.
 *
 * `Special:FilePath` with a `width` is the documented, stable way to get a sized
 * image without first querying for its URL. Sizes are deliberately modest: the
 * audience includes people on old phones and slow connections, and a 4000px
 * cathedral photograph is a hostile thing to send them.
 */
function filePathUrl(fileName: string, width: number): string {
  const name = fileName.replace(/^File:/i, '').replace(/ /g, '_');
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=${width}`;
}

interface CommonsMetadata {
  Artist?: { value?: string };
  LicenseShortName?: { value?: string };
  Credit?: { value?: string };
}

/**
 * Author and licence for a Commons file. Best-effort: an image whose credit we
 * cannot fetch is still shown, with the link to its file page, which is where the
 * licence is authoritative anyway.
 */
async function creditFor(
  fileName: string,
  opts: { fetchImpl?: typeof fetch; signal?: AbortSignal },
): Promise<{ author?: string; license?: string }> {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'extmetadata');
  url.searchParams.set('titles', `File:${fileName.replace(/^File:/i, '')}`);

  try {
    const res = await (opts.fetchImpl ?? fetch)(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'MassFinder/0.1 (Catholic Mass times; +https://github.com/rsarin20/quant)',
      },
      signal: opts.signal,
    });
    if (!res.ok) return {};
    const body = (await res.json()) as {
      query?: { pages?: Record<string, { imageinfo?: Array<{ extmetadata?: CommonsMetadata }> }> };
    };
    const pages = body.query?.pages ?? {};
    const first = Object.values(pages)[0];
    const meta = first?.imageinfo?.[0]?.extmetadata;
    return {
      author: plainText(meta?.Artist?.value ?? meta?.Credit?.value),
      license: plainText(meta?.LicenseShortName?.value),
    };
  } catch {
    return {};
  }
}

/** Wikidata's image claim (P18) for an item, as a Commons file name. */
async function imageFileFromWikidata(
  qid: string,
  opts: { fetchImpl?: typeof fetch; signal?: AbortSignal },
): Promise<string | undefined> {
  if (!/^Q\d+$/.test(qid)) return undefined;
  const url = `https://www.wikidata.org/w/rest.php/wikibase/v1/entities/items/${qid}/statements?property=P18`;
  try {
    const res = await (opts.fetchImpl ?? fetch)(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'MassFinder/0.1 (Catholic Mass times; +https://github.com/rsarin20/quant)',
      },
      signal: opts.signal,
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as Record<
      string,
      Array<{ rank?: string; value?: { content?: unknown } }>
    >;
    for (const statement of body.P18 ?? []) {
      if (statement.rank === 'deprecated') continue;
      const value = statement.value?.content;
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export interface PhotoLookupOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  /** The OSM `wikimedia_commons` tag value, when the church had one. */
  commonsTag?: string;
  /** Wikidata item id from the OSM `wikidata` tag. */
  wikidata?: string;
}

/**
 * A photograph for a church, or `undefined`.
 *
 * Never throws. A missing picture is a cosmetic loss; a failed request that took
 * the Mass times down with it would not be.
 */
export async function findChurchPhoto(
  opts: PhotoLookupOptions,
): Promise<ChurchPhoto | undefined> {
  let fileName: string | undefined;
  let via: ChurchPhoto['via'] = 'osm-tag';

  // The OSM tag is free — no request at all — so it goes first.
  const tag = opts.commonsTag?.trim();
  if (tag && /^file:/i.test(tag)) {
    fileName = tag;
  } else if (tag && /\.(jpe?g|png|webp|tiff?)$/i.test(tag)) {
    // Some mappers write the bare file name, others "Category:...". Only a file
    // name is usable; a category would need another round trip to resolve.
    fileName = tag;
  }

  if (!fileName && opts.wikidata) {
    fileName = await imageFileFromWikidata(opts.wikidata, opts);
    via = 'wikidata';
  }
  if (!fileName) return undefined;

  const credit = await creditFor(fileName, opts);
  const clean = fileName.replace(/^File:/i, '').replace(/ /g, '_');
  return {
    url: filePathUrl(fileName, 640),
    wideUrl: filePathUrl(fileName, 1280),
    sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(clean)}`,
    author: credit.author,
    license: credit.license,
    via,
  };
}
