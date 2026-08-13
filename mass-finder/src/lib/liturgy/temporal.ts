import {
  addDays,
  gregorianEaster,
  isoDate,
  nextWeekdayAfter,
  utc,
  weekdayOf,
  weekdayOnOrAfter,
  weekdayOnOrBefore,
  WEEKDAY_NAMES,
  type Weekday,
} from './computus';
import { Rank, type Celebration, type Season } from './types';

/**
 * The temporal cycle: seasons, and the celebrations that move with Easter or
 * with Christmas.
 *
 * Two options here genuinely vary by country and change what day a person must
 * go to Mass, so they are parameters rather than constants:
 *
 *  - **Epiphany** is kept on 6 January, or transferred to the Sunday between
 *    2 and 8 January.
 *  - **Ascension** is kept on the Thursday 40 days after Easter, or transferred
 *    to the following Sunday.
 *  - **Corpus Christi** is kept on the Thursday after Trinity Sunday, or
 *    transferred to the following Sunday.
 *
 * Getting these wrong is the single most common way a Mass-times listing sends
 * someone to a church on the wrong day.
 */
export interface TemporalOptions {
  epiphany: 'jan6' | 'sunday';
  ascension: 'thursday' | 'sunday';
  corpusChristi: 'thursday' | 'sunday';
}

export const DEFAULT_TEMPORAL: TemporalOptions = {
  epiphany: 'jan6',
  ascension: 'thursday',
  corpusChristi: 'sunday',
};

const ORDINALS = [
  '', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh',
  'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth',
  'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth',
  'Nineteenth', 'Twentieth', 'Twenty-first', 'Twenty-second', 'Twenty-third',
  'Twenty-fourth', 'Twenty-fifth', 'Twenty-sixth', 'Twenty-seventh',
  'Twenty-eighth', 'Twenty-ninth', 'Thirtieth', 'Thirty-first',
  'Thirty-second', 'Thirty-third', 'Thirty-fourth',
];

/** The key dates of one liturgical year, indexed by the civil year of Easter. */
export interface YearAnchors {
  /** Civil year the anchors are computed for. */
  year: number;
  easter: Date;
  ashWednesday: Date;
  palmSunday: Date;
  holyThursday: Date;
  goodFriday: Date;
  holySaturday: Date;
  divineMercySunday: Date;
  ascension: Date;
  pentecost: Date;
  trinitySunday: Date;
  corpusChristi: Date;
  sacredHeart: Date;
  immaculateHeart: Date;
  christTheKing: Date;
  /** Advent I of *this* civil year (starts the next liturgical year). */
  adventStart: Date;
  /** Epiphany as actually kept this year. */
  epiphany: Date;
  /** Baptism of the Lord — the last day of Christmas Time. */
  baptismOfTheLord: Date;
  /** Holy Family — the Sunday in the Christmas octave, or 30 December. */
  holyFamily: Date;
  /** Advent I of the *previous* civil year, needed for the lectionary cycle. */
  previousAdventStart: Date;
}

export function adventStartFor(year: number): Date {
  // The Fourth Sunday of Advent is the last Sunday before Christmas; Advent
  // begins three weeks earlier.
  const adventFour = weekdayOnOrBefore(utc(year, 12, 24), 0);
  return addDays(adventFour, -21);
}

function epiphanyFor(year: number, mode: TemporalOptions['epiphany']): Date {
  if (mode === 'jan6') return utc(year, 1, 6);
  // The Sunday falling between 2 and 8 January.
  return weekdayOnOrAfter(utc(year, 1, 2), 0);
}

function baptismFor(year: number, epiphany: Date, mode: TemporalOptions['epiphany']): Date {
  if (mode === 'jan6') {
    return nextWeekdayAfter(epiphany, 0);
  }
  // Where Epiphany is transferred: normally the following Sunday — but when
  // Epiphany itself lands on 7 or 8 January, Christmas Time is already at its
  // limit and the Baptism is kept on the Monday immediately after.
  const dayOfMonth = epiphany.getUTCDate();
  if (dayOfMonth === 7 || dayOfMonth === 8) return addDays(epiphany, 1);
  return nextWeekdayAfter(epiphany, 0);
}

