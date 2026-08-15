'use client';

import { useMemo, useState } from 'react';

import BrowseMap from './BrowseMap';
import {
  citiesByRegion,
  countriesAlphabetical,
  countryByCode,
  type BrowseCity,
} from '@/lib/places';

/**
 * Browse to a church, rather than search for one.
 *
 * Three ways down the same ladder, because different readers arrive knowing
 * different things:
 *
 *  - **Country, then city.** For the person who knows they will be in Switzerland
 *    next week and has not decided where to stay. Dropdowns, because a search box
 *    demands the answer up front.
 *  - **A town by name.** For the town no reasonable bundled list would include,
 *    resolved by the same geocoder the main search uses.
 *  - **The map.** For "somewhere near here", which neither of the above can express.
 *
 * All three end at the same place: a latitude and longitude, handed to the search
 * the app already does.
 */

export interface BrowsePanelProps {
  /** Runs the nearby search for a point the reader has chosen. */
  onChoose: (point: { lat: number; lon: number; label: string }) => void;
  /** Where the map should start. */
  initial?: { lat: number; lon: number };
}

export default function BrowsePanel({ onChoose, initial }: BrowsePanelProps) {
  const countries = useMemo(() => countriesAlphabetical(), []);
  const [countryCode, setCountryCode] = useState('');
  const [cityName, setCityName] = useState('');
  const [town, setTown] = useState('');
  const [townStatus, setTownStatus] = useState<string | undefined>();
  const [showMap, setShowMap] = useState(false);
  const [pin, setPin] = useState(initial ?? { lat: 47.3769, lon: 8.5417 });

  const country = countryCode ? countryByCode(countryCode) : undefined;
  const groups = country ? citiesByRegion(country) : [];

  function chooseCity(name: string) {
    setCityName(name);
    const city: BrowseCity | undefined = country?.cities.find((c) => c.name === name);
    if (!city) return;
    setPin({ lat: city.lat, lon: city.lon });
    onChoose({
      lat: city.lat,
      lon: city.lon,
      label: `${city.name}, ${country?.name ?? ''}`.replace(/,\s*$/, ''),
    });
  }

  async function findTown(event: React.FormEvent) {
    event.preventDefault();
    const query = town.trim();
    if (!query) return;
    setTownStatus('Looking for that place…');
    try {
      // The same geocoder the main search uses. Scoped to the chosen country when
      // there is one, because "Springfield" is a great many places.
      // Country is appended to the query rather than passed as a filter, because
      // that is what the geocoder behind /api/search understands — and it is
      // enough to stop "Springfield" landing on the wrong continent.
      const scoped = country ? `${query}, ${country.name}` : query;
      const res = await fetch(`/api/search?q=${encodeURIComponent(scoped)}`);
      if (!res.ok) throw new Error(`search failed (${res.status})`);
      const body = (await res.json()) as {
        places?: Array<{ lat: number; lon: number; displayName: string }>;
      };
      const first = body.places?.[0];
      if (!first) {
        setTownStatus(
          `We could not find a place called “${query}”. Try the nearest larger town, or use the map.`,
        );
        return;
      }
      setTownStatus(undefined);
      setPin({ lat: first.lat, lon: first.lon });
      onChoose({ lat: first.lat, lon: first.lon, label: first.displayName });
    } catch (err) {
      setTownStatus(`We could not look that up just now: ${String(err)}`);
    }
  }

  return (
    <section className="browse" aria-labelledby="browse-heading">
      <h2 id="browse-heading">Find a church anywhere in the world</h2>
      <p className="browse-lead">
        Choose a country and a city, type the name of a town, or move the map.
      </p>

      <div className="browse-row">
        <label className="browse-field">
          <span className="browse-label">Country</span>
          <select
            value={countryCode}
            onChange={(e) => {
              setCountryCode(e.target.value);
              setCityName('');
            }}
          >
            <option value="">Choose a country…</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="browse-field">
          <span className="browse-label">City</span>
          <select
            value={cityName}
            disabled={!country}
            onChange={(e) => chooseCity(e.target.value)}
          >
            <option value="">
              {country ? 'Choose a city…' : 'Choose a country first'}
            </option>
            {groups.map((group) =>
              group.region ? (
                <optgroup key={group.region} label={group.region}>
                  {group.cities.map((city) => (
                    <option key={city.name} value={city.name}>
                      {city.name}
                    </option>
                  ))}
                </optgroup>
              ) : (
                group.cities.map((city) => (
                  <option key={city.name} value={city.name}>
                    {city.name}
                  </option>
                ))
              ),
            )}
          </select>
        </label>
      </div>

      <form className="browse-row" onSubmit={findTown}>
        <label className="browse-field browse-field-wide">
          <span className="browse-label">Or a town or village by name</span>
          <input
            type="search"
            value={town}
            onChange={(e) => setTown(e.target.value)}
            placeholder="Einsiedeln, Ballyvourney, Assisi…"
            autoComplete="off"
          />
        </label>
        <button type="submit" className="btn btn-secondary browse-go">
          Find it
        </button>
      </form>
      {townStatus ? (
        <p className="browse-status" role="status">
          {townStatus}
        </p>
      ) : null}

      <div className="browse-map-toggle">
        <button
          type="button"
          className="btn btn-secondary"
          aria-expanded={showMap}
          onClick={() => setShowMap((open) => !open)}
        >
          {showMap ? 'Hide the map' : 'Show a map instead'}
        </button>
      </div>

      {showMap ? (
        <div className="browse-map">
          <BrowseMap
            lat={pin.lat}
            lon={pin.lon}
            onMove={(next) => setPin({ lat: next.lat, lon: next.lon })}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              onChoose({
                lat: pin.lat,
                lon: pin.lon,
                label: `the place on the map (${pin.lat.toFixed(3)}, ${pin.lon.toFixed(3)})`,
              })
            }
          >
            Find churches here
          </button>
          <p className="attribution">
            Map data and tiles ©{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              OpenStreetMap contributors
            </a>
            .
          </p>
        </div>
      ) : null}
    </section>
  );
}
