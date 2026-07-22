# The Mirror + resume.md

**See how you show up across AI assistants — then fix it.** A working prototype
of the loop that is the whole product:

> **see you're invisible/wrong in AI → understand why → generate the fix →
> re-measure and watch it change.**

The claim this product makes — and can prove in-product:

> **When an AI looks you up, we make sure it finds you, gets you right, and can
> back it up with sources.**

The claim it deliberately **never** makes: *“we make you rank #1 / guarantee you
show up when a recruiter asks for the best people.”* That depends on model
training and retrieval ranking we don't control. Every headline, tooltip, and
button in the app stays on the right side of that line.

---

## What it does

Two halves on one screen, sharing **one `Profile` object** as the single source
of truth:

### Half A — The Mirror
A comparative view of how AI answers questions about a candidate.
- **Preset question chips** grouped by intent (find me / get me right / my
  credibility / cite me) + a **custom question** input, all through one pipeline.
- **Four-column grid** — columns are a first-class concept. **Perplexity is the
  one live column**; ChatGPT / Claude / Gemini render as visibly-disabled
  “coming soon” placeholders (never faked).
- **Verdict strips** above each verbatim answer: `Named ✓ / Not found ✗ /
  Wrong person ⚠` + a source-count badge + evidence-quality, computed by a judge
  model. **Conflation is flagged explicitly** (highest-value signal).
- **Retrieval ON/OFF toggle** — the honesty mechanism:
  - **OFF** = “AI answering from memory” (best-effort; Sonar is always
    search-grounded, so we label it honestly rather than overclaim).
  - **ON** = “AI allowed to look you up” — the half your profile improves.
- **Caching** by `hash(slug + profileVersion + questionId + mode)` — re-runs are
  free until the profile is edited.

### Half B — The Fix (resume → resume.md)
- **Drop a resume** (PDF/DOCX) → server-side parse → **confirm/correct fields**
  (accuracy + consent).
- **Corroboration links** (`sameAs`) prompt — framed as highest-leverage.
- Generates three artifacts at a **real, fetchable URL**:
  1. **`resume.md`** — clean Markdown with YAML frontmatter (downloadable).
  2. **Hosted profile page** at `/{slug}` — server-rendered HTML with
     **schema.org `Person` JSON-LD embedded in the initial response** (no JS
     needed to read it).
  3. **`/{slug}/agent.json`** — the profile as clean structured JSON (the future
     MCP artifact; endpoint only).
- **The before/after**: re-runs the Mirror in look-you-up mode, pointing the
  model at the now-public page, and shows the change side by side.
- A **“How this works”** panel (Findable · Readable · Trusted) with an honest
  limit stated plainly.

---

## Quick start

```bash
npm install
npm run seed      # writes the example candidate + a captured before/after
npm run dev       # http://localhost:3000
```

With **no API keys**, the app runs in **demo mode**: it serves the seeded
example candidate (*Jane Okafor*) and a captured before/after, clearly labeled
`seeded demo data` — never passed off as a live call. Custom questions with no
key return an honest empty result (we never fabricate).

To go live, copy `.env.example` → `.env.local` and add keys (see below).

### Verify the hosted profile is machine-readable (no JS)

```bash
curl -s http://localhost:3000/jane-okafor | grep 'application/ld+json'   # JSON-LD present in raw HTML
curl -s http://localhost:3000/jane-okafor/agent.json                     # structured JSON
curl -s http://localhost:3000/robots.txt                                 # AI crawlers allowed
curl -s http://localhost:3000/llms.txt                                   # machine-readable orientation
```

---

## Environment (`.env.example`)

| Variable | Purpose |
| --- | --- |
| `PERPLEXITY_API_KEY` | The model queried in the Mirror. Only Perplexity is wired. |
| `PERPLEXITY_MODEL` | `sonar` (default) or `sonar-pro`. |
| `JUDGE_PROVIDER` | `anthropic` (default), `openai`, or `perplexity`. |
| `ANTHROPIC_API_KEY` / `JUDGE_API_KEY` / `OPENAI_API_KEY` | Judge model key for the chosen provider. |
| `JUDGE_MODEL` | Small model, temp 0 (e.g. `claude-haiku-4-5-20251001`, `gpt-4o-mini`). |
| `APP_URL` | Public origin of THIS app — the profile host. Set for a demo (see below). |

If no judge key is set, verdicts fall back to a **deterministic heuristic** and
are flagged best-effort in the UI. The Mirror needs `PERPLEXITY_API_KEY` for
live answers; otherwise it shows seeded data.

---

## How the before/after works (and why it's real)

The before/after only means anything if a model can actually **GET** the page:

1. **Before** = retrieval-ON with *no public page to find* → the model can't
   name the candidate (or conflates them). This is the void, shown honestly.