function holyFamilyFor(year: number): Date {
  // The Sunday within the Christmas octave (26-31 December). When Christmas
  // itself is a Sunday there is no such Sunday, and the feast is kept on
  // 30 December.
  const candidate = weekdayOnOrAfter(utc(year, 12, 26), 0);
  if (candidate.getUTCMonth() === 11 && candidate.getUTCDate() <= 31) return candidate;
  return utc(year, 12, 30);
}

export function anchorsFor(year: number, opts: TemporalOptions = DEFAULT_TEMPORAL): YearAnchors {
  const easter = gregorianEaster(year);
  const pentecost = addDays(easter, 49);
  const trinitySunday = addDays(easter, 56);
  const adventStart = adventStartFor(year);
  const epiphany = epiphanyFor(year, opts.epiphany);

  return {
    year,
    easter,
    ashWednesday: addDays(easter, -46),
    palmSunday: addDays(easter, -7),
    holyThursday: addDays(easter, -3),
    goodFriday: addDays(easter, -2),
    holySaturday: addDays(easter, -1),
    divineMercySunday: addDays(easter, 7),
    ascension: opts.ascension === 'thursday' ? addDays(easter, 39) : addDays(easter, 42),
    pentecost,
    trinitySunday,
    corpusChristi:
      opts.corpusChristi === 'thursday' ? addDays(easter, 60) : addDays(easter, 63),
    sacredHeart: addDays(easter, 68),
    immaculateHeart: addDays(easter, 69),
    christTheKing: addDays(adventStart, -7),
    adventStart,
    epiphany,
    baptismOfTheLord: baptismFor(year, epiphany, opts.epiphany),
    holyFamily: holyFamilyFor(year),
    previousAdventStart: adventStartFor(year - 1),
  };
}

/** What the temporal cycle assigns to a single date. */
export interface TemporalDay {
  season: Season;
  seasonWeek: number;
  /** The temporal celebration for this date (a Sunday, a weekday, a solemnity). */
  celebration: Celebration;
}

function weekdayName(d: Date): string {
  return WEEKDAY_NAMES[weekdayOf(d)];
}

function ordinaryWeekdayCelebration(d: Date, week: number): Celebration {
  return {
    id: `ot-w${week}-${weekdayOf(d)}`,
    name: `${weekdayName(d)} of the ${ORDINALS[week]} Week in Ordinary Time`,
    rank: Rank.WEEKDAY,
    colour: 'green',
    scope: 'universal',
  };
}

/**
 * Build the temporal cycle for every day of a civil year.
 *
 * Returns a map from ISO date to the temporal assignment. Built by walking the
 * seasons forward rather than by testing each date against every rule, because
 * Ordinary Time week numbers are only definable sequentially — the second block
 * of Ordinary Time is numbered *backwards* from Advent so that Christ the King
 * always lands in week 34.
 */
