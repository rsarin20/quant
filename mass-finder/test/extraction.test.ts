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

// ── Windows of time are not Mass times ─────────────────────────────────────

test('opening hours are not read as Mass times', () => {
  // Found in production: this line became the headline "Next Mass 09:00", quoted
  // as its own source, sending the reader to a Mass that does not exist.
  const page = [
    'Our Oratory & Mass',
    'Open 9am - 5pm Monday to Friday',
    'Every Monday - Friday 1pm - 4pm',
    '1pm Daily – Lunchtime Mass',
  ].join('\n');
  // Only the real one survives, and it survives intact.
  assert.deepEqual(slots(page), ['0123456@13:00']);
});

test('a day range is still read, because it is not a time range', () => {
  // "Monday - Friday" must not be mistaken for a window, or every weekday
  // schedule written with a dash would vanish.
  assert.deepEqual(slots('Mass Monday - Friday 7:30 a.m.'), ['12345@07:30']);
});

test('a time window is rejected however it is written', () => {
  for (const line of [
    'Mass 10:45 a.m. to 11:00 a.m.',
    'Mass 9am - 5pm',
    'Mass 14:00 until 15:00',
    'The church is open for Mass 8:00',
  ]) {
    assert.deepEqual(slots(line), [], line);
  }
});

// ── A qualifier belongs to one time, not to the whole line ─────────────────

test('a language marker applies to the Mass it sits beside, not all of them', () => {
  // Live output labelled all three of these Spanish, so a Spanish speaker would
  // be sent to a 9:30 in English and an English speaker to a Spanish 7:00.
  const rules = extract(
    'Saturday: 9:30 a.m., 11:00 a.m., and 7:00 p.m. (Spanish- Vigil Mass)',
  );
  const byTime = new Map(rules.map((r) => [r.time, r.language]));
  assert.equal(byTime.get('19:00'), 'es');
  assert.equal(byTime.get('09:30'), undefined);
  assert.equal(byTime.get('11:00'), undefined);
});

test('a language heading before every time applies to all of them', () => {
  // "Spanish Masses: 9:00, 12:00" really does mean both.
  const rules = extract('Spanish Masses on Sunday: 9:00 a.m., 12:00 p.m.');
  assert.ok(rules.length >= 2);
  assert.ok(rules.every((r) => r.language === 'es'));
});

// ── German-language parishes, which is why Switzerland was blank ────────────

test('a German Gottesdienst schedule is read', () => {
  // Swiss and German parishes publish "Gottesdienste", never "Mass times". The
  // word was missing from the vocabulary, so every line on every German-language
  // parish site was discarded and whole countries came back empty.
  const page = [
    'Gottesdienste',
    'Sonntag: 10.00 Uhr',
    'Samstag: 18.00 Uhr',
    'Dienstag bis Freitag: 8.30 Uhr',
  ].join('\n');
  assert.deepEqual(slots(page), ['0@10:00', '2345@08:30', '6@18:00']);
});

test('a Wortgottesdienst is not a Mass, despite containing the word', () => {
  // The Liturgy of the Word and a Communion service are not Mass, and in a
  // country short of priests they appear on the same timetable. Sending somebody
  // to one expecting Mass is the failure this guards.
  const page = [
    'Gottesdienste',
    'Sonntag: 10.00 Uhr',
    'Mittwoch: Wortgottesdienst 9.00 Uhr',
    'Freitag: Kommunionfeier 9.00 Uhr',
  ].join('\n');
  assert.deepEqual(slots(page), ['0@10:00']);
});

test('German devotions are not read as Mass', () => {
  for (const line of [
    'Freitag: Rosenkranz 17.30 Uhr',
    'Donnerstag: Anbetung 18.00 Uhr',
    'Samstag: Beichte 17.00 Uhr',
    'Sonntag: Vesper 17.00 Uhr',
  ]) {
    assert.deepEqual(slots(line), [], line);
  }
});
