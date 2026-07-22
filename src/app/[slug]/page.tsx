import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProfile } from "@/lib/store";
import { profileToJsonLd } from "@/lib/jsonld";
import { getAppUrl } from "@/lib/appUrl";

export const dynamic = "force-dynamic"; // always server-render fresh

// B4: The hosted profile page. FULLY server-rendered HTML with JSON-LD in the
// initial response (no client-only rendering) so a crawler/fetcher — or a model
// with browsing — sees the content and structured data without executing JS.
// This is the canonical thing on the open web for a model to fetch.

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await getProfile(params.slug);
  if (!profile) return { title: "Profile not found" };
  const desc = [profile.currentRole, profile.currentCompany]
    .filter(Boolean)
    .join(" at ");
  return {
    title: `${profile.name} — ${profile.currentRole}`,
    description: desc || profile.name,
    alternates: { canonical: `${getAppUrl()}/${profile.slug}` },
  };
}

export default async function ProfilePage({ params }: Props) {
  const profile = await getProfile(params.slug);
  if (!profile) notFound();

  const canonicalUrl = `${getAppUrl()}/${profile.slug}`;
  const jsonLd = profileToJsonLd(profile, canonicalUrl);

  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "48px 24px 96px",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        lineHeight: 1.55,
        color: "#1a1f28",
        background: "#fff",
        minHeight: "100vh",
      }}
    >
      {/* JSON-LD embedded in the initial HTML response — the machine view. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header style={{ borderBottom: "2px solid #eee", paddingBottom: 20, marginBottom: 24 }}>
        <h1 style={{ fontSize: 34, margin: 0, letterSpacing: -0.5 }}>{profile.name}</h1>
        <p style={{ fontSize: 18, color: "#3b4351", margin: "6px 0 0" }}>
          {[profile.currentRole, profile.currentCompany].filter(Boolean).join(" · ")}
        </p>
        <p style={{ color: "#6b7484", margin: "4px 0 0" }}>
          {[profile.location, profile.specialty].filter(Boolean).join(" — ")}
        </p>
        <p style={{ marginTop: 12 }}>
          <a href={`${canonicalUrl}/agent.json`} style={{ color: "#2b6ef2", fontSize: 14 }}>
            agent.json (machine-readable)
          </a>
        </p>
      </header>

      {profile.experience.length > 0 && (
        <Section title="Experience">
          {profile.experience.map((r, i) => (
            <div key={i} style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 600 }}>
                {[r.title, r.company].filter(Boolean).join(", ")}
                {(r.startDate || r.endDate) && (
                  <span style={{ color: "#8a92a1", fontWeight: 400 }}>
                    {"  "}
                    {[r.startDate, r.endDate].filter(Boolean).join("–")}
                  </span>
                )}
              </div>
              <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                {r.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </Section>
      )}

      {profile.skills.length > 0 && (
        <Section title="Skills">
          <p style={{ margin: 0 }}>{profile.skills.join(" · ")}</p>
        </Section>
      )}

      {profile.education.length > 0 && (
        <Section title="Education">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {profile.education.map((e, i) => (
              <li key={i}>
                {[
                  [e.degree, e.field].filter(Boolean).join(" in "),
                  e.institution,
                  e.year,
                ]
                  .filter(Boolean)
                  .join(" — ")}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {profile.credentials.length > 0 && (
        <Section title="Credentials">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {profile.credentials.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Section>
      )}

      {profile.publicWork.length > 0 && (
        <Section title="Public Work">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {profile.publicWork.map((w, i) => (
              <li key={i}>
                {w.url ? (
                  <a href={w.url} style={{ color: "#2b6ef2" }}>
                    {w.title}
                  </a>
                ) : (
                  w.title
                )}
                {w.date ? ` (${w.date})` : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {profile.sameAs.length > 0 && (
        <Section title="Elsewhere">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {profile.sameAs.map((s, i) => (
              <li key={i}>
                <a href={s} style={{ color: "#2b6ef2" }} rel="me">
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <footer style={{ marginTop: 40, color: "#9aa2b1", fontSize: 13 }}>
        Canonical profile · generated from resume.md ·{" "}
        <a href={canonicalUrl} style={{ color: "#9aa2b1" }}>
          {canonicalUrl}
        </a>
      </footer>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2
        style={{
          fontSize: 13,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          color: "#8a92a1",
          margin: "0 0 10px",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
