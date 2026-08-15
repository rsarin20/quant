import assert from 'node:assert/strict';
import test from 'node:test';

import type { Church } from '../src/lib/churches/types';
import { findChurchPhoto } from '../src/lib/churches/photos';
import {
  buildSearchQuery,
  MINIMUM_SEARCH_SCORE,
  scoreSearchResult,
} from '../src/lib/churches/searchDiscovery';
import {
  citiesByRegion,
  countriesAlphabetical,
  countryByCode,
} from '../src/lib/places';
import { themeFor } from '../src/lib/theme';

function church(overrides: Partial<Church> = {}): Church {
  return {
    id: 'osm:way/250738641',
    name: 'Saint Saviour’s Church',
    lat: 53.35,
    lon: -6.27,
    timezone: 'Europe/Dublin',
    countryCode: 'IE',
    rite: 'roman',
    identification: 'tagged-catholic',
    sources: [],
    ...overrides,
  };
}

// ── The per-church theme ───────────────────────────────────────────────────

test('a church looks the same on every visit and different from its neighbour', () => {
  // Stability is the whole point: a background that changed on each load would be
  // noise, and one shared by every church on the street would carry no meaning.
  const a = themeFor({ churchId: 'osm:way/250738641', colour: 'green' });
  const again = themeFor({ churchId: 'osm:way/250738641', colour: 'green' });
  const neighbour = themeFor({ churchId: 'osm:way/250738642', colour: 'green' });

  assert.equal(a.background, again.background, 'same church, same background');
  assert.notEqual(
    a.background,
    neighbour.background,
    'ids differing by one digit must not collide',
  );
});

