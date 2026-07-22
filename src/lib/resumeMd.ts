import type { Profile } from "./types";

// ---------------------------------------------------------------------------
// B3: resume.md — clean, human-readable Markdown with YAML frontmatter.
// Machine-first: concrete, dated, specific. No fluff adjectives.
// ---------------------------------------------------------------------------

export function generateResumeMd(profile: Profile, canonicalUrl: string): string {
  const fm: string[] = ["---"];
  fm.push(`name: ${yaml(profile.name)}`);
  fm.push(`title: ${yaml(profile.currentRole)}`);
  if (profile.currentCompany) fm.push(`company: ${yaml(profile.currentCompany)}`);
  if (profile.location) fm.push(`location: ${yaml(profile.location)}`);
  fm.push(`canonical: ${yaml(canonicalUrl)}`);
  if (profile.sameAs.length) {
    fm.push("sameAs:");
    for (const s of profile.sameAs) fm.push(`  - ${yaml(s)}`);
  }
  fm.push("---");

  const body: string[] = [];
  body.push(`# ${profile.name}`);
  const sub = [profile.currentRole, profile.currentCompany].filter(Boolean).join(" · ");
  if (sub) body.push(`**${sub}**`);
  if (profile.location) body.push(profile.location);
  body.push("");

  // Summary
  const summary = buildSummary(profile);
  if (summary) {
    body.push("## Summary");
    body.push(summary);
    body.push("");
  }

  // Experience
  if (profile.experience.length) {
    body.push("## Experience");
    for (const r of profile.experience) {
      const dates = [r.startDate, r.endDate].filter(Boolean).join("–");
      const header = [r.title, r.company].filter(Boolean).join(", ");
      body.push(`### ${header}${dates ? `  (${dates})` : ""}`);
      for (const b of r.bullets) body.push(`- ${b}`);
      body.push("");
    }
  }

  // Skills
  if (profile.skills.length) {
    body.push("## Skills");
    body.push(profile.skills.join(", "));
    body.push("");
  }

  // Education
  if (profile.education.length) {
    body.push("## Education");
    for (const e of profile.education) {
      const line = [
        [e.degree, e.field].filter(Boolean).join(" in "),
        e.institution,
        e.year,
      ]
        .filter(Boolean)
        .join(" — ");
      body.push(`- ${line}`);
    }
    body.push("");
  }

  // Credentials
  if (profile.credentials.length) {
    body.push("## Credentials");
    for (const c of profile.credentials) body.push(`- ${c}`);
    body.push("");
  }

  // Public work
  if (profile.publicWork.length) {
    body.push("## Public Work");
    for (const w of profile.publicWork) {
      const label = w.url ? `[${w.title}](${w.url})` : w.title;
      body.push(`- ${label}${w.date ? ` (${w.date})` : ""}`);
    }
    body.push("");
  }

  // Corroboration links
  if (profile.sameAs.length) {
    body.push("## Elsewhere");
    for (const s of profile.sameAs) body.push(`- ${s}`);
    body.push("");
  }

  return fm.join("\n") + "\n\n" + body.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function buildSummary(p: Profile): string {
  const bits: string[] = [];
  if (p.currentRole && p.currentCompany)
    bits.push(`${p.currentRole} at ${p.currentCompany}`);
  else if (p.currentRole) bits.push(p.currentRole);
  if (p.specialty) bits.push(`Focus: ${p.specialty}.`);
  if (p.claimedAchievement) bits.push(`${cap(p.claimedAchievement)}.`);
  return bits.join(". ").replace(/\.\./g, ".");
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// Minimal YAML string quoting — enough for the fields we emit.
function yaml(v: string): string {
  if (v === "") return '""';
  if (/[:#\-?\[\]{}&*!|>'"%@`]/.test(v) || /^\s|\s$/.test(v)) {
    return JSON.stringify(v);
  }
  return v;
}
