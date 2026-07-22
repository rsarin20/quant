"use client";

import { COPY } from "@/lib/copy";

// B5: the "How this works" explanation panel. Not buried in docs. A simple
// two-state diagram + three plain steps. The explanation is a trust feature —
// candidates who don't grasp the mechanism suspect snake oil.
export function HowThisWorks() {
  return (
    <div className="rounded-2xl border border-line bg-panel p-6">
      <h3 className="text-lg font-semibold">How this works</h3>

      {/* Two-state diagram */}
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <div className="rounded-xl border border-bad/30 bg-bad/5 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-bad">
            Resume on your laptop
          </div>
          <p className="mt-2 text-sm text-white/80">
            A PDF on disk, or a LinkedIn page behind a login that blocks AI
            crawlers.
          </p>
          <p className="mt-2 text-sm font-medium text-bad">→ Invisible to AI</p>
        </div>

        <div className="hidden items-center justify-center text-2xl text-muted md:flex">
          →
        </div>

        <div className="rounded-xl border border-good/30 bg-good/5 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-good">
            resume.md at a public URL
          </div>
          <p className="mt-2 text-sm text-white/80">
            Structured, linked to your real work, served as clean HTML + JSON-LD.
          </p>
          <p className="mt-2 text-sm font-medium text-good">
            → AI reads it, gets you right, cites it
          </p>
        </div>
      </div>

      {/* Three steps */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[COPY.howItWorks.findable, COPY.howItWorks.readable, COPY.howItWorks.trusted].map(
          (s, i) => (
            <div key={i} className="rounded-xl border border-line bg-panel2 p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
                  {i + 1}
                </span>
                <span className="font-medium">{s.title}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">{s.body}</p>
            </div>
          )
        )}
      </div>

      <p className="mt-5 rounded-lg border border-line bg-panel2 p-3 text-xs leading-relaxed text-muted">
        <span className="font-semibold text-white/80">Honest limit: </span>
        {COPY.fix.honestLimit}
      </p>
    </div>
  );
}
