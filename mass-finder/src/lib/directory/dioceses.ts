/**
 * Diocesan and national parish directories.
 *
 * ## Why this is the layer that scales
 *
 * A curated per-church entry costs one line of research per church. A diocesan
 * directory costs one line of research per *diocese* — and a diocese is 50 to 300
 * parishes. When a church has no website of its own, its diocese almost always
 * has a page about it, because the diocese needs that page for its own parish
 * finder. Those pages are plain server-rendered HTML with the Mass times sitting
 * in the text, which is exactly what the extractor is good at.
 *
 * So the crawl order for a church with no site is: find its diocese from its
 * country and region, fetch the diocese's parish index, find the entry whose name
 * matches this church, follow it, and read the times from there. Anything found
 * this way is stamped `diocese-website`, which ranks below the parish's own site
 * in `bestQuality()` — the diocese is authoritative about which parishes exist and
 * can lag about when their Masses are.
 *
 * ## What is deliberately not here
 *
 * Commercial Mass-time aggregators are not crawled. Their data is valuable and
 * their terms do not permit bulk extraction, and an app whose whole claim is
 * honesty cannot start by taking someone else's database. Where one covers a
 * country well, it appears in `SEARCH_FALLBACKS` as a **link** the reader can
 * follow — sending a person to the site that has the answer is both useful and
 * fair, and it is what the "we could not find times" card does instead of
 * shrugging.
 */

export interface DioceseDirectory {
  /** ISO 3166-1 alpha-2. */
  country: string;
  /**
   * Cities, counties or states this directory covers, lowercased. Matched against
   * the church's address. Empty means it covers the whole country.
   */
  regions?: string[];
  label: string;
  /**
   * The parish index — a page listing the diocese's parishes with links. The
   * crawler fetches this, scores its links against the church's name, and follows
   * the best match.
   */
  indexUrl: string;
  /**
   * Optional URL pattern for going straight to a parish page, `{slug}` replaced
   * with the church's slugified name. Tried before the index when present, since
   * it saves a fetch.
   */
  parishUrlPattern?: string;
}

export const DIOCESE_DIRECTORIES: DioceseDirectory[] = [
  {
    country: 'IE',
    regions: ['dublin', 'co. dublin', 'county dublin'],
    label: 'Archdiocese of Dublin',
    indexUrl: 'https://dublindiocese.ie/parishes/',
    parishUrlPattern: 'https://dublindiocese.ie/parish/{slug}/',
  },
  {
    country: 'IE',
    regions: ['derry', 'londonderry'],
    label: 'Diocese of Derry',
    indexUrl: 'https://www.derrydiocese.org/mass-times',
  },
  {
    country: 'IE',
    label: 'Catholic Bishops of Ireland parish finder',
    indexUrl: 'https://www.catholicbishops.ie/dioceses/',
  },

  // ── Switzerland ────────────────────────────────────────────────────────
  // Searches here came back blank, and the reason is structural: Switzerland has
  // no national Mass-times portal. Its six dioceses devolve the job to
  // *city-level* pastoral associations, which publish a combined timetable for
  // every parish in the city. So the unit of coverage here is the city, not the
  // diocese — and those pages are exactly the shape the extractor wants.
  {
    country: 'CH',
    regions: ['zürich', 'zurich'],
    label: 'Katholisch Stadt Zürich',
    indexUrl: 'https://katholisch-zuerich.ch/pfarreien/',
  },
  {
    country: 'CH',
    regions: ['luzern', 'lucerne'],
    label: 'Katholische Kirche Stadt Luzern',
    indexUrl: 'https://www.kathluzern.ch/gottesdienste',
  },
  {
    country: 'CH',
    regions: ['basel'],
    label: 'Römisch-Katholische Kirche Basel-Stadt',
    indexUrl: 'https://www.rkk-bs.ch/pfarreien',
  },
  {
    country: 'CH',
    regions: ['bern'],
    label: 'Katholische Kirche Region Bern',
    indexUrl: 'https://www.kathbern.ch/pfarreien/',
  },
  {
    country: 'CH',
    regions: ['genève', 'geneve', 'geneva'],
    label: 'Église catholique romaine à Genève',
    indexUrl: 'https://www.eglisecatholique-ge.ch/paroisses/',
  },
  {
    country: 'CH',
    regions: ['lausanne', 'vaud'],
    label: 'Église catholique dans le canton de Vaud',
    indexUrl: 'https://www.cath-vd.ch/paroisses/',
  },
  {
    country: 'CH',
    regions: ['lugano', 'ticino'],
    label: 'Diocesi di Lugano',
    indexUrl: 'https://www.diocesilugano.ch/parrocchie/',
  },
];

