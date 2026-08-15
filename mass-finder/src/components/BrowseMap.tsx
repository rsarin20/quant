'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A slippy map, hand-rolled.
 *
 * ## Why not Leaflet
 *
 * Because a map library is 150KB of JavaScript for an audience that includes
 * people on old phones and metered connections, and because the whole job here is
 * "show tiles, let me drag them, tell me where I dropped the pin". That is about a
 * hundred lines of arithmetic against the standard Web Mercator tile scheme, with
 * no dependency to keep up to date and nothing to load before the map appears.
 *
 * ## Tiles
 *
 * OpenStreetMap's own tile servers, whose usage policy this respects: a bounded
 * viewport, no bulk prefetching, no tile scraping, and visible attribution — which
 * the page carries next to the map, as the licence requires.
 *
 * ## Accessibility, which a map usually fails
 *
 * A drag-only map is unusable for anyone who cannot drag. So every movement is
 * also available from a button: four arrows, two zooms, all at the same 60px tap
 * target as the rest of the app, all keyboard-reachable. The map is a convenience
 * on top of the dropdowns, never the only way through — an older user who cannot
 * work a map still gets to their church by country and city.
 */

const TILE_SIZE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 17;

/** Web Mercator: longitude → global pixel x at this zoom. */
function lonToX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * TILE_SIZE * 2 ** zoom;
}

/** Web Mercator: latitude → global pixel y at this zoom. */
function latToY(lat: number, zoom: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return (
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * TILE_SIZE * 2 ** zoom
  );
}

function xToLon(x: number, zoom: number): number {
  return (x / (TILE_SIZE * 2 ** zoom)) * 360 - 180;
}

function yToLat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / (TILE_SIZE * 2 ** zoom);
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

export interface BrowseMapProps {
  lat: number;
  lon: number;
  zoom?: number;
  /** Called when the reader settles on a new centre. */
  onMove?: (centre: { lat: number; lon: number; zoom: number }) => void;
  height?: number;
}

export default function BrowseMap({
  lat,
  lon,
  zoom: initialZoom = 13,
  onMove,
  height = 340,
}: BrowseMapProps) {
  const [zoom, setZoom] = useState(initialZoom);
  const [centre, setCentre] = useState({ lat, lon });
  const [size, setSize] = useState({ width: 640, height });
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; startLat: number; startLon: number } | null>(
    null,
  );

  // Follow the props when the reader picks a city from the dropdowns, so the map
  // and the selects never disagree about where we are.
  useEffect(() => {
    setCentre({ lat, lon });
  }, [lat, lon]);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const measure = () =>
      setSize({ width: element.clientWidth || 640, height });
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [height]);

  const settle = useCallback(
    (next: { lat: number; lon: number }, nextZoom: number) => {
      setCentre(next);
      setZoom(nextZoom);
      onMove?.({ ...next, zoom: nextZoom });
    },
    [onMove],
  );

  const centreX = lonToX(centre.lon, zoom);
  const centreY = latToY(centre.lat, zoom);
  const originX = centreX - size.width / 2;
  const originY = centreY - size.height / 2;

  // Which tiles the viewport overlaps, plus a one-tile margin so a drag does not
  // reveal blank ground before the next row loads.
  const firstCol = Math.floor(originX / TILE_SIZE) - 1;
  const firstRow = Math.floor(originY / TILE_SIZE) - 1;
  const cols = Math.ceil(size.width / TILE_SIZE) + 3;
  const rows = Math.ceil(size.height / TILE_SIZE) + 3;
  const worldTiles = 2 ** zoom;

  const tiles: Array<{ key: string; src: string; left: number; top: number }> = [];
  for (let row = firstRow; row < firstRow + rows; row += 1) {
    if (row < 0 || row >= worldTiles) continue;
    for (let col = firstCol; col < firstCol + cols; col += 1) {
      // Wrap east–west so dragging past the date line keeps working.
      const wrapped = ((col % worldTiles) + worldTiles) % worldTiles;
      tiles.push({
        key: `${zoom}/${col}/${row}`,
        src: `https://tile.openstreetmap.org/${zoom}/${wrapped}/${row}.png`,
        left: col * TILE_SIZE - originX,
        top: row * TILE_SIZE - originY,
      });
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      startLat: centre.lat,
      startLon: centre.lon,
    };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const x = lonToX(drag.startLon, zoom) - dx;
    const y = latToY(drag.startLat, zoom) - dy;
    setCentre({ lat: yToLat(y, zoom), lon: xToLon(x, zoom) });
  }

  function onPointerUp() {
    if (!dragRef.current) return;
    dragRef.current = null;
    onMove?.({ ...centre, zoom });
  }

  /** Nudge by a quarter of the viewport — the same distance an arrow key gives. */
  function nudge(dxFraction: number, dyFraction: number) {
    const x = centreX + dxFraction * size.width;
    const y = centreY + dyFraction * size.height;
    settle({ lat: yToLat(y, zoom), lon: xToLon(x, zoom) }, zoom);
  }

  function changeZoom(delta: number) {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
    if (next === zoom) return;
    settle(centre, next);
  }

  return (
    <div className="map-wrap">
      <div
        ref={frameRef}
        className="map-frame"
        style={{ height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="application"
        aria-label="Map. Drag to move, or use the buttons below."
      >
        {tiles.map((tile) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={tile.key}
            src={tile.src}
            alt=""
            width={TILE_SIZE}
            height={TILE_SIZE}
            draggable={false}
            loading="lazy"
            style={{ position: 'absolute', left: tile.left, top: tile.top }}
          />
        ))}
        {/* The pin sits at the exact centre, which is the point we search from. */}
        <div className="map-pin" aria-hidden="true" />
      </div>

      <div className="map-controls">
        <button type="button" className="btn btn-map" onClick={() => nudge(0, -0.25)}>
          <span aria-hidden="true">↑</span>
          <span className="sr-only">Move north</span>
        </button>
        <button type="button" className="btn btn-map" onClick={() => nudge(-0.25, 0)}>
          <span aria-hidden="true">←</span>
          <span className="sr-only">Move west</span>
        </button>
        <button type="button" className="btn btn-map" onClick={() => nudge(0.25, 0)}>
          <span aria-hidden="true">→</span>
          <span className="sr-only">Move east</span>
        </button>
        <button type="button" className="btn btn-map" onClick={() => nudge(0, 0.25)}>
          <span aria-hidden="true">↓</span>
          <span className="sr-only">Move south</span>
        </button>
        <button type="button" className="btn btn-map" onClick={() => changeZoom(1)}>
          <span aria-hidden="true">＋</span>
          <span className="sr-only">Zoom in</span>
        </button>
        <button type="button" className="btn btn-map" onClick={() => changeZoom(-1)}>
          <span aria-hidden="true">－</span>
          <span className="sr-only">Zoom out</span>
        </button>
      </div>

      <p className="map-readout">
        Looking at {centre.lat.toFixed(4)}, {centre.lon.toFixed(4)} — the pin in the
        middle is where we will search.
      </p>
    </div>
  );
}
