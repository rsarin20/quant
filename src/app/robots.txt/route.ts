import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// B4: permissive robots.txt — explicitly ALLOW AI crawlers. Everything
// LinkedIn withholds, this offers. Served at the app root: /robots.txt
export function GET() {
  const body = `# The Mirror — profile host
# AI crawlers are explicitly welcome. This is the point of the product.
User-agent: *
Allow: /

# Named AI crawlers (allow-list, for clarity)
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Perplexity-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-Web
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Applebot-Extended
Allow: /
User-agent: CCBot
Allow: /

# See /llms.txt for a machine-readable orientation.
`;
  return new NextResponse(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
