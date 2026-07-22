import type { Verdict, SourceRef } from "./types";

// ---------------------------------------------------------------------------
// A4. The judge. A cheap LLM call (small model, temp 0, fixed) scores each
// answer given: the question, the profile's groundTruthNotes, and the raw
// answer. Conflation is the highest-value signal — flag when the answer
// describes a person contradicting groundTruthNotes.
//
// groundTruthNotes is JUDGE-ONLY. It is passed here but NEVER sent to the
// model runner (Perplexity) — that would contaminate the measurement.
//
// Provider is configurable (JUDGE_PROVIDER). When no key is available we fall
// back to a deterministic heuristic judge so the app still functions offline;
// the caller marks such results so the UI can be honest about it.
// ---------------------------------------------------------------------------

export type JudgeInput = {
  question: string;
  answer: string;
  candidateName: string;
  groundTruthNotes: string; // judge-only
  sources: SourceRef[];
};

const PROVIDER = (process.env.JUDGE_PROVIDER || "anthropic").toLowerCase();

const JUDGE_SYSTEM = `You are a strict evaluator measuring how an AI assistant portrayed a specific job candidate. You are given a QUESTION, the AI's raw ANSWER, the candidate's NAME, and private GROUND TRUTH notes about the real person.

Return ONLY a JSON object (no prose, no markdown fences) with exactly these keys:
{
  "candidate_named": boolean,            // did the answer explicitly name this candidate?
  "identity_correct": boolean,           // if named, does the described person match the ground truth?
  "conflated_with_other_person": boolean,// did it describe a DIFFERENT person with the same/similar name, or attribute facts that contradict ground truth?
  "conflation_detail": string,           // one sentence: who/what it confused, or "" if none
  "source_count": number,                // count of distinct source URLs the answer relied on (use provided SOURCES)
  "sources": string[],                   // the source URLs
  "evidence_quality": "none" | "thin" | "moderate" | "strong"
}

Rules:
- If the candidate is not named at all: candidate_named=false, identity_correct=false, conflated_with_other_person=false.
- Flag conflation whenever the answer's described person contradicts the ground truth (wrong company, wrong field, wrong location, wrong achievements).
- evidence_quality: "none" = no sources/vague; "thin" = 1 weak/tangential source; "moderate" = 1-2 relevant sources; "strong" = multiple corroborating relevant sources.
- Be conservative: absence of evidence is "none"/"thin", not "moderate".`;

export async function judge(input: JudgeInput): Promise<{
  verdict: Verdict;
  usedLlm: boolean;
}> {
  const userMsg = buildUserMessage(input);

  try {
    if (PROVIDER === "anthropic" && process.env.ANTHROPIC_API_KEY) {
      return { verdict: normalize(await callAnthropic(userMsg), input), usedLlm: true };
    }
    if (
      (PROVIDER === "openai" || PROVIDER === "perplexity") &&
      openAiCompatKey()
    ) {
      return { verdict: normalize(await callOpenAiCompatible(userMsg), input), usedLlm: true };
    }
  } catch (e) {
    // Fall through to heuristic on any judge failure — never block the Mirror.
    console.error("Judge LLM failed, using heuristic:", (e as Error).message);
  }

  return { verdict: heuristicJudge(input), usedLlm: false };
}

function buildUserMessage(input: JudgeInput): string {
  return [
    `QUESTION:\n${input.question}`,
    `CANDIDATE NAME:\n${input.candidateName}`,
    `GROUND TRUTH (private, about the real person):\n${input.groundTruthNotes || "(none provided)"}`,
    `SOURCES the answer cited:\n${
      input.sources.length
        ? input.sources.map((s) => `- ${s.url}`).join("\n")
        : "(none)"
    }`,
    `RAW ANSWER:\n${input.answer || "(empty)"}`,
  ].join("\n\n");
}

// ------------------------------- Providers ---------------------------------

async function callAnthropic(userMsg: string): Promise<Partial<Verdict>> {
  const base = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
  const model = process.env.JUDGE_MODEL || "claude-haiku-4-5-20251001";
  const res = await fetch(`${base.replace(/\/$/, "")}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      temperature: 0,
      system: JUDGE_SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic judge ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? "";
  return parseJson(text);
}

function openAiCompatKey(): string | undefined {
  return process.env.JUDGE_API_KEY || process.env.OPENAI_API_KEY || process.env.PERPLEXITY_API_KEY;
}

async function callOpenAiCompatible(userMsg: string): Promise<Partial<Verdict>> {
  const base =
    process.env.JUDGE_BASE_URL ||
    (PROVIDER === "perplexity" ? "https://api.perplexity.ai" : "https://api.openai.com/v1");
  const model = process.env.JUDGE_MODEL || (PROVIDER === "perplexity" ? "sonar" : "gpt-4o-mini");
  const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiCompatKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: JUDGE_SYSTEM },
        { role: "user", content: userMsg },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI-compat judge ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  return parseJson(text);
}

// ------------------------------- Helpers -----------------------------------

function parseJson(text: string): Partial<Verdict> {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in judge output");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalize(v: Partial<Verdict>, input: JudgeInput): Verdict {
  const sources = Array.isArray(v.sources) && v.sources.length
    ? v.sources
    : input.sources.map((s) => s.url);
  return {
    candidate_named: Boolean(v.candidate_named),
    identity_correct: Boolean(v.identity_correct),
    conflated_with_other_person: Boolean(v.conflated_with_other_person),
    conflation_detail: v.conflation_detail || "",
    source_count:
      typeof v.source_count === "number" ? v.source_count : sources.length,
    sources,
    evidence_quality: (["none", "thin", "moderate", "strong"] as const).includes(
      v.evidence_quality as never
    )
      ? (v.evidence_quality as Verdict["evidence_quality"])
      : "none",
  };
}

// Deterministic fallback: no fabrication, just conservative string checks on
// the REAL answer. Marked non-LLM by the caller so the UI can note it.
function heuristicJudge(input: JudgeInput): Verdict {
  const answer = (input.answer || "").toLowerCase();
  const name = input.candidateName.trim().toLowerCase();
  const named = name.length > 0 && answer.includes(name);
  const sources = input.sources.map((s) => s.url);
  const sc = sources.length;
  const quality: Verdict["evidence_quality"] =
    sc === 0 ? "none" : sc === 1 ? "thin" : sc <= 3 ? "moderate" : "strong";
  return {
    candidate_named: named,
    // Heuristic can't verify identity correctness; be conservative.
    identity_correct: named && sc > 0,
    conflated_with_other_person: false,
    conflation_detail: "",
    source_count: sc,
    sources,
    evidence_quality: named ? quality : "none",
  };
}
