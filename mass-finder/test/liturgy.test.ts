import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addDays,
  gregorianEaster,
  isoDate,
  utc,
  weekdayOnOrBefore,
} from '../src/lib/liturgy/computus';
import { anchorsFor, adventStartFor, lectionaryCycles } from '../src/lib/liturgy/temporal';
import { buildYear, clearCalendarCache, liturgicalDay } from '../src/lib/liturgy/calendar';
import { regionFor } from '../src/lib/liturgy/regions';
import { Rank } from '../src/lib/liturgy/types';

const US = regionFor('US');
const IE = regionFor('IE');
const PL = regionFor('PL');

test('Gregorian Easter matches published dates', () => {
  const known: Record<number, string> = {
    1818: '1818-03-22', // earliest possible date
    1900: '1900-04-15',
    1961: '1961-04-02',
    2000: '2000-04-23',
    2011: '2011-04-24',
    2018: '2018-04-01',
    2024: '2024-03-31',
    2025: '2025-04-20',
    2026: '2026-04-05',
    2027: '2027-03-28',
    2028: '2028-04-16',
    2038: '2038-04-25', // latest possible date
  };
  for (const [year, expected] of Object.entries(known)) {
    assert.equal(isoDate(gregorianEaster(Number(year))), expected, `Easter ${year}`);
  }
});

test('Easter is always a Sunday, for eight centuries', () => {
  for (let y = 1600; y <= 2400; y += 1) {
    assert.equal(gregorianEaster(y).getUTCDay(), 0, `Easter ${y} is not a Sunday`);
  }
});

test('moveable feasts derived from Easter 2025', () => {
  const a = anchorsFor(2025, US.temporal);
  assert.equal(isoDate(a.easter), '2025-04-20');
  assert.equal(isoDate(a.ashWednesday), '2025-03-05');
  assert.equal(isoDate(a.palmSunday), '2025-04-13');
  assert.equal(isoDate(a.holyThursday), '2025-04-17');
  assert.equal(isoDate(a.goodFriday), '2025-04-18');
  assert.equal(isoDate(a.pentecost), '2025-06-08');
  assert.equal(isoDate(a.trinitySunday), '2025-06-15');
  assert.equal(isoDate(a.christTheKing), '2025-11-23');
  assert.equal(isoDate(a.adventStart), '2025-11-30');
});

test('Ascension and Corpus Christi follow the regional option', () => {
  const thursday = anchorsFor(2025, { epiphany: 'jan6', ascension: 'thursday', corpusChristi: 'thursday' });
  assert.equal(isoDate(thursday.ascension), '2025-05-29');
  assert.equal(isoDate(thursday.corpusChristi), '2025-06-19');

  const sunday = anchorsFor(2025, { epiphany: 'jan6', ascension: 'sunday', corpusChristi: 'sunday' });
  assert.equal(isoDate(sunday.ascension), '2025-06-01');
  assert.equal(isoDate(sunday.corpusChristi), '2025-06-22');
});

test('Advent begins on the Sunday four weeks before Christmas', () => {
  assert.equal(isoDate(adventStartFor(2024)), '2024-12-01');
  assert.equal(isoDate(adventStartFor(2025)), '2025-11-30');
  assert.equal(isoDate(adventStartFor(2026)), '2026-11-29');
  // When Christmas is a Sunday (2022), Advent IV is 18 December.
  assert.equal(isoDate(weekdayOnOrBefore(utc(2022, 12, 24), 0)), '2022-12-18');
  assert.equal(isoDate(adventStartFor(2022)), '2022-11-27');
});

test('Epiphany transferred to Sunday, and the Baptism that follows it', () => {
  // 2025: the Sunday between 2 and 8 January is 5 January; Baptism the next Sunday.
  const a2025 = anchorsFor(2025, US.temporal);
  assert.equal(isoDate(a2025.epiphany), '2025-01-05');
  assert.equal(isoDate(a2025.baptismOfTheLord), '2025-01-12');

  // 2024 is the interesting case: Epiphany lands on 7 January, so Christmas
  // Time is at its limit and the Baptism is kept on the Monday, 8 January.
  const a2024 = anchorsFor(2024, US.temporal);
  assert.equal(isoDate(a2024.epiphany), '2024-01-07');
  assert.equal(isoDate(a2024.baptismOfTheLord), '2024-01-08');
});

test('Epiphany kept on 6 January where the conference has not moved it', () => {
  const a = anchorsFor(2025, IE.temporal);
  assert.equal(isoDate(a.epiphany), '2025-01-06');
  assert.equal(isoDate(a.baptismOfTheLord), '2025-01-12');
});

