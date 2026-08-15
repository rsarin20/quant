import type { SourceRef } from '../churches/types';
import type { MassRule, Weekday } from './types';

/**
 * A deterministic first pass over parish-website text.
 *
 * This is not trying to beat the language model at reading a messy page. It has
 * two jobs the model cannot do:
 *
 *  1. **Verification.** After the model extracts "Sunday 10:30", we check that
 *     a time resembling 10:30 actually occurs in the source text near a word
 *     meaning Sunday. A model that hallucinates a plausible Mass time is the
 *     worst failure mode this app has, because the output looks exactly like a
 *     correct answer. This pass is the ground truth the model is checked against.
 *
 *  2. **Working with no API key.** With no model configured the app still needs
 *     to produce something, clearly labelled as machine-read and low confidence,
 *     rather than nothing at all.
 */

/**
 * Weekday words in the languages Catholic parishes most commonly publish in.
 * Extending this list is the cheapest way to improve coverage in a new country.
 */
const WEEKDAY_WORDS: Array<[Weekday, string[]]> = [
  [0, ['sunday', 'sundays', 'domingo', 'domingos', 'dimanche', 'domenica', 'sonntag', 'niedziela', 'zondag', 'söndag', 'chủ nhật', 'linggo']],
  [1, ['monday', 'mondays', 'lunes', 'lundi', 'lunedì', 'montag', 'poniedziałek', 'maandag', 'segunda-feira']],
  [2, ['tuesday', 'tuesdays', 'martes', 'mardi', 'martedì', 'dienstag', 'wtorek', 'dinsdag', 'terça-feira']],
  [3, ['wednesday', 'wednesdays', 'miércoles', 'miercoles', 'mercredi', 'mercoledì', 'mittwoch', 'środa', 'woensdag', 'quarta-feira']],
  [4, ['thursday', 'thursdays', 'jueves', 'jeudi', 'giovedì', 'donnerstag', 'czwartek', 'donderdag', 'quinta-feira']],
  [5, ['friday', 'fridays', 'viernes', 'vendredi', 'venerdì', 'freitag', 'piątek', 'vrijdag', 'sexta-feira']],
  [6, ['saturday', 'saturdays', 'sábado', 'sabado', 'samedi', 'sabato', 'samstag', 'sonnabend', 'sobota', 'zaterdag']],
];

/** Words that mark a line as being about Mass rather than some other event. */
const MASS_WORDS = [
  'mass',
  'masses',
  'misa',
  'misas',
  'missa',
  'missas',
  'messe',
  'messes',
  'messa',
  'messe',
  'msza',
  'mszy',
  'eucharist',
  'eucharistie',
  'eucaristía',
  // German-speaking Europe, which is why Switzerland came back blank. A Swiss or
  // German parish does not publish "Mass times" — it publishes *Gottesdienste*,
  // and that word was not in this list, so every schedule line on every
  // German-language parish site failed the "is this about Mass?" test and was
  // discarded. Coverage in a country can hinge on a single missing noun.
  'gottesdienst',
  'gottesdienste',
  'eucharistiefeier',
  'messfeier',
  'messen',
  'hl. messe',
  'heilige messe',
  'sonntagsmesse',
  'abendmesse',
  'pfarreigottesdienst',
  'liturgy',
  'divine liturgy',
  'qurbana',
  'qurbono',
];

/**
 * Services that are **not** Mass.
 *
 * A parish's timetable page lists Mass alongside Confession, Adoration and the
 * Divine Office, usually in the same table. Live testing against a real parish
 * showed the cost of ignoring that: the line
 *
 *   "Monday to Friday: Lauds at 7:00 a.m., and Vespers at 6:00 p.m."
 *
 * became a 7:00 "Mass", and the app's headline answer sent the reader to Morning
 * Prayer. Confession blocks did the same — "Friday: after 7:25 a.m. Mass, 10:45
 * a.m. to 11:00 a.m." yielded three imaginary Masses, because the line does
 * mention Mass, just not as the thing being scheduled.
 *
 * So a line naming any of these is skipped outright, even when it also says
 * "Mass". That will occasionally lose a real Mass from a line that lists both —
 * and that is the right trade: this app's premise is that a wrong time is worse
 * than a missing one, because a missing time shows "ring the parish" while a
 * wrong one sends somebody on a journey to the wrong service. The language-model
 * layer reads these pages properly when it is configured.
 */
