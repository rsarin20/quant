"use client";

import type { MirrorResult } from "@/lib/types";
import { VerdictStrip } from "./VerdictStrip";

export type CellState = {
  status: "idle" | "loading" | "done" | "error";
  result?: MirrorResult;
};

// One answer cell: verdict strip + VERBATIM answer (never paraphrased) +
// sources. Streaming/progress is shown instead of a silent spinner (A2).
export function AnswerCell({
  state,
  label,
}: {
  state: CellState;
  label?: string;
}) {
  if (state.status === "idle") {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center text-xs text-muted/60">
        Not run yet
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="flex h-full min-h-[120px] flex-col justify-center gap-2 text-xs text-muted">
        <div className="dot-pulse text-accent">
          <span>●</span>
          <span>●</span>
          <span>●</span>
        </div>
        {label ? `${label} is searching…` : "Searching the web…"}
      </div>
    );
  }

  const r = state.result;
  if (!r) return null;

  if (r.error && !r.answer) {
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-bad/30 bg-bad/10 p-3 text-xs text-bad">
          <div className="font-medium">No live result</div>
          <p className="mt-1 text-bad/80">{r.degradedReason || r.error}</p>
        </div>
      </div>
    );
  }

  const blank = !r.answer.trim();

  return (
    <div className="space-y-3">
      <VerdictStrip verdict={r.verdict} />

      {blank ? (
        <div className="rounded-lg border border-dashed border-line p-4 text-center text-xs text-muted">
          The model returned nothing about this person.
          <div className="mt-1 text-muted/70">A blank is a real result — this is the void.</div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">
          {r.answer}
        </p>
      )}

      {r.sources.length > 0 && (
        <div className="border-t border-line pt-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-muted">
            Sources
          </div>
          <ul className="space-y-1">
            {r.sources.slice(0, 6).map((s, i) => (
              <li key={i} className="truncate text-xs">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  {s.title || s.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] text-muted/70">
        <span>Measured {new Date(r.measuredAt).toLocaleDateString()}</span>
        {r.seeded && <Badge tone="seed">seeded demo data</Badge>}
        {r.live && <Badge tone="live">live call</Badge>}
        {r.degraded && r.degradedReason && (
          <span title={r.degradedReason} className="cursor-help underline decoration-dotted">
            best-effort
          </span>
        )}
      </div>
    </div>
  );
}

function Badge({ tone, children }: { tone: "seed" | "live"; children: React.ReactNode }) {
  const cls =
    tone === "live"
      ? "bg-good/15 text-good"
      : "bg-warn/15 text-warn";
  return (
    <span className={`rounded px-1.5 py-0.5 ${cls}`}>{children}</span>
  );
}