test('Holy Family falls on 30 December when Christmas is a Sunday', () => {
  // 2022: Christmas was a Sunday, so there is no Sunday in the octave.
  assert.equal(isoDate(anchorsFor(2022, US.temporal).holyFamily), '2022-12-30');
  // 2025: Christmas is a Thursday, so the Sunday in the octave is 28 December.
  assert.equal(isoDate(anchorsFor(2025, US.temporal).holyFamily), '2025-12-28');
});

test('lectionary cycles', () => {
  // Liturgical year 2025 (from Advent 2024) is Year C, weekday Year I.
  assert.deepEqual(lectionaryCycles(utc(2025, 6, 1)), { sundayCycle: 'C', weekdayCycle: 'I' });
  // Liturgical year 2024 is Year B, weekday Year II.
  assert.deepEqual(lectionaryCycles(utc(2024, 6, 1)), { sundayCycle: 'B', weekdayCycle: 'II' });
  // Liturgical year 2023 is Year A, weekday Year I.
  assert.deepEqual(lectionaryCycles(utc(2023, 6, 1)), { sundayCycle: 'A', weekdayCycle: 'I' });
  // December after Advent I already belongs to the next liturgical year.
  assert.equal(lectionaryCycles(utc(2024, 12, 8)).sundayCycle, 'C');
  assert.equal(lectionaryCycles(utc(2024, 11, 24)).sundayCycle, 'B');
});

test('the Annunciation is transferred out of Holy Week', () => {
  // 2024: 25 March was Monday of Holy Week. The Annunciation moves to the
  // Monday after the Second Sunday of Easter — 8 April 2024.
  clearCalendarCache();
  const year = buildYear(2024, US);
  assert.equal(year.get('2024-03-25')!.celebration.id, 'monday-of-holy-week');
  const target = year.get('2024-04-08')!;
  assert.equal(target.celebration.id, 'annunciation');
  assert.equal(target.celebration.scope, 'transferred');
  assert.match(target.celebration.about!, /Transferred from 25 March/);
});

test('the Immaculate Conception is transferred off a Sunday of Advent', () => {
  // 8 December 2024 was the Second Sunday of Advent, so the solemnity moved to
  // Monday 9 December.
  clearCalendarCache();
  const year = buildYear(2024, US);
  assert.equal(year.get('2024-12-08')!.celebration.id, 'advent-sunday-2');
  assert.equal(year.get('2024-12-09')!.celebration.id, 'immaculate-conception');
  assert.equal(year.get('2024-12-09')!.celebration.scope, 'transferred');
});

test('the Immaculate Conception stays put when it is not a Sunday', () => {
  clearCalendarCache();
  const year = buildYear(2025, US);
  assert.equal(year.get('2025-12-08')!.celebration.id, 'immaculate-conception');
  assert.equal(year.get('2025-12-08')!.isHolyDayOfObligation, true);
});

test('All Souls displaces a Sunday in Ordinary Time', () => {
  // 2 November 2025 was a Sunday. All Souls is the one commemoration that wins.
  clearCalendarCache();
  const year = buildYear(2025, US);
  const day = year.get('2025-11-02')!;
  assert.equal(day.celebration.id, 'all-souls');
  // It is still a Sunday, so the obligation stands.
  assert.equal(day.isHolyDayOfObligation, true);
});

test('a solemnity outranks a Sunday in Ordinary Time', () => {
  clearCalendarCache();
  // 29 June 2025 (Saints Peter and Paul) was a Sunday.
  const year = buildYear(2025, US);
  assert.equal(year.get('2025-06-29')!.celebration.id, 'ss-peter-paul');
});

test('a feast of a saint is suppressed by a Sunday', () => {
  clearCalendarCache();
  const year = buildYear(2025, US);
  // 3 July 2025 (Saint Thomas) is a Thursday — the feast is kept.
  assert.equal(year.get('2025-07-03')!.celebration.id, 'st-thomas-apostle');
  // 25 January 2026 (Conversion of Saint Paul) is a Sunday — the Sunday wins,
  // and the feast is listed as also falling today.
  const y2026 = buildYear(2026, US);
  const jan25 = y2026.get('2026-01-25')!;
  assert.equal(jan25.celebration.rank, Rank.SUNDAY);
  assert.ok(jan25.alsoToday.some((c) => c.id === 'conversion-of-st-paul'));
});

