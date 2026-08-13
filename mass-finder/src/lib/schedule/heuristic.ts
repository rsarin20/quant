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
  'liturgy',
  'divine liturgy',
  'qurbana',
  'qurbono',
];

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
  for (const [code, pattern] of LANGUAGE_HINTS) {
    if (pattern.test(line)) return code;
  }
  return undefined;
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
  const out: string[] = [];
  const lower = line.toLowerCase();

  if (/\bnoon\b|\bmediod(í|i)a\b|\bmezzogiorno\b/.test(lower)) out.push('12:00');
  if (/\bmidnight\b|\bmedianoche\b|\bmezzanotte\b|\bmitternacht\b/.test(lower)) out.push('00:00');

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
    out.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }

  return Array.from(new Set(out));
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
  return Array.from(found).sort();
}

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

  for (let i = 0; i < lines.length && rules.length < maxRules; i += 1) {
    const line = lines[i];
    if (mentionsMass(line)) massContextUntil = i + 8;

    const weekdays = extractWeekdays(line);
    const times = extractTimes(line);
    if (!weekdays.length || !times.length) continue;

    const inMassContext = mentionsMass(line) || i <= massContextUntil;
    if (!inMassContext) continue;

    const language = detectLanguage(line);
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
        language,
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
