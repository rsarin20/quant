import test from 'node:test';
import assert from 'node:assert/strict';

import type { Church, SourceRef } from '../src/lib/churches/types';
import { clearCalendarCache } from '../src/lib/liturgy/calendar';
import { parseServiceTimes } from '../src/lib/schedule/osmServiceTimes';
import {
  extractRulesFromText,
  extractTimes,
  extractWeekdays,
  timeAppearsInText,
} from '../src/lib/schedule/heuristic';
import {
  groupByLocalDate,
  nextObligationMass,
  resolveOccurrences,
} from '../src/lib/schedule/resolve';
import {
  friendlyTime,
  localDateIn,
  localTimeIn,
  zonedTimeToInstant,
} from '../src/lib/schedule/timezone';
import type { ChurchSchedule, MassRule } from '../src/lib/schedule/types';

const source: SourceRef = {
  kind: 'parish-website',
  url: 'https://example.org/mass-times',
  fetchedAt: '2025-01-01T00:00:00.000Z',
};

function church(overrides: Partial<Church> = {}): Church {
  return {
    id: 'test:1',
    name: 'St Test the Confessor',
    lat: 53.3498,
    lon: -6.2603,
    timezone: 'Europe/Dublin',
    countryCode: 'IE',
    rite: 'roman',
    identification: 'tagged-catholic',
    sources: [source],
    ...overrides,
  };
}

function schedule(rules: MassRule[]): ChurchSchedule {
  return { churchId: 'test:1', rules, quality: 'parish-website' };
}

function rule(partial: Partial<MassRule> & { time: string }): MassRule {
  return {
    id: `r-${partial.time}-${partial.weekdays?.join('') ?? 'x'}`,
    kind: 'weekly',
    confidence: 0.9,
    source,
    ...partial,
  } as MassRule;
}

// ── Timezone handling ──────────────────────────────────────────────────────

test('wall-clock times convert to the right instant across a DST change', () => {
  // Ireland moved to summer time at 01:00 UTC on 30 March 2025.
  const beforeDst = zonedTimeToInstant(2025, 3, 29, 10, 30, 'Europe/Dublin');
  assert.equal(beforeDst.toISOString(), '2025-03-29T10:30:00.000Z');
  const afterDst = zonedTimeToInstant(2025, 3, 30, 10, 30, 'Europe/Dublin');
  assert.equal(afterDst.toISOString(), '2025-03-30T09:30:00.000Z');
});

test('wall-clock conversion works in the southern hemisphere', () => {
  // Sydney is UTC+11 in January (summer time) and UTC+10 in July.
  assert.equal(
    zonedTimeToInstant(2025, 1, 12, 9, 0, 'Australia/Sydney').toISOString(),
    '2025-01-11T22:00:00.000Z',
  );
  assert.equal(
    zonedTimeToInstant(2025, 7, 13, 9, 0, 'Australia/Sydney').toISOString(),
    '2025-07-12T23:00:00.000Z',
  );
});

test('a half-hour-offset zone round-trips', () => {
  // India is UTC+5:30 year-round — a common case for this app.
  const instant = zonedTimeToInstant(2025, 8, 15, 7, 0, 'Asia/Kolkata');
  assert.equal(instant.toISOString(), '2025-08-15T01:30:00.000Z');
  assert.equal(localTimeIn(instant, 'Asia/Kolkata'), '07:00');
  assert.equal(localDateIn(instant, 'Asia/Kolkata'), '2025-08-15');
});

test('friendly times avoid the noon/midnight ambiguity', () => {
  assert.equal(friendlyTime('12:00'), '12 noon');
  assert.equal(friendlyTime('00:00'), 'Midnight');
  assert.match(friendlyTime('18:30', 'en-GB'), /18:30|6:30/);
});

// ── OSM service_times parsing ──────────────────────────────────────────────

test('parses common OpenStreetMap service_times values', () => {
  const r1 = parseServiceTimes('Su 09:00,11:00; Sa 18:30', 'c', source);
  assert.equal(r1.rules.length, 3);
  assert.deepEqual(
    r1.rules.map((r) => r.time),
    ['09:00', '11:00', '18:30'],
  );
  // The Saturday evening Mass is recognised as a Sunday vigil.
  const saturday = r1.rules.find((r) => r.time === '18:30')!;
  assert.deepEqual(saturday.weekdays, [6]);
  assert.equal(saturday.anticipates, 'next-day');

  // A weekday range expands.
  const r2 = parseServiceTimes('Mo-Fr 07:30', 'c', source);
  assert.deepEqual(r2.rules[0].weekdays, [1, 2, 3, 4, 5]);

  // A time range records the start.
  const r3 = parseServiceTimes('Su 08:00-09:00', 'c', source);
  assert.equal(r3.rules[0].time, '08:00');

  // `off` produces nothing rather than a phantom Mass.
  assert.equal(parseServiceTimes('PH off', 'c', source).rules.length, 0);
});

