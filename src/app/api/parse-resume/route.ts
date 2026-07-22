import { NextRequest, NextResponse } from "next/server";
import { extractText, parseResumeText } from "@/lib/resumeParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// B2.1/B2.2: accept a dropped resume, parse to raw text, extract structured
// fields (best-effort). The response feeds the confirm/correct UI.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    const blob = file as File;
    const buffer = Buffer.from(await blob.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: "Empty file." }, { status: 400 });
    }
    if (buffer.length > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 8MB)." }, { status: 400 });
    }

    const text = await extractText(buffer, blob.name, blob.type);
    if (!text.trim()) {
      return NextResponse.json(
        {
          error:
            "Could not extract text from this file. If it's a scanned/image PDF, OCR is needed. Try a text-based PDF or DOCX, or fill fields manually.",
        },
        { status: 422 }
      );
    }
    const fields = parseResumeText(text);
    return NextResponse.json({ fields, rawTextPreview: text.slice(0, 2000) });
  } catch (e) {
    console.error("parse-resume error:", e);
    return NextResponse.json(
      { error: `Failed to parse resume: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
