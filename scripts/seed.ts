// Seed one example candidate + a captured before/after, so the demo is
// reproducible even with no API keys. Seeded results are clearly flagged
// (seeded:true, live:false) so the UI never passes them off as live calls.
//
// Run: npm run seed
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

type Mode = "off" | "on";

const SEED_DIR = path.join(process.cwd(), "data", "seed");
const SEED_CACHE = path.join(SEED_DIR, "cache");

function cacheKey(slug: string, version: number, questionId: string, mode: Mode) {
  return crypto
    .createHash("sha256")
    .update(`${slug}::${version}::${questionId}::${mode}`)
    .digest("hex")
    .slice(0, 32);
}

const SLUG = "jane-okafor";
const VERSION = 1;
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const CANONICAL = `${APP_URL}/${SLUG}`;

const profile = {
  slug: SLUG,
  name: "Jane Okafor",
  currentRole: "Senior Product Manager",
  currentCompany: "Northwind Payments",
  location: "London, UK",
  domain: "payments / fintech PM",
  specialty: "real-time payments fraud systems",
  targetRole: "Director of Product, Risk",
  claimedAchievement: "cut real-time payments fraud losses by 40%",
  experience: [
    {
      title: "Senior Product Manager",
      company: "Northwind Payments",
      startDate: "2021",
      endDate: "Present",
      bullets: [
        "Led the real-time fraud scoring platform from 120ms → 45ms p99 latency, 2023",
        "Cut fraud losses 40% year-over-year by shipping a graph-based mule-account detector, 2023",
        "Owned the Faster Payments risk roadmap across a team of 9 engineers and 2 data scientists",
      ],
    },
    {
      title: "Product Manager",
      company: "Monzo",
      startDate: "2018",
      endDate: "2021",
      bullets: [
        "Shipped transaction-risk decisioning covering 4M+ accounts",
        "Reduced false-positive card declines 22% while holding fraud flat, 2020",
      ],
    },
  ],
  education: [
    { institution: "Imperial College London", degree: "MEng", field: "Computing", year: "2015" },
  ],
  skills: [
    "real-time payments",
    "fraud detection",
    "risk decisioning",
    "product management",
    "SQL",
    "experimentation",
    "graph analytics",
  ],
  credentials: ["ACAMS (Certified Anti-Money Laundering Specialist)"],
  publicWork: [
    {
      kind: "talk" as const,
      title: "Sub-50ms fraud scoring for instant payments (Money20/20 Europe)",
      url: "https://example.com/talks/m2020-jane-okafor",
      date: "2023",
    },
    {
      kind: "writing" as const,
      title: "Why graph features beat rules for mule detection",
      url: "https://example.com/blog/graph-mule-detection",
      date: "2022",
    },
  ],
  sameAs: [
    "https://github.com/janeokafor",
    "https://www.linkedin.com/in/jane-okafor-payments",
    "https://janeokafor.dev",
  ],
  groundTruthNotes:
    "Jane Okafor is a payments/fintech Senior PM in London (Northwind Payments, formerly Monzo), specializing in real-time payments fraud. NOT the cardiologist Dr. Jane Okafor in Lagos, and NOT the amateur footballer of the same name. Her signature result is a 40% cut in real-time payments fraud losses in 2023.",
  createdAt: "2026-01-01T00:00:00.000Z",
  version: VERSION,
};

// ---- seeded answers per question -----------------------------------------

type Seed = {
  qid: string;
  offAnswer: string;
  beforeAnswer: string;
  beforeSources: string[];
  afterAnswer: string;
  afterSources: string[];
  afterConflation?: boolean;
};

const G = "https://github.com/janeokafor";
const SITE = "https://janeokafor.dev";