test('unparseable service_times fragments are reported, not silently dropped', () => {
  const result = parseServiceTimes('Su 10:00; sometimes also Wednesdays', 'c', source);
  assert.equal(result.rules.length, 1);
  assert.equal(result.unparsed.length, 1);
});

test('a bare time with no day is not turned into a daily Mass', () => {
  const result = parseServiceTimes('10:00', 'c', source);
  assert.equal(result.rules.length, 0);
  assert.equal(result.unparsed.length, 1);
});

// ── Free-text heuristics ───────────────────────────────────────────────────

test('extracts times only when they are unambiguously times', () => {
  assert.deepEqual(extractTimes('Sunday Mass at 10:30'), ['10:30']);
  assert.deepEqual(extractTimes('Sunday 8am and 6pm'), ['08:00', '18:00']);
  assert.deepEqual(extractTimes('Messe à 18h30'), ['18:30']);
  assert.deepEqual(extractTimes('Mass at noon'), ['12:00']);
  // Bare numbers must not become times, or an address becomes a Mass.
  assert.deepEqual(extractTimes('12 Church Road, Dublin 4'), []);
  assert.deepEqual(extractTimes('Telephone 353 1 234 5678'), []);
});

test('extracts weekdays including ranges and other languages', () => {
  assert.deepEqual(extractWeekdays('Sunday'), [0]);
  assert.deepEqual(extractWeekdays('Monday to Friday'), [1, 2, 3, 4, 5]);
  assert.deepEqual(extractWeekdays('Domingo'), [0]);
  assert.deepEqual(extractWeekdays('Samstag'), [6]);
  assert.deepEqual(extractWeekdays('Nothing here'), []);
});

test('reads a realistic parish page into rules', () => {
  const text = [
    'Welcome to St Test the Confessor',
    'Mass Times',
    'Saturday Vigil: 6.30pm',
    'Sunday: 9.00am, 11.00am and 6.00pm',
    'Monday to Friday: 10.00am',
    'Confessions: Saturday 5.30pm',
    'Parish office: 12 Church Road',
  ].join('\n');

  const rules = extractRulesFromText(text, { churchId: 'c', source });
  const times = rules.map((r) => r.time).sort();
  assert.ok(times.includes('09:00'), 'should find the 9am');
  assert.ok(times.includes('11:00'), 'should find the 11am');
  assert.ok(times.includes('10:00'), 'should find the weekday 10am');
  const vigil = rules.find((r) => r.time === '18:30');
  assert.ok(vigil, 'should find the Saturday vigil');
  assert.equal(vigil!.anticipates, 'next-day');
  // Every rule must carry the line it was read from.
  assert.ok(rules.every((r) => r.source.quote && r.source.quote.length > 0));
});

