"use client";

import type { Verdict } from "@/lib/types";

// A2/A4: the verdict strip above each answer. This is what makes long answers
// scannable — most users read strips, not paragraphs.
//   Named ✓ / Not found ✗ / Wrong person ⚠  +  a source-count badge.

export function VerdictStrip({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="inline-block h-2 w-2 rounded-full bg-line" />
        No verdict
      </div>
    );
  }

  const { primary, cls, icon } = classify(verdict);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${cls}`}
      >
        <span>{icon}</span>
        {primary}
      </span>

      <span
        className="inline-flex items-center gap-1 rounded-full bg-panel2 px-2 py-0.5 text-muted"
        title="Distinct sources the answer relied on"
      >
        {verdict.source_count} {verdict.source_count === 1 ? "source" : "sources"}
      </span>

      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 ${evidenceCls(
          verdict.evidence_quality
        )}`}
        title="Judge's assessment of evidence quality"
      >
        {verdict.evidence_quality} evidence
      </span>

      {verdict.conflated_with_other_person && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-bad/15 px-2 py-0.5 text-bad"
          title={verdict.conflation_detail || "Answer describes a different person"}
        >
          ⚠ conflation
        </span>
      )}
    </div>
  );
}

function classify(v: Verdict): { primary: string; cls: string; icon: string } {
  if (!v.candidate_named)
    return { primary: "Not found", cls: "bg-bad/15 text-bad", icon: "✗" };
  if (v.conflated_with_other_person || !v.identity_correct)
    return { primary: "Wrong person", cls: "bg-warn/15 text-warn", icon: "⚠" };
  return { primary: "Named", cls: "bg-good/15 text-good", icon: "✓" };
}

function evidenceCls(q: Verdict["evidence_quality"]): string {
  switch (q) {
    case "strong":
      return "bg-good/15 text-good";
    case "moderate":
      return "bg-accent/15 text-accent";
    case "thin":
      return "bg-warn/15 text-warn";
    default:
      return "bg-panel2 text-muted";
  }
}
