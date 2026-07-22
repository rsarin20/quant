import type { Profile, Role, Education, PublicItem } from "./types";
import { slugify } from "./slug";

// ---------------------------------------------------------------------------
// B2.1: Parse a resume (PDF/DOCX) to raw text, then heuristically extract
// structured fields. Parsing is imperfect BY DESIGN here — the output is shown
// in a confirm/correct UI (B2.2) which is both accuracy and consent. We never
// fabricate: unknown fields are left blank for the human to fill.
// ---------------------------------------------------------------------------

export async function extractText(
  buffer: Buffer,
  filename: string,
  mimetype: string
): Promise<string> {
  const isPdf = mimetype.includes("pdf") || filename.toLowerCase().endsWith(".pdf");
  const isDocx =
    mimetype.includes("word") ||
    mimetype.includes("officedocument") ||
    filename.toLowerCase().endsWith(".docx");

  if (isPdf) {
    // Import lazily; pdf-parse touches the FS at module load in some setups.
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (isDocx) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }
  // Fallback: treat as plain text.
  return buffer.toString("utf8");
}

const SECTION_HEADERS: Record<string, RegExp> = {
  experience:
    /^(work\s+)?(experience|employment|professional\s+experience|work\s+history)\b/i,
  education: /^education\b/i,
  skills: /^(skills|technical\s+skills|core\s+competencies|technologies)\b/i,
  credentials: /^(certifications?|credentials?|licenses?|awards?)\b/i,
  publications: /^(publications?|talks?|writing|projects?|public\s+work|open\s+source)\b/i,
  summary: /^(summary|profile|about|objective)\b/i,
};

export function parseResumeText(text: string): Partial<Profile> {
  const rawLines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\t/g, " ").trim());
  const lines = rawLines.filter((l) => l.length > 0);

  const links = extractLinks(text);

  // Name: usually the first short, capitalized, non-contact line.
  let name = "";
  for (const l of lines.slice(0, 8)) {
    if (/@|https?:|\d{3}/.test(l)) continue;
    const words = l.split(/\s+/);
    if (words.length >= 1 && words.length <= 5 && /[A-Za-z]/.test(l) && l.length < 60) {
      name = l.replace(/[|,•].*$/, "").trim();
      break;
    }
  }

  // Location: look for "City, ST" or "City, Country" near the top. Scan line by
  // line (never across a newline) and skip the name line itself.
  let location = "";
  for (const l of lines.slice(0, 12)) {
    if (l === name) continue;
    const m = l.match(
      /\b([A-Z][a-zA-Z.]+(?:[ \t][A-Z][a-zA-Z.]+)*),[ \t]*([A-Z]{2}|[A-Z][a-zA-Z]+)\b/
    );
    if (m) {
      location = m[0];
      break;
    }
  }

  // Split into sections.
  const sections = splitSections(lines);

  const experience = parseExperience(sections.experience || []);
  const education = parseEducation(sections.education || []);
  const skills = parseSkills(sections.skills || []);
  const credentials = (sections.credentials || []).filter((l) => l.length > 2);
  const publicWork = parsePublic(sections.publications || [], links);

  // Derive helper fields from the strongest signals we have.
  const currentRole = experience[0]?.title || "";
  const currentCompany = experience[0]?.company || "";

  return {
    name,
    currentRole,
    currentCompany,
    location,
    experience,
    education,
    skills,
    credentials,
    publicWork,
    sameAs: links,
    // Fields the human should confirm/fill — left blank, never invented.
    domain: "",
    specialty: "",
    targetRole: "",
    claimedAchievement: experience[0]?.bullets?.[0] || "",
    groundTruthNotes: "",
    slug: name ? slugify(name) : "",
  } as Partial<Profile>;
}

// ------------------------------- helpers -----------------------------------

function firstMatch(text: string, re: RegExp): string | undefined {
  const m = text.match(re);
  return m ? m[0] : undefined;
}

function extractLinks(text: string): string[] {
  const urls = new Set<string>();
  const re = /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s)]*)?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let u = m[1];
    if (/@/.test(u)) continue; // email fragment
    if (!/^https?:\/\//.test(u)) u = "https://" + u;
    // keep only plausible profile/portfolio links
    if (/(github|gitlab|linkedin|orcid|medium|substack|twitter|x\.com|dev\.to|behance|dribbble|youtube|scholar|\.io|\.dev|\.me|\.com|\.org|\.net)/i.test(u)) {
      urls.add(u.replace(/[.,);]+$/, ""));
    }
  }
  return [...urls].slice(0, 12);
}

