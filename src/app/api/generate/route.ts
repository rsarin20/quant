import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/store";
import { generateResumeMd } from "@/lib/resumeMd";
import { profileToJsonLd } from "@/lib/jsonld";
import { profileToAgentJson } from "@/lib/agentJson";
import { getAppUrl } from "@/lib/appUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// B2.4: return the three generated artifacts for preview/download. The hosted
// page and agent.json are ALSO served live at /{slug} and /{slug}/agent.json —
// this endpoint just packages them for the UI (resume.md download + previews).
export async function POST(req: NextRequest) {
  const { slug } = (await req.json()) as { slug: string };
  const profile = await getProfile(slug);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const appUrl = getAppUrl();
  const canonicalUrl = `${appUrl}/${profile.slug}`;

  const resumeMd = generateResumeMd(profile, canonicalUrl);
  const jsonLd = profileToJsonLd(profile, canonicalUrl);
  const agentJson = profileToAgentJson(profile, canonicalUrl);

  return NextResponse.json({
    canonicalUrl,
    agentJsonUrl: `${canonicalUrl}/agent.json`,
    resumeMd,
    jsonLd,
    agentJson,
  });
}
