import { SEASON_LABELS, RANK_LABELS, Rank, type LiturgicalDay } from './types';

/**
 * Turning the liturgical calendar into sentences an eighty-year-old can read
 * without a glossary.
 *
 * The calendar engine knows that 15 August 2025 is a Solemnity of rank 3, of the
 * Blessed Virgin Mary, a holy day of obligation in Ireland under canon 1246 with
 * `verified` confidence. None of that is useful to the person holding the phone.
 * What they need is: *what is this Mass, do I have to go, and can I trust you.*
 *
 * Three rules govern the wording:
 *
 *  1. **No jargon without a gloss.** "Solemnity", "vigil", "obligation" and
 *     "Ordinary Time" all get explained in the same breath.
 *  2. **Certainty is graded in the language, not hidden.** A `verified`
 *     obligation says "you are expected at Mass"; an `unverified` one says
 *     "in many countries this is a day to go to Mass — your parish will know".
 *     The interface never launders a guess into a statement.
 *  3. **Short sentences.** One idea each.
 */

export interface DayExplanation {
  /** The headline name, e.g. "The Assumption of the Blessed Virgin Mary". */
  title: string;
  /** What kind of day it is: "Sunday", "Solemnity", "Weekday". */
  kind: string;
  /** One or two sentences saying what is being celebrated. */
  what: string;
  /** Whether the person is expected at Mass, phrased to match our certainty. */
  obligation?: string;
  /** Anything unusual about Mass itself today. */
  warning?: string;
  /** Season context, for people who like to know where they are in the year. */
  season: string;
}

const SEASON_NOTES: Record<LiturgicalDay['season'], string> = {
  advent: 'Advent is the four weeks of getting ready for Christmas.',
  christmas: 'Christmas Time runs from Christmas Day until the Baptism of the Lord in January.',
  lent: 'Lent is the forty days of preparation before Easter.',
  triduum: 'These are the three holiest days of the year, from Thursday evening to Easter.',
  easter: 'Easter Time is the fifty days from Easter Sunday to Pentecost.',
  ordinary: 'Ordinary Time is the rest of the year, outside the great seasons.',
};

function obligationSentence(day: LiturgicalDay): string | undefined {
  if (!day.isHolyDayOfObligation) return undefined;

  if (day.weekday === 0) {
    return 'This is a Sunday, so Catholics are expected to be at Mass. A Mass on Saturday evening counts.';
  }

  switch (day.obligationConfidence) {
    case 'verified':
      return `This is a holy day of obligation in ${day.regionName}, so Catholics are expected to be at Mass. A Mass the evening before counts.`;
    case 'likely':
      return `This is a holy day of obligation in ${day.regionName} as far as we know, so Catholics are normally expected at Mass. Your parish will confirm.`;
    default:
      return 'In many countries this is a day when Catholics go to Mass. We are not certain about the rules where you are — your parish will know.';
  }
}

function warningFor(day: LiturgicalDay): string | undefined {
  switch (day.massRestriction) {
    case 'none':
      return 'There is no Mass anywhere in the world today. Instead there is the Celebration of the Lord’s Passion, usually in the afternoon. Churches are open for prayer.';
    case 'vigil-only':
      return 'There is no Mass during the day today. The Easter Vigil begins after dark and is the main Mass of Easter.';
    case 'evening-only':
      return 'There is normally only one Mass today, in the evening — the Mass of the Lord’s Supper.';
    default:
      return undefined;
  }
}

function kindLabel(day: LiturgicalDay): string {
  if (day.celebration.displayKind) return day.celebration.displayKind;
  if (day.weekday === 0 && day.celebration.rank >= Rank.SUNDAY) return 'Sunday';
  const label = RANK_LABELS[day.celebration.rank] ?? 'Day';
  if (day.celebration.rank <= Rank.PROPER_SOLEMNITY && day.weekday === 0) {
    return `${label}, kept on a Sunday`;
  }
  return label;
}

