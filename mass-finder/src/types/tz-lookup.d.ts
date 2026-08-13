/**
 * `tz-lookup` ships as CommonJS with no bundled types. It exports one function:
 * coordinates in, IANA timezone name out, entirely offline.
 */
declare module 'tz-lookup' {
  /** Throws if the coordinates are out of range. */
  export default function tzlookup(latitude: number, longitude: number): string;
}