/**
 * Where to send a reader when we genuinely have nothing.
 *
 * This is the anti-dead-end. A card that says "we have no times" and stops is
 * worse than useless to someone who needs to be at Mass this evening: it has
 * taken their time and given them nothing to do next. Every such card gets a link
 * that will plausibly answer the question, in this order of preference — a
 * national directory that covers their country, then a plain web search for the
 * church by name and place.
 *
 * These are links out, not sources read: nothing here is crawled and no time from
 * these sites is ever presented as ours.
 */
export interface SearchFallback {
  country?: string;
  label: string;
  /** `{name}`, `{city}`, `{lat}`, `{lon}` are substituted. */
  urlPattern: string;
}

export const SEARCH_FALLBACKS: SearchFallback[] = [
  {
    country: 'IE',
    label: 'Mass times for Ireland (CatholicIreland.net)',
    urlPattern: 'https://www.catholicireland.net/mass-times/',
  },
  {
    country: 'US',
    label: 'MassTimes.org — Mass and Confession near this church',
    urlPattern: 'https://masstimes.org/map?lat={lat}&lng={lon}',
  },
  {
    country: 'GB',
    label: 'Find a Mass in England and Wales',
    urlPattern: 'https://cbcew.org.uk/mass-finder/',
  },
  {
    country: 'CH',
    label: 'Swiss Catholic parish finder (kath.ch)',
    urlPattern: 'https://www.kath.ch/pfarrei-finden/',
  },
];

/** Turn a church name into the slug shape diocesan sites tend to use. */
export function slugifyParish(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Dropped rather than spaced, so "St Mary's" slugs to `st-marys` — which is
    // what diocesan CMSs actually use. Spacing it produced `st-mary-s`, meaning
    // the URL guess 404'd for every possessive parish name, i.e. most of them.
    .replace(/['\u2019\u02bc]/g, '')
    .replace(/\b(saint|st\.?)\b/g, 'st')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Directories that might know about a church, most specific first. */
export function directoriesFor(opts: {
  country?: string;
  city?: string;
  state?: string;
}): DioceseDirectory[] {
  if (!opts.country) return [];
  const country = opts.country.toUpperCase();
  const place = [opts.city, opts.state]
    .filter(Boolean)
    .map((s) => s!.toLowerCase());

  const inCountry = DIOCESE_DIRECTORIES.filter((d) => d.country === country);
  const regional = inCountry.filter(
    (d) => d.regions?.some((r) => place.some((p) => p.includes(r) || r.includes(p))),
  );
  const national = inCountry.filter((d) => !d.regions?.length);
  return [...regional, ...national];
}

/** A link the reader can follow when we have no times of our own. */
export function fallbackLinksFor(opts: {
  country?: string;
  name: string;
  city?: string;
  lat: number;
  lon: number;
}): Array<{ label: string; url: string }> {
  const links: Array<{ label: string; url: string }> = [];
  const country = opts.country?.toUpperCase();

  for (const f of SEARCH_FALLBACKS) {
    if (f.country && f.country !== country) continue;
    links.push({
      label: f.label,
      url: f.urlPattern
        .replace('{name}', encodeURIComponent(opts.name))
        .replace('{city}', encodeURIComponent(opts.city ?? ''))
        .replace('{lat}', String(opts.lat))
        .replace('{lon}', String(opts.lon)),
    });
  }

  // Always last, always available: a plain search for this church by name and
  // place. Unglamorous, and it works everywhere in the world.
  const query = [opts.name, opts.city, 'Mass times'].filter(Boolean).join(' ');
  links.push({
    label: `Search the web for “${opts.name}” Mass times`,
    url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  });

  return links;
}