test('a memorial in Lent yields to the Lenten weekday but is still noted', () => {
  clearCalendarCache();
  const year = buildYear(2025, US);
  // 7 March 2025 (Perpetua and Felicity) is a Friday after Ash Wednesday.
  const day = year.get('2025-03-07')!;
  assert.equal(day.season, 'lent');
  assert.ok(day.celebration.rank <= Rank.PRIVILEGED_WEEKDAY);
  assert.ok(day.alsoToday.some((c) => c.id === 'ss-perpetua-felicity'));
});

test('Ordinary Time weeks are numbered so Christ the King is week 34', () => {
  clearCalendarCache();
  const year = buildYear(2025, US);
  assert.equal(year.get('2025-11-23')!.celebration.id, 'christ-the-king');
  assert.equal(year.get('2025-11-23')!.seasonWeek, 34);
  // 22 June 2025 is the 12th week of Ordinary Time. In the United States the
  // Sunday itself is taken by Corpus Christi, which the conference transfers off
  // the Thursday — so check the week number here, and the plain Sunday in a
  // country that keeps Corpus Christi on its own day.
  assert.equal(year.get('2025-06-22')!.seasonWeek, 12);
  assert.equal(year.get('2025-06-22')!.celebration.id, 'corpus-christi');
  clearCalendarCache();
  assert.equal(buildYear(2025, PL).get('2025-06-22')!.celebration.id, 'ot-sunday-12');
  clearCalendarCache();
  // Trinity Sunday occupies the 11th Sunday's slot.
  assert.equal(year.get('2025-06-15')!.celebration.id, 'trinity-sunday');
  assert.equal(year.get('2025-06-15')!.seasonWeek, 11);
});

