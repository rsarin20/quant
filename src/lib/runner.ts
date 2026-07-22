import type { Mode, ModelId, SourceRef } from "./types";

// ---------------------------------------------------------------------------
// The model-runner interface. Columns are a first-class concept so more models
// can be added later behind THIS interface with no UI changes. Only Perplexity
// is implemented now (native retrieval = cleanest proxy for the real recruiter
// experience). Do NOT fake other models' answers.
// ---------------------------------------------------------------------------

export type RunnerInput = {
  question: string;
  mode: Mode;
  // Optional public profile URL to surface to the model in retrieval-ON mode.
  // This is how the "after" step proves the freshly-generated page is fetchable
  // and correct — the model actually reaches the page and describes the person
  // from it. Empty/undefined = the honest "before" state (nothing to point at).
  contextUrl?: string;
};

export type RunnerOutput = {
  answer: string; // verbatim model output
  sources: SourceRef[];
  degraded: boolean; // e.g. best-effort memory mode
  degradedReason?: string;
};

export interface ModelRunner {
  readonly id: ModelId;
  readonly label: string;
  readonly enabled: boolean; // false => rendered as "coming soon" placeholder
  run(input: RunnerInput): Promise<RunnerOutput>;
}

// Registry of columns. Order defines the grid's left-to-right layout.
// The three disabled entries keep the comparative design intact and make
// adding models later trivial — SEAM: implement a ModelRunner and flip enabled.
export const COLUMN_MODELS: { id: ModelId; label: string; enabled: boolean }[] = [
  { id: "perplexity", label: "Perplexity", enabled: true },
  { id: "chatgpt", label: "ChatGPT", enabled: false },
  { id: "claude", label: "Claude", enabled: false },
  { id: "gemini", label: "Gemini", enabled: false },
];
