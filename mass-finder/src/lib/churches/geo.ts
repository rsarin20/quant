/** Distance and bounding-box helpers. Plain trigonometry, no dependencies. */

const EARTH_RADIUS_M = 6_371_000;

export interface LatLon {
  lat: number;
  lon: number;
}

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineMetres(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A box of roughly `radiusMetres` around a point, clamped to valid ranges. */
export function boxAround(centre: LatLon, radiusMetres: number): BoundingBox {
  const latDelta = (radiusMetres / EARTH_RADIUS_M) * (180 / Math.PI);
  // Longitude degrees shrink towards the poles. Guard against the cosine going
  // to zero so a search near a pole degrades to the whole longitude range
  // instead of producing Infinity.
  const cosLat = Math.max(Math.cos(toRad(centre.lat)), 1e-6);
  const lonDelta = latDelta / cosLat;
  return {
    south: Math.max(-90, centre.lat - latDelta),
    north: Math.min(90, centre.lat + latDelta),
    west: Math.max(-180, centre.lon - lonDelta),
    east: Math.min(180, centre.lon + lonDelta),
  };
}

/** Human distance, in the units the user's locale expects. */
export function formatDistance(metres: number, imperial: boolean): string {
  if (imperial) {
    const miles = metres / 1609.344;
    if (miles < 0.2) return `${Math.round(metres * 3.28084 / 10) * 10} feet away`;
    if (miles < 10) return `${miles.toFixed(1)} miles away`;
    return `${Math.round(miles)} miles away`;
  }
  if (metres < 950) return `${Math.round(metres / 10) * 10} metres away`;
  const km = metres / 1000;
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}

/**
 * Countries that use miles for road distance. Used only to choose a unit, so
 * being slightly incomplete costs nothing more than an unfamiliar unit.
 */
const IMPERIAL_COUNTRIES = new Set(['US', 'GB', 'LR', 'MM']);

export function usesImperial(countryCode?: string | null): boolean {
  return !!countryCode && IMPERIAL_COUNTRIES.has(countryCode.toUpperCase());
}
