// ---------------------------------------------------------------------------
// Centralized UI copy. The positioning guardrail lives here so every headline,
// tooltip, and button stays on the right side of the line.
//
// CLAIM WE MAKE:  "When an AI looks you up, we make sure it finds you, gets you
//                  right, and can back it up with sources."
// CLAIM WE NEVER MAKE: "We make you rank #1 / guarantee you show up when a
//                  recruiter asks for the best people."
// ---------------------------------------------------------------------------

export const COPY = {
  productName: "The Mirror",
  tagline:
    "When an AI looks you up, we make sure it finds you, gets you right, and can back it up with sources.",
  // The line we never cross — kept here as a documented guardrail.
  neverClaim:
    "We do NOT promise you'll rank #1 or show up when a recruiter asks for “the best” people. That depends on model training and ranking we don't control.",

  mirror: {
    title: "The Mirror",
    subtitle: "How you show up across AI assistants, right now.",
  },

  retrieval: {
    off: {
      label: "AI answering from memory",
      help: "What the AI has memorized. Hard to change quickly — your profile does NOT rewrite the model's memory.",
    },
    on: {
      label: "AI allowed to look you up",
      help: "What the AI finds when it can search. This is the half your profile improves.",
    },
  },

  fix: {
    title: "The Fix — resume → resume.md",
    subtitle:
      "Turn your resume into a public, machine-readable profile an AI can actually fetch, read, and cite.",
    honestLimit:
      "This improves what AI finds when it looks you up (retrieval ON). It does little for what the model has memorized (retrieval OFF) — and we don't claim otherwise.",
  },

  howItWorks: {
    findable: {
      title: "Findable",
      body: "A stable public URL an AI can actually reach. Your resume on a laptop, or behind a LinkedIn login, is invisible to retrieval.",
    },
    readable: {
      title: "Readable",
      body: "Server-rendered HTML with embedded schema.org JSON-LD. The model reads your facts as data, not by guessing from prose. This is what kills conflation.",
    },
    trusted: {
      title: "Trusted",
      body: "Corroboration links (sameAs) to your real work. One source becomes several agreeing sources — what moves a model from “unsure” to naming you.",
    },
  },
} as const;
