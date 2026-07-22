import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/store";
import { runMirrorQuestion } from "@/lib/mirror";
import { PRESET_QUESTIONS } from "@/lib/questions";
import type { Mode } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mirror
// body: { slug, questionId, mode, customText?, force? }
// Runs ONE question through the live Perplexity column + judge, with caching.
//
// GUARDRAIL: we only ever query the ACTIVE candidate's own profile. There is no
// endpoint to query arbitrary strangers — that would reintroduce the
// data-broker posture the product avoids. Custom questions run against the same
// single profile.
export async function POST(req: NextRequest) {
  try {
    const { slug, questionId, mode, customText, force, contextUrl } =
      (await req.json()) as {
        slug: string;
        questionId: string;
        mode: Mode;
        customText?: string;
        force?: boolean;
        contextUrl?: string;
      };

    const profile = await getProfile(slug);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    let template: string;
    let qId = questionId;
    if (questionId === "custom") {
      if (!customText || !customText.trim()) {
        return NextResponse.json(
          { error: "Custom question text required." },
          { status: 400 }
        );
      }
      template = customText.trim();
      // Cache key varies with the custom text so different questions don't collide.
      qId = "custom:" + hash(customText.trim());
    } else {
      const preset = PRESET_QUESTIONS.find((q) => q.id === questionId);
      if (!preset) {
        return NextResponse.json({ error: "Unknown question." }, { status: 400 });
      }
      template = preset.template;
    }

    const result = await runMirrorQuestion(profile, qId, template, mode, {
      force: Boolean(force),
      contextUrl: contextUrl?.trim() || undefined,
    });
    return NextResponse.json({ result });
  } catch (e) {
    return NextResponse.json(
      { error: `Mirror run failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
