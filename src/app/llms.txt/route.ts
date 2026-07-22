import { NextResponse } from "next/server";
import { listProfiles } from "@/lib/store";
import { getAppUrl } from "@/lib/appUrl";

export const dynamic = "force-dynamic";

// B4: llms.txt at the app root. A short, machine-readable orientation pointing
// crawlers/agents at the canonical profile pages and their agent.json endpoints.
export async function GET() {
  const appUrl = getAppUrl();
  const profiles = await listProfiles();
  const lines: string[] = [];
  lines.push("# The Mirror — machine-readable profile host");
  lines.push("");
  lines.push(
    "> Canonical, structured professional profiles. Each profile page embeds"
  );
  lines.push(
    "> schema.org/Person JSON-LD and exposes an agent.json endpoint. Facts are"
  );
  lines.push("> atomic and dated. Corroboration links are provided via sameAs.");
  lines.push("");
  lines.push("## Profiles");
  if (profiles.length === 0) {
    lines.push("- (none published yet)");
  } else {
    for (const p of profiles) {
      const url = `${appUrl}/${p.slug}`;
      const who = [p.currentRole, p.currentCompany].filter(Boolean).join(" at ");
      lines.push(`- [${p.name}${who ? " — " + who : ""}](${url}) · agent.json: ${url}/agent.json`);
    }
  }
  lines.push("");
  return new NextResponse(lines.join("\n") + "\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