const NON_MASS_WORDS = [
  // The sacrament of penance.
  'confession',
  'confessions',
  'reconciliation',
  'confesion',
  'confesiones',
  'confesión',
  'confissão',
  'confessione',
  'beichte',
  'spowied',
  // A Wortgottesdienst is the Liturgy of the Word and a Kommunionfeier is a
  // Communion service: neither is a Mass, and in a country short of priests they
  // are common enough that treating them as Mass would send somebody to a
  // service where no Mass is celebrated. Both are matched here rather than in the
  // Mass list, and the non-Mass test runs first, so "Wortgottesdienst" cannot be
  // rescued by the "gottesdienst" inside it.
  'wortgottesdienst',
  'wortgottesfeier',
  'kommunionfeier',
  // Eucharistic devotions that are not Mass.
  'adoration',
  'adoración',
  'adoracion',
  'adoração',
  'adorazione',
  'exposition',
  'benediction',
  'holy hour',
  'anbetung',
  // The Liturgy of the Hours.
  'lauds',
  'vespers',
  'compline',
  'matins',
  'morning prayer',
  'evening prayer',
  'night prayer',
  'divine office',
  'liturgy of the hours',
  'vísperas',
  'visperas',
  'laudes',
  'vesper',
  'komplet',
  // Other devotions.
  'rosary',
  'rosario',
  'novena',
  'stations of the cross',
  'way of the cross',
  'via crucis',
  'chaplet',
  'andacht',
  'rosenkranz',
  'kreuzweg',
  'taufe',
  'trauung',
  'beerdigung',
  'abdankung',
  'baptism',
  'baptisms',
  'wedding',
  'weddings',
  'funeral',
];

/**
 * Lines that describe when a building is open, not when Mass is celebrated.
 *
 * Found in production: St Martin's Apostolate in Dublin published
 *
 *   "Open 9am - 5pm Monday to Friday"
 *
 * and the app's headline answer became "Next Mass 09:00", quoting that sentence
 * as its source. The reader is told, with a citation, to turn up at nine for a
 * Mass that does not exist. The genuine line on the same page — "1pm Daily –
 * Lunchtime Mass" — was also found, so the cost of the false one was purely
 * additive: it displaced a correct answer with an invented one.
 */
const OPENING_HOURS_PATTERN =
  /\b(open|opens|opening|closed|closes|office hours|opening hours|abierto|horario de atenci|ge(ö|o)ffnet)\b/i;

/**
 * A window between two clock times — "9am - 5pm", "10:45 to 11:00".
 *
 * A window is how parishes write opening hours, Confession slots and Adoration
 * periods. It is almost never how they write a Mass, because a Mass is announced
 * by when it starts. Treating both ends of a window as start times manufactures
 * two Masses out of one non-Mass fact.
 *
 * Both sides must be times, which is what separates "9am - 5pm" from
 * "Monday - Friday": a day range is not a time range, and lines like
 * "Monday - Friday 1pm Mass" must still be read.
 */