const seeds: Seed[] = [
  {
    qid: "disc_recruiter",
    offAnswer:
      "I don't have reliable, specific information about individual senior product managers in London from memory, and I won't guess at names — doing so risks inventing or misattributing people.",
    beforeAnswer:
      "I couldn't find a clearly identifiable person by name for this. There are many product managers in London working in payments, but I don't have a specific, well-sourced individual to recommend.",
    beforeSources: [],
    afterAnswer:
      "One strong match is Jane Okafor, a Senior Product Manager at Northwind Payments in London focused on real-time payments fraud. Her public profile lists leading a fraud-scoring platform to sub-50ms latency and a 40% reduction in fraud losses in 2023.",
    afterSources: [CANONICAL, SITE],
  },
  {
    qid: "disc_specialty",
    offAnswer:
      "From memory I can describe the field of real-time payments fraud systems, but I can't reliably attribute it to specific named individuals without a source.",
    beforeAnswer:
      "I can describe the area, but I don't have specific named people I can confidently attribute to real-time payments fraud systems.",
    beforeSources: [],
    afterAnswer:
      "Jane Okafor is known for work in real-time payments fraud systems — her profile documents a graph-based mule-account detector and sub-50ms fraud scoring for instant payments, presented at Money20/20 Europe (2023).",
    afterSources: [CANONICAL, "https://example.com/talks/m2020-jane-okafor"],
  },
  {
    qid: "disc_achievement",
    offAnswer:
      "I don't have a specific, verifiable person in memory associated with cutting real-time payments fraud losses by 40%, so I won't attribute it to anyone.",
    beforeAnswer:
      "I couldn't find a clearly sourced person credited with this specific achievement.",
    beforeSources: [],
    afterAnswer:
      "Jane Okafor, Senior PM at Northwind Payments, is credited with cutting real-time payments fraud losses by roughly 40% in 2023 via a graph-based mule-account detector, according to her profile and a related write-up.",
    afterSources: [CANONICAL, "https://example.com/blog/graph-mule-detection"],
  },
  {
    qid: "acc_aboutdomain",
    offAnswer:
      "I'm not confident I have accurate memorized details about a specific Jane Okafor in payments/fintech, so I'd rather not risk describing the wrong person.",
    beforeAnswer:
      "There appear to be several people named Jane Okafor. Without a specific source I can't be sure which one works in payments/fintech in London, so I can't give reliable details.",
    beforeSources: [],
    afterAnswer:
      "Jane Okafor is a Senior Product Manager at Northwind Payments in London, working on real-time payments fraud systems. Previously a PM at Monzo. She holds an MEng in Computing from Imperial College London and an ACAMS certification.",
    afterSources: [CANONICAL, `${CANONICAL}/agent.json`],
  },
  {
    qid: "acc_background",
    offAnswer:
      "I don't have reliable memorized biographical details for this specific person and won't fabricate a background.",
    beforeAnswer:
      "I found mentions that could refer to more than one Jane Okafor and can't confidently separate them, so I can't give a trustworthy background.",
    beforeSources: [],
    afterAnswer:
      "Per her public profile: Senior Product Manager at Northwind Payments (2021–present), previously Product Manager at Monzo (2018–2021). Focus on real-time payments fraud and risk decisioning. MEng Computing, Imperial College London (2015). Spoke at Money20/20 Europe (2023).",
    afterSources: [CANONICAL, G],
  },
];

function verdict(named: boolean, correct: boolean, sources: string[], quality: string) {
  return {
    candidate_named: named,
    identity_correct: correct,
    conflated_with_other_person: false,
    conflation_detail: "",
    source_count: sources.length,
    sources,
    evidence_quality: quality,
  };
}

function result(qid: string, mode: Mode, phase: "before" | "after", answer: string, sources: string[]) {
  const named = phase === "after";
  return {
    model: "perplexity",
    mode,
    questionId: `${qid}:${phase}`,
    questionText: "(seeded)",
    answer,
    sources: sources.map((url) => ({ url })),
    verdict: named
      ? verdict(true, true, sources, sources.length >= 2 ? "moderate" : "thin")
      : verdict(false, false, sources, "none"),
    measuredAt: "2026-01-02T10:00:00.000Z",
    seeded: true,
    live: false,
    degraded: mode === "off",
    degradedReason:
      mode === "off"
        ? "Seeded example of best-effort memory mode. Sonar is always search-grounded; retrieval can't be fully disabled via the API."
        : undefined,
  };
}

async function main() {
  await fs.mkdir(SEED_CACHE, { recursive: true });
  await fs.writeFile(
    path.join(SEED_DIR, `${SLUG}.json`),
    JSON.stringify(profile, null, 2),
    "utf8"
  );

  let count = 0;
  for (const s of seeds) {
    // OFF (memory) — phase "before"
    await write(cacheKey(SLUG, VERSION, `${s.qid}:before`, "off"), result(s.qid, "off", "before", s.offAnswer, []));
    // ON before — phase "before"
    await write(cacheKey(SLUG, VERSION, `${s.qid}:before`, "on"), result(s.qid, "on", "before", s.beforeAnswer, s.beforeSources));
    // ON after — phase "after"
    await write(cacheKey(SLUG, VERSION, `${s.qid}:after`, "on"), result(s.qid, "on", "after", s.afterAnswer, s.afterSources));
    count += 3;
  }
  console.log(`Seeded profile ${SLUG} + ${count} cached results into data/seed/`);
  console.log(`Canonical URL baked into seed answers: ${CANONICAL}`);
  console.log(`(If your public URL differs, set APP_URL and re-run npm run seed.)`);
}

async function write(key: string, value: unknown) {
  await fs.writeFile(path.join(SEED_CACHE, `${key}.json`), JSON.stringify(value, null, 2), "utf8");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