function splitSections(lines: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  let current = "header";
  out[current] = [];
  for (const line of lines) {
    let matched: string | null = null;
    for (const [key, re] of Object.entries(SECTION_HEADERS)) {
      if (re.test(line) && line.length < 40) {
        matched = key;
        break;
      }
    }
    if (matched) {
      current = matched;
      if (!out[current]) out[current] = [];
      continue;
    }
    (out[current] ||= []).push(line);
  }
  return out;
}

const DATE_RE =
  /\b(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?((?:19|20)\d{2})\b|\bPresent\b|\bCurrent\b/gi;

function parseExperience(lines: string[]): Role[] {
  const roles: Role[] = [];
  let currentRole: Role | null = null;

  for (const line of lines) {
    const dates = line.match(DATE_RE);
    const isBullet = /^[•\-*·▪◦]/.test(line);
    const looksLikeHeader =
      !isBullet &&
      (dates?.length || / at | – | — |,\s*[A-Z]/.test(line)) &&
      line.length < 120;

    if (looksLikeHeader && !isBullet) {
      if (currentRole) roles.push(currentRole);
      const { title, company } = splitTitleCompany(line);
      const dl = [...line.matchAll(DATE_RE)].map((m) => m[0]);
      currentRole = {
        title,
        company,
        startDate: dl[0] || "",
        endDate: dl[1] || (/(present|current)/i.test(line) ? "Present" : ""),
        bullets: [],
      };
    } else if (currentRole) {
      const clean = line.replace(/^[•\-*·▪◦]\s*/, "").trim();
      if (clean.length > 3) currentRole.bullets.push(clean);
    }
  }
  if (currentRole) roles.push(currentRole);
  return roles.slice(0, 8);
}

function splitTitleCompany(line: string): { title: string; company: string } {
  const cleaned = line.replace(DATE_RE, "").replace(/\s{2,}/g, " ").trim().replace(/[|]/g, ",");
  // Common separators: " at ", " – ", " — ", ", "
  let parts: string[] = [];
  if (/\sat\s/i.test(cleaned)) parts = cleaned.split(/\sat\s/i);
  else if (/\s[–—-]\s/.test(cleaned)) parts = cleaned.split(/\s[–—-]\s/);
  else if (/,/.test(cleaned)) parts = cleaned.split(",");
  else parts = [cleaned];
  const title = (parts[0] || "").trim().replace(/[,–—-]+$/, "");
  const company = (parts[1] || "").trim().replace(/[,–—-]+$/, "");
  return { title, company };
}

function parseEducation(lines: string[]): Education[] {
  const out: Education[] = [];
  for (const line of lines) {
    if (line.length < 4) continue;
    const year = (line.match(/\b(19|20)\d{2}\b/) || [])[0] || "";
    const degreeMatch = line.match(
      /\b(B\.?S\.?|B\.?A\.?|M\.?S\.?|M\.?A\.?|MBA|Ph\.?D\.?|Bachelor|Master|Doctor)[a-zA-Z.]*/i
    );
    const degree = degreeMatch ? degreeMatch[0] : "";
    // Institution: portion with University/College/Institute/School.
    const instMatch = line.match(/([A-Z][\w.&]*(?:\s+[A-Z][\w.&]*)*\s+(?:University|College|Institute|School))/);
    const institution = instMatch ? instMatch[0] : line.replace(DATE_RE, "").trim();
    out.push({ institution, degree, field: "", year });
  }
  return out.slice(0, 5);
}

function parseSkills(lines: string[]): string[] {
  const joined = lines.join(", ");
  return joined
    .split(/[,•·|/\n]+/)
    .map((s) => s.replace(/^[\s-]+|[\s-]+$/g, ""))
    .filter((s) => s.length >= 2 && s.length <= 40)
    .slice(0, 40);
}

function parsePublic(lines: string[], links: string[]): PublicItem[] {
  const out: PublicItem[] = [];
  for (const line of lines) {
    if (line.length < 4) continue;
    const urlInLine = line.match(/https?:\/\/\S+/)?.[0];
    out.push({
      kind: /talk|conference|keynote|spoke/i.test(line)
        ? "talk"
        : /github|open.?source/i.test(line)
        ? "oss"
        : /blog|article|wrote|medium|substack/i.test(line)
        ? "writing"
        : "other",
      title: line.replace(/https?:\/\/\S+/, "").replace(/^[•\-*·]\s*/, "").trim().slice(0, 120),
      url: urlInLine || "",
      date: (line.match(/\b(19|20)\d{2}\b/) || [])[0] || "",
    });
  }
  return out.slice(0, 8);
}
