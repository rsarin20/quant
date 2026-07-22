import type { Profile } from "./types";

// ---------------------------------------------------------------------------
// B4/B1.6: /{slug}/agent.json — the profile as clean, structured JSON.
// An agent-readable resume (the future MCP artifact — we just expose the
// endpoint now; no MCP distribution built, per scope).
//
// groundTruthNotes is judge-only and is deliberately NOT included here.
// ---------------------------------------------------------------------------

export function profileToAgentJson(profile: Profile, canonicalUrl: string) {
  return {
    schemaVersion: "1.0",
    canonical: canonicalUrl,
    generatedFrom: "resume.md",
    person: {
      name: profile.name,
      jobTitle: profile.currentRole,
      worksFor: profile.currentCompany || null,
      location: profile.location || null,
      domain: profile.domain || null,
      specialty: profile.specialty || null,
      knowsAbout: profile.skills,
      hasCredential: profile.credentials,
      alumniOf: profile.education.map((e) => ({
        institution: e.institution,
        degree: e.degree,
        field: e.field,
        year: e.year,
      })),
      experience: profile.experience.map((r) => ({
        title: r.title,
        company: r.company,
        start: r.startDate,
        end: r.endDate,
        highlights: r.bullets,
      })),
      publicWork: profile.publicWork,
      sameAs: profile.sameAs,
    },
    meta: {
      version: profile.version,
      createdAt: profile.createdAt,
    },
  };
}
