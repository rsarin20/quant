import type { SourceRef } from "./types";
import type { ModelRunner, RunnerInput, RunnerOutput } from "./runner";

// ---------------------------------------------------------------------------
// Perplexity runner. Endpoint is OpenAI-compatible:
//   POST https://api.perplexity.ai/chat/completions
// Models: "sonar" (light, grounded) / "sonar-pro" (deeper retrieval).
// Sources come back as top-level `search_results` (title+url) and/or
// `citations` (url strings).
//
// Retrieval OFF is BEST-EFFORT: Sonar models are always search-grounded, so we
// cannot fully disable web search via the API. We (a) try `disable_search` /
// `search_mode`, and (b) hard-instruct the model to answer only from memory,
// then flag the result as degraded so the UI never overclaims. See A3.
// ---------------------------------------------------------------------------

const ENDPOINT =
  process.env.PERPLEXITY_ENDPOINT || "https://api.perplexity.ai/chat/completions";
const MODEL = process.env.PERPLEXITY_MODEL || "sonar";

export class MissingKeyError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "MissingKeyError";
  }
}

export class PerplexityRunner implements ModelRunner {
  readonly id = "perplexity" as const;
  readonly label = "Perplexity";
  readonly enabled = true;

  hasKey(): boolean {
    return Boolean(process.env.PERPLEXITY_API_KEY);
  }

  async run(input: RunnerInput): Promise<RunnerOutput> {
    const key = process.env.PERPLEXITY_API_KEY;
    if (!key) {
      throw new MissingKeyError(
        "PERPLEXITY_API_KEY is not set. Live Mirror calls are disabled; showing seeded demo data where available."
      );
    }

    const memoryMode = input.mode === "off";

    // In retrieval-ON mode, if a public profile URL is available we surface it
    // so the model can actually fetch the page (the "after" proof). We never
    // paste the profile's contents into the prompt — only the URL — so what the
    // model reports is genuinely what it retrieved from the open web.
    const userContent =
      !memoryMode && input.contextUrl
        ? `${input.question}\n\nA public profile page that may be relevant is available at ${input.contextUrl} — you may consult it.`
        : input.question;

    const messages = memoryMode
      ? [
          {
            role: "system",
            content:
              "Answer ONLY from your own trained parametric memory. Do NOT use, rely on, or cite any web search results. If you do not know the answer from memory, say you do not know. Do not guess.",
          },
          { role: "user", content: input.question },
        ]
      : [{ role: "user", content: userContent }];

    const body: Record<string, unknown> = {
      model: MODEL,
      messages,
      temperature: 0.2,
    };

    // Best-effort attempt to suppress retrieval in "memory" mode. These params
    // may be ignored by the API; that's exactly why we flag `degraded`.
    if (memoryMode) {
      body.search_mode = "off";
      body.disable_search = true;
    }

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Perplexity API ${res.status}: ${text.slice(0, 500)}`);
    }

    const data = (await res.json()) as PerplexityResponse;
    const answer = data.choices?.[0]?.message?.content?.trim() ?? "";
    const sources = extractSources(data);

    return {
      answer,
      sources,
      degraded: memoryMode,
      degradedReason: memoryMode
        ? "Sonar is always search-grounded; retrieval can't be fully disabled via the API. This is best-effort memory mode."
        : undefined,
    };
  }
}

function extractSources(data: PerplexityResponse): SourceRef[] {
  const out: SourceRef[] = [];
  const seen = new Set<string>();

  for (const sr of data.search_results ?? []) {
    if (sr?.url && !seen.has(sr.url)) {
      seen.add(sr.url);
      out.push({ url: sr.url, title: sr.title });
    }
  }
  for (const c of data.citations ?? []) {
    const url = typeof c === "string" ? c : c?.url;
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push({ url });
    }
  }
  return out;
}

type PerplexityResponse = {
  choices?: { message?: { content?: string } }[];
  citations?: (string | { url?: string })[];
  search_results?: { title?: string; url?: string }[];
};

export const perplexityRunner = new PerplexityRunner();