function whatSentence(day: LiturgicalDay): string {
  if (day.celebration.about) return day.celebration.about;

  const c = day.celebration;
  if (c.rank <= Rank.PROPER_SOLEMNITY) {
    return `A Solemnity — one of the Church's greatest days.`;
  }
  if (c.rank === Rank.FEAST_OF_THE_LORD || c.rank === Rank.FEAST || c.rank === Rank.PROPER_FEAST) {
    return c.ofMary
      ? 'A feast of the Blessed Virgin Mary.'
      : c.ofTheLord
        ? 'A feast of the Lord.'
        : 'A feast day.';
  }
  if (c.rank === Rank.MEMORIAL || c.rank === Rank.PROPER_MEMORIAL) {
    return 'The Church remembers a saint today.';
  }
  if (day.weekday === 0) {
    return `An ordinary Sunday. The readings are from Year ${day.sundayCycle}.`;
  }
  return 'An ordinary weekday. Mass is shorter than on a Sunday.';
}

export function explainDay(day: LiturgicalDay): DayExplanation {
  const alsoNames = day.alsoToday
    .filter((c) => c.rank <= Rank.OPTIONAL_MEMORIAL)
    .map((c) => c.name);

  let what = whatSentence(day);
  if (alsoNames.length && day.celebration.rank >= Rank.PRIVILEGED_WEEKDAY) {
    what += ` The parish may also remember ${alsoNames[0]} today.`;
  }

  return {
    title: day.celebration.name,
    kind: kindLabel(day),
    what,
    obligation: obligationSentence(day),
    warning: warningFor(day),
    season: `${SEASON_LABELS[day.season]}. ${SEASON_NOTES[day.season]}`,
  };
}

/**
 * A one-line answer to "what is this Mass?", for the card that shows a single
 * Mass time. Vigils get an explicit explanation, because "Saturday 6pm" listed
 * under Sunday is the single most confusing thing about a Catholic timetable.
 */
export function describeMass(day: LiturgicalDay, isVigil: boolean): string {
  const name = day.celebration.name;
  if (isVigil) {
    if (day.weekday === 0) {
      return `Sunday Mass, celebrated on Saturday evening. It counts as your Sunday Mass.`;
    }
    return `Mass for ${name}, celebrated the evening before. It counts for the day itself.`;
  }
  if (day.weekday === 0 && day.celebration.rank >= Rank.SUNDAY) {
    return `Sunday Mass — ${name}.`;
  }
  return `Mass of ${name}.`;
}

/**
 * How to phrase a schedule's trustworthiness. Every screen that shows a Mass
 * time shows one of these next to it. The wording is the product: a person who
 * knows how sure we are can decide whether to ring ahead.
 */
export function describeReliability(input: {
  quality: 'confirmed' | 'parish-website' | 'secondary' | 'community-tags' | 'unknown';
  lastCheckedAt?: string;
  disputed?: boolean;
  now?: Date;
}): { text: string; tone: 'good' | 'fair' | 'poor' } {
  if (input.disputed) {
    return {
      text: 'Someone has told us these times are wrong. Please ring the parish before travelling.',
      tone: 'poor',
    };
  }

  const age = input.lastCheckedAt
    ? Math.floor(
        ((input.now ?? new Date()).getTime() - new Date(input.lastCheckedAt).getTime()) /
          86_400_000,
      )
    : undefined;
  const checked =
    age === undefined
      ? ''
      : age <= 0
        ? ' Checked today.'
        : age === 1
          ? ' Checked yesterday.'
          : age < 30
            ? ` Checked ${age} days ago.`
            : ` Last checked ${Math.round(age / 30)} months ago.`;

  switch (input.quality) {
    case 'confirmed':
      return {
        text: `Confirmed by people who have been to this church.${checked}`,
        tone: 'good',
      };
    case 'parish-website':
      return { text: `Taken from the parish's own website.${checked}`, tone: 'good' };
    case 'secondary':
      return {
        text: `Taken from a parish newsletter or bulletin, which can be out of date.${checked}`,
        tone: 'fair',
      };
    case 'community-tags':
      return {
        text: `From a community map, not from the parish. These times are often out of date.${checked}`,
        tone: 'fair',
      };
    default:
      return {
        text: 'We do not have Mass times for this church yet. Please ring the parish.',
        tone: 'poor',
      };
  }
}
