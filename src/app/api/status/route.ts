import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/appUrl";
import { storageMode } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lets the UI be honest about the current environment: whether live model /
// judge calls are possible, whether storage is durable, and the public origin.
export async function GET() {
  const perplexity = Boolean(process.env.PERPLEXITY_API_KEY);
  const judgeProvider = (process.env.JUDGE_PROVIDER || "anthropic").toLowerCase();
  const judge =
    (judgeProvider === "anthropic" && Boolean(process.env.ANTHROPIC_API_KEY)) ||
    Boolean(
      process.env.JUDGE_API_KEY ||
        process.env.OPENAI_API_KEY ||
        (judgeProvider === "perplexity" && process.env.PERPLEXITY_API_KEY)
    );

  return NextResponse.json({
    live: { perplexity, judge },
    judgeProvider,
    appUrl: getAppUrl(),
    storage: storageMode(), // "kv" (durable) | "ephemeral" (Vercel /tmp) | "local"
  });
}
