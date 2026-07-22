import { NextRequest, NextResponse } from "next/server";
import { getProfile, saveProfile, listProfiles } from "@/lib/store";
import { slugify } from "@/lib/slug";
import type { Profile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY: Profile = {
  slug: "",
  name: "",
  currentRole: "",
  currentCompany: "",
  location: "",
  domain: "",
  specialty: "",
  targetRole: "",
  claimedAchievement: "",
  experience: [],
  education: [],
  skills: [],
  credentials: [],
  publicWork: [],
  sameAs: [],
  groundTruthNotes: "",
  createdAt: "",
  version: 1,
};

// GET /api/profile            -> list all profiles (seed + runtime)
// GET /api/profile?slug=...    -> one profile
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (slug) {
    const p = await getProfile(slug);
    if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ profile: p });
  }
  const all = await listProfiles();
  return NextResponse.json({ profiles: all });
}

// POST /api/profile  -> create/update. Bumps version when content changes so
// cached Mirror results invalidate (cache key includes version).
export async function POST(req: NextRequest) {
  try {
    const incoming = (await req.json()) as Partial<Profile>;
    if (!incoming.name || !incoming.name.trim()) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    const slug = (incoming.slug && incoming.slug.trim()) || slugify(incoming.name);

    const existing = await getProfile(slug);
    const merged: Profile = { ...EMPTY, ...(existing || {}), ...incoming, slug };

    if (existing) {
      // Bump version only if judge/mirror-relevant content actually changed.
      const before = fingerprint(existing);
      const after = fingerprint(merged);
      merged.version = before === after ? existing.version : existing.version + 1;
      merged.createdAt = existing.createdAt || new Date().toISOString();
    } else {
      merged.version = 1;
      merged.createdAt = new Date().toISOString();
    }

    await saveProfile(merged);
    return NextResponse.json({ profile: merged });
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to save profile: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}

// Content fields that affect what the Mirror measures. Editing these bumps the
// version and invalidates the cache.
function fingerprint(p: Profile): string {
  return JSON.stringify({
    name: p.name,
    currentRole: p.currentRole,
    currentCompany: p.currentCompany,
    location: p.location,
    domain: p.domain,
    specialty: p.specialty,
    targetRole: p.targetRole,
    claimedAchievement: p.claimedAchievement,
    experience: p.experience,
    education: p.education,
    skills: p.skills,
    credentials: p.credentials,
    publicWork: p.publicWork,
    sameAs: p.sameAs,
    groundTruthNotes: p.groundTruthNotes,
  });
}
