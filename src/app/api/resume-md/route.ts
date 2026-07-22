import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/store";
import { generateResumeMd } from "@/lib/resumeMd";
import { getAppUrl } from "@/lib/appUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Downloadable resume.md
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  const profile = await getProfile(slug);
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const md = generateResumeMd(profile, `${getAppUrl()}/${profile.slug}`);
  return new NextResponse(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${profile.slug}.resume.md"`,
    },
  });
}