2. Generating the profile publishes `/{slug}` at your app's own public URL —
   server-rendered HTML + JSON-LD, permissive `robots.txt`, an `llms.txt`.
3. **After** = the same question, retrieval-ON, with the model pointed at the
   now-public URL. It **fetches the page and describes the candidate from it**,
   with the page as a cited source.

We only ever paste the **URL** (never the profile's contents) into the “after”
query, so what the model reports is genuinely what it retrieved. And we never
imply this changes the model's **memory** (retrieval-OFF) — only what it finds.

### Making the profile URL publicly fetchable for a demo

The app's own public URL **is** the profile host. In local dev the canonical URL
defaults to the request host. For a live demo where a real model must reach the
page:

- Deploy the app to a public URL, **or** expose `localhost:3000` via a tunnel
  (e.g. `cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`).
- Set `APP_URL=https://your-public-origin` (no trailing slash).
- Re-run `npm run seed` so the seeded before/after answers reference the right
  canonical URL.
- With a real `PERPLEXITY_API_KEY`, the “after” run then genuinely fetches the
  live page.

> **API vs consumer-app caveat:** the Perplexity **API** (Sonar) is a clean
> proxy for the recruiter experience, but it is not identical to the
> perplexity.ai consumer app — retrieval, indexing latency, and ranking differ,
> and a brand-new page may not yet be in any web index. Pointing the model at
> the URL demonstrates the *mechanism* (a fetchable, structured, correct page);
> real-world discovery via organic indexing takes time. Sonar is also always
> search-grounded, so retrieval-OFF is best-effort “memory mode,” labeled as
> such.

---

## Adding a candidate

1. Open **The Fix** tab, drop a PDF/DOCX (or “Enter manually”).
2. Correct the parsed fields, add corroboration links, add judge-only
   ground-truth notes.
3. **Generate profile & artifacts** → the page goes live at `/{slug}` and the
   before/after kicks off automatically.

Runtime candidates persist under `data/profiles/`; cached results under
`data/cache/`. The seeded example lives under `data/seed/` (committed).

---

## Adding more models later (the seam)

Columns are already a first-class concept. To add a model:

1. Implement the `ModelRunner` interface (`src/lib/runner.ts`):
   ```ts
   interface ModelRunner {
     id: ModelId; label: string; enabled: boolean;
     run(input: RunnerInput): Promise<RunnerOutput>;
   }
   ```
   (see `src/lib/perplexity.ts` for the reference implementation).
2. Flip `enabled: true` for that model in `COLUMN_MODELS` and route it in
   `src/lib/mirror.ts`.

The grid, verdict strips, caching, and before/after all work unchanged.

---

## Guardrails (baked in)

- **`groundTruthNotes` is judge-only** — never sent to Perplexity (it would
  contaminate the measurement).
- **Only the active candidate's own name is queried** — no querying random
  strangers (avoids the data-broker posture).
- **Never fabricate answers or backfill blanks** — a blank/wrong result is real
  and is the best sales case; the app shows the void.
- **Verbatim model output** in the grid — no paraphrasing.
- **Only attributable claims** get published in the generated profile.

---

## Clean seams — intentionally NOT built (per scope)

Interfaces / TODOs only, no implementations, for: **additional models**,
**monitoring/alerts**, **MCP / agent distribution** (the `agent.json` endpoint is
the seam), **verification / verified-claims**, and **pricing tiers**.

---

## Project layout

```
src/
  app/
    page.tsx                     # Mirror + Fix orchestrator (client)
    [slug]/page.tsx              # SSR hosted profile page (JSON-LD in initial HTML)
    [slug]/agent.json/route.ts   # structured JSON endpoint
    robots.txt/route.ts          # permissive, AI crawlers allowed
    llms.txt/route.ts            # machine-readable orientation
    api/
      parse-resume/  profile/  mirror/  generate/  resume-md/  status/
  lib/
    types.ts        # the shared Profile object + result types
    runner.ts       # ModelRunner interface + column registry (the seam)
    perplexity.ts   # the one live runner
    judge.ts        # provider-agnostic verdict scorer (+ heuristic fallback)
    mirror.ts       # resolve → run → judge → cache
    resumeParser.ts # PDF/DOCX → structured fields
    resumeMd.ts / jsonld.ts / agentJson.ts   # artifact generators
    store.ts        # file persistence (profiles + cache, seed fallback)
    questions.ts / copy.ts / slug.ts / appUrl.ts
  components/       # Mirror grid, verdict strips, toggle, chips, Fix flow, etc.
scripts/seed.ts     # example candidate + captured before/after
data/seed/          # committed seed profile + cache
```

**Tech:** Next.js (App Router) + TypeScript + Tailwind, single app, file/JSON
persistence. This is a prototype — it prioritizes a clickable, honest,
end-to-end demo over production hardening.
