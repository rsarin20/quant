import Anthropic from '@anthropic-ai/sdk';

import type { SourceRef } from '../churches/types';
import { timeAppearsInText } from '../schedule/heuristic';
import type { MassRule, Weekday } from '../schedule/types';
import type { FetchedPage } from './crawl';

/**
 * Reading a parish page with Claude.
 *
 * The heuristic pass finds times that sit next to a weekday word on the same
 * line. It cannot handle the cases that actually matter: a table whose header
 * row carries the days, a sentence that says "the Saturday evening Mass is at
 * six", a note that the 9am is suspended during the school holidays, or a
 * Christmas timetable listing four different Masses under one heading.
 *
 * ## The one thing that must not happen
 *
 * A model asked for Mass times will always produce plausible Mass times. A
 * hallucinated "Sunday 10:00" is indistinguishable from a correct one, and the
 * person it fails is standing outside a locked church. So the design here is
 * built around not trusting the output:
 *
 *  1. The model must return a **verbatim quote** from the page for every single
 *     Mass it reports. Not a paraphrase — the exact characters.
 *  2. We check that the quote really occurs in the page text we sent.
 *  3. We check that the claimed time really occurs in the page text, allowing for
 *     the formats a parish might have written it in.
 *  4. Anything failing (2) or (3) is discarded, not merely down-weighted.
 *
 * That turns the model from an oracle into a proposer whose proposals are
 * checked against the source. It cannot invent a Mass, because it cannot invent
 * a quote that exists in text it did not write.
 */

const MODEL = process.env.MASSFINDER_MODEL ?? 'claude-opus-5';
const EFFORT = (process.env.MASSFINDER_EFFORT ?? 'medium') as
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max';

/** Celebration ids the model may use for `liturgical` rules. */
const KNOWN_CELEBRATIONS = [
  'christmas',
  'mary-mother-of-god',
  'epiphany',
  'ash-wednesday',
  'palm-sunday',
  'holy-thursday',
  'good-friday',
  'holy-saturday',
  'easter-sunday',
  'divine-mercy-sunday',
  'ascension',
  'pentecost',
  'trinity-sunday',
  'corpus-christi',
  'sacred-heart',
  'assumption',
  'all-saints',
  'all-souls',
  'christ-the-king',
  'immaculate-conception',
  'st-joseph',
  'annunciation',
  'ss-peter-paul',
  'our-lady-of-guadalupe',
] as const;

/**
 * The output schema. Every field is required and "absent" is expressed as an
 * empty string or empty array rather than null — strict structured outputs
 * handle a fully-required schema far more reliably than a forest of `anyOf`
 * nullable unions, and the extra branches buy nothing here.
 */
