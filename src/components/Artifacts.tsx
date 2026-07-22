"use client";

import { useState } from "react";
import type { Profile } from "@/lib/types";

export type GenResult = {
  canonicalUrl: string;
  agentJsonUrl: string;
  resumeMd: string;
  jsonLd: unknown;
  agentJson: unknown;
};

// B2.4: the three generated artifacts, then the hand-off to the before/after.
export function Artifacts({
  profile,
  gen,
  onSeeMirror,
}: {
  profile: Profile;
  gen: GenResult;
  onSeeMirror: () => void;
}) {
  const [tab, setTab] = useState<"md" | "jsonld" | "agent">("md");

  function download() {
    const blob = new Blob([gen.resumeMd], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${profile.slug}.resume.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-good/30 bg-good/5 p-4">
        <div className="text-sm font-semibold text-good">
          ✓ Published — {profile.name}&apos;s profile is now live and fetchable
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <LinkCard
            title="Hosted profile page"
            desc="Server-rendered HTML + embedded JSON-LD. The canonical thing on the open web."
            url={gen.canonicalUrl}
          />
          <LinkCard
            title="agent.json endpoint"
            desc="The profile as clean structured JSON — agent-readable."
            url={gen.agentJsonUrl}
          />
        </div>
        <p className="mt-3 text-xs text-muted">
          Verify it&apos;s machine-readable without JS:{" "}
          <code className="rounded bg-panel2 px-1.5 py-0.5 text-[11px] text-white/80">
            curl -s {gen.canonicalUrl} | grep application/ld+json
          </code>
        </p>
      </div>

      {/* Artifact preview tabs */}
      <div className="rounded-xl border border-line bg-panel">
        <div className="flex items-center gap-1 border-b border-line p-2">
          <Tab active={tab === "md"} onClick={() => setTab("md")}>
            resume.md
          </Tab>
          <Tab active={tab === "jsonld"} onClick={() => setTab("jsonld")}>
            JSON-LD
          </Tab>
          <Tab active={tab === "agent"} onClick={() => setTab("agent")}>
            agent.json
          </Tab>
          {tab === "md" && (
            <button
              onClick={download}
              className="ml-auto rounded-lg bg-panel2 px-3 py-1 text-xs hover:bg-line"
            >
              ↓ Download resume.md
            </button>
          )}
        </div>
        <pre className="scroll-thin max-h-80 overflow-auto p-4 text-xs leading-relaxed text-white/80">
          {tab === "md"
            ? gen.resumeMd
            : JSON.stringify(tab === "jsonld" ? gen.jsonLd : gen.agentJson, null, 2)}
        </pre>
      </div>

      {/* The money shot CTA */}
      <div className="rounded-xl border border-accent/40 bg-accent/10 p-5 text-center">
        <div className="text-sm font-semibold">
          Now watch it change: re-measure with your page live
        </div>
        <p className="mx-auto mt-1 max-w-lg text-xs text-muted">
          We&apos;ll ask the AI the same questions again — this time it can reach
          your new public page. Compare what it found before vs. after,
          side by side.
        </p>
        <button
          onClick={onSeeMirror}
          className="mt-3 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent/90"
        >
          See the before / after →
        </button>
      </div>
    </div>
  );
}

function LinkCard({ title, desc, url }: { title: string; desc: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block rounded-lg border border-line bg-panel2 p-3 hover:border-accent"
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-0.5 text-xs text-muted">{desc}</div>
      <div className="mt-1.5 truncate text-xs text-accent">{url}</div>
    </a>
  );
}

function Tab({
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
      className={`rounded-lg px-3 py-1 text-xs ${
        active ? "bg-panel2 text-white" : "text-muted hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
