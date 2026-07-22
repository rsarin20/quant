import type { Profile } from "./types";

// ---------------------------------------------------------------------------
// B1/B3: JSON-LD (schema.org Person) generated from the SAME Profile object as
// the human-readable page, so the human and machine views can never drift.
// This is what kills conflation: the model reads facts as DATA, not inference.
// ---------------------------------------------------------------------------

export function profileToJsonLd(profile: Profile, canonicalUrl: string) {
  const worksFor = profile.currentCompany
    ? { "@type": "Organization", name: profile.currentCompany }
    : undefined;

  const alumniOf = profile.education.map((e) => ({
    "@type": "CollegeOrUniversity",
    name: e.institution,
  }));

  const hasCredential = profile.credentials.map((c) => ({
    "@type": "EducationalOccupationalCredential",
    name: c,
  }));

  const person: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    url: canonicalUrl,
    jobTitle: profile.currentRole,
    description: buildDescription(profile),
    knowsAbout: profile.skills,
  };

  if (worksFor) person.worksFor = worksFor;
  if (profile.location) person.homeLocation = { "@type": "Place", name: profile.location };
  if (alumniOf.length) person.alumniOf = alumniOf;
  if (hasCredential.length) person.hasCredential = hasCredential;
  if (profile.sameAs.length) person.sameAs = profile.sameAs;

  // Public work as subjectOf.
  if (profile.publicWork.length) {
    person.subjectOf = profile.publicWork.map((w) => ({
      "@type": w.kind === "writing" ? "Article" : "CreativeWork",
      name: w.title,
      url: w.url,
      ...(w.date ? { datePublished: w.date } : {}),
    }));
  }

  return person;
}

function buildDescription(p: Profile): string {
  const parts: string[] = [];
  if (p.currentRole && p.currentCompany)
    parts.push(`${p.currentRole} at ${p.currentCompany}`);
  else if (p.currentRole) parts.push(p.currentRole);
  if (p.specialty) parts.push(`specializing in ${p.specialty}`);
  if (p.location) parts.push(`based in ${p.location}`);
  return parts.join(", ") + (parts.length ? "." : "");
}
