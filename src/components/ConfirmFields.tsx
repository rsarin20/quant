"use client";

import type { Profile, Role, Education, PublicItem } from "@/lib/types";

// B2.2 + B2.3: show extracted fields for confirm/correct (accuracy + consent),
// and prompt for corroboration links (sameAs) — framed as highest-leverage.
export function ConfirmFields({
  profile,
  setProfile,
  busy,
  onBack,
  onGenerate,
}: {
  profile: Profile;
  setProfile: (p: Profile) => void;
  busy: boolean;
  onBack: () => void;
  onGenerate: () => void;
}) {
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) =>
    setProfile({ ...profile, [k]: v });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-line bg-panel2 p-3 text-xs text-muted">
        Parsing is imperfect. Correct anything wrong — nothing is published until
        you generate. Only attributable claims from your resume should go in;
        don't embellish.
      </div>

      {/* Identity */}
      <FieldGrid>
        <Text label="Full name" value={profile.name} onChange={(v) => set("name", v)} required />
        <Text label="Current role" value={profile.currentRole} onChange={(v) => set("currentRole", v)} />
        <Text label="Current company" value={profile.currentCompany} onChange={(v) => set("currentCompany", v)} />
        <Text label="Location" value={profile.location} onChange={(v) => set("location", v)} />
      </FieldGrid>

      {/* Mirror-driving fields */}
      <div>
        <SectionLabel>Used by the Mirror's questions</SectionLabel>
        <FieldGrid>
          <Text label="Domain (e.g. payments / fintech PM)" value={profile.domain} onChange={(v) => set("domain", v)} />
          <Text label="Specialty (e.g. real-time payments fraud)" value={profile.specialty} onChange={(v) => set("specialty", v)} />
          <Text label="Target role" value={profile.targetRole} onChange={(v) => set("targetRole", v)} />
          <Text label="Signature achievement" value={profile.claimedAchievement} onChange={(v) => set("claimedAchievement", v)} />
        </FieldGrid>
      </div>

      {/* Experience */}
      <div>
        <SectionLabel>Experience</SectionLabel>
        <div className="space-y-3">
          {profile.experience.map((r, i) => (
            <RoleEditor
              key={i}
              role={r}
              onChange={(nr) => {
                const exp = [...profile.experience];
                exp[i] = nr;
                set("experience", exp);
              }}
              onRemove={() => set("experience", profile.experience.filter((_, j) => j !== i))}
            />
          ))}
          <button
            onClick={() =>
              set("experience", [
                ...profile.experience,
                { title: "", company: "", startDate: "", endDate: "", bullets: [] },
              ])
            }
            className="rounded-lg border border-line px-3 py-1.5 text-xs hover:border-muted"
          >
            + Add role
          </button>
        </div>
      </div>

      {/* Skills + credentials as comma lists */}
      <FieldGrid>
        <ListText label="Skills (comma-separated → knowsAbout)" values={profile.skills} onChange={(v) => set("skills", v)} />
        <ListText label="Credentials (comma-separated)" values={profile.credentials} onChange={(v) => set("credentials", v)} />
      </FieldGrid>

      {/* Education */}
      <div>
        <SectionLabel>Education</SectionLabel>
        <div className="space-y-2">
          {profile.education.map((e, i) => (
            <EduEditor
              key={i}
              edu={e}
              onChange={(ne) => {
                const ed = [...profile.education];
                ed[i] = ne;
                set("education", ed);
              }}
              onRemove={() => set("education", profile.education.filter((_, j) => j !== i))}
            />
          ))}
          <button
            onClick={() =>
              set("education", [
                ...profile.education,
                { institution: "", degree: "", field: "", year: "" },
              ])
            }
            className="rounded-lg border border-line px-3 py-1.5 text-xs hover:border-muted"
          >
            + Add education
          </button>
        </div>
      </div>

      {/* Corroboration links — highest leverage */}
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
        <SectionLabel>
          Corroboration links (sameAs) — highest-leverage, optional
        </SectionLabel>
        <p className="mb-2 text-xs text-muted">
          Each link is another source that agrees with your profile. AI trusts a
          fact more when several places confirm it. GitHub, ORCID, personal site,
          X, talk URLs.
        </p>
        <ListText
          label=""
          values={profile.sameAs}
          onChange={(v) => set("sameAs", v)}
          newline
          placeholder="https://github.com/you"
        />
      </div>

      {/* Ground truth — judge only */}
      <div>
        <SectionLabel>
          Ground-truth notes (judge-only — NEVER sent to the AI)
        </SectionLabel>
        <p className="mb-2 text-xs text-muted">
          Private facts the scorer uses to detect when an answer describes the
          wrong person. Not published, not queried.
        </p>
        <textarea
          value={profile.groundTruthNotes}
          onChange={(e) => set("groundTruthNotes", e.target.value)}
          rows={3}
          placeholder="e.g. Jane Okafor the payments PM in London — NOT the cardiologist in Lagos or the footballer."
          className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-muted hover:text-white">
          ← Back
        </button>
        <button
          disabled={busy || !profile.name.trim()}
          onClick={onGenerate}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {busy ? "Generating…" : "Generate profile & artifacts →"}
        </button>
      </div>
    </div>
  );
}