test('the Divine Office, Confession and Adoration are not reported as Mass', () => {
  // These are the exact lines from a real Dublin parish's timetable page that the
  // first live deployment mis-read. Before the fix, the app's headline answer was
  // "07:00" — which this page shows is Lauds, not Mass. Sending somebody to
  // Morning Prayer believing it is Mass is the failure this app exists to avoid.
  const realPage = [
    'Mass & Confession times',
    'Mass times',
    'Sunday: 9:30 a.m., 11:30 a.m.,* and 8:30 p.m.',
    'Saturday: 9:30 a.m.,** 11:00 a.m., and 7:00 p.m. (Spanish- Vigil Mass)',
    'Confession times',
    'Friday: after 7:25 a.m. Mass, 10:45 a.m. to 11:00 a.m. & 8:15 p.m. to 9:00 p.m.',
    'Saturday: 11:30 a.m. to 1:00 p.m., and 3:00 p.m. to 6:00 p.m. (5:00 p.m. to 6:00 p.m. confessions in English & Spanish)',
    'Divine Office',
    'Monday to Friday: Lauds at 7:00 a.m., and Vespers at 6:00 p.m.',
    'Saturday: Lauds at 9:00 a.m., and Vespers at 6:00 p.m.',
    'Sunday: Matins & Lauds at 8:40 a.m., and Vespers at 6:00 p.m.',
    'Adoration',
    'Every Friday from October to June from 8:00 p.m. to 9:00 p.m., followed by Compline (night prayer)',
  ].join('\n');

  const rules = extractRulesFromText(realPage, { churchId: 'c', source });
  const times = rules.map((r) => r.time);

  // The genuine Sunday and Saturday Masses survive.
  assert.ok(times.includes('09:30'), 'the 9:30 Sunday Mass should be found');
  assert.ok(times.includes('11:30'), 'the 11:30 Sunday Mass should be found');
  assert.ok(times.includes('20:30'), 'the 8:30pm Sunday Mass should be found');
  assert.ok(times.includes('19:00'), 'the Saturday 7pm vigil should be found');

  // None of the non-Mass services do.
  assert.equal(times.includes('07:00'), false, 'Lauds must not become a 7:00 Mass');
  assert.equal(times.includes('18:00'), false, 'Vespers must not become a 6:00pm Mass');
  assert.equal(times.includes('08:40'), false, 'Matins must not become an 8:40 Mass');
  assert.equal(times.includes('10:45'), false, 'a Confession slot must not become a Mass');
  assert.equal(times.includes('21:00'), false, 'a Confession slot must not become a Mass');
  assert.equal(times.includes('13:00'), false, 'a Confession slot must not become a Mass');
  assert.equal(times.includes('15:00'), false, 'a Confession slot must not become a Mass');
  assert.equal(times.includes('20:00'), false, 'Adoration must not become a Mass');

  // The Spanish vigil keeps its language and its anticipated status.
  const vigil = rules.find((r) => r.time === '19:00');
  assert.equal(vigil!.language, 'es');
  assert.equal(vigil!.anticipates, 'next-day');
});

test('a line mentioning Mass only in passing yields nothing', () => {
  assert.equal(
    extractRulesFromText(
      'Mass times\nConfessions: Saturday after the 10:00 a.m. Mass until 11:00 a.m.',
      { churchId: 'c', source },
    ).length,
    0,
  );
});

test('verbatim time verification accepts the formats parishes really use', () => {
  assert.equal(timeAppearsInText('18:30', 'Saturday Vigil 6.30pm'), true);
  assert.equal(timeAppearsInText('10:00', 'Sunday at 10am'), true);
  assert.equal(timeAppearsInText('12:00', 'Mass at noon'), true);
  assert.equal(timeAppearsInText('09:00', 'Sunday Mass 9:00'), true);
  // A time the page does not mention must be rejected — this is the gate that
  // stops a model inventing a plausible Mass.
  assert.equal(timeAppearsInText('07:15', 'Sunday Mass at 10am and 6pm'), false);
});

// ── Resolution ─────────────────────────────────────────────────────────────

test('resolves a weekly schedule into the next Masses', () => {
  clearCalendarCache();
  const c = church();
  const s = schedule([
    rule({ kind: 'weekly', weekdays: [0], time: '10:00' }),
    rule({ kind: 'weekly', weekdays: [6], time: '18:30', anticipates: 'next-day' }),
  ]);

  // Friday 15 August 2025, 09:00 Dublin time.
  const from = zonedTimeToInstant(2025, 8, 15, 9, 0, 'Europe/Dublin');
  const occurrences = resolveOccurrences(c, s, { from, days: 3 });

  assert.equal(occurrences.length, 2);
  // The Saturday evening vigil comes first, and it celebrates Sunday.
  assert.equal(occurrences[0].localTime, '18:30');
  assert.equal(occurrences[0].isVigil, true);
  assert.equal(occurrences[0].liturgicalDate, '2025-08-17');
  assert.equal(occurrences[0].day.weekday, 0);
  assert.equal(occurrences[0].day.isHolyDayOfObligation, true);
  // Then the Sunday morning Mass.
  assert.equal(occurrences[1].localTime, '10:00');
  assert.equal(occurrences[1].isVigil, false);
});

test('an unmarked Saturday evening Mass is still treated as the Sunday Mass', () => {
  clearCalendarCache();
  const c = church();
  // No `anticipates` set — as an OSM tag or a terse web page would leave it.
  const s = schedule([rule({ kind: 'weekly', weekdays: [6], time: '18:00' })]);
  const from = zonedTimeToInstant(2025, 8, 16, 6, 0, 'Europe/Dublin');
  const [occurrence] = resolveOccurrences(c, s, { from, days: 2 });
  assert.equal(occurrence.isVigil, true);
  assert.equal(occurrence.day.weekday, 0);
});