export function temporalYear(
  year: number,
  opts: TemporalOptions = DEFAULT_TEMPORAL,
): Map<string, TemporalDay> {
  const out = new Map<string, TemporalDay>();
  const a = anchorsFor(year, opts);
  const prev = anchorsFor(year - 1, opts);

  const set = (d: Date, day: TemporalDay) => out.set(isoDate(d), day);

  // ── Christmas Time carried over from last year: 1 January → Baptism ───────
  // The octave day of Christmas (1 January) is Mary, Mother of God — a
  // solemnity supplied by the sanctoral, so we only mark the season here.
  {
    const epiphanyThisYear = a.epiphany;
    const baptism = a.baptismOfTheLord;
    for (let d = utc(year, 1, 1); d <= baptism; d = addDays(d, 1)) {
      const iso = isoDate(d);
      if (d < epiphanyThisYear) {
        // Days before Epiphany. 1 January is the octave day; 2-5 January are
        // weekdays of Christmas Time — except a Sunday falling in that gap,
        // which is a Sunday of Christmas Time and carries the Sunday obligation.
        // Treating it as a weekday would tell an Irish or Italian reader that
        // 4 January 2026 was an ordinary weekday when it was in fact a Sunday.
        const isOctaveDay = d.getUTCDate() === 1;
        const isSunday = weekdayOf(d) === 0 && !isOctaveDay;
        out.set(iso, {
          season: 'christmas',
          seasonWeek: 1,
          celebration: isSunday
            ? {
                id: 'second-sunday-after-christmas',
                name: 'The Second Sunday after the Nativity',
                rank: Rank.SUNDAY,
                displayKind: 'Sunday',
                colour: 'white',
                ofTheLord: true,
                about:
                  'A Sunday of Christmas Time, kept in countries where the Epiphany stays on 6 January.',
                scope: 'universal',
              }
            : isOctaveDay
            ? {
                // The octave day of Christmas *is* the solemnity of Mary,
                // Mother of God. Using the sanctoral's id here means the two
                // cycles deduplicate instead of competing, and the day gets the
                // name people will actually see on the parish noticeboard.
                id: 'mary-mother-of-god',
                name: 'Mary, the Holy Mother of God',
                rank: Rank.SOLEMNITY,
                colour: 'white',
                ofMary: true,
                about:
                  'The octave day of Christmas. The Church honours Mary as the Mother of God — the same day as the New Year.',
                scope: 'universal',
              }
            : {
                id: `christmas-weekday-jan-${d.getUTCDate()}`,
                name: `${d.getUTCDate()} January — Christmas Weekday`,
                rank: Rank.WEEKDAY,
                colour: 'white',
                scope: 'universal',
              },
        });
      } else if (isoDate(d) === isoDate(epiphanyThisYear)) {
        out.set(iso, {
          season: 'christmas',
          seasonWeek: 1,
          celebration: {
            id: 'epiphany',
            name: 'The Epiphany of the Lord',
            rank: Rank.PRIVILEGED,
            colour: 'white',
            ofTheLord: true,
            about:
              'The day the Wise Men found the child Jesus — Christ shown to all the nations.',
            scope: opts.epiphany === 'sunday' ? 'transferred' : 'universal',
          },
        });
      } else if (isoDate(d) === isoDate(baptism)) {
        out.set(iso, {
          season: 'christmas',
          seasonWeek: 2,
          celebration: {
            id: 'baptism-of-the-lord',
            name: 'The Baptism of the Lord',
            rank: Rank.FEAST_OF_THE_LORD,
            colour: 'white',
            ofTheLord: true,
            about:
              'Jesus is baptised in the Jordan by John. This is the last day of Christmas.',
            scope: 'universal',
          },
        });
      } else {
        out.set(iso, {
          season: 'christmas',
          seasonWeek: 2,
          celebration: {
            id: `christmas-weekday-after-epiphany-${weekdayOf(d)}`,
            name: `${weekdayName(d)} after Epiphany`,
            rank: Rank.WEEKDAY,
            colour: 'white',
            scope: 'universal',
          },
        });
      }
    }
  }

  // ── Ordinary Time, first block: day after Baptism → day before Ash Wed ───
  // Week 1 begins the day after the Baptism of the Lord. Each Sunday opens the
  // next numbered week.
  {
    let week = 1;
    for (
      let d = addDays(a.baptismOfTheLord, 1);
      d < a.ashWednesday;
      d = addDays(d, 1)
    ) {
      if (weekdayOf(d) === 0) week += 1;
      set(d, {
        season: 'ordinary',
        seasonWeek: week,
        celebration:
          weekdayOf(d) === 0
            ? {
                id: `ot-sunday-${week}`,
                name: `The ${ORDINALS[week]} Sunday in Ordinary Time`,
                rank: Rank.SUNDAY,
                colour: 'green',
                scope: 'universal',
              }
            : ordinaryWeekdayCelebration(d, week),
      });
    }
  }

  // ── Lent: Ash Wednesday → the day before Holy Thursday ───────────────────
  {
    set(a.ashWednesday, {
      season: 'lent',
      seasonWeek: 0,
      celebration: {
        id: 'ash-wednesday',
        name: 'Ash Wednesday',
        rank: Rank.PRIVILEGED,
        displayKind: 'Day of fasting and abstinence',
        colour: 'violet',
        about:
          'Lent begins. Ashes are placed on the forehead. It is a day of fasting and abstinence — but it is not a holy day of obligation.',
        scope: 'universal',
      },
    });
    for (let d = addDays(a.ashWednesday, 1); weekdayOf(d) !== 0; d = addDays(d, 1)) {
      set(d, {
        season: 'lent',
        seasonWeek: 0,
        celebration: {
          id: `lent-after-ashes-${weekdayOf(d)}`,
          name: `${weekdayName(d)} after Ash Wednesday`,
          rank: Rank.PRIVILEGED_WEEKDAY,
          colour: 'violet',
          scope: 'universal',
        },
      });
    }

    for (let week = 1; week <= 5; week += 1) {
      const sunday = addDays(a.easter, -49 + week * 7);
      const isLaetare = week === 4;
      set(sunday, {
        season: 'lent',
        seasonWeek: week,
        celebration: {
          id: `lent-sunday-${week}`,
          name: `The ${ORDINALS[week]} Sunday of Lent`,
          rank: Rank.PRIVILEGED,
          displayKind: 'Sunday',
          colour: isLaetare ? 'rose' : 'violet',
          about: isLaetare
            ? 'Laetare Sunday — a note of joy in the middle of Lent. Rose vestments may be worn.'
            : undefined,
          scope: 'universal',
        },
      });
      for (let i = 1; i <= 6; i += 1) {
        const d = addDays(sunday, i);
        if (d >= a.palmSunday) break;
        set(d, {
          season: 'lent',
          seasonWeek: week,
          celebration: {
            id: `lent-w${week}-${weekdayOf(d)}`,
            name: `${weekdayName(d)} of the ${ORDINALS[week]} Week of Lent`,
            rank: Rank.PRIVILEGED_WEEKDAY,
            colour: 'violet',
            scope: 'universal',
          },
        });
      }
    }

    // Holy Week.
    set(a.palmSunday, {
      season: 'lent',
      seasonWeek: 6,
      celebration: {
        id: 'palm-sunday',
        name: 'Palm Sunday of the Passion of the Lord',
        rank: Rank.PRIVILEGED,
        displayKind: 'Sunday',
        colour: 'red',
        ofTheLord: true,
        about:
          'Holy Week begins. Palms are blessed and the Passion is read. Mass is longer than usual.',
        scope: 'universal',
      },
    });
    const holyWeekNames: Array<[number, string, string]> = [
      [-6, 'monday-of-holy-week', 'Monday of Holy Week'],
      [-5, 'tuesday-of-holy-week', 'Tuesday of Holy Week'],
      [-4, 'wednesday-of-holy-week', 'Wednesday of Holy Week'],
    ];
    for (const [offset, id, name] of holyWeekNames) {
      set(addDays(a.easter, offset), {
        season: 'lent',
        seasonWeek: 6,
        celebration: {
          id,
          name,
          rank: Rank.PRIVILEGED,
          displayKind: 'Day of Holy Week',
          colour: 'violet',
          scope: 'universal',
        },
      });
    }
  }

  // ── The Easter Triduum ───────────────────────────────────────────────────
  set(a.holyThursday, {
    season: 'triduum',
    seasonWeek: 0,
    celebration: {
      id: 'holy-thursday',
      name: 'Thursday of the Lord’s Supper',
      rank: Rank.TRIDUUM,
      colour: 'white',
      ofTheLord: true,
      about:
        'The evening Mass of the Lord’s Supper remembers the Last Supper. There is normally only one Mass, in the evening, and no morning Mass.',
      scope: 'universal',
    },
  });
  set(a.goodFriday, {
    season: 'triduum',
    seasonWeek: 0,
    celebration: {
      id: 'good-friday',
      name: 'Friday of the Passion of the Lord',
      rank: Rank.TRIDUUM,
      colour: 'red',
      ofTheLord: true,
      about:
        'Good Friday. There is NO Mass anywhere in the world today — instead there is the Celebration of the Lord’s Passion, usually in the afternoon. A day of fasting and abstinence.',
      scope: 'universal',
    },
  });
  set(a.holySaturday, {
    season: 'triduum',
    seasonWeek: 0,
    celebration: {
      id: 'holy-saturday',
      name: 'Holy Saturday',
      rank: Rank.TRIDUUM,
      colour: 'white',
      ofTheLord: true,
      about:
        'There is no Mass during the day. The Easter Vigil begins after nightfall — the greatest Mass of the year, and it fulfils the Easter obligation.',
      scope: 'universal',
    },
  });

  // ── Easter Time: Easter Sunday → Pentecost ───────────────────────────────
  {
    set(a.easter, {
      season: 'easter',
      seasonWeek: 1,
      celebration: {
        id: 'easter-sunday',
        name: 'Easter Sunday of the Resurrection of the Lord',
        rank: Rank.TRIDUUM,
        displayKind: 'Solemnity',
        colour: 'gold',
        ofTheLord: true,
        about: 'Easter Day — the Resurrection of Jesus. The greatest feast of the year.',
        scope: 'universal',
      },
    });
    for (let i = 1; i <= 6; i += 1) {
      const d = addDays(a.easter, i);
      set(d, {
        season: 'easter',
        seasonWeek: 1,
        celebration: {
          id: `easter-octave-${weekdayOf(d)}`,
          name: `${weekdayName(d)} within the Octave of Easter`,
          rank: Rank.PRIVILEGED,
          displayKind: 'Day in the Octave of Easter',
          colour: 'white',
          ofTheLord: true,
          scope: 'universal',
        },
      });
    }
    set(a.divineMercySunday, {
      season: 'easter',
      seasonWeek: 2,
      celebration: {
        id: 'divine-mercy-sunday',
        name: 'The Second Sunday of Easter (Divine Mercy Sunday)',
        rank: Rank.PRIVILEGED,
        displayKind: 'Sunday',
        colour: 'white',
        ofTheLord: true,
        about: 'The octave day of Easter, kept as Divine Mercy Sunday.',
        scope: 'universal',
      },
    });

    for (let week = 3; week <= 7; week += 1) {
      const sunday = addDays(a.easter, (week - 1) * 7);
      set(sunday, {
        season: 'easter',
        seasonWeek: week,
        celebration: {
          id: `easter-sunday-${week}`,
          name: `The ${ORDINALS[week]} Sunday of Easter`,
          rank: Rank.PRIVILEGED,
          displayKind: 'Sunday',
          colour: 'white',
          scope: 'universal',
        },
      });
    }
    // Easter weekdays (octave already filled above; `set` overwrites, so fill
    // weekdays first is not needed — we skip any date already assigned).
    for (let d = addDays(a.easter, 7); d < a.pentecost; d = addDays(d, 1)) {
      const iso = isoDate(d);
      if (out.has(iso)) continue;
      const week = Math.floor((d.getTime() - a.easter.getTime()) / 604_800_000) + 1;
      out.set(iso, {
        season: 'easter',
        seasonWeek: week,
        celebration: {
          id: `easter-w${week}-${weekdayOf(d)}`,
          name: `${weekdayName(d)} of the ${ORDINALS[week]} Week of Easter`,
          rank: Rank.WEEKDAY,
          colour: 'white',
          scope: 'universal',
        },
      });
    }

    set(a.ascension, {
      season: 'easter',
      seasonWeek: opts.ascension === 'thursday' ? 6 : 7,
      celebration: {
        id: 'ascension',
        name: 'The Ascension of the Lord',
        rank: Rank.PRIVILEGED,
        colour: 'white',
        ofTheLord: true,
        about:
          'Jesus returns to the Father forty days after Easter. In many countries this is a holy day of obligation.',
        scope: opts.ascension === 'sunday' ? 'transferred' : 'universal',
      },
    });

    set(a.pentecost, {
      season: 'easter',
      seasonWeek: 8,
      celebration: {
        id: 'pentecost',
        name: 'Pentecost Sunday',
        rank: Rank.PRIVILEGED,
        displayKind: 'Solemnity',
        colour: 'red',
        ofTheLord: true,
        about:
          'The Holy Spirit comes upon the apostles fifty days after Easter. Easter Time ends today.',
        scope: 'universal',
      },
    });
  }

  // ── Ordinary Time, second block: Monday after Pentecost → Advent I ───────
  // Numbered backwards from Advent so that Christ the King is always the Sunday
  // of week 34.
  {
    const lastSaturday = addDays(a.adventStart, -1);
    const totalDays =
      Math.round((lastSaturday.getTime() - addDays(a.pentecost, 1).getTime()) / 86_400_000) + 1;
    // Work out the week number of the Monday after Pentecost by counting the
    // Sundays that remain before Advent.
    let sundaysRemaining = 0;
    for (
      let d = addDays(a.pentecost, 1);
      d <= lastSaturday;
      d = addDays(d, 1)
    ) {
      if (weekdayOf(d) === 0) sundaysRemaining += 1;
    }
    let week = 34 - sundaysRemaining;
    void totalDays;

    for (let d = addDays(a.pentecost, 1); d <= lastSaturday; d = addDays(d, 1)) {
      if (weekdayOf(d) === 0) week += 1;
      const iso = isoDate(d);
      const isChristTheKing = iso === isoDate(a.christTheKing);
      out.set(iso, {
        season: 'ordinary',
        seasonWeek: week,
        celebration: isChristTheKing
          ? {
              id: 'christ-the-king',
              name: 'Our Lord Jesus Christ, King of the Universe',
              rank: Rank.SOLEMNITY,
              colour: 'white',
              ofTheLord: true,
              about: 'The last Sunday of the Church’s year.',
              scope: 'universal',
            }
          : weekdayOf(d) === 0
            ? {
                id: `ot-sunday-${week}`,
                name: `The ${ORDINALS[week]} Sunday in Ordinary Time`,
                rank: Rank.SUNDAY,
                colour: 'green',
                scope: 'universal',
              }
            : ordinaryWeekdayCelebration(d, week),
      });
    }

    // Solemnities of the Lord that hang off Pentecost and Trinity. The two
    // moveable *memorials* (Mary Mother of the Church, the Immaculate Heart)
    // are not temporal celebrations — they are supplied by `moveableSanctoral`
    // so the precedence table can weigh them against the weekday properly.
    set(a.trinitySunday, {
      season: 'ordinary',
      seasonWeek: out.get(isoDate(a.trinitySunday))?.seasonWeek ?? 0,
      celebration: {
        id: 'trinity-sunday',
        name: 'The Most Holy Trinity',
        rank: Rank.SOLEMNITY,
        colour: 'white',
        ofTheLord: true,
        scope: 'universal',
      },
    });
    set(a.corpusChristi, {
      season: 'ordinary',
      seasonWeek: out.get(isoDate(a.corpusChristi))?.seasonWeek ?? 0,
      celebration: {
        id: 'corpus-christi',
        name: 'The Most Holy Body and Blood of Christ',
        rank: Rank.SOLEMNITY,
        colour: 'white',
        ofTheLord: true,
        about:
          'Corpus Christi. There is often a procession with the Blessed Sacrament after Mass.',
        scope: opts.corpusChristi === 'sunday' ? 'transferred' : 'universal',
      },
    });
    set(a.sacredHeart, {
      season: 'ordinary',
      seasonWeek: out.get(isoDate(a.sacredHeart))?.seasonWeek ?? 0,
      celebration: {
        id: 'sacred-heart',
        name: 'The Most Sacred Heart of Jesus',
        rank: Rank.SOLEMNITY,
        colour: 'white',
        ofTheLord: true,
        scope: 'universal',
      },
    });
  }

  // ── Advent of this year ──────────────────────────────────────────────────
  {
    for (let week = 1; week <= 4; week += 1) {
      const sunday = addDays(a.adventStart, (week - 1) * 7);
      if (sunday.getUTCFullYear() !== year) continue;
      const isGaudete = week === 3;
      set(sunday, {
        season: 'advent',
        seasonWeek: week,
        celebration: {
          id: `advent-sunday-${week}`,
          name: `The ${ORDINALS[week]} Sunday of Advent`,
          rank: Rank.PRIVILEGED,
          displayKind: 'Sunday',
          colour: isGaudete ? 'rose' : 'violet',
          about: isGaudete
            ? 'Gaudete Sunday — "Rejoice!" Rose vestments may be worn.'
            : undefined,
          scope: 'universal',
        },
      });
    }
    for (let d = a.adventStart; d < utc(year, 12, 25); d = addDays(d, 1)) {
      const iso = isoDate(d);
      if (out.has(iso) && out.get(iso)!.season === 'advent') continue;
      const week = Math.floor((d.getTime() - a.adventStart.getTime()) / 604_800_000) + 1;
      const dayOfMonth = d.getUTCDate();
      const isLate = d.getUTCMonth() === 11 && dayOfMonth >= 17;
      out.set(iso, {
        season: 'advent',
        seasonWeek: week,
        celebration: {
          id: isLate ? `advent-dec-${dayOfMonth}` : `advent-w${week}-${weekdayOf(d)}`,
          name: isLate
            ? `${dayOfMonth} December`
            : `${weekdayName(d)} of the ${ORDINALS[week]} Week of Advent`,
          rank: isLate ? Rank.PRIVILEGED_WEEKDAY : Rank.WEEKDAY,
          colour: 'violet',
          scope: 'universal',
        },
      });
    }
  }

  // ── Christmas of this year: 25 → 31 December ─────────────────────────────
  {
    set(utc(year, 12, 25), {
      season: 'christmas',
      seasonWeek: 1,
      celebration: {
        id: 'christmas',
        name: 'The Nativity of the Lord',
        rank: Rank.PRIVILEGED,
        colour: 'white',
        ofTheLord: true,
        about:
          'Christmas Day. The Mass on Christmas Eve after nightfall also fulfils the obligation.',
        scope: 'universal',
      },
    });
    for (let day = 26; day <= 31; day += 1) {
      const d = utc(year, 12, day);
      set(d, {
        season: 'christmas',
        seasonWeek: 1,
        celebration: {
          id: `christmas-octave-day-${day}`,
          name: `${day} December — Day within the Octave of the Nativity`,
          rank: Rank.PRIVILEGED_WEEKDAY,
          colour: 'white',
          scope: 'universal',
        },
      });
    }
    const hf = a.holyFamily;
    set(hf, {
      season: 'christmas',
      seasonWeek: 1,
      celebration: {
        id: 'holy-family',
        name: 'The Holy Family of Jesus, Mary and Joseph',
        rank: Rank.FEAST_OF_THE_LORD,
        colour: 'white',
        ofTheLord: true,
        about: 'Jesus, Mary and Joseph honoured together as a family.',
        scope: 'universal',
      },
    });
  }

  void prev;
  return out;
}

