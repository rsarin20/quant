"use client";

import { useRef, useState } from "react";
import type { Profile } from "@/lib/types";
import { COPY } from "@/lib/copy";
import { HowThisWorks } from "./HowThisWorks";
import { ConfirmFields } from "./ConfirmFields";
import { Artifacts, type GenResult } from "./Artifacts";

type Step = "drop" | "confirm" | "artifacts";

// HALF B: resume → resume.md. Drop → confirm fields → corroboration links →
// generate three artifacts → hand off to the before/after.
export function FixFlow({
  initialProfile,
  onProfileReady,
}: {
  initialProfile?: Profile | null;
  onProfileReady: (profile: Profile, canonicalUrl: string) => void;
}) {
  const [step, setStep] = useState<Step>(initialProfile ? "confirm" : "drop");
  const [profile, setProfile] = useState<Profile | null>(initialProfile ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gen, setGen] = useState<GenResult | null>(null);
  // Existing (already-published) profiles are treated as previously consented.
  const [consent, setConsent] = useState<boolean>(Boolean(initialProfile));
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-resume", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Parse failed");
      setProfile(blankProfile(data.fields));
      setStep("confirm");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAndGenerate() {
    if (!profile) return;
    setBusy(true);
    setError("");
    try {
      // Persist (bumps version if content changed → invalidates Mirror cache).
      const saveRes = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, consent }),
      });
      const saved = await saveRes.json();
      if (!saveRes.ok) throw new Error(saved.error || "Save failed");
      const savedProfile: Profile = saved.profile;
      setProfile(savedProfile);

      // Generate artifacts.
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: savedProfile.slug }),
      });
      const g = await genRes.json();
      if (!genRes.ok) throw new Error(g.error || "Generate failed");
      setGen(g);
      setStep("artifacts");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{COPY.fix.title}</h2>
        <p className="mt-1 text-sm text-muted">{COPY.fix.subtitle}</p>
      </div>

      <StepBar step={step} />

      {error && (
        <div className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          {error}
        </div>
      )}

      {step === "drop" && (
        <DropZone
          busy={busy}
          fileRef={fileRef}
          onFile={handleFile}
          onManual={() => {
            setProfile(blankProfile({}));
            setStep("confirm");
          }}
        />
      )}

      {step === "confirm" && profile && (
        <ConfirmFields
          profile={profile}
          setProfile={setProfile}
          busy={busy}
          consent={consent}
          setConsent={setConsent}
          onBack={() => setStep("drop")}
          onGenerate={saveAndGenerate}
        />
      )}

      {step === "artifacts" && profile && gen && (
        <Artifacts
          profile={profile}
          gen={gen}
          onSeeMirror={() => onProfileReady(profile, gen.canonicalUrl)}
        />
      )}

      <HowThisWorks />
    </div>
  );
}

// --------------------------------------------------------------------------

function StepBar({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "drop", label: "Drop resume" },
    { id: "confirm", label: "Confirm fields" },
    { id: "artifacts", label: "Generate profile" },
  ];
  const idx = steps.findIndex((s) => s.id === step);
  return (
    <div className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full ${
              i <= idx ? "bg-accent text-white" : "bg-panel2 text-muted"
            }`}
          >
            {i + 1}
          </span>
          <span className={i <= idx ? "text-white" : "text-muted"}>{s.label}</span>
          {i < steps.length - 1 && <span className="mx-1 text-line">———</span>}
        </div>
      ))}
    </div>
  );
}

function DropZone({
  busy,
  fileRef,
  onFile,
  onManual,
}: {
  busy: boolean;
  fileRef: React.RefObject<HTMLInputElement>;
  onFile: (f: File) => void;
  onManual: () => void;
}) {
  const [drag, setDrag] = useState(false);
  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition ${
          drag ? "border-accent bg-accent/5" : "border-line bg-panel"
        }`}
      >
        <div className="text-4xl">📄</div>
        <p className="mt-3 text-sm font-medium">
          {busy ? "Parsing…" : "Drop your resume (PDF or DOCX)"}
        </p>
        <p className="mt-1 text-xs text-muted">
          Parsed on the server. You'll confirm every field before anything is published.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            Choose file
          </button>
          <button
            disabled={busy}
            onClick={onManual}
            className="rounded-lg border border-line px-4 py-2 text-sm hover:border-muted disabled:opacity-50"
          >
            Enter manually
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </div>
    </div>
  );
}

function blankProfile(fields: Partial<Profile>): Profile {
  return {
    slug: fields.slug || "",
    name: fields.name || "",
    currentRole: fields.currentRole || "",
    currentCompany: fields.currentCompany || "",
    location: fields.location || "",
    domain: fields.domain || "",
    specialty: fields.specialty || "",
    targetRole: fields.targetRole || "",
    claimedAchievement: fields.claimedAchievement || "",
    experience: fields.experience || [],
    education: fields.education || [],
    skills: fields.skills || [],
    credentials: fields.credentials || [],
    publicWork: fields.publicWork || [],
    sameAs: fields.sameAs || [],
    groundTruthNotes: fields.groundTruthNotes || "",
    createdAt: fields.createdAt || "",
    version: fields.version || 1,
  };
}