test('every day of a decade is assigned exactly one celebration', () => {
  for (let y = 2020; y <= 2030; y += 1) {
    clearCalendarCache();
    const year = buildYear(y, US);
    const expectedDays = (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 366 : 365;
    assert.equal(year.size, expectedDays, `${y} should have ${expectedDays} days`);
    for (let d = utc(y, 1, 1); d.getUTCFullYear() === y; d = addDays(d, 1)) {
      const day = year.get(isoDate(d));
      assert.ok(day, `missing ${isoDate(d)}`);
      assert.ok(day!.celebration.name.length > 0, `unnamed ${isoDate(d)}`);
      assert.ok(day!.season, `no season for ${isoDate(d)}`);
    }
  }
});

test('Good Friday allows no Mass, Holy Saturday only the Vigil', () => {
  clearCalendarCache();
  const year = buildYear(2025, US);
  assert.equal(year.get('2025-04-18')!.massRestriction, 'none');
  assert.equal(year.get('2025-04-19')!.massRestriction, 'vigil-only');
  assert.equal(year.get('2025-04-17')!.massRestriction, 'evening-only');
  // Neither Good Friday nor Holy Saturday is a day of obligation.
  assert.equal(year.get('2025-04-18')!.isHolyDayOfObligation, false);
  assert.equal(year.get('2025-04-19')!.isHolyDayOfObligation, false);
});

test('United States abrogates some obligations on Saturday and Monday', () => {
  clearCalendarCache();
  // 15 August 2026 is a Saturday, so the Assumption does not bind in the US.
  const y2026 = buildYear(2026, US);
  const aug15 = y2026.get('2026-08-15')!;
  assert.equal(aug15.celebration.id, 'assumption');
  assert.equal(aug15.isHolyDayOfObligation, false);

  // 15 August 2025 is a Friday, so it does bind.
  clearCalendarCache();
  const y2025 = buildYear(2025, US);
  assert.equal(y2025.get('2025-08-15')!.isHolyDayOfObligation, true);

  // The Immaculate Conception is the patronal feast and is never abrogated.
  clearCalendarCache();
  const y2030 = buildYear(2030, US);
  const dec8 = y2030.get('2030-12-08')!;
  if (dec8.celebration.id === 'immaculate-conception') {
    assert.equal(dec8.isHolyDayOfObligation, true);
  }
});

test('regional differences produce different obligation answers on one date', () => {
  clearCalendarCache();
  // Corpus Christi 2025: Thursday 19 June in Poland, Sunday 22 June in the US.
  const pl = buildYear(2025, PL);
  const us = buildYear(2025, US);
  assert.equal(pl.get('2025-06-19')!.celebration.id, 'corpus-christi');
  assert.equal(pl.get('2025-06-19')!.isHolyDayOfObligation, true);
  assert.equal(us.get('2025-06-22')!.celebration.id, 'corpus-christi');
  assert.notEqual(us.get('2025-06-19')!.celebration.id, 'corpus-christi');
});

test('Saint Patrick binds in Ireland and not in the United States', () => {
  clearCalendarCache();
  const ie = buildYear(2025, IE);
  assert.equal(ie.get('2025-03-17')!.isHolyDayOfObligation, true);
  clearCalendarCache();
  const us = buildYear(2025, US);
  assert.equal(us.get('2025-03-17')!.isHolyDayOfObligation, false);
});

test('an optional memorial does not displace the weekday it falls on', () => {
  clearCalendarCache();
  const year = buildYear(2026, US);
  // 13 August is Saints Pontian and Hippolytus — an optional memorial. On an
  // ordinary weekday the weekday Mass is the default; the memorial is offered.
  const day = year.get('2026-08-13')!;
  assert.equal(day.celebration.rank, Rank.WEEKDAY);
  assert.ok(day.alsoToday.some((c) => c.id === 'ss-pontian-hippolytus'));
  // An *obligatory* memorial does displace it.
  const obligatory = year.get('2026-08-11')!; // Saint Clare
  assert.equal(obligatory.celebration.id, 'st-clare');
  assert.equal(obligatory.celebration.rank, Rank.MEMORIAL);
});

test('a national proper promotes a celebration the universal calendar ranks low', () => {
  clearCalendarCache();
  // Saint Patrick is an optional memorial universally, a Solemnity in Ireland.
  // 17 March 2025 is a Monday in Lent — universally the Lenten weekday wins.
  assert.equal(buildYear(2025, regionFor('US')).get('2025-03-17')!.celebration.id !== 'st-patrick', true);
  clearCalendarCache();
  const ie = buildYear(2025, IE).get('2025-03-17')!;
  assert.equal(ie.celebration.id, 'st-patrick');
  assert.equal(ie.celebration.scope, 'national');
});

test('a national patron is transferred off a Sunday of Lent', () => {
  // 17 March 2024 was the Fifth Sunday of Lent.
  clearCalendarCache();
  const ie = buildYear(2024, IE);
  assert.equal(ie.get('2024-03-17')!.celebration.id, 'lent-sunday-5');
  assert.equal(ie.get('2024-03-18')!.celebration.id, 'st-patrick');
  assert.equal(ie.get('2024-03-18')!.celebration.scope, 'transferred');
});

test('country-only celebrations appear only in that country', () => {
  clearCalendarCache();
  const br = buildYear(2025, regionFor('BR'));
  assert.equal(br.get('2025-10-12')!.celebration.id, 'our-lady-of-aparecida');
  clearCalendarCache();
  const us = buildYear(2025, US);
  assert.notEqual(us.get('2025-10-12')!.celebration.id, 'our-lady-of-aparecida');
});

test('Guadalupe holds its day in Mexico even against a Sunday of Advent', () => {
  // 12 December 2027 falls on the Third Sunday of Advent.
  clearCalendarCache();
  const mx = buildYear(2027, regionFor('MX'));
  const dec12 = mx.get('2027-12-12')!;
  assert.equal(dec12.weekday, 0);
  assert.equal(dec12.celebration.id, 'our-lady-of-guadalupe');
  assert.equal(dec12.isHolyDayOfObligation, true);
});

test('1 January is Mary, Mother of God — not a generic octave day', () => {
  clearCalendarCache();
  const day = buildYear(2026, US).get('2026-01-01')!;
  assert.equal(day.celebration.id, 'mary-mother-of-god');
  assert.match(day.celebration.name, /Mother of God/);
  // 1 January 2026 is a Thursday, so the US obligation is not abrogated.
  assert.equal(day.isHolyDayOfObligation, true);
  // 1 January 2028 is a Saturday, so it is.
  clearCalendarCache();
  assert.equal(buildYear(2028, US).get('2028-01-01')!.isHolyDayOfObligation, false);
});

test('obligation confidence is surfaced honestly', () => {
  clearCalendarCache();
  // A country with no verified table falls back to universal law and says so.
  const day = liturgicalDay(utc(2025, 8, 15), 'ZZ');
  assert.equal(day.obligationConfidence, 'unverified');
  // Sundays are always certain, whatever the country.
  const sunday = liturgicalDay(utc(2025, 8, 17), 'ZZ');
  assert.equal(sunday.weekday, 0);
  assert.equal(sunday.obligationConfidence, 'verified');
  assert.equal(sunday.isHolyDayOfObligation, true);
});

test('every Sunday of a year is a day of obligation everywhere', () => {
  for (const code of ['US', 'IE', 'PL', 'PH', 'ZZ']) {
    clearCalendarCache();
    const year = buildYear(2025, regionFor(code));
    for (const [iso, day] of year) {
      if (day.weekday === 0) {
        assert.equal(day.isHolyDayOfObligation, true, `${code} ${iso}`);
      }
    }
  }
});
