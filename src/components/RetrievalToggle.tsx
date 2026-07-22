"use client";

import type { Mode } from "@/lib/types";
import { COPY } from "@/lib/copy";

// A3: the ON/OFF toggle. The honesty mechanism AND the before/after engine.
export function RetrievalToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel p-1">
      <div className="grid grid-cols-2 gap-1">
        {(["off", "on"] as Mode[]).map((m) => {
          const active = mode === m;
          const c = m === "off" ? COPY.retrieval.off : COPY.retrieval.on;
          return (
            <button
              key={m}
              onClick={() => onChange(m)}
              className={`rounded-lg px-3 py-2 text-left transition ${
                active
                  ? m === "on"
                    ? "bg-accent/20 ring-1 ring-accent"
                    : "bg-panel2 ring-1 ring-line"
                  : "hover:bg-panel2/60"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    m === "on" ? "bg-accent" : "bg-muted"
                  }`}
                />
                {c.label}
                <span className="ml-auto text-[10px] uppercase tracking-wide text-muted">
                  {m}
                </span>
              </div>
              <p className="mt-1 text-xs leading-snug text-muted">{c.help}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
