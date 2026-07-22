// ---------------------------------------------------------------------------
// Shared data model. ONE Profile object is the single source of truth: it powers
// the Mirror's questions AND the resume.md / hosted-profile generation.
// ---------------------------------------------------------------------------

export type Role = {
  title: string;
  company: string;
  startDate: string; // "2021" or "2021-03"
  endDate: string; // "2024" or "Present"
  bullets: string[]; // atomic, dated where possible: "Led X→Y, −40% latency, 2023"
};

export type Education = {
  institution: string;
  degree: string;
  field: string;
  year: string;
};

export type PublicItem = {
  kind: "talk" | "writing" | "oss" | "other";
  title: string;
  url: string;
  date: string;
};

export type Profile = {
  slug: string; // url-safe, e.g. "jane-okafor"
  name: string;
  currentRole: string;
  currentCompany: string;
  location: string;
  domain: string; // "payments / fintech PM"
  specialty: string; // "real-time payments fraud systems"
  targetRole: string;
  claimedAchievement: string;
  experience: Role[]; // parsed from resume
  education: Education[];
  skills: string[]; // -> knowsAbout
  credentials: string[];
  publicWork: PublicItem[]; // talks, writing, OSS
  sameAs: string[]; // GitHub, ORCID, personal site, X, talk URLs
  groundTruthNotes: string; // judge-only; NEVER sent to Perplexity
  createdAt: string;
  version: number; // bump when edited; cache key component
};

// The retrieval mode is the honesty mechanism + the before/after engine.
export type Mode = "off" | "on";

// One of the four columns in the comparative grid. Only "perplexity" is live.
export type ModelId = "perplexity" | "chatgpt" | "claude" | "gemini";

export type EvidenceQuality = "none" | "thin" | "moderate" | "strong";

// Judge output for a single answer.
export type Verdict = {
  candidate_named: boolean;
  identity_correct: boolean;
  conflated_with_other_person: boolean;
  conflation_detail: string;
  source_count: number;
  sources: string[];
  evidence_quality: EvidenceQuality;
};

// A source as returned by the model runner.
export type SourceRef = {
  url: string;
  title?: string;
};

// The full result of running one question through one model in one mode.
export type MirrorResult = {
  model: ModelId;
  mode: Mode;
  questionId: string;
  questionText: string;
  answer: string; // verbatim model output — NEVER paraphrased
  sources: SourceRef[];
  verdict: Verdict | null;
  measuredAt: string;
  // Provenance flags so the UI can be honest about where data came from.
  seeded: boolean; // pre-baked demo data, not a live call
  live: boolean; // an actual API call was made this run
  degraded: boolean; // best-effort (e.g. memory mode the API can't fully enforce)
  degradedReason?: string;
  error?: string;
};

export type Question = {
  id: string;
  intent: "discovery" | "accuracy" | "assessment" | "sourcing";
  // Template with {field} placeholders resolved against the Profile.
  template: string;
  // Whether this is one of the prototype's "must implement" questions.
  core: boolean;
};
