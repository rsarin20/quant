'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import BrowsePanel from '@/components/BrowsePanel';
import MassCard from '@/components/MassCard';
import type { NearbyResponse } from '@/lib/api-types';
import type { Place } from '@/lib/churches/geocode';

/**
 * The home screen.
 *
 * One job: get from "I want to go to Mass" to a time, a place and a route, in as
 * few taps as possible. Two ways in — share your location, or type where you are
 * — and the second is offered as an equal, not a fallback, because plenty of
 * older users have location switched off and will never turn it on.
 *
 * Nothing here is hidden behind a gesture or an unlabelled icon, and every state
 * (asking, searching, failed, empty) says in words what has happened and what to
 * do next.
 */

type Phase = 'idle' | 'locating' | 'searching' | 'done' | 'error';

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<NearbyResponse>();
  const [origin, setOrigin] = useState<{ lat: number; lon: number }>();
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [placeLabel, setPlaceLabel] = useState<string>();
  const [now, setNow] = useState(() => new Date());
  const resultsRef = useRef<HTMLDivElement>(null);

  // Keep "starts in N minutes" honest without re-fetching.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const search = useCallback(
    async (lat: number, lon: number, label?: string) => {
      setPhase('searching');
      setError(undefined);
      setPlaceLabel(label);
      setOrigin({ lat, lon });
      try {
        const res = await fetch(
          `/api/nearby?lat=${lat}&lon=${lon}&radius=8000&limit=12&schedules=1`,
        );
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Search failed (${res.status})`);
        setResult(body as NearbyResponse);
        setPhase('done');
        // Move focus to the results so a screen-reader user is not left behind.
        requestAnimationFrame(() => resultsRef.current?.focus());
      } catch (err) {
        setError(
          `We could not find churches just now. ${err instanceof Error ? err.message : String(err)}`,
        );
        setPhase('error');
      }
    },
    [],
  );

  const useMyLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError(
        'This device will not tell us where you are. Please type the name of your town below instead.',
      );
      setPhase('error');
      return;
    }
    setPhase('locating');
    setError(undefined);
    navigator.geolocation.getCurrentPosition(
      (pos) => search(pos.coords.latitude, pos.coords.longitude),
      (geoErr) => {
        setError(
          geoErr.code === geoErr.PERMISSION_DENIED
            ? 'You have not given permission to use your location. That is fine — type the name of your town below instead.'
            : 'We could not work out where you are. Please type the name of your town below instead.',
        );
        setPhase('error');
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 },
    );
  }, [search]);

  const lookUpPlace = useCallback(async () => {
    if (query.trim().length < 2) return;
    setPhase('searching');
    setError(undefined);
    setPlaces([]);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const body = await res.json();
      const found: Place[] = body.places ?? [];
      if (!found.length) {
        setError(
          `We could not find anywhere called “${query}”. Try the name of a nearby town or city.`,
        );
        setPhase('error');
        return;
      }
      if (found.length === 1) {
        await search(found[0].lat, found[0].lon, found[0].displayName);
        return;
      }
      setPlaces(found);
      setPhase('idle');
    } catch (err) {
      setError(`We could not look that up. ${err instanceof Error ? err.message : String(err)}`);
      setPhase('error');
    }
  }, [query, search]);

  const busy = phase === 'locating' || phase === 'searching';
  const todayIso = result?.today?.day.date ?? new Date().toISOString().slice(0, 10);

  return (
    <main>
      <h1>Find the next Mass</h1>
      <p>
        Tell us where you are and we will show you when and where the next Catholic
        Mass is, what is being celebrated, and how to get there.
      </p>

      <section className="search-card" aria-label="Search for churches">
        <button className="btn btn-primary" onClick={useMyLocation} disabled={busy}>
          {phase === 'locating' ? 'Finding you…' : 'Use my location'}
        </button>

        <div className="divider">or</div>

        <label htmlFor="place">Type your town, city or postcode</label>
        <p className="hint">For example: Ballsbridge, or Mumbai, or 90210</p>
        <input
          id="place"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') lookUpPlace();
          }}
          placeholder="Where are you?"
          autoComplete="off"
          enterKeyHint="search"
        />
        <div className="btn-row">
          <button
            className="btn btn-secondary"
            onClick={lookUpPlace}
            disabled={busy || query.trim().length < 2}
          >
            Search this place
          </button>
        </div>

        {places.length > 1 ? (
          <div style={{ marginTop: '1rem' }}>
            <h2>Which one do you mean?</h2>
            <div className="btn-row">
              {places.map((p) => (
                <button
                  key={`${p.lat},${p.lon}`}
                  className="btn btn-secondary"
                  onClick={() => search(p.lat, p.lon, p.displayName)}
                >
                  {p.displayName}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/*
        Browsing, offered on every search rather than hidden on another page. The
        reader who has just been told "no churches found near you" is exactly the
        reader who needs to look somewhere else, and making them navigate away to do
        it loses most of them.
      */}
      <BrowsePanel
        initial={origin}
        onChoose={({ lat, lon, label }) => search(lat, lon, label)}
      />

      {error ? (
        <p className="notice notice-loud" role="alert">
          {error}
        </p>
      ) : null}

      {busy ? <p className="spinner">Looking for churches near you…</p> : null}

      <div ref={resultsRef} tabIndex={-1} aria-live="polite">
        {result ? (
          <>
            {result.containsExampleData ? (
              <p className="notice notice-loud">
                This app is running in demonstration mode. The churches below are
                invented examples — do not travel to them.
              </p>
            ) : null}

            {result.notices.map((n) => (
              <p className="notice" key={n}>
                {n}
              </p>
            ))}

            {result.today ? (
              <section className="today" aria-label="What today is in the Church">
                <p className="eyebrow">Today in the Church</p>
                <h2>{result.today.explanation.title}</h2>
                <p>
                  <strong>{result.today.explanation.kind}.</strong>{' '}
                  {result.today.explanation.what}
                </p>
                {result.today.explanation.obligation ? (
                  <p>
                    <strong>{result.today.explanation.obligation}</strong>
                  </p>
                ) : null}
                {result.today.explanation.warning ? (
                  <p>
                    <strong>{result.today.explanation.warning}</strong>
                  </p>
                ) : null}
                <details>
                  <summary>More about today</summary>
                  <div className="details-body">
                    <p>{result.today.explanation.season}</p>
                    <p>
                      Sunday readings: Year {result.today.day.sundayCycle}. Weekday
                      readings: Year {result.today.day.weekdayCycle}.
                    </p>
                    {result.today.day.alsoToday.length ? (
                      <p>
                        Also remembered today:{' '}
                        {result.today.day.alsoToday.map((c) => c.name).join('; ')}.
                      </p>
                    ) : null}
                    <p>
                      Holy-day rules shown for: {result.today.day.regionName}
                      {result.today.day.obligationConfidence !== 'verified'
                        ? ' (we are not fully certain of the rules there)'
                        : ''}
                      .
                    </p>
                  </div>
                </details>
              </section>
            ) : null}

            {placeLabel ? <p className="hint">Showing churches near {placeLabel}</p> : null}

            {result.churches.length === 0 ? (
              <p className="notice">
                We did not find any Catholic churches within about 8 kilometres. Try a
                nearby town, or search again with your location switched on.
              </p>
            ) : null}

            {result.churches.map((card, i) => (
              <MassCard
                key={card.church.id}
                card={card}
                todayIso={todayIso}
                now={now}
                origin={origin}
                lead={i === 0}
                href={`/church/${encodeURIComponent(card.church.id)}`}
              />
            ))}

            {result.churches.length ? (
              <footer>
                <p>{result.attribution}</p>
                <p>
                  Mass times are gathered from parish websites and community map data.
                  They can be wrong or out of date. If a time matters — a funeral, a
                  feast day, a long journey — please ring the parish first.
                </p>
              </footer>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
