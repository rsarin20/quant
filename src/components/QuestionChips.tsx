"use client";

import { useState } from "react";
import type { Profile, Question } from "@/lib/types";
import { PRESET_QUESTIONS, INTENT_LABELS, interpolate } from "@/lib/questions";

// A1: preset question library as tappable chips grouped by intent, plus a
// custom-question input that runs through the same pipeline.
export function QuestionChips({
  profile,
  activeIds,
  onToggle,
  onCustom,
}: {
  profile: Profile;
  activeIds: Set<string>;
  onToggle: (q: Question) => void;
  onCustom: (text: string) => void;
}) {
  const [custom, setCustom] = useState("");

  const groups = groupByIntent(PRESET_QUESTIONS);

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([intent, qs]) => (
        <div key={intent}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {INTENT_LABELS[intent as Question["intent"]]}
          </div>
          <div className="flex flex-wrap gap-2">
            {qs.map((q) => {
              const active = activeIds.has(q.id);
              return (
                <button
                  key={q.id}
                  onClick={() => onToggle(q)}
                  title={interpolate(q.template, profile)}
                  className={`rounded-full border px-3 py-1.5 text-left text-xs transition ${
                    active
                      ? "border-accent bg-accent/15 text-white"
                      : "border-line bg-panel hover:border-muted"
                  }`}
                >
                  {interpolate(q.template, profile)}
                  {q.core && (
                    <span className="ml-1.5 text-[9px] uppercase text-accent">core</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Ask your own
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.trim()) {
              onCustom(custom.trim());
              setCustom("");
            }
          }}
          className="flex gap-2"
        >
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder={`e.g. What has ${profile.name || "this person"} shipped recently?`}
            className="flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none placeholder:text-muted/60 focus:border-accent"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            Run
          </button>
        </form>
      </div>
    </div>
  );
}

function groupByIntent(qs: Question[]): Record<string, Question[]> {
  const out: Record<string, Question[]> = {};
  for (const q of qs) (out[q.intent] ||= []).push(q);
  return out;
}
