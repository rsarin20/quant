import type { Church, SourceRef } from '../churches/types';
import { extractRulesFromText } from '../schedule/heuristic';
import { parseServiceTimes } from '../schedule/osmServiceTimes';
import type { ChurchSchedule, MassRule, ScheduleQuality } from '../schedule/types';
import { crawlParishSite, type CrawlOptions } from './crawl';
import { extractWithModel, isModelConfigured } from './llm';

/**
 * The Mass-times extraction pipeline.
 *
 * Four layers, cheapest and most reliable first. Each is allowed to fail without
 * taking the others down, and each stamps its own provenance so the interface can
 * always tell the user where a time came from:
 *
 *  1. **OpenStreetMap `service_times`.** Free, instant, already fetched with the
 *     church. Sparse coverage and often stale, so lowest confidence.
 *  2. **The parish's own website.** Crawled one hop from the homepage.
 *  3. **A deterministic text pass** over those pages. No API key needed.
 *  4. **Claude**, reading the same pages, with every claim checked back against
 *     the source text.
 *
 * Layers 3 and 4 read the *same* fetched pages, so the model costs one extra API
 * call rather than another round of traffic to a parish's server.
 */

export interface ExtractOptions extends CrawlOptions {
  /** OSM `service_times` tag value, when the church record had one. */
  serviceTimes?: string;
  /** Skip the model even when a key is configured. */
  skipModel?: boolean;
}

export interface ExtractReport {
  schedule: ChurchSchedule;
  /** Everything that went wrong, for the diagnostics view. */
  problems: string[];
  /** Notes worth showing the user verbatim, e.g. "summer schedule differs". */
  observations: string[];
  pagesRead: string[];
  modelUsed?: string;
}

function bestQuality(rules: MassRule[]): ScheduleQuality {
  if (!rules.length) return 'unknown';
  const kinds = new Set(rules.map((r) => r.source.kind));
  if (kinds.has('user-report')) return 'confirmed';
  if (kinds.has('parish-website')) return 'parish-website';
  if (kinds.has('parish-bulletin') || kinds.has('diocese-website')) return 'secondary';
  if (kinds.has('openstreetmap')) return 'community-tags';
  return 'unknown';
}

/**
 * Drop rules that duplicate a better-sourced rule for the same slot.
 *
 * Without this a church whose OSM tag and website agree shows every Mass twice,
 * which reads as an error and undermines trust in the times that are right.
 */
function dedupe(rules: MassRule[]): MassRule[] {
  const byKey = new Map<string, MassRule>();
  for (const rule of rules) {
    const key = [
      rule.kind,
      (rule.weekdays ?? []).join(','),
      rule.monthDay ? `${rule.monthDay.month}-${rule.monthDay.day}` : '',
      rule.celebrationId ?? '',
      rule.date ?? '',
      rule.time,
      rule.language ?? '',
    ].join('|');
    const existing = byKey.get(key);
    if (!existing || rule.confidence > existing.confidence) {
      byKey.set(key, rule);
    }
  }
  return Array.from(byKey.values());
}

export async function extractSchedule(
  church: Church,
  opts: ExtractOptions = {},
): Promise<ExtractReport> {
  const problems: string[] = [];
  const observations: string[] = [];
  const pagesRead: string[] = [];
  let rules: MassRule[] = [];
  let modelUsed: string | undefined;

  // ── Layer 1: OpenStreetMap tags ─────────────────────────────────────────
  if (opts.serviceTimes) {
    const osmSource: SourceRef = {
      kind: 'openstreetmap',
      url: church.sources.find((s) => s.kind === 'openstreetmap')?.url,
      fetchedAt: new Date().toISOString(),
      detail: 'OpenStreetMap service_times tag',
    };
    const parsed = parseServiceTimes(opts.serviceTimes, church.id, osmSource);
    rules.push(...parsed.rules);
    if (parsed.unparsed.length) {
      problems.push(
        `Could not read part of the OpenStreetMap service_times tag: ${parsed.unparsed.join('; ')}`,
      );
    }
  }

  // ── Layer 2: the parish website ─────────────────────────────────────────
  if (!church.website) {
    problems.push('No website is recorded for this church, so we could not read a schedule from one.');
    return finish();
  }

  const crawl = await crawlParishSite(church.website, opts).catch((err) => {
    problems.push(`Could not read ${church.website}: ${String(err)}`);
    return { pages: [], failures: [] };
  });
  for (const f of crawl.failures) problems.push(`Could not read ${f.url}: ${f.reason}`);
  pagesRead.push(...crawl.pages.map((p) => p.finalUrl));
  if (!crawl.pages.length) return finish();

  // ── Layer 3: deterministic text pass ───────────────────────────────────
  for (const page of crawl.pages) {
    const source: SourceRef = {
      kind: /\.pdf($|\?)/i.test(page.finalUrl) ? 'parish-bulletin' : 'parish-website',
      url: page.finalUrl,
      fetchedAt: page.fetchedAt,
      detail: page.title,
    };
    rules.push(...extractRulesFromText(page.text, { churchId: church.id, source }));
  }

  // ── Layer 4: Claude, verified against the same pages ───────────────────
  if (!opts.skipModel && isModelConfigured()) {
    try {
      const result = await extractWithModel({
        churchId: church.id,
        churchName: church.name,
        pages: crawl.pages,
      });
      modelUsed = result.modelUsed;
      if (result.refused) {
        problems.push('The model declined to process this page, so only the basic text pass was used.');
      }
      rules.push(...result.rules);
      observations.push(...result.observations);
      for (const r of result.rejected) {
        problems.push(`Discarded an unverifiable extracted Mass: ${r.reason}`);
      }
    } catch (err) {
      problems.push(`Model extraction failed: ${String(err)}`);
    }
  } else if (!isModelConfigured()) {
    observations.push(
      'No language model is configured, so these times come from simple text matching and should be treated as unconfirmed.',
    );
  }

  return finish();

  function finish(): ExtractReport {
    rules = dedupe(rules);
    return {
      schedule: {
        churchId: church.id,
        rules,
        lastCheckedAt: new Date().toISOString(),
        lastError: rules.length ? undefined : problems[0],
        quality: bestQuality(rules),
      },
      problems,
      observations,
      pagesRead,
      modelUsed,
    };
  }
}
