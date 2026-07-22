"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Mode, Profile, Question } from "@/lib/types";
import { COPY } from "@/lib/copy";
import { RetrievalToggle } from "@/components/RetrievalToggle";
import { QuestionChips } from "@/components/QuestionChips";
import { ComparativeGrid, type QuestionRow } from "@/components/ComparativeGrid";
import { type CellState } from "@/components/AnswerCell";
import { FixFlow } from "@/components/FixFlow";
import { PRESET_QUESTIONS, interpolate } from "@/lib/questions";

type ActiveQ = { id: string; text: string; questionId: string; customText?: string };
type Status = { live: { perplexity: boolean; judge: boolean }; appUrl: string } | null;

export default function Home() {
  const [status, setStatus] = useState<Status>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [active, setActive] = useState<Profile | null>(null);
  const [tab, setTab] = useState<"mirror" | "fix">("mirror");

  const [mode, setMode] = useState<Mode>("on");
  const [activeQs, setActiveQs] = useState<ActiveQ[]>([]);
  // cells keyed `${mode}:${clientId}`; afterCells keyed clientId (ON + profile URL)
  const [cells, setCells] = useState<Record<string, CellState>>({});
  const [afterCells, setAfterCells] = useState<Record<string, CellState>>({});
  const [compare, setCompare] = useState(false);
  const [canonicalUrl, setCanonicalUrl] = useState<string>("");

  // ---- bootstrap ----
  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => {});
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        const list: Profile[] = d.profiles || [];
        setProfiles(list);
        if (list.length && !active) {
          setActive(list[0]);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When active profile changes, seed a couple of core questions and reset grid.
  useEffect(() => {
    if (!active) return;
    setCells({});
    setAfterCells({});
    setCompare(false);
    setCanonicalUrl(status?.appUrl ? `${status.appUrl}/${active.slug}` : "");
    const core = PRESET_QUESTIONS.filter((q) => q.core).slice(0, 3);
    setActiveQs(
      core.map((q) => ({ id: q.id, questionId: q.id, text: interpolate(q.template, active) }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.slug, active?.version]);

  // Slug-explicit core so callers never depend on possibly-stale `active`.
  const fetchMirror = useCallback(
    async (
      slug: string,
      q: ActiveQ,
      runMode: Mode,
      opts: { after?: boolean; force?: boolean; url?: string } = {}
    ) => {
      const key = opts.after ? q.id : `${runMode}:${q.id}`;
      const setter = opts.after ? setAfterCells : setCells;
      setter((prev) => ({ ...prev, [key]: { status: "loading" } }));
      try {
        const res = await fetch("/api/mirror", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            questionId: q.questionId,
            customText: q.customText,
            mode: runMode,
            force: opts.force,
            contextUrl: opts.after ? opts.url : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "run failed");
        setter((prev) => ({ ...prev, [key]: { status: "done", result: data.result } }));
      } catch (e) {
        setter((prev) => ({
          ...prev,
          [key]: {
            status: "error",
            result: {
              model: "perplexity",
              mode: runMode,
              questionId: q.questionId,
              questionText: q.text,
              answer: "",
              sources: [],
              verdict: null,
              measuredAt: new Date().toISOString(),
              seeded: false,
              live: false,
              degraded: true,
              error: (e as Error).message,
            },
          },
        }));
      }
    },
    []
  );

  const runOne = useCallback(
    (q: ActiveQ, runMode: Mode, opts: { after?: boolean; force?: boolean } = {}) => {
      if (!active) return;
      return fetchMirror(active.slug, q, runMode, {
        ...opts,
        url: opts.after ? canonicalUrl : undefined,
      });
    },
    [active, canonicalUrl, fetchMirror]
  );

  // Auto-run current-mode cells for any active question that hasn't run yet.
  useEffect(() => {
    if (!active || compare) return;
    for (const q of activeQs) {
      const key = `${mode}:${q.id}`;
      if (!cells[key]) runOne(q, mode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQs, mode, active, compare]);

  function toggleQuestion(q: Question) {
    if (!active) return;
    setActiveQs((prev) => {
      const exists = prev.find((a) => a.id === q.id);
      if (exists) return prev.filter((a) => a.id !== q.id);
      return [...prev, { id: q.id, questionId: q.id, text: interpolate(q.template, active) }];
    });
  }

  function addCustom(text: string) {
    const id = "custom:" + simpleHash(text);
    setActiveQs((prev) =>
      prev.find((a) => a.id === id)
        ? prev
        : [...prev, { id, questionId: "custom", customText: text, text }]
    );
  }

  // Force fresh runs only when a live key exists; in demo mode we read the
  // seeded before/after from cache (forcing would bypass it and show blanks).
  const forceLive = Boolean(status?.live.perplexity);

  async function runCompare() {
    if (!active || !canonicalUrl) return;
    setMode("on");
    setCompare(true);
    for (const q of activeQs) {
      // "before" = ON without the profile URL; "after" = ON pointed at the page.
      runOne(q, "on", { force: forceLive });
      runOne(q, "on", { after: true, force: forceLive });
    }
  }

  const activeIds = useMemo(() => new Set(activeQs.map((q) => q.id)), [activeQs]);
  const rows: QuestionRow[] = activeQs.map((q) => ({ id: q.id, text: q.text }));
  const currentCells = useMemo(() => {
    const out: Record<string, CellState> = {};
    for (const q of activeQs) out[q.id] = cells[`${mode}:${q.id}`] || { status: "idle" };
    return out;
  }, [activeQs, cells, mode]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Header status={status} />

      {/* Candidate bar */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel p-3">
        <span className="text-xs uppercase tracking-wide text-muted">Candidate</span>
        <select
          value={active?.slug || ""}
          onChange={(e) => setActive(profiles.find((p) => p.slug === e.target.value) || null)}
          className="rounded-lg border border-line bg-panel2 px-3 py-1.5 text-sm outline-none focus:border-accent"
        >
          {profiles.length === 0 && <option value="">No candidates yet</option>}
          {profiles.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name} — {p.currentRole}
            </option>
          ))}
        </select>
        {active && (
          <a
            href={`/${active.slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:underline"
          >
            view public profile ↗
          </a>
        )}
        <div className="ml-auto flex gap-1 rounded-lg bg-panel2 p-1">
          <TabBtn active={tab === "mirror"} onClick={() => setTab("mirror")}>
            The Mirror
          </TabBtn>
          <TabBtn active={tab === "fix"} onClick={() => setTab("fix")}>
            The Fix
          </TabBtn>
        </div>
      </div>

      {tab === "mirror" ? (
        <div className="mt-6 space-y-5">
          {!active ? (
            <EmptyState onFix={() => setTab("fix")} />
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <RetrievalToggle
                    mode={mode}
                    onChange={(m) => {
                      setCompare(false);
                      setMode(m);
                    }}
                  />
                  <div className="rounded-xl border border-line bg-panel p-4">
                    <QuestionChips
                      profile={active}
                      activeIds={activeIds}
                      onToggle={toggleQuestion}
                      onCustom={addCustom}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold">{COPY.mirror.title}</h2>
                    <span className="text-xs text-muted">
                      Measured {new Date().toLocaleDateString()} · verbatim model output
                    </span>
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() => activeQs.forEach((q) => runOne(q, mode, { force: forceLive }))}
                        className="rounded-lg border border-line px-3 py-1.5 text-xs hover:border-muted"
                        title={forceLive ? "Re-measure with a fresh live call" : "Reload (demo mode reads seeded data)"}
                      >
                        ↻ Re-run
                      </button>
                      <button
                        onClick={runCompare}
                        disabled={!canonicalUrl}
                        title={
                          canonicalUrl
                            ? "Run before (no page) vs after (page live) side by side"
                            : "Generate a profile in The Fix first"
                        }
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-40"
                      >
                        ⚡ Before / After
                      </button>
                    </div>
                  </div>

                  {compare && (
                    <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs text-muted">
                      <span className="font-medium text-white/80">Before / after: </span>
                      “Before” is retrieval-ON with no public page to find. “After” is the
                      same question with your page live — the model can now fetch{" "}
                      <a href={canonicalUrl} target="_blank" rel="noreferrer" className="text-accent underline">
                        your profile
                      </a>
                      . Memory (retrieval-OFF) is unchanged — we don&apos;t claim to move it.
                    </div>
                  )}

                  <ComparativeGrid
                    questions={rows}
                    mode={mode}
                    results={currentCells}
                    afterResults={compare ? afterCells : undefined}
                    compare={compare}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mt-6">
          <FixFlow
            initialProfile={active}
            onProfileReady={(p, url) => {
              setProfiles((prev) => {
                const rest = prev.filter((x) => x.slug !== p.slug);
                return [p, ...rest];
              });
              setActive(p);
              setCanonicalUrl(url);
              setTab("mirror");
              // Kick off the before/after money shot.
              setCompare(true);
              setMode("on");
              setCells({});
              setAfterCells({});
              const core = PRESET_QUESTIONS.filter((q) => q.core).slice(0, 3);
              const qs: ActiveQ[] = core.map((q) => ({
                id: q.id,
                questionId: q.id,
                text: interpolate(q.template, p),
              }));
              setActiveQs(qs);
              const force = Boolean(status?.live.perplexity);
              qs.forEach((q) => {
                fetchMirror(p.slug, q, "on", { force }); // before
                fetchMirror(p.slug, q, "on", { after: true, force, url }); // after
              });
            }}
          />
        </div>
      )}

      <Footer />
    </div>
  );
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// ------------------------------- chrome ------------------------------------

function Header({ status }: { status: Status }) {
  return (
    <header>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          {COPY.productName}
          <span className="ml-2 text-sm font-normal text-muted">· How you show up in AI</span>
        </h1>
        {status && <LiveBadge status={status} />}
      </div>
      <p className="mt-2 max-w-3xl text-sm text-white/80">{COPY.tagline}</p>
      <p className="mt-1 max-w-3xl text-xs text-muted">{COPY.neverClaim}</p>
    </header>
  );
}

function LiveBadge({ status }: { status: NonNullable<Status> }) {
  const both = status.live.perplexity && status.live.judge;
  const some = status.live.perplexity || status.live.judge;
  const tone = both ? "text-good bg-good/15" : some ? "text-warn bg-warn/15" : "text-muted bg-panel2";
  const label = status.live.perplexity
    ? both
      ? "Live: Perplexity + judge"
      : "Live: Perplexity (heuristic judge)"
    : "Demo mode: seeded data (no API keys)";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`} title="Set keys in .env to enable live calls">
      ● {label}
    </span>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        active ? "bg-accent text-white" : "text-muted hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ onFix }: { onFix: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-12 text-center">
      <p className="text-sm text-muted">No candidate loaded.</p>
      <button
        onClick={onFix}
        className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
      >
        Add a resume →
      </button>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-line pt-6 text-xs text-muted">
      <p>
        Prototype. Perplexity is the only wired model; other columns are seams for
        later. Retrieval-OFF is best-effort. We measure two things separately: what
        AI has memorized (hard to change) and what AI finds when it looks you up
        (what your profile improves).
      </p>
    </footer>
  );
}
