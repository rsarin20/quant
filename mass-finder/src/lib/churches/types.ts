/**
 * A Catholic church, as far as Mass Finder is concerned.
 *
 * Everything here is either a fact from a source we can name, or explicitly
 * marked as absent. There is no field whose value we invent.
 */
export interface Church {
  /** Stable id. OSM-derived churches use `osm:node/123456`. */
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** IANA timezone, resolved offline from the coordinates. */
  timezone: string;
  /** ISO 3166-1 alpha-2, used to pick the right holy-day rules. */
  countryCode?: string;
  address?: {
    street?: string;
    housenumber?: string;
    city?: string;
    postcode?: string;
    state?: string;
    country?: string;
  };
  phone?: string;
  website?: string;
  email?: string;
  /**
   * OpenStreetMap's own `service_times` (or `opening_hours:service_times`) tag,
   * carried through so the extraction pipeline can read it without a second
   * Overpass query. Sparse, sometimes stale, but free and already in hand — and
   * for a church with no website it is often the only machine-readable schedule
   * that exists anywhere.
   */
  serviceTimes?: string;
  /**
   * Wikidata item id (`Q…`) from the OSM `wikidata` tag. Used to find an official
   * website for the ~70% of churches OSM has no `website` tag for.
   */
  wikidata?: string;
  /**
   * How we came to know this church's website, when it did not come straight from
   * the OSM `website` tag. Shown in the sources list, because a website we
   * inferred deserves less trust than one a mapper recorded.
   */
  websiteSource?: 'osm-tag' | 'wikidata' | 'curated';
  /**
   * Which Catholic Church this parish belongs to. The Roman calendar this app
   * computes applies to the Latin church; the Eastern Catholic churches keep
   * their own calendars and we must not pretend otherwise.
   */
  rite: Rite;
  denominationRaw?: string;
  /**
   * How sure we are this is a Catholic place of worship at all. OSM tagging is
   * uneven: some churches carry `denomination=catholic`, some carry nothing and
   * are only identifiable by name.
   */
  identification: 'tagged-catholic' | 'name-inferred' | 'user-confirmed';
  sources: SourceRef[];
  /**
   * True for the fictional parishes bundled so the interface can be seen working
   * without network access. The UI must label these unmistakably: showing
   * invented Mass times as if they were real is the one thing this app must
   * never do.
   */
  example?: boolean;
}

export type Rite =
  | 'roman'
  | 'byzantine'
  | 'syro-malabar'
  | 'syro-malankara'
  | 'maronite'
  | 'melkite'
  | 'chaldean'
  | 'coptic-catholic'
  | 'armenian-catholic'
  | 'ethiopian-catholic'
  | 'ukrainian-greek-catholic'
  | 'other-eastern'
  | 'unknown';

/** Eastern churches whose liturgical calendar is not the Roman one. */
export const NON_ROMAN_RITES: ReadonlySet<Rite> = new Set<Rite>([
  'byzantine',
  'syro-malabar',
  'syro-malankara',
  'maronite',
  'melkite',
  'chaldean',
  'coptic-catholic',
  'armenian-catholic',
  'ethiopian-catholic',
  'ukrainian-greek-catholic',
  'other-eastern',
]);

export const RITE_LABELS: Record<Rite, string> = {
  roman: 'Roman Catholic (Latin)',
  byzantine: 'Byzantine Catholic',
  'syro-malabar': 'Syro-Malabar Catholic',
  'syro-malankara': 'Syro-Malankara Catholic',
  maronite: 'Maronite Catholic',
  melkite: 'Melkite Greek Catholic',
  chaldean: 'Chaldean Catholic',
  'coptic-catholic': 'Coptic Catholic',
  'armenian-catholic': 'Armenian Catholic',
  'ethiopian-catholic': 'Ethiopian Catholic',
  'ukrainian-greek-catholic': 'Ukrainian Greek Catholic',
  'other-eastern': 'Eastern Catholic',
  unknown: 'Catholic',
};

/**
 * Where a piece of information came from. Every Mass time in this app carries
 * one of these, and the interface always offers to show it — a time with no
 * traceable source is a rumour, and a person standing outside a locked church
 * deserves to know which it was.
 */
export interface SourceRef {
  kind:
    | 'openstreetmap'
    | 'parish-website'
    | 'parish-bulletin'
    | 'diocese-website'
    | 'user-report'
    | 'seed-data';
  /** URL the claim can be checked against, when there is one. */
  url?: string;
  /** Verbatim text the claim was read from. Never paraphrased. */
  quote?: string;
  /** ISO timestamp of when we last saw this. */
  fetchedAt: string;
  /** Free-text detail, e.g. the OSM tag name or the page title. */
  detail?: string;
}

export interface ChurchSearchResult {
  church: Church;
  /** Metres from the search point. */
  distanceMetres: number;
}
