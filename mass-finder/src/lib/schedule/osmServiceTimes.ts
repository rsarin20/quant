import type { SourceRef } from '../churches/types';
import type { MassRule, Weekday } from './types';

/**
 * Parse OpenStreetMap's `service_times` tag.
 *
 * The tag uses the `opening_hours` syntax, which is far larger than anything a
 * parish needs. This handles the subset that actually appears on churches:
 *
 *   Su 09:00,11:00; Sa 18:30
 *   Mo-Fr 07:30; Su 08:00-09:00,10:30
 *   Su 10:00; PH off
 *   Tu,Th 19:00
 *
 * A time range (`08:00-09:00`) is read as a Mass *starting* at the first time —
 * mappers use ranges to record duration, and the start is what a person needs.
 *
 * Coverage of this tag is thin and often years stale, which is why rules from it
 * are given low confidence and the UI labels them as community-maintained rather
 * than parish-published.
 */

const DAY_TOKENS: Record<string, Weekday> = {
  su: 0,
  mo: 1,
  tu: 2,
  we: 3,
  th: 4,
  fr: 5,
  sa: 6,
};

const ORDER: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

function expandDayRange(from: Weekday, to: Weekday): Weekday[] {
  const out: Weekday[] = [];
  let i = ORDER.indexOf(from);
  const end = ORDER.indexOf(to);
  // Ranges may wrap the week, e.g. `Sa-Su`.
  for (let guard = 0; guard < 8; guard += 1) {
    out.push(ORDER[i]);
    if (i === end) break;
    i = (i + 1) % 7;
  }
  return out;
}

function parseDaySpec(spec: string): Weekday[] {
  const days: Weekday[] = [];
  for (const part of spec.split(',')) {
    const token = part.trim().toLowerCase();
    if (!token) continue;
    const range = /^([a-z]{2})\s*-\s*([a-z]{2})$/.exec(token);
    if (range) {
      const from = DAY_TOKENS[range[1]];
      const to = DAY_TOKENS[range[2]];
      if (from !== undefined && to !== undefined) days.push(...expandDayRange(from, to));
      continue;
    }
    const single = DAY_TOKENS[token];
    if (single !== undefined) days.push(single);
  }
  return Array.from(new Set(days));
}

function parseTimes(spec: string): string[] {
  const out: string[] = [];
  for (const part of spec.split(',')) {
    const token = part.trim();
    if (!token) continue;
    // `08:00-09:00` → take the start.
    const start = token.split('-')[0].trim();
    const m = /^(\d{1,2}):(\d{2})$/.exec(start);
    if (!m) continue;
    const hour = Number(m[1]);
    const minute = Number(m[2]);
    if (hour > 23 || minute > 59) continue;
    out.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }
  return out;
}

export interface OsmParseResult {
  rules: MassRule[];
  /** Fragments we could not understand, kept so we never silently drop data. */
  unparsed: string[];
}

export function parseServiceTimes(
  value: string,
  churchId: string,
  source: SourceRef,
): OsmParseResult {
  const rules: MassRule[] = [];
  const unparsed: string[] = [];
  let counter = 0;

  for (const chunk of value.split(';')) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    // `PH off`, `off`, `closed` — nothing to schedule.
    if (/\b(off|closed)\b/i.test(trimmed)) continue;
    // Public/school holiday qualifiers we cannot resolve to dates.
    if (/^(PH|SH)\b/i.test(trimmed)) {
      unparsed.push(trimmed);
      continue;
    }

    const match = /^([A-Za-z,\s-]+?)\s+([\d:,\s-]+)$/.exec(trimmed);
    if (!match) {
      // A bare time list with no day spec, e.g. `10:00`. Ambiguous: it usually
      // means daily, but guessing "every day" from an unqualified number would
      // manufacture six Masses that may not exist.
      unparsed.push(trimmed);
      continue;
    }

    const days = parseDaySpec(match[1]);
    const times = parseTimes(match[2]);
    if (!days.length || !times.length) {
      unparsed.push(trimmed);
      continue;
    }

    for (const time of times) {
      counter += 1;
      const [hourStr] = time.split(':');
      const hour = Number(hourStr);
      // A Saturday evening Mass is a Sunday Mass. Mark it, so the obligation
      // logic and the "next Sunday Mass" query both see it.
      const anticipates =
        days.includes(6) && days.length === 1 && hour >= 16 ? ('next-day' as const) : undefined;

      rules.push({
        id: `${churchId}:osm:${counter}`,
        kind: 'weekly',
        weekdays: days,
        time,
        anticipates,
        confidence: 0.45,
        source: { ...source, quote: trimmed },
      });
    }
  }

  return { rules, unparsed };
}