/**
 * Celebrations of Mary and the saints whose date moves with Easter, and which
 * therefore cannot live in the date-keyed sanctoral. Returned as date → list so
 * the precedence resolver can weigh them against the temporal day.
 */
export function moveableSanctoral(
  year: number,
  opts: TemporalOptions = DEFAULT_TEMPORAL,
): Map<string, Celebration[]> {
  const a = anchorsFor(year, opts);
  const out = new Map<string, Celebration[]>();
  out.set(isoDate(addDays(a.pentecost, 1)), [
    {
      id: 'mary-mother-of-the-church',
      name: 'The Blessed Virgin Mary, Mother of the Church',
      rank: Rank.MEMORIAL,
      colour: 'white',
      ofMary: true,
      scope: 'universal',
    },
  ]);
  out.set(isoDate(a.immaculateHeart), [
    {
      id: 'immaculate-heart-of-mary',
      name: 'The Immaculate Heart of the Blessed Virgin Mary',
      rank: Rank.MEMORIAL,
      colour: 'white',
      ofMary: true,
      scope: 'universal',
    },
  ]);
  return out;
}

/**
 * Sunday and weekday lectionary cycles.
 *
 * Both are keyed to the liturgical year, which begins in Advent — so a date in
 * December belongs to the *next* civil year's cycle. Sunday readings run on a
 * three-year cycle (A / B / C) and weekday readings on a two-year cycle
 * (I / II).
 */
export function lectionaryCycles(d: Date, opts: TemporalOptions = DEFAULT_TEMPORAL): {
  sundayCycle: 'A' | 'B' | 'C';
  weekdayCycle: 'I' | 'II';
} {
  void opts;
  const civilYear = d.getUTCFullYear();
  const advent = adventStartFor(civilYear);
  // The liturgical year is identified by the civil year it mostly falls in.
  const liturgicalYear = d >= advent ? civilYear + 1 : civilYear;
  // Liturgical year 2023 is Year A, 2024 Year B, 2025 Year C — so the residues
  // 1 / 2 / 0 map to A / B / C respectively.
  const sundayCycle = (['C', 'A', 'B'] as const)[liturgicalYear % 3];
  const weekdayCycle = liturgicalYear % 2 === 1 ? 'I' : 'II';
  return { sundayCycle, weekdayCycle };
}

export function ordinalLabel(n: number): string {
  return ORDINALS[n] ?? String(n);
}
