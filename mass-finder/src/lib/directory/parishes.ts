import type { CuratedParish } from './types';

/**
 * The curated parish list.
 *
 * Almost every entry here supplies a **website** rather than transcribed times.
 * That is deliberate and it is the higher-leverage half of the directory: a URL
 * hands the extraction pipeline a church it could not previously see, and the
 * times then keep themselves up to date. A transcribed time, by contrast, is
 * correct on the day it was typed and decays silently from then on.
 *
 * ## The rule for adding a website here
 *
 * Only add a URL you are confident is the church's own site. A wrong URL is not a
 * harmless miss — it would attribute another parish's Mass times to this church,
 * which is the worst failure this app has. Two things guard against that:
 *
 *  - Curated URLs are marked `websiteSource: 'curated'`, and
 *  - `verifyPageIdentity()` in the crawl layer requires a page reached from a
 *    curated URL to actually mention this church's name before any time is
 *    accepted from it. A mistyped domain therefore yields nothing rather than
 *    yielding a lie.
 *
 * ## Coverage, stated honestly
 *
 * This list is a spine, not a world. It holds the churches most likely to be
 * searched for — cathedrals, basilicas, city-centre parishes — in the cities with
 * the most Catholics. Global coverage comes from the layers around it: OSM tags,
 * Wikidata, and the diocesan directories in `dioceses.ts`, none of which need a
 * per-church entry. When this file is the only thing that knows a church, that is
 * a gap to be filled, not the design working as intended.
 */
export const CURATED_PARISHES: CuratedParish[] = [
  // ── Dublin ───────────────────────────────────────────────────────────────
  // The survey that motivated this file: 25 churches in the city centre, 7 with
  // a website in OpenStreetMap. These are the ones OSM has no URL for.
  {
    osmId: 'osm:way/43981431',
    label: "St Mary's Pro-Cathedral, Dublin",
    website: 'https://procathedral.ie/',
    note: 'The cathedral church of the Archdiocese of Dublin.',
  },
  {
    match: { name: 'Whitefriar Street Church', city: 'Dublin', country: 'IE' },
    label: 'Whitefriar Street Carmelite Church, Dublin',
    website: 'https://whitefriarstreetchurch.ie/',
  },
  {
    osmId: 'osm:way/275478033',
    label: 'Newman University Church, Dublin',
    website: 'https://www.universitychurch.ie/',
  },
  {
    osmId: 'osm:way/229577991',
    label: "St Andrew's, Westland Row, Dublin",
    website: 'https://www.standrewswestlandrow.ie/',
  },
  {
    osmId: 'osm:way/39416246',
    label: "St Peter's, Phibsborough, Dublin",
    website: 'https://www.stpetersphibsboro.ie/',
  },
  {
    osmId: 'osm:relation/3374049',
    label: "St Teresa's, Clarendon Street, Dublin",
    website: 'https://www.clarendonstreet.ie/',
  },

  // ── Cathedrals and basilicas with the highest search volume ──────────────
  // Chosen because a traveller in an unfamiliar city looks for the cathedral
  // first. Each is the seat or principal church of its diocese.
  {
    match: { name: "St Patrick's Cathedral", city: 'New York', country: 'US' },
    label: "St Patrick's Cathedral, New York",
    website: 'https://saintpatrickscathedral.org/',
  },
  {
    match: { name: 'Westminster Cathedral', city: 'London', country: 'GB' },
    label: 'Westminster Cathedral, London',
    website: 'https://westminstercathedral.org.uk/',
  },
  {
    match: { name: 'Holy Name Cathedral', city: 'Chicago', country: 'US' },
    label: 'Holy Name Cathedral, Chicago',
    website: 'https://holynamecathedral.org/',
  },
  {
    match: { name: 'Cathedral of Our Lady of the Angels', city: 'Los Angeles', country: 'US' },
    label: 'Cathedral of Our Lady of the Angels, Los Angeles',
    website: 'https://olacathedral.org/',
  },
  {
    match: { name: "St Mary's Cathedral", city: 'Sydney', country: 'AU' },
    label: "St Mary's Cathedral, Sydney",
    website: 'https://www.stmaryscathedral.org.au/',
  },
  {
    match: { name: "St Michael's Cathedral Basilica", city: 'Toronto', country: 'CA' },
    label: "St Michael's Cathedral Basilica, Toronto",
    website: 'https://www.stmichaelscathedral.com/',
  },
  {
    match: { name: 'Manila Cathedral', city: 'Manila', country: 'PH' },
    label: 'Manila Cathedral',
    website: 'https://manilacathedral.com.ph/',
  },
  {
    match: { name: "St Patrick's Cathedral", city: 'Melbourne', country: 'AU' },
    label: "St Patrick's Cathedral, Melbourne",
    website: 'https://melbournecatholic.org/st-patricks-cathedral',
  },
];
