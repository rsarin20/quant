/**
 * The curated parish directory — the part of Mass Finder that is a database
 * rather than a scraper.
 *
 * ## Why this exists
 *
 * The crawl-the-parish-website approach has a hard ceiling, and it is lower than
 * it looks. A survey of 25 Catholic churches in central Dublin found **7** with a
 * website recorded in OpenStreetMap. The other 18 are not obscure — they include
 * the city's pro-cathedral — they simply have nobody who has typed a URL into a
 * map. No amount of cleverness in the extractor helps a church whose website we
 * cannot name.
 *
 * So the directory holds two different kinds of hand-gathered fact:
 *
 *  1. **A website we found** for a church OSM has no URL for. This is the higher
 *     leverage of the two: one line of data hands the whole extraction pipeline a
 *     church it previously could not see, and the times stay self-updating.
 *  2. **A schedule we read and transcribed**, for churches whose site defeats
 *     automated reading — times inside images, JavaScript-rendered calendars,
 *     PDF-only bulletins. Slower to maintain, but it is the difference between an
 *     answer and a blank.
 *
 * ## The rules this data lives by
 *
 * Every transcribed time carries the URL it came from, the verbatim sentence it
 * was read from, and the date it was checked. Those are not decoration: the UI
 * shows all three, and a time that cannot produce them does not belong in here.
 * `checkedOn` is what keeps the directory honest as it ages — a hand-entered time
 * has no way to notice that a parish moved its 10:00 to 10:30, so the interface
 * shows the reader how old the claim is and lets them judge.
 *
 * Bundled as TypeScript rather than loaded from disk on purpose: the serverless
 * bundle is read-only and its `/tmp` is per-instance, so anything that must be
 * available on a cold start has to be part of the build.
 */

/** A weekday, 0 = Sunday, matching `Date.getUTCDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface CuratedTime {
  /**
   * Days this Mass is celebrated. `'daily'` is Monday–Sunday, `'weekdays'` is
   * Monday–Friday, `'mon-sat'` is Monday–Saturday — the three groupings parish
   * websites actually use.
   */
  days: Weekday[] | 'daily' | 'weekdays' | 'mon-sat';
  /** 24-hour wall-clock time in the church's own timezone, `HH:MM`. */
  time: string;
  /** BCP-47-ish language code when the Mass is not in the local vernacular. */
  language?: string;
  /**
   * True when this Mass discharges the obligation for the *following* day — a
   * Saturday evening Mass for Sunday, or the eve of a holy day.
   */
  vigil?: boolean;
  /** Traditional Latin Mass, when the parish says so. */
  form?: 'ordinary' | 'traditional-latin';
  /** The verbatim sentence on the source page that this time was read from. */
  quote: string;
  /** Shown to the reader as-is, e.g. "Not celebrated in July and August." */
  note?: string;
}

export interface CuratedParish {
  /**
   * OpenStreetMap id (`osm:way/250738641`) — the primary key, because it is the
   * id the rest of the app uses. Prefer this over `match` whenever it is known.
   */
  osmId?: string;
  /**
   * Fallback identification for churches whose OSM id we do not have, or which
   * may be re-mapped. Matched on a normalised name plus city, which is fuzzy
   * enough to survive "St" vs "Saint" and strict enough not to collide.
   */
  match?: { name: string; city: string; country: string };
  /** Human-readable label, only for maintaining this file. */
  label: string;
  /** Official website. Supplied when OSM has none, or has a dead one. */
  website?: string;
  /** Hand-transcribed Mass times. Omit when the website alone is enough. */
  times?: CuratedTime[];
  /** Where `times` were read from. Required whenever `times` is present. */
  source?: { url: string; kind?: 'parish-website' | 'diocese-website' };
  /** ISO date (`YYYY-MM-DD`) the times were last checked against the source. */
  checkedOn?: string;
  /** Anything the reader should know, surfaced in the interface. */
  note?: string;
}

/** Normalise a church name for fuzzy matching. */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Apostrophes are dropped, not spaced: "St Mary's" and "Saint Marys" are the
    // same church, and turning the apostrophe into a space made them differ by a
    // stray "s" token. Straight and curly both, since parish sites use either.
    .replace(/['\u2019\u02bc]/g, '')
    // "St." / "St" / "Ste" all become "saint" so either spelling matches.
    .replace(/\bst[.']?\b/g, 'saint')
    .replace(/\bss[.']?\b/g, 'saints')
    // Words that appear or vanish freely in church names and carry no signal.
    .replace(/\b(the|church|catholic|roman|parish|of|de|del|la|le|el)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
