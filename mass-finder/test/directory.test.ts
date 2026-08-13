import assert from 'node:assert/strict';
import test from 'node:test';

import { __testing } from '../src/lib/churches/overpass';
import { officialWebsiteFor } from '../src/lib/churches/wikidata';
import { discoverWebsite, hasSomewhereToLook } from '../src/lib/churches/discover';
import type { Church } from '../src/lib/churches/types';
import {
  directoriesFor,
  fallbackLinksFor,
  slugifyParish,
} from '../src/lib/directory/dioceses';
import { curatedFor, withCuratedWebsite } from '../src/lib/directory/registry';
import { normaliseName } from '../src/lib/directory/types';
import { scoreLink, verifyPageIdentity } from '../src/lib/extract/crawl';
import { scoreDirectoryLink } from '../src/lib/extract/directoryCrawl';

function church(overrides: Partial<Church> = {}): Church {
  return {
    id: 'osm:way/1',
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

// ── Reading a website out of whatever key the mapper used ──────────────────

test('a website is found under any of OSM’s competing URL keys', () => {
  const cases: Array<[Record<string, string>, string | undefined]> = [
    [{ website: 'https://a.example/' }, 'https://a.example/'],
    [{ 'contact:website': 'https://b.example/' }, 'https://b.example/'],
    [{ url: 'https://c.example/' }, 'https://c.example/'],
    [{ 'website:en': 'https://d.example/' }, 'https://d.example/'],
    // No scheme is the single most common malformation in the wild.
    [{ website: 'parish.example.ie' }, 'https://parish.example.ie/'],
    // Several URLs crammed into one tag: take the first.
    [{ website: 'https://e.example/;https://f.example/' }, 'https://e.example/'],
    [{ website: 'not a url' }, undefined],
    [{}, undefined],
  ];
  for (const [tags, expected] of cases) {
    const built = __testing.elementToChurch(
      { type: 'way', id: 1, lat: 53, lon: -6, tags: { ...tags, denomination: 'roman_catholic' } },
      new Date().toISOString(),
    );
    assert.equal(built?.website, expected, JSON.stringify(tags));
  }
});

test('OSM service_times is carried through instead of discarded', () => {
  // This tag was being dropped entirely, which left the whole first extraction
  // layer as dead code — free schedule data thrown away on every search.
  const built = __testing.elementToChurch(
    {
      type: 'way',
      id: 2,
      lat: 53,
      lon: -6,
      tags: { denomination: 'roman_catholic', service_times: 'Su 10:00,12:00' },
    },
    new Date().toISOString(),
  );
  assert.equal(built?.serviceTimes, 'Su 10:00,12:00');
});

test('a wikidata tag is kept only when it is a well-formed item id', () => {
  const good = __testing.elementToChurch(
    { type: 'node', id: 3, lat: 53, lon: -6, tags: { denomination: 'catholic', wikidata: 'Q42' } },
    new Date().toISOString(),
  );
  assert.equal(good?.wikidata, 'Q42');
  const bad = __testing.elementToChurch(
    { type: 'node', id: 4, lat: 53, lon: -6, tags: { denomination: 'catholic', wikidata: 'rubbish' } },
    new Date().toISOString(),
  );
  assert.equal(bad?.wikidata, undefined);
});

// ── Wikidata ───────────────────────────────────────────────────────────────

test('Wikidata P856 yields an official website', async () => {
  const fetchImpl = (async () =>
    new Response(
      JSON.stringify({ P856: [{ value: { type: 'value', content: 'https://procathedral.ie/' } }] }),
      { status: 200 },
    )) as unknown as typeof fetch;
  assert.equal(await officialWebsiteFor('Q1', { fetchImpl }), 'https://procathedral.ie/');
});

test('a deprecated Wikidata website is not followed', async () => {
  // Deprecated rank is how Wikidata records "this URL used to be right". Crawling
  // it would point us at a dead or re-registered domain.
  const fetchImpl = (async () =>
    new Response(
      JSON.stringify({
        P856: [
          { rank: 'deprecated', value: { type: 'value', content: 'https://old.example/' } },
          { rank: 'normal', value: { type: 'value', content: 'https://new.example/' } },
        ],
      }),
      { status: 200 },
    )) as unknown as typeof fetch;
  assert.equal(await officialWebsiteFor('Q1', { fetchImpl }), 'https://new.example/');
});

test('a Wikidata failure degrades to “no website”, never to an exception', async () => {
  const fetchImpl = (async () => {
    throw new Error('network down');
  }) as unknown as typeof fetch;
  assert.equal(await officialWebsiteFor('Q1', { fetchImpl }), undefined);
  assert.equal(await officialWebsiteFor('not-a-qid', { fetchImpl }), undefined);
});

// ── The curated directory ──────────────────────────────────────────────────

test('the pro-cathedral is matched by OSM id and given its website', () => {
  const proCathedral = church({ id: 'osm:way/43981431', name: "Saint Mary's Cathedral" });
  assert.equal(proCathedral.website, undefined);
  const filled = withCuratedWebsite(proCathedral);
  assert.equal(filled.website, 'https://procathedral.ie/');
  assert.equal(filled.websiteSource, 'curated');
  // The inferred URL is recorded as a source, not smuggled in silently.
  assert.ok(filled.sources.some((s) => s.detail?.includes('parish directory')));
});

test('a curated website never overwrites one OSM already knows', () => {
  const tagged = church({ id: 'osm:way/43981431', website: 'https://from-osm.example/' });
  assert.equal(withCuratedWebsite(tagged).website, 'https://from-osm.example/');
  assert.equal(withCuratedWebsite(tagged).websiteSource, undefined);
});

test('name matching needs city and country to agree', () => {
  // "St Patrick's Cathedral" exists in New York, Dublin, Melbourne and Karachi.
  // Matching on name alone would attach one city's website to another's church.
  const ny = church({
    id: 'osm:way/999',
    name: "St. Patrick's Cathedral",
    address: { city: 'New York' },
    countryCode: 'US',
  });
  assert.ok(curatedFor(ny), 'New York should match');

  const elsewhere = church({
    id: 'osm:way/998',
    name: "St. Patrick's Cathedral",
    address: { city: 'Karachi' },
    countryCode: 'PK',
  });
  assert.equal(curatedFor(elsewhere), undefined, 'Karachi must not match New York');

  const noCity = church({ id: 'osm:way/997', name: "St. Patrick's Cathedral" });
  assert.equal(curatedFor(noCity), undefined, 'no city means no match');
});

test('name normalisation survives the ways church names are written', () => {
  assert.equal(normaliseName("St. Mary's Church"), normaliseName('Saint Marys'));
  assert.equal(normaliseName('The Catholic Church of St Joseph'), normaliseName('St. Joseph'));
});

// ── Identity verification, the guard on every inferred URL ─────────────────

test('a page from an inferred URL must mention the church', () => {
  const page = { text: 'Welcome to Saint Saviour’s, Dominick Street.', title: 'Home' };
  assert.equal(verifyPageIdentity(page, 'Saint Saviour’s Church'), true);
  // A real site, but the wrong parish — this is the failure that would otherwise
  // publish another church's Mass times under this church's name.
  const wrong = { text: 'Welcome to Gardiner Street Parish.', title: 'Gardiner Street' };
  assert.equal(verifyPageIdentity(wrong, 'Saint Saviour’s Church'), false);
});

test('a wholly generic name is not falsely claimed as verified', () => {
  // "Our Lady Catholic Church" is made entirely of words shared by thousands of
  // parishes, so there is nothing to check it against. The guard abstains rather
  // than inventing a verdict — and "Holy Cross" does have a distinctive word, so
  // it is still checked.
  const page = { text: 'Some entirely unrelated parish website.' };
  assert.equal(verifyPageIdentity(page, 'Our Lady Catholic Church'), true);
  assert.equal(verifyPageIdentity(page, 'Holy Cross Church'), false);
});

// ── Diocesan directories ───────────────────────────────────────────────────

test('a Dublin church is offered the Dublin archdiocese before the national list', () => {
  const found = directoriesFor({ country: 'IE', city: 'Dublin' });
  assert.equal(found[0]?.label, 'Archdiocese of Dublin');
  assert.ok(found.length > 1, 'the national directory should still be a fallback');
});

test('a country with no directory yields none', () => {
  assert.deepEqual(directoriesFor({ country: 'JP', city: 'Osaka' }), []);
  assert.deepEqual(directoriesFor({}), []);
});

test('parish slugs match the shape diocesan sites use', () => {
  assert.equal(slugifyParish("St Mary's Pro-Cathedral"), 'st-marys-pro-cathedral');
  assert.equal(slugifyParish('Adam & Eve Church'), 'adam-and-eve-church');
});

test('a directory link must match most of the distinctive name, not one word', () => {
  const name = 'Church of Saint Lawrence O’Toole';
  assert.ok(
    scoreDirectoryLink({ url: '/parish/lawrence-otoole/', text: "St Lawrence O'Toole" }, name) > 0,
  );
  // A different saint sharing one word is a different parish.
  assert.equal(
    scoreDirectoryLink({ url: '/parish/st-lawrence-of-brindisi/', text: 'St Lawrence' }, name),
    0,
  );
  assert.equal(scoreDirectoryLink({ url: '/donate/', text: 'Donate' }, name), 0);
});

// ── Never a dead end ───────────────────────────────────────────────────────

test('a church with no times always gets somewhere else to look', () => {
  const links = fallbackLinksFor({
    country: 'IE',
    name: 'Our Lady of Lourdes',
    city: 'Dublin',
    lat: 53.35,
    lon: -6.25,
  });
  assert.ok(links.length >= 2, 'a national directory plus a web search');
  assert.ok(links.every((l) => /^https:\/\//.test(l.url)));

  // Even somewhere with no directory of its own gets the search fallback.
  const remote = fallbackLinksFor({ country: 'MN', name: 'Saint Peter', lat: 47, lon: 106 });
  assert.equal(remote.length, 1);
  assert.match(remote[0].url, /google\.com\/search/);
});

// ── Deciding where to spend the network budget ─────────────────────────────

test('a church with any lead at all is worth a lookup', () => {
  assert.equal(hasSomewhereToLook(church({ website: 'https://x.example/' }), false), true);
  assert.equal(hasSomewhereToLook(church({ serviceTimes: 'Su 10:00' }), false), true);
  assert.equal(hasSomewhereToLook(church({ wikidata: 'Q1' }), false), true);
  assert.equal(hasSomewhereToLook(church(), true), true, 'its diocese is a lead');
  assert.equal(hasSomewhereToLook(church(), false), false, 'no lead at all');
});

test('discovery prefers the curated website and does not call the network for it', async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;

  const found = await discoverWebsite(
    church({ id: 'osm:way/43981431', wikidata: 'Q1' }),
    { fetchImpl },
  );
  assert.equal(found.website, 'https://procathedral.ie/');
  assert.equal(called, false, 'the curated hit should short-circuit Wikidata');
});

test('discovery falls back to Wikidata and marks where the URL came from', async () => {
  const fetchImpl = (async () =>
    new Response(
      JSON.stringify({ P856: [{ value: { type: 'value', content: 'https://found.example/' } }] }),
      { status: 200 },
    )) as unknown as typeof fetch;

  const found = await discoverWebsite(church({ wikidata: 'Q1234' }), { fetchImpl });
  assert.equal(found.website, 'https://found.example/');
  assert.equal(found.websiteSource, 'wikidata');
  assert.ok(found.sources.some((s) => s.url?.includes('Q1234')));
});

// ── Link scoring ───────────────────────────────────────────────────────────

test('a nav link reading only “Times” is followed', () => {
  // This scored zero before, so on sites whose only schedule link says "Times"
  // the crawler read the homepage and stopped.
  assert.ok(scoreLink({ url: 'https://p.example/times', text: 'Times' }, 'https://p.example/') > 30);
  assert.ok(
    scoreLink({ url: 'https://p.example/donate', text: 'Donate' }, 'https://p.example/') < 0,
  );
});