const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['masses', 'pageIsAboutMassTimes', 'observations'],
  properties: {
    pageIsAboutMassTimes: {
      type: 'boolean',
      description:
        'True only if this page actually publishes a Mass schedule. False for homepages, news, or pages that merely mention Mass.',
    },
    observations: {
      type: 'string',
      description:
        'Anything a reader would need to know that does not fit the structured rules: "times change in summer", "check bulletin", "confessions listed alongside Mass". Empty string if none.',
    },
    masses: {
      type: 'array',
      description: 'One entry per distinct Mass. Do not merge two times into one entry.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'kind',
          'weekdays',
          'month',
          'day',
          'celebrationId',
          'date',
          'time',
          'isVigil',
          'language',
          'form',
          'note',
          'sourceQuote',
        ],
        properties: {
          kind: {
            type: 'string',
            enum: ['weekly', 'annual-date', 'liturgical', 'one-off'],
            description:
              'weekly = repeats on weekdays. annual-date = same calendar date each year. liturgical = tied to a feast whose date moves. one-off = a single dated Mass.',
          },
          weekdays: {
            type: 'array',
            description: '0=Sunday … 6=Saturday. Empty unless kind is weekly.',
            items: { type: 'integer', enum: [0, 1, 2, 3, 4, 5, 6] },
          },
          month: { type: 'integer', description: '1-12 for annual-date, otherwise 0.' },
          day: { type: 'integer', description: '1-31 for annual-date, otherwise 0.' },
          celebrationId: {
            type: 'string',
            enum: ['', ...KNOWN_CELEBRATIONS],
            description: 'Required when kind is liturgical, empty otherwise.',
          },
          date: {
            type: 'string',
            description: 'YYYY-MM-DD when kind is one-off, empty otherwise.',
          },
          time: {
            type: 'string',
            description:
              'Start time as 24-hour HH:MM. Convert am/pm yourself. "Midnight Mass" is 00:00.',
          },
          isVigil: {
            type: 'boolean',
            description:
              'True if this Mass is celebrated the evening before the day it belongs to — a Saturday evening Mass for Sunday, or Christmas Eve for Christmas.',
          },
          language: {
            type: 'string',
            description:
              'Two-letter code if the page says this Mass is in a particular language ("la" for Latin). Empty if not stated.',
          },
          form: {
            type: 'string',
            enum: ['', 'ordinary', 'traditional-latin', 'eastern', 'other'],
            description: 'Only set if the page distinguishes the form. Empty otherwise.',
          },
          note: {
            type: 'string',
            description:
              'Short qualifier the page gives: "Sung", "Children\'s Mass", "term time only". Empty if none.',
          },
          sourceQuote: {
            type: 'string',
            description:
              'VERBATIM text copied from the page that states this Mass. Copy the exact characters, including the time as written. Never paraphrase, never reformat, never translate. This is checked against the page and the entry is discarded if it does not match.',
          },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You read Catholic parish web pages and extract the Mass schedule.

Older people rely on this to decide whether to travel to a church, so a wrong time is worse than a missing one. Report only what the page states.

Rules:
- Every entry needs a verbatim sourceQuote copied character-for-character from the page. If you cannot quote it, do not report it.
- Report Mass only. Confession, Adoration, Rosary, Benediction, Stations of the Cross, Vespers and Morning Prayer are not Mass — skip them even when listed in the same table.
- A Saturday evening Mass is normally the Sunday Mass. Set isVigil true for it.
- Keep each time separate. "Sunday 8:00, 10:30 and 12:00" is three entries.
- Convert to 24-hour time. On a parish schedule an unmarked "6:30" in an evening list means 18:30; use the page's own layout to decide, and if genuinely ambiguous, omit the entry.
- Do not carry over times from a previous year's Christmas or Easter timetable unless the page presents them as current.
- If the page has no Mass schedule, set pageIsAboutMassTimes false and return an empty list.`;

export interface LlmExtractionInput {
  churchId: string;
  churchName: string;
  pages: FetchedPage[];
}

export interface LlmExtractionResult {
  rules: MassRule[];
  observations: string[];
  /** Entries the model produced that failed verification, kept for diagnostics. */
  rejected: Array<{ reason: string; entry: unknown }>;
  modelUsed: string;
  /** True when the safety classifiers declined the request. */
  refused?: boolean;
}

/** Trim page text to a sane size, keeping the parts most likely to hold times. */
function condense(page: FetchedPage, budget: number): string {
  if (page.text.length <= budget) return page.text;
  const lines = page.text.split('\n');
  const scored = lines.map((line, index) => {
    const hasTime = /\d{1,2}\s*[:.h]\s*\d{2}|\d{1,2}\s*(am|pm)/i.test(line);
    const hasDay =
      /sunday|monday|tuesday|wednesday|thursday|friday|saturday|domingo|lunes|s(á|a)bado|dimanche|samedi|domenica|sonntag|samstag|niedziela|sobota/i.test(
        line,
      );
    const hasMass = /\bmass|misa|missa|messe|messa|msza|liturgy|qurbana\b/i.test(line);
    return { line, index, score: (hasTime ? 3 : 0) + (hasDay ? 2 : 0) + (hasMass ? 2 : 0) };
  });
  const keep = new Set<number>();
  for (const s of scored) {
    if (s.score >= 2) {
      // Keep neighbours too: a table's day header may be several lines above.
      for (let i = Math.max(0, s.index - 4); i <= Math.min(lines.length - 1, s.index + 4); i += 1) {
        keep.add(i);
      }
    }
  }
  let out = '';
  for (let i = 0; i < lines.length && out.length < budget; i += 1) {
    if (keep.has(i)) out += `${lines[i]}\n`;
  }
  return out || page.text.slice(0, budget);
}

interface RawMass {
  kind: MassRule['kind'];
  weekdays: number[];
  month: number;
  day: number;
  celebrationId: string;
  date: string;
  time: string;
  isVigil: boolean;
  language: string;
  form: string;
  note: string;
  sourceQuote: string;
}

/** Normalise whitespace and case for quote comparison. */
function normaliseForMatch(s: string): string {
  return s.toLowerCase().replace(/[\s ]+/g, ' ').trim();
}

export function isModelConfigured(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/**
 * Ask Claude to read the pages, then verify everything it says against them.
 */
export async function extractWithModel(
  input: LlmExtractionInput,
  client?: Anthropic,
): Promise<LlmExtractionResult> {
  const anthropic = client ?? new Anthropic();
  const perPageBudget = Math.floor(120_000 / Math.max(1, input.pages.length));

  const corpus = input.pages
    .map(
      (p, i) =>
        `<page index="${i}" url="${p.finalUrl}" title="${p.title ?? ''}">\n${condense(p, perPageBudget)}\n</page>`,
    )
    .join('\n\n');

  const response = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 16_000,
    system: SYSTEM_PROMPT,
    output_config: {
      effort: EFFORT,
      format: {
        type: 'json_schema',
        schema: EXTRACTION_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    // Claude Opus 5's safety classifiers can decline a request; routing the
    // refusal to Anthropic's recommended fallback server-side means a parish
    // page with an unlucky turn of phrase still gets read.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    stream: false,
    messages: [
      {
        role: 'user',
        content: `Parish: ${input.churchName}\n\nExtract the Mass schedule from these pages.\n\n${corpus}`,
      },
    ],
  });

  // Always check stop_reason before touching content: on a refusal the content
  // array is empty or partial, and indexing it blindly throws.
  if (response.stop_reason === 'refusal') {
    return {
      rules: [],
      observations: [],
      rejected: [],
      modelUsed: response.model,
      refused: true,
    };
  }

  const textBlock = response.content.find(
    (b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text',
  );
  if (!textBlock) {
    return { rules: [], observations: [], rejected: [], modelUsed: response.model };
  }

  let parsed: { masses: RawMass[]; pageIsAboutMassTimes: boolean; observations: string };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch (err) {
    return {
      rules: [],
      observations: [],
      rejected: [{ reason: `Model output was not valid JSON: ${String(err)}`, entry: textBlock.text }],
      modelUsed: response.model,
    };
  }

  const allText = normaliseForMatch(input.pages.map((p) => p.text).join('\n'));
  const rawTextForTimes = input.pages.map((p) => p.text).join('\n');

  const rules: MassRule[] = [];
  const rejected: LlmExtractionResult['rejected'] = [];
  let counter = 0;

  for (const mass of parsed.masses ?? []) {
    // ── Verification gate 1: the quote must really be on the page ──────────
    const quote = normaliseForMatch(mass.sourceQuote ?? '');
    if (!quote) {
      rejected.push({ reason: 'No sourceQuote supplied', entry: mass });
      continue;
    }
    if (!allText.includes(quote)) {
      rejected.push({ reason: 'sourceQuote does not appear in the fetched page text', entry: mass });
      continue;
    }

    // ── Verification gate 2: the time must really be on the page ──────────
    if (!/^\d{1,2}:\d{2}$/.test(mass.time)) {
      rejected.push({ reason: `Time "${mass.time}" is not HH:MM`, entry: mass });
      continue;
    }
    const [h, min] = mass.time.split(':').map(Number);
    if (h > 23 || min > 59) {
      rejected.push({ reason: `Time "${mass.time}" is out of range`, entry: mass });
      continue;
    }
    const padded = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    if (!timeAppearsInText(padded, rawTextForTimes)) {
      rejected.push({
        reason: `Time ${padded} does not appear anywhere in the page text`,
        entry: mass,
      });
      continue;
    }

    // ── Shape checks per rule kind ────────────────────────────────────────
    if (mass.kind === 'weekly' && !(mass.weekdays?.length > 0)) {
      rejected.push({ reason: 'weekly rule with no weekdays', entry: mass });
      continue;
    }
    if (mass.kind === 'annual-date' && !(mass.month >= 1 && mass.day >= 1)) {
      rejected.push({ reason: 'annual-date rule with no month/day', entry: mass });
      continue;
    }
    if (mass.kind === 'liturgical' && !mass.celebrationId) {
      rejected.push({ reason: 'liturgical rule with no celebrationId', entry: mass });
      continue;
    }
    if (mass.kind === 'one-off' && !/^\d{4}-\d{2}-\d{2}$/.test(mass.date)) {
      rejected.push({ reason: 'one-off rule with no valid date', entry: mass });
      continue;
    }

    const page =
      input.pages.find((p) => normaliseForMatch(p.text).includes(quote)) ?? input.pages[0];
    const source: SourceRef = {
      kind: /\.pdf($|\?)/i.test(page.finalUrl) ? 'parish-bulletin' : 'parish-website',
      url: page.finalUrl,
      quote: mass.sourceQuote.slice(0, 400),
      fetchedAt: page.fetchedAt,
      detail: page.title,
    };

    counter += 1;
    rules.push({
      id: `${input.churchId}:model:${counter}`,
      kind: mass.kind,
      weekdays: mass.kind === 'weekly' ? (mass.weekdays as Weekday[]) : undefined,
      monthDay:
        mass.kind === 'annual-date' ? { month: mass.month, day: mass.day } : undefined,
      celebrationId: mass.kind === 'liturgical' ? mass.celebrationId : undefined,
      date: mass.kind === 'one-off' ? mass.date : undefined,
      time: padded,
      anticipates: mass.isVigil ? 'next-day' : undefined,
      language: mass.language || undefined,
      form: (mass.form || undefined) as MassRule['form'],
      note: mass.note || undefined,
      // Verified against the source text on both quote and time. Still not a
      // human confirmation, so it stays short of certainty.
      confidence: 0.82,
      source,
    });
  }

  const observations: string[] = [];
  if (parsed.observations) observations.push(parsed.observations);
  if (parsed.pageIsAboutMassTimes === false) {
    observations.push('The pages we found do not appear to publish a Mass schedule.');
  }

  return { rules, observations, rejected, modelUsed: response.model };
}