// ------------------------------- field bits --------------------------------

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
      {children}
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">
        {label}
        {required && <span className="text-bad"> *</span>}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}

function ListText({
  label,
  values,
  onChange,
  newline,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  newline?: boolean;
  placeholder?: string;
}) {
  const sep = newline ? "\n" : ", ";
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs text-muted">{label}</span>}
      <textarea
        value={values.join(sep)}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(newline ? /\n+/ : /,/)
              .map((s) => s.trim())
              .filter(Boolean)
          )
        }
        rows={newline ? 3 : 2}
        className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}

function RoleEditor({
  role,
  onChange,
  onRemove,
}: {
  role: Role;
  onChange: (r: Role) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-panel p-3">
      <div className="grid gap-2 sm:grid-cols-[2fr_2fr_1fr_1fr]">
        <input
          value={role.title}
          placeholder="Title"
          onChange={(e) => onChange({ ...role, title: e.target.value })}
          className="rounded border border-line bg-panel2 px-2 py-1.5 text-sm outline-none focus:border-accent"
        />
        <input
          value={role.company}
          placeholder="Company"
          onChange={(e) => onChange({ ...role, company: e.target.value })}
          className="rounded border border-line bg-panel2 px-2 py-1.5 text-sm outline-none focus:border-accent"
        />
        <input
          value={role.startDate}
          placeholder="Start"
          onChange={(e) => onChange({ ...role, startDate: e.target.value })}
          className="rounded border border-line bg-panel2 px-2 py-1.5 text-sm outline-none focus:border-accent"
        />
        <input
          value={role.endDate}
          placeholder="End"
          onChange={(e) => onChange({ ...role, endDate: e.target.value })}
          className="rounded border border-line bg-panel2 px-2 py-1.5 text-sm outline-none focus:border-accent"
        />
      </div>
      <textarea
        value={role.bullets.join("\n")}
        placeholder="One achievement per line — concrete + dated: “Cut fraud losses 40%, 2023”"
        onChange={(e) =>
          onChange({
            ...role,
            bullets: e.target.value.split(/\n+/).map((s) => s.replace(/^[-•]\s*/, "").trim()).filter(Boolean),
          })
        }
        rows={3}
        className="mt-2 w-full rounded border border-line bg-panel2 px-2 py-1.5 text-sm outline-none focus:border-accent"
      />
      <button onClick={onRemove} className="mt-2 text-xs text-bad hover:underline">
        Remove role
      </button>
    </div>
  );
}

function EduEditor({
  edu,
  onChange,
  onRemove,
}: {
  edu: Education;
  onChange: (e: Education) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid items-center gap-2 sm:grid-cols-[2fr_1.5fr_1.5fr_0.8fr_auto]">
      <input value={edu.institution} placeholder="Institution" onChange={(e) => onChange({ ...edu, institution: e.target.value })} className="rounded border border-line bg-panel px-2 py-1.5 text-sm outline-none focus:border-accent" />
      <input value={edu.degree} placeholder="Degree" onChange={(e) => onChange({ ...edu, degree: e.target.value })} className="rounded border border-line bg-panel px-2 py-1.5 text-sm outline-none focus:border-accent" />
      <input value={edu.field} placeholder="Field" onChange={(e) => onChange({ ...edu, field: e.target.value })} className="rounded border border-line bg-panel px-2 py-1.5 text-sm outline-none focus:border-accent" />
      <input value={edu.year} placeholder="Year" onChange={(e) => onChange({ ...edu, year: e.target.value })} className="rounded border border-line bg-panel px-2 py-1.5 text-sm outline-none focus:border-accent" />
      <button onClick={onRemove} className="text-xs text-bad hover:underline">×</button>
    </div>
  );
}

// Re-export type helper for PublicItem editing left as a seam (not needed for MVP).
export type { PublicItem };