test('a Saturday MORNING Mass is not treated as a vigil', () => {
  clearCalendarCache();
  const c = church();
  const s = schedule([rule({ kind: 'weekly', weekdays: [6], time: '10:00' })]);
  const from = zonedTimeToInstant(2025, 8, 16, 6, 0, 'Europe/Dublin');
  const [occurrence] = resolveOccurrences(c, s, { from, days: 2 });
  assert.equal(occurrence.isVigil, false);
  assert.equal(occurrence.day.weekday, 6);
});

test('no Mass is ever listed on Good Friday', () => {
  clearCalendarCache();
  const c = church();
  // A parish with a Mass every single day, including Fridays.
  const s = schedule([
    rule({ kind: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6], time: '10:00' }),
  ]);
  // Good Friday 2025 is 18 April.
  const from = zonedTimeToInstant(2025, 4, 18, 6, 0, 'Europe/Dublin');
  const occurrences = resolveOccurrences(c, s, { from, days: 1 });
  assert.equal(
    occurrences.length,
    0,
    'a daily-Mass rule must not project a Mass onto Good Friday',
  );
});

test('Holy Saturday allows only a Mass after nightfall', () => {
  clearCalendarCache();
  const c = church();
  const s = schedule([
    rule({ id: 'morning', kind: 'weekly', weekdays: [6], time: '10:00' }),
    rule({ id: 'vigil', kind: 'weekly', weekdays: [6], time: '21:00' }),
  ]);
  // Holy Saturday 2025 is 19 April.
  const from = zonedTimeToInstant(2025, 4, 19, 6, 0, 'Europe/Dublin');
  const occurrences = resolveOccurrences(c, s, { from, days: 1 });
  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].localTime, '21:00');
  // The Easter Vigil is the Mass of Easter Sunday.
  assert.equal(occurrences[0].liturgicalDate, '2025-04-20');
  assert.equal(occurrences[0].day.celebration.id, 'easter-sunday');
});

test('Holy Thursday allows only an evening Mass', () => {
  clearCalendarCache();
  const c = church();
  const s = schedule([
    rule({ id: 'am', kind: 'weekly', weekdays: [4], time: '07:00' }),
    rule({ id: 'pm', kind: 'weekly', weekdays: [4], time: '19:30' }),
  ]);
  const from = zonedTimeToInstant(2025, 4, 17, 5, 0, 'Europe/Dublin');
  const occurrences = resolveOccurrences(c, s, { from, days: 1 });
  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].localTime, '19:30');
});

test('a liturgical rule fires on a feast whose date moves', () => {
  clearCalendarCache();
  // Ireland keeps Ascension on the Thursday: 29 May 2025.
  const c = church();
  const s = schedule([
    rule({ id: 'asc', kind: 'liturgical', celebrationId: 'ascension', time: '19:00' }),
  ]);
  const from = zonedTimeToInstant(2025, 5, 1, 0, 0, 'Europe/Dublin');
  const occurrences = resolveOccurrences(c, s, { from, days: 40 });
  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].liturgicalDate, '2025-05-29');
  assert.equal(occurrences[0].day.isHolyDayOfObligation, true);
});

test('the same liturgical rule fires on a different date in a different country', () => {
  clearCalendarCache();
  // The United States transfers Ascension to the Sunday: 1 June 2025.
  const c = church({ countryCode: 'US', timezone: 'America/New_York' });
  const s = schedule([
    rule({ id: 'asc', kind: 'liturgical', celebrationId: 'ascension', time: '11:00' }),
  ]);
  const from = zonedTimeToInstant(2025, 5, 1, 0, 0, 'America/New_York');
  const occurrences = resolveOccurrences(c, s, { from, days: 45 });
  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].liturgicalDate, '2025-06-01');
});

test('an annual-date rule fires on its calendar date', () => {
  clearCalendarCache();
  const c = church();
  const s = schedule([
    rule({ id: 'assum', kind: 'annual-date', monthDay: { month: 8, day: 15 }, time: '07:30' }),
  ]);
  const from = zonedTimeToInstant(2025, 8, 1, 0, 0, 'Europe/Dublin');
  const occurrences = resolveOccurrences(c, s, { from, days: 30 });
  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].liturgicalDate, '2025-08-15');
  assert.equal(occurrences[0].day.celebration.id, 'assumption');
});

