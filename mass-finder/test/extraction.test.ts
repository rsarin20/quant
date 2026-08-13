import assert from 'node:assert/strict';
import test from 'node:test';

import { extractRulesFromText, extractWeekdays } from '../src/lib/schedule/heuristic';

const source = {
  kind: 'parish-website' as const,
  url: 'https://parish.example/mass-times',
  fetchedAt: '2026-08-13T00:00:00.000Z',
};

function extract(text: string) {
  return extractRulesFromText(text, { churchId: 'osm:way/1', source });
}

/** `{ weekdays, time }` pairs, for comparing without the noise. */
function slots(text: string) {
  return extract(text)
    .map((r) => `${(r.weekdays ?? []).join('')}@${r.time}`)
    .sort();
}

// ── The table layout, which is how tidy parish pages are written ───────────

test('a day heading governs the times listed beneath it', () => {
  // What an HTML table becomes once the markup is stripped. Every one of these
  // times used to be dropped for not naming a day on its own line — so the
  // best-organised parish pages on the web yielded nothing at all.
  const page = [
    'Mass Times',
    'Sunday',
    '9:00 AM',
    '11:00 AM',
    'Saturday',
    '6:00 PM',
  ].join('\n');
  assert.deepEqual(slots(page), ['0@09:00', '0@11:00', '6@18:00']);
});

test('a Saturday evening Mass under a day heading is still read as a vigil', () => {
  const rules = extract(['Mass Times', 'Saturday', '6:00 PM'].join('\n'));
  assert.equal(rules.length, 1);
  assert.equal(rules[0].anticipates, 'next-day');
});

test('a day heading does not reach unrelated times further down the page', () => {
  // Four lines is a table column. Beyond that it is a different part of the page,
  // and carrying the day forward would invent Masses out of phone numbers.
  const page = [
    'Mass Times',
    'Sunday',
    '9:00 AM',
    'Our parish was founded in 1873.',
    'The office is open until 4:30 PM.',
    'Parish accounts audited to 31:12 standards',
    'Call us on 6:00 for details',
  ].join('\n');
  assert.deepEqual(slots(page), ['0@09:00']);
});

test('a day heading inside a Confession block does not leak into the Mass block', () => {
  const page = [
    'Confession times',
    'Saturday',
    '10:30 AM',
    'Mass times',
    'Sunday: 11:00 AM',
  ].join('\n');
  assert.deepEqual(slots(page), ['0@11:00']);
});

// ── Collective day words ───────────────────────────────────────────────────

test('collective day words are understood', () => {
  assert.deepEqual(extractWeekdays('Weekday Masses'), [1, 2, 3, 4, 5]);
  assert.deepEqual(extractWeekdays('Weekend Masses'), [0, 6]);
  assert.deepEqual(extractWeekdays('Daily Mass'), [0, 1, 2, 3, 4, 5, 6]);
  // A named day still wins over a collective word on the same line.
  assert.deepEqual(extractWeekdays('Weekday Mass on Wednesday'), [3]);
});

test('“Weekday Masses 7:30am” produces the five weekday Masses', () => {
  // Parishes write this at least as often as they enumerate Monday to Friday, and
  // the line named no individual day, so all five Masses were lost.
  assert.deepEqual(slots('Weekday Masses 7:30am'), [
    '12345@07:30',
  ]);
});

// ── The non-Mass guard must survive all of the above ───────────────────────

test('the Divine Office is still not reported as Mass', () => {
  // The production bug this guard exists for: the app's headline answer was
  // "Next Mass 07:00", sourced from a line about Morning Prayer.
  const page = [
    'Services',
    'Monday to Friday: Lauds at 7:00 a.m., and Vespers at 6:00 p.m.',
    'Mass times',
    'Sunday: 10:00 AM',
  ].join('\n');
  assert.deepEqual(slots(page), ['0@10:00']);
});

test('a Confession line that mentions Mass in passing yields no Mass', () => {
  const page = [
    'Confession times',
    'Friday: after 7:25 a.m. Mass, 10:45 a.m. to 11:00 a.m.',
  ].join('\n');
  assert.deepEqual(slots(page), []);
});

test('every rule carries the line it was read from', () => {
  // A time with no traceable quote is a rumour, and the interface promises to be
  // able to show the reader exactly what the source said.
  const rules = extract('Mass times\nSunday: 10:00 AM');
  assert.ok(rules.length > 0);
  for (const rule of rules) {
    assert.ok(rule.source.quote, 'every rule needs a verbatim quote');
    assert.equal(rule.source.url, source.url);
  }
});
