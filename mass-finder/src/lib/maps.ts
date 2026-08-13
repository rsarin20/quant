import type { Church } from './churches/types';

/**
 * Google Maps links.
 *
 * Uses the documented cross-platform Maps URLs rather than the `comgooglemaps://`
 * scheme or a platform-specific intent: those need per-OS branching and fail
 * silently when the app is not installed. The universal `https://www.google.com/maps`
 * form opens the Maps app when it is present and the website when it is not,
 * which is the behaviour an older user needs — the button always does something.
 *
 * Directions carry the destination as coordinates *and* the name, because a
 * parish name alone is often ambiguous ("St Mary's") while coordinates alone give
 * the driver nothing to recognise on arrival.
 */

export type TravelMode = 'driving' | 'walking' | 'transit' | 'bicycling';

export interface DirectionsOptions {
  /** The user's position, when they have shared it. Omitted means "from here". */
  origin?: { lat: number; lon: number };
  mode?: TravelMode;
}

/**
 * A directions link, which is what answers "how long would it take me to get
 * there" — Google shows the travel time as soon as the link opens.
 */
export function directionsUrl(church: Church, opts: DirectionsOptions = {}): string {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  // Coordinates rather than the name: "St Mary's" matches hundreds of churches,
  // and sending a driver to the wrong one is the failure mode to avoid.
  url.searchParams.set('destination', `${church.lat},${church.lon}`);
  if (opts.origin) {
    url.searchParams.set('origin', `${opts.origin.lat},${opts.origin.lon}`);
  }
  url.searchParams.set('travelmode', opts.mode ?? 'driving');
  // `dir_action=navigate` starts turn-by-turn immediately on mobile.
  url.searchParams.set('dir_action', 'navigate');
  return url.toString();
}

/** A plain map pin, for "where is this church?" without starting a journey. */
export function mapUrl(church: Church): string {
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', `${church.lat},${church.lon}`);
  return url.toString();
}

/** `tel:` link, normalised so it dials on a phone. */
export function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** A one-line postal address from whatever parts we have. */
export function formatAddress(church: Church): string | undefined {
  const a = church.address;
  if (!a) return undefined;
  const line1 = [a.housenumber, a.street].filter(Boolean).join(' ');
  const parts = [line1, a.city, a.postcode].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}