test('the liturgical colour changes the accent, and Lent does not look like Easter', () => {
  const lent = themeFor({ churchId: 'osm:way/1', colour: 'violet' });
  const ordinary = themeFor({ churchId: 'osm:way/1', colour: 'green' });
  const martyr = themeFor({ churchId: 'osm:way/1', colour: 'red' });
  assert.notEqual(lent.accent, ordinary.accent);
  assert.notEqual(martyr.accent, ordinary.accent);
  for (const theme of [lent, ordinary, martyr]) {
    assert.match(theme.accent, /^hsl\(/);
    assert.match(theme.accentSoft, /^hsl\(/);
  }
});

test('a photograph becomes the background, always behind a scrim', () => {
  const withPhoto = themeFor({
    churchId: 'osm:way/1',
    colour: 'white',
    photoUrl: 'https://commons.example/photo.jpg',
  });
  assert.equal(withPhoto.fromPhoto, true);
  assert.ok(withPhoto.background.includes('photo.jpg'));
  // Without the scrim, a heading over a sunlit white cathedral is unreadable.
  assert.ok(
    withPhoto.background.includes('linear-gradient'),
    'a photo background must carry a darkening scrim',
  );
});

test('an unknown colour degrades to green rather than to nothing', () => {
  const theme = themeFor({ churchId: 'osm:way/1', colour: 'gold' });
  assert.match(theme.accent, /^hsl\(/);
});

// ── Photographs and their credits ──────────────────────────────────────────

test('a Commons file from the OSM tag needs no Wikidata request', async () => {
  const calls: string[] = [];
  const fetchImpl = (async (input: URL | string) => {
    calls.push(String(input));
    return new Response(
      JSON.stringify({
        query: {
          pages: {
            '1': {
              imageinfo: [
                {
                  extmetadata: {
                    Artist: { value: '<a href="/wiki/User:X">Jane Photographer</a>' },
                    LicenseShortName: { value: 'CC BY-SA 4.0' },
                  },
                },
              ],
            },
          },
        },
      }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;

  const photo = await findChurchPhoto({
    commonsTag: 'File:Saint Saviours Dublin.jpg',
    wikidata: 'Q1',
    fetchImpl,
  });

  assert.ok(photo);
  assert.ok(photo.url.includes('Special:FilePath'));
  assert.ok(photo.url.includes('width=640'));
  // The credit the licence requires, with Commons' markup stripped out.
  assert.equal(photo.author, 'Jane Photographer');
  assert.equal(photo.license, 'CC BY-SA 4.0');
  assert.equal(photo.via, 'osm-tag');
  assert.ok(
    calls.every((c) => !c.includes('wikidata.org')),
    'the OSM tag should short-circuit the Wikidata lookup',
  );
});

test('a church with no picture anywhere yields no photo and no request', async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
  assert.equal(await findChurchPhoto({ fetchImpl }), undefined);
  assert.equal(called, false);
});

test('a failed photo lookup is a missing picture, never an exception', async () => {
  const fetchImpl = (async () => {
    throw new Error('network down');
  }) as unknown as typeof fetch;
  // Wikidata unreachable: no image, and crucially no throw — a cosmetic loss must
  // not take the Mass times down with it.
  assert.equal(await findChurchPhoto({ wikidata: 'Q1', fetchImpl }), undefined);
});

// ── Search-engine discovery ────────────────────────────────────────────────

test('the query is asked in the language the parish publishes in', () => {
  // "Mass times" ranks the English aggregators above a Swiss parish's own site.
  const swiss = buildSearchQuery(
    church({ name: 'Pfarrei St. Anton', countryCode: 'CH', address: { city: 'Zürich' } }),
  );
  assert.match(swiss, /Gottesdienste/);
  assert.match(swiss, /Zürich/);

  const irish = buildSearchQuery(church({ address: { city: 'Dublin' } }));
  assert.match(irish, /Mass times/);
});

test('an aggregator or encyclopaedia result is never the answer', () => {
  const target = church({ name: 'Pfarrei St. Anton', address: { city: 'Zürich' }, countryCode: 'CH' });
  for (const url of [
    'https://en.wikipedia.org/wiki/St._Anton,_Zürich',
    'https://www.facebook.com/stantonzuerich',
    'https://masstimes.org/church/anton-zurich',
    'https://www.tripadvisor.ch/Attraction-anton',
  ]) {
    assert.equal(
      scoreSearchResult({ url, title: 'St. Anton Zürich' }, target),
      0,
      url,
    );
  }
});

test('the parish’s own domain beats a page that merely mentions it', () => {
  const target = church({ name: 'Pfarrei St. Anton', address: { city: 'Zürich' }, countryCode: 'CH' });
  const own = scoreSearchResult(
    { url: 'https://st-anton-zuerich.ch/', title: 'Pfarrei St. Anton Zürich' },
    target,
  );
  const mention = scoreSearchResult(
    {
      url: 'https://example-blog.ch/2019/07/parish-visits/zurich/anton',
      title: 'A visit to St. Anton',
    },
    target,
  );
  assert.ok(own > mention, 'the domain match must outrank a passing mention');
  assert.ok(own >= MINIMUM_SEARCH_SCORE, 'the real site must clear the threshold');
});

test('a result for a different church scores nothing', () => {
  // A search engine always returns something. The top hit for a church it has
  // never heard of is some other church, and crawling that would publish that
  // church's Mass times under this one's name.
  const target = church({ name: 'Pfarrei St. Anton', address: { city: 'Zürich' }, countryCode: 'CH' });
  assert.equal(
    scoreSearchResult(
      { url: 'https://st-peter-basel.ch/', title: 'Pfarrei St. Peter Basel' },
      target,
    ),
    0,
  );
});

// ── Browsing by place ──────────────────────────────────────────────────────

test('Switzerland is browsable down to its cities', () => {
  const ch = countryByCode('CH');
  assert.ok(ch, 'Switzerland must be in the list — it is where the gap was reported');
  const names = ch.cities.map((c) => c.name);
  for (const expected of ['Zürich', 'Geneva', 'Basel', 'Lucerne', 'Lugano']) {
    assert.ok(names.includes(expected), `${expected} should be browsable`);
  }
  // Every city needs coordinates, because a city you cannot search from is a
  // dead entry in a dropdown.
  for (const city of ch.cities) {
    assert.ok(Number.isFinite(city.lat) && Number.isFinite(city.lon), city.name);
    assert.ok(Math.abs(city.lat) <= 90 && Math.abs(city.lon) <= 180, city.name);
  }
});

test('countries are alphabetical and cities grouped by region', () => {
  const list = countriesAlphabetical();
  const names = list.map((c) => c.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));

  const us = countryByCode('US');
  assert.ok(us);
  const groups = citiesByRegion(us);
  // A country with a dozen cities needs its dropdown grouped, or it is a wall.
  assert.ok(groups.length > 1);
  const california = groups.find((g) => g.region === 'California');
  assert.ok(california);
  assert.deepEqual(
    california.cities.map((c) => c.name),
    ['Los Angeles', 'San Francisco'],
  );
});

test('every browsable city has plausible coordinates', () => {
  for (const country of countriesAlphabetical()) {
    assert.ok(country.cities.length > 0, `${country.name} has no cities`);
    assert.match(country.code, /^[A-Z]{2}$/, country.name);
    for (const city of country.cities) {
      assert.ok(
        Math.abs(city.lat) <= 90 && Math.abs(city.lon) <= 180,
        `${city.name}, ${country.name}`,
      );
    }
  }
});