const TIME_RANGE_PATTERN =
  /\d{1,2}(?:[:.]\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?\s*(?:-|–|—|to|till|until|hasta|bis)\s*\d{1,2}(?:[:.]\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)/i;

/** Does this line describe a window of time rather than a starting time? */
export function describesTimeWindow(line: string): boolean {
  return OPENING_HOURS_PATTERN.test(line) || TIME_RANGE_PATTERN.test(line);
}

/** Words that mark a Mass as anticipated, in several languages. */
const VIGIL_WORDS = ['vigil', 'vigilia', 'vigile', 'vorabendmesse', 'anticipata', 'anticipada'];

const LANGUAGE_HINTS: Array<[string, RegExp]> = [
  ['es', /\b(spanish|espa(ñ|n)ol|en espa(ñ|n)ol)\b/i],
  ['pl', /\b(polish|polski|po polsku)\b/i],
  ['pt', /\b(portuguese|portugu(ê|e)s)\b/i],
  ['it', /\b(italian|italiano)\b/i],
  ['fr', /\b(french|fran(ç|c)ais)\b/i],
  ['vi', /\b(vietnamese|vi(ệ|e)t)\b/i],
  ['tl', /\b(tagalog|filipino)\b/i],
  ['ko', /\b(korean|한국)\b/i],
  ['zh', /\b(chinese|mandarin|cantonese|中文)\b/i],
  ['ml', /\b(malayalam)\b/i],
  ['ta', /\b(tamil)\b/i],
  ['la', /\b(latin|latina|tridentine|extraordinary form|usus antiquior)\b/i],
  ['de', /\b(german|deutsch)\b/i],
  ['en', /\b(english|in english)\b/i],
];

function detectLanguage(line: string): string | undefined {
  return detectLanguageAt(line)?.code;
}

/** The language marker on a line, with where it appears. */
function detectLanguageAt(line: string): { code: string; at: number } | undefined {
  for (const [code, pattern] of LANGUAGE_HINTS) {
    const m = pattern.exec(line);
    if (m) return { code, at: m.index };
  }
  return undefined;
}

/**
 * Which of a line's times a qualifier belongs to.
 *
 * A marker applies to the nearest time, not to all of them. Live output showed
 * why: the line "Saturday: 9:30 a.m., 11:00 a.m., and 7:00 p.m. (Spanish - Vigil
 * Mass)" had labelled all three Masses Spanish, so a Spanish speaker would be sent
 * to a 9:30 Mass in English, and someone who does not speak Spanish would be sent
 * to the 7:00 without warning. Only the 7:00 is Spanish, and it is the one the
 * marker sits beside.
 *
 * When the marker precedes every time it is a heading for the line — "Spanish
 * Masses: 9:00, 12:00" — and then it does apply to all of them.
 */
function qualifierAppliesTo(
  markerAt: number,
  times: Array<{ time: string; at: number }>,
): Set<string> {
  if (times.length <= 1) return new Set(times.map((t) => t.time));
  if (markerAt < times[0].at) return new Set(times.map((t) => t.time));
  let nearest = times[0];
  for (const t of times) {
    if (Math.abs(t.at - markerAt) < Math.abs(nearest.at - markerAt)) nearest = t;
  }
  return new Set([nearest.time]);
}

/**
 * Find every clock time in a line, normalised to 24-hour `HH:MM`.
 *
 * Handles `10:30`, `10.30`, `10:30am`, `10 am`, `6pm`, `18h30`, `18h`, and
 * `noon`/`midnight`. Deliberately does not treat a bare number as a time: a
 * parish page full of addresses and phone numbers would otherwise generate
 * dozens of imaginary Masses.
 */
export function extractTimes(line: string): string[] {
  return extractTimesWithPositions(line).map((t) => t.time);
}

/**
 * The same times, each with where in the line it was written.
 *
 * The position is what lets a qualifier be attached to the time it belongs to
 * rather than to every time on the line. A parish writing
 *
 *   "Saturday: 9:30 a.m., 11:00 a.m., and 7:00 p.m. (Spanish - Vigil Mass)"
 *
 * has one Spanish Mass, not three; the live site was labelling all three Spanish,
 * which would send a Spanish speaker to a 9:30 Mass in English and an
 * English speaker to a 7:00 Mass they cannot follow.
 */
export function extractTimesWithPositions(line: string): Array<{ time: string; at: number }> {
  const out: Array<{ time: string; at: number }> = [];
  const lower = line.toLowerCase();

  const noon = /\bnoon\b|\bmediod(í|i)a\b|\bmezzogiorno\b/.exec(lower);
  if (noon) out.push({ time: '12:00', at: noon.index });
  const midnight = /\bmidnight\b|\bmedianoche\b|\bmezzanotte\b|\bmitternacht\b/.exec(lower);
  if (midnight) out.push({ time: '00:00', at: midnight.index });

  const pattern =
    /(\d{1,2})\s*(?:[:.h]\s*(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|am|pm)?(?=\b|\s|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(lower)) !== null) {
    const hasMinutes = m[2] !== undefined;
    const meridiem = m[3]?.replace(/[.\s]/g, '');
    const usedHSeparator = /\dh/.test(m[0]);
    // Without either minutes or an am/pm marker, this is just a number.
    if (!hasMinutes && !meridiem && !usedHSeparator) continue;

    let hour = Number(m[1]);
    const minute = hasMinutes ? Number(m[2]) : 0;
    if (hour > 23 || minute > 59) continue;

    if (meridiem?.startsWith('p') && hour < 12) hour += 12;
    if (meridiem?.startsWith('a') && hour === 12) hour = 0;

    // No meridiem and an hour that reads as afternoon on a parish schedule.
    // Times like "6:30" with no marker on a line that also says "evening" are
    // resolved below by the caller; here we keep the literal reading.
    out.push({
      time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      at: m.index,
    });
  }

  const seen = new Set<string>();
  return out.filter((t) => (seen.has(t.time) ? false : (seen.add(t.time), true)));
}

/** Weekdays named in a line, expanding ranges like "Monday-Friday". */
export function extractWeekdays(line: string): Weekday[] {
  const lower = line.toLowerCase();
  const found = new Set<Weekday>();

  // Ranges first: "monday to friday", "mon-fri", "lunes a viernes".
  for (const [fromDay, fromWords] of WEEKDAY_WORDS) {
    for (const fw of fromWords) {
      for (const [toDay, toWords] of WEEKDAY_WORDS) {
        for (const tw of toWords) {
          const range = new RegExp(
            `${escape(fw)}\\s*(?:-|–|—|to|through|a|bis|à|al|do)\\s*${escape(tw)}`,
            'i',
          );
          if (range.test(lower)) {
            let i = fromDay;
            for (let guard = 0; guard < 8; guard += 1) {
              found.add(i as Weekday);
              if (i === toDay) break;
              i = ((i + 1) % 7) as Weekday;
            }
          }
        }
      }
    }
  }

  if (found.size) return Array.from(found).sort();

  for (const [day, words] of WEEKDAY_WORDS) {
    if (words.some((w) => new RegExp(`\\b${escape(w)}`, 'i').test(lower))) {
      found.add(day);
    }
  }
  if (found.size) return Array.from(found).sort();

  // Collective words. Parishes write "Weekday Masses 7:30am" at least as often as
  // they enumerate Monday to Friday, and a line naming no individual day used to be
  // discarded entirely — losing every weekday Mass on such a page.
  for (const [pattern, days] of COLLECTIVE_DAY_WORDS) {
    if (pattern.test(lower)) return [...days].sort();
  }
  return [];
}

/**
 * Ways of naming a group of days without listing them.
 *
 * "Weekend" is deliberately Saturday **and** Sunday: a parish writing "Weekend
 * Masses: Sat 6pm, Sun 10am" means both, and the vigil logic downstream works out
 * that the Saturday evening one counts for Sunday. Ordered longest-first so
 * "weekday" is not matched inside "weekdays" by the shorter pattern.
 */
const COLLECTIVE_DAY_WORDS: Array<[RegExp, Weekday[]]> = [
  [/\bweekend|\bfin de semana|\bfim de semana/i, [6, 0]],
  [/\bweekdays?\b|\bferial|\bdías? de semana|\bdias? de semana|\bwochentag/i, [1, 2, 3, 4, 5]],
  [/\bdaily\b|\bevery day\b|\ball week\b|\bdiario\b|\bdiariamente\b|\bt(a|á)glich\b|\bcodziennie\b/i,
    [0, 1, 2, 3, 4, 5, 6]],
];

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function mentionsMass(line: string): boolean {
  const lower = line.toLowerCase();
  return MASS_WORDS.some((w) => new RegExp(`\\b${escape(w)}\\b`, 'i').test(lower));
}

export function mentionsVigil(line: string): boolean {
  const lower = line.toLowerCase();
  return VIGIL_WORDS.some((w) => lower.includes(w));
}

/**
 * True when a line schedules something other than Mass. Such a line is skipped
 * even if it also mentions Mass — see `NON_MASS_WORDS` for why.
 */
export function mentionsNonMassService(line: string): boolean {
  const lower = line.toLowerCase();
  return NON_MASS_WORDS.some((w) => new RegExp(`\\b${escape(w)}`, 'i').test(lower));
}

/**
 * Is this line a bare time row, of the kind that sits under a day heading?
 *
 * Only such lines may inherit the day from a heading above them. Without this
 * test, a page reading
 *
 *     Sunday
 *     9:00 AM
 *     The office is open until 4:30 PM.
 *
 * produced a Sunday Mass at 16:30 from the office-hours sentence — a wrong time,
 * presented with a quote and a source, of exactly the kind that sends someone out
 * to a locked building. Prose is therefore excluded: a genuine table cell is a
 * time plus at most a short qualifier ("6:00 PM (Vigil)", "11:00 Spanish"), never
 * a sentence.
 */
export function looksLikeBareTimeRow(line: string): boolean {
  if (line.length > 48) return false;
  // What remains once the times, punctuation and digits are taken out.
  const words = line
    .replace(/\d{1,2}\s*[:.h]\s*\d{2}/g, ' ')
    .replace(/\b\d{1,2}\s*(a\.?m\.?|p\.?m\.?)/gi, ' ')
    .replace(/\b(am|pm|noon|midnight|vigil|and|&)\b/gi, ' ')
    .replace(/[^\p{L} ]+/gu, ' ')
    .trim();
  // One short qualifier is fine; a clause is not.
  return words.length <= 16;
}

export interface HeuristicOptions {
  churchId: string;
  source: SourceRef;
  /** Cap on rules produced, so a pathological page cannot flood the schedule. */
  maxRules?: number;
}

/**
 * Read a page's text into candidate rules.
 *
 * Scans line by line, keeping only lines that name at least one weekday and at
 * least one clock time. A line must either mention Mass, or sit within a few
 * lines of one that does — parish pages routinely put the heading "Mass Times"
 * above a bare table of days and times.
 */
export function extractRulesFromText(
  text: string,
  opts: HeuristicOptions,
): MassRule[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const rules: MassRule[] = [];
  const maxRules = opts.maxRules ?? 60;
  let massContextUntil = -1;
  let counter = 0;

  /**
   * Which section of the page we are in.
   *
   * Parish timetables are sectioned under headings, and the rows beneath a
   * heading need not repeat it. A real page defeated line-by-line filtering
   * exactly this way: under "Confession times" sat
   * "Friday: after 7:25 a.m. Mass, 10:45 a.m. to 11:00 a.m." — a line that
   * mentions Mass but schedules confessions, and whose times became three
   * imaginary Masses. So a heading puts us in a section, and the section governs
   * every row under it until the next heading.
   */
  let section: 'mass' | 'other' | 'unknown' = 'unknown';

  /** Days set by a bare day heading, governing the time-only rows beneath it. */
  let pendingDays: Weekday[] | undefined;
  let pendingDaysUntil = -1;

  for (let i = 0; i < lines.length && rules.length < maxRules; i += 1) {
    const line = lines[i];
    const positioned = extractTimesWithPositions(line);
    const times = positioned.map((t) => t.time);
    const namesMass = mentionsMass(line);
    const namesOther = mentionsNonMassService(line);

    // A line naming a service but carrying no times is a heading.
    if (!times.length) {
      // "Mass & Confession times" is a Mass heading, so Mass wins a tie.
      if (namesMass) {
        section = 'mass';
        massContextUntil = i + 8;
      } else if (namesOther) {
        section = 'other';
        // A day heading inside a Confession block must not leak into the Mass
        // block that follows it.
        pendingDays = undefined;
      }

      // A bare day heading — "Sunday", "Weekdays" — sets the day for the rows
      // beneath it. Kept short-lived: three lines is a table column, ten lines
      // later is a different part of the page and guessing would invent times.
      const headingDays = extractWeekdays(line);
      if (headingDays.length && line.length < 60) {
        pendingDays = headingDays;
        pendingDaysUntil = i + 4;
      }
      continue;
    }

    // Skip anything that schedules a different service. Checked before the Mass
    // test, because such lines very often mention Mass in passing.
    if (namesOther) continue;
    // Skip opening hours and time windows for the same reason: they carry clock
    // times that are not the start of a Mass.
    if (describesTimeWindow(line)) continue;
    // Inside a non-Mass section, skip the row outright. A passing mention of
    // Mass must not rescue it: "Friday: after 7:25 a.m. Mass, 10:45 a.m. to
    // 11:00 a.m." sits under "Confession times" and names Mass only to say when
    // confessions start. Allowing that through was the bug. A parish that lists a
    // genuine Mass under a Confession heading loses it here, which is the right
    // way round — a missing time shows "ring the parish", a wrong one sends
    // somebody to the wrong service.
    if (section === 'other') continue;

    // A day named on its own line governs the times listed under it. This is what
    // an HTML table or definition list collapses to once the markup is stripped:
    //
    //     Mass Times
    //     Sunday
    //     9:00 AM
    //     11:00 AM
    //     Saturday
    //     6:00 PM (Vigil)
    //
    // Every one of those times used to be discarded for not naming a day on its
    // own line, which meant the tidiest parish pages on the web — the ones that use
    // a real table — yielded nothing at all.
    const onLine = extractWeekdays(line);
    const weekdays = onLine.length
      ? onLine
      : pendingDays && i <= pendingDaysUntil && looksLikeBareTimeRow(line)
        ? pendingDays
        : [];
    if (!weekdays.length) continue;

    if (namesMass) massContextUntil = i + 8;
    const inMassContext = namesMass || section === 'mass' || i <= massContextUntil;
    if (!inMassContext) continue;

    const marker = detectLanguageAt(line);
    const spokenIn = marker
      ? qualifierAppliesTo(marker.at, positioned)
      : new Set<string>();
    const vigil = mentionsVigil(line);

    for (const time of times) {
      if (rules.length >= maxRules) break;
      counter += 1;
      const hour = Number(time.split(':')[0]);
      const anticipates =
        vigil || (weekdays.length === 1 && weekdays[0] === 6 && hour >= 16)
          ? ('next-day' as const)
          : undefined;

      rules.push({
        id: `${opts.churchId}:heuristic:${counter}`,
        kind: 'weekly',
        weekdays,
        time,
        anticipates,
        language: marker && spokenIn.has(time) ? marker.code : undefined,
        form: /tridentine|extraordinary form|usus antiquior|latin mass/i.test(line)
          ? 'traditional-latin'
          : undefined,
        // Deterministic text-matching with no understanding of the page. Good
        // enough to show with a caveat, never good enough to state as fact.
        confidence: 0.4,
        source: { ...opts.source, quote: line.slice(0, 300) },
      });
    }
  }

  return rules;
}

/**
 * Does a claimed Mass time actually appear in the source text?
 *
 * Used to check model output. Accepts the time in any of the formats a parish
 * might have written it, so a correct extraction from "6:00 PM" is not rejected
 * for not literally containing "18:00".
 */
export function timeAppearsInText(time: string, text: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return false;
  const hour24 = Number(m[1]);
  const minute = m[2];
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minuteNoPad = String(Number(minute));

  const candidates = [
    `${hour24}:${minute}`,
    `${String(hour24).padStart(2, '0')}:${minute}`,
    `${hour12}:${minute}`,
    `${hour24}.${minute}`,
    `${hour12}.${minute}`,
    `${hour24}h${minute}`,
    `${hour12}h${minute}`,
  ];
  if (minute === '00') {
    candidates.push(
      `${hour12} am`,
      `${hour12} pm`,
      `${hour12}am`,
      `${hour12}pm`,
      `${hour12}:00`,
      `${hour24}h`,
    );
    if (hour24 === 12) candidates.push('noon');
    if (hour24 === 0) candidates.push('midnight');
  }
  void minuteNoPad;

  const haystack = text.toLowerCase().replace(/\s+/g, ' ');
  return candidates.some((c) => haystack.includes(c.toLowerCase()));
}