test('seasonal and excepted rules are honoured', () => {
  clearCalendarCache();
  const c = church();
  const s = schedule([
    rule({
      id: 'summer',
      kind: 'weekly',
      weekdays: [0],
      time: '09:00',
      validFrom: '2025-07-01',
      validTo: '2025-08-31',
    }),
    rule({
      id: 'lent-only',
      kind: 'weekly',
      weekdays: [5],
      time: '19:00',
      onlyInSeason: ['lent'],
    }),
  ]);

  // In June the summer Sunday Mass has not started yet.
  const june = resolveOccurrences(c, s, {
    from: zonedTimeToInstant(2025, 6, 1, 0, 0, 'Europe/Dublin'),
    days: 7,
  });
  assert.equal(june.filter((o) => o.ruleId === 'summer').length, 0);

  // In July it runs.
  const july = resolveOccurrences(c, s, {
    from: zonedTimeToInstant(2025, 7, 1, 0, 0, 'Europe/Dublin'),
    days: 14,
  });
  assert.ok(july.some((o) => o.ruleId === 'summer'));

  // The Lent-only Friday Mass appears in March, not in June.
  const march = resolveOccurrences(c, s, {
    from: zonedTimeToInstant(2025, 3, 10, 0, 0, 'Europe/Dublin'),
    days: 14,
  });
  assert.ok(march.some((o) => o.ruleId === 'lent-only'));
  assert.equal(june.filter((o) => o.ruleId === 'lent-only').length, 0);
});

test('duplicate rules from different sources collapse to the best one', () => {
  clearCalendarCache();
  const c = church();
  const s = schedule([
    {
      id: 'osm',
      kind: 'weekly',
      weekdays: [0],
      time: '10:00',
      confidence: 0.45,
      source: { ...source, kind: 'openstreetmap' },
    },
    {
      id: 'web',
      kind: 'weekly',
      weekdays: [0],
      time: '10:00',
      confidence: 0.82,
      source,
    },
  ]);
  const from = zonedTimeToInstant(2025, 8, 15, 0, 0, 'Europe/Dublin');
  const occurrences = resolveOccurrences(c, s, { from, days: 4 });
  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].ruleId, 'web');
});

test('the next obligation Mass skips ordinary weekday Masses', () => {
  clearCalendarCache();
  const c = church();
  const s = schedule([
    rule({ id: 'daily', kind: 'weekly', weekdays: [1, 2, 3, 4, 5], time: '10:00' }),
    rule({ id: 'sunday', kind: 'weekly', weekdays: [0], time: '11:00' }),
  ]);
  // From Monday 11 August 2025 the next obligation is *not* the Sunday: Friday
  // 15 August is the Assumption, a holy day of obligation in Ireland, so the
  // parish's ordinary weekday Mass that morning satisfies it. This is exactly
  // the case a naive "next Sunday Mass" implementation gets wrong.
  const from = zonedTimeToInstant(2025, 8, 11, 8, 0, 'Europe/Dublin');
  const next = nextObligationMass(c, s, { from, days: 10 });
  assert.ok(next);
  assert.equal(next!.liturgicalDate, '2025-08-15');
  assert.equal(next!.day.celebration.id, 'assumption');

  // In a week with no feast, it does fall through to the Sunday.
  clearCalendarCache();
  const quietWeek = zonedTimeToInstant(2025, 9, 8, 8, 0, 'Europe/Dublin');
  const sunday = nextObligationMass(c, s, { from: quietWeek, days: 10 });
  assert.equal(sunday!.liturgicalDate, '2025-09-14');
  assert.equal(sunday!.localTime, '11:00');
});

test('occurrences group under the local date they are celebrated on', () => {
  clearCalendarCache();
  const c = church();
  const s = schedule([
    rule({ kind: 'weekly', weekdays: [6], time: '18:30', anticipates: 'next-day' }),
    rule({ kind: 'weekly', weekdays: [0], time: '10:00' }),
  ]);
  const from = zonedTimeToInstant(2025, 8, 15, 0, 0, 'Europe/Dublin');
  const grouped = groupByLocalDate(resolveOccurrences(c, s, { from, days: 4 }), c.timezone);
  // The vigil groups under Saturday, where a person would go to it — while its
  // liturgy remains Sunday's.
  assert.equal(grouped[0].date, '2025-08-16');
  assert.equal(grouped[0].occurrences[0].liturgicalDate, '2025-08-17');
  assert.equal(grouped[1].date, '2025-08-17');
});

test('a Mass already begun is not offered as the next Mass', () => {
  clearCalendarCache();
  const c = church();
  const s = schedule([rule({ kind: 'weekly', weekdays: [0], time: '10:00' })]);
  // Sunday 17 August 2025 at 10:30 local — the 10:00 has started.
  const from = zonedTimeToInstant(2025, 8, 17, 10, 30, 'Europe/Dublin');
  const occurrences = resolveOccurrences(c, s, { from, days: 8 });
  assert.equal(occurrences[0].liturgicalDate, '2025-08-24');
});
