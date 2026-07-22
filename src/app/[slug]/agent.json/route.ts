import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/store";
import { profileToAgentJson } from "@/lib/agentJson";
import { getAppUrl } from "@/lib/appUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// B1.6/B4: /{slug}/agent.json — the profile as clean structured JSON.
// An agent-readable resume (future MCP artifact; endpoint only for now).
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const profile = await getProfile(params.slug);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  const canonicalUrl = `${getAppUrl()}/${profile.slug}`;
  const body = profileToAgentJson(profile, canonicalUrl);
  return NextResponse.json(body, {
    headers: {
      "Access-Control-Allow-Origin": "*", // agents/crawlers may fetch cross-origin
      "Cache-Control": "public, max-age=60",
    },
  });
}
