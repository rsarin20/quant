import type { Mode, MirrorResult, Profile } from "./types";
import { perplexityRunner, MissingKeyError } from "./perplexity";
import { judge } from "./judge";
import { cacheKey, getCached, setCached } from "./store";
import { interpolate } from "./questions";

// ---------------------------------------------------------------------------
// Orchestrates ONE question through the live column (Perplexity): resolve →
// run → judge → cache. Only the perplexity runner is wired; the grid renders
// the other three columns as disabled placeholders (see runner.COLUMN_MODELS).
//
// GUARDRAIL: only the active candidate's own name is ever queried (enforced by
// callers). groundTruthNotes goes to the judge only, never to the runner.
// ---------------------------------------------------------------------------

export type RunOptions = {
  force?: boolean; // bypass cache
  // When set (retrieval-ON only), the model is pointed at this public URL —
  // the "after" state. Absent = the "before" state. Folded into the cache key
  // so before/after results never collide.
  contextUrl?: string;
  // Invoked immediately before a real (paid) model call — after a cache miss.
  // Returns ok:false to block the live call (rate/spend limit). Cache/seed hits
  // never reach here, so they're always free.
  guard?: () => Promise<{ ok: boolean; reason?: string }>;
};

export async function runMirrorQuestion(
  profile: Profile,
  questionId: string,
  template: string,
  mode: Mode,
  opts: RunOptions = {}
): Promise<MirrorResult> {
  const questionText = interpolate(template, profile);
  const phase = mode === "on" && opts.contextUrl ? "after" : "before";
  const key = cacheKey(profile.slug, profile.version, `${questionId}:${phase}`, mode);

  if (!opts.force) {
    const cached = await getCached(key);
    if (cached) return cached;
  }

  const measuredAt = new Date().toISOString();

  // Cache missed → a live call is imminent. Enforce spend/rate limits now, so
  // only real paid calls are counted.
  if (opts.guard) {
    const g = await opts.guard();
    if (!g.ok) {
      return {
        model: "perplexity",
        mode,
        questionId,
        questionText,
        answer: "",
        sources: [],
        verdict: null,
        measuredAt,
        seeded: false,
        live: false,
        degraded: true,
        degradedReason: g.reason || "Rate limited.",
        error: "rate_limited",
      };
    }
  }

  let result: MirrorResult;
  try {
    const out = await perplexityRunner.run({
      question: questionText,
      mode,
      contextUrl: mode === "on" ? opts.contextUrl : undefined,
    });

    // Judge the REAL answer. groundTruthNotes is judge-only.
    const { verdict, usedLlm } = await judge({
      question: questionText,
      answer: out.answer,
      candidateName: profile.name,
      groundTruthNotes: profile.groundTruthNotes,
      sources: out.sources,
    });

    result = {
      model: "perplexity",
      mode,
      questionId,
      questionText,
      answer: out.answer,
      sources: out.sources,
      verdict,
      measuredAt,
      seeded: false,
      live: true,
      degraded: out.degraded || !usedLlm,
      degradedReason: [
        out.degradedReason,
        usedLlm ? "" : "Verdict computed by heuristic fallback (no judge model key set).",
      ]
        .filter(Boolean)
        .join(" "),
    };
  } catch (e) {
    const err = e as Error;
    // Honest failure state — never fabricate an answer. A blank/error is real.
    result = {
      model: "perplexity",
      mode,
      questionId,
      questionText,
      answer: "",
      sources: [],
      verdict: null,
      measuredAt,
      seeded: false,
      live: false,
      degraded: true,
      degradedReason:
        err instanceof MissingKeyError
          ? "No PERPLEXITY_API_KEY set — showing seeded demo data if available, otherwise no live result."
          : undefined,
      error: err.message,
    };
    // NEVER cache errors/missing-key results. Caching an empty result would
    // shadow the seeded demo cache (which getCached reads only as a fallback)
    // and poison future live runs once a key is added.
    return result;
  }

  await setCached(key, result);
  return result;
}
