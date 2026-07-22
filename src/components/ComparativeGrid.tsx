"use client";

import { COLUMN_MODELS } from "@/lib/runner";
import type { Mode } from "@/lib/types";
import { AnswerCell, type CellState } from "./AnswerCell";

// A2: the comparative view. Columns are a first-class concept; one real column
// (Perplexity) plus visibly-disabled "coming soon" placeholders for the other
// three. One row per question, answer shown verbatim. Optional before/after
// split inside the Perplexity column for the money-shot.

export type QuestionRow = { id: string; text: string };

export function ComparativeGrid({
  questions,
  mode,
  results,
  afterResults,
  compare,
}: {
  questions: QuestionRow[];
  mode: Mode;
  results: Record<string, CellState>;
  afterResults?: Record<string, CellState>;
  compare?: boolean;
}) {
  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-muted">
        Pick a question above to see how AI answers it.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[900px]">
        {/* Column header row */}
        <div className="grid grid-cols-[minmax(200px,1fr)_repeat(4,minmax(220px,1fr))] gap-3">
          <div className="px-1 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Question
          </div>
          {COLUMN_MODELS.map((m) => (
            <div
              key={m.id}
              className={`flex items-center gap-2 rounded-t-lg px-3 py-2 text-sm font-medium ${
                m.enabled ? "bg-panel2 text-white" : "bg-panel/50 text-muted"
              }`}
            >
              {m.label}
              {!m.enabled && (
                <span className="ml-auto rounded-full bg-line px-2 py-0.5 text-[10px] uppercase text-muted">
                  coming soon
                </span>
              )}
              {m.enabled && (
                <span className="ml-auto rounded-full bg-good/15 px-2 py-0.5 text-[10px] uppercase text-good">
                  live
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Question rows */}
        <div className="divide-y divide-line/60">
          {questions.map((q) => (
            <div
              key={q.id}
              className="grid grid-cols-[minmax(200px,1fr)_repeat(4,minmax(220px,1fr))] gap-3 py-3"
            >
              <div className="px-1 text-sm text-white/80">{q.text}</div>

              {/* Perplexity — the live column */}
              <div className="rounded-lg border border-line bg-panel p-3">
                {compare && afterResults ? (
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-warn">
                        Before — no public profile
                      </div>
                      <AnswerCell state={results[q.id] || { status: "idle" }} label="Perplexity" />
                    </div>
                    <div className="border-t border-line pt-3">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-good">
                        After — profile page live
                      </div>
                      <AnswerCell
                        state={afterResults[q.id] || { status: "idle" }}
                        label="Perplexity"
                      />
                    </div>
                  </div>
                ) : (
                  <AnswerCell state={results[q.id] || { status: "idle" }} label="Perplexity" />
                )}
              </div>

              {/* Disabled placeholder columns — never faked */}
              {COLUMN_MODELS.filter((m) => !m.enabled).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-center rounded-lg border border-dashed border-line/60 bg-panel/30 p-3 text-center text-xs text-muted/50"
                >
                  {m.label} column — not wired in this prototype
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
