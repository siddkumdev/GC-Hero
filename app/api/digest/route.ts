import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getDigest } from "@/lib/digest";
import { GeminiOverloadedError } from "@/lib/gemini";
import type { DigestResponseDTO } from "@/lib/types";

export const runtime = "nodejs";

// F3 — AI community digest. Stats computed in our code; Gemini writes the insight; result cached
// per data-signature (see lib/digest.ts) so this is cheap on repeated dashboard loads.
// `?refresh=1` forces a regeneration (the card's refresh button).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const force = new URL(req.url).searchParams.get("refresh") === "1";

  try {
    const { text, stats, generatedAt, cached } = await getDigest(force);
    const payload: DigestResponseDTO = {
      digest: text,
      generatedAt: new Date(generatedAt).toISOString(),
      cached,
      stats: {
        totalIssues: stats.totalIssues,
        totalReports: stats.totalReports,
        resolvedCount: stats.resolvedCount,
      },
    };
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    if (err instanceof GeminiOverloadedError) {
      return NextResponse.json({ error: err.message, retryable: true }, { status: 503 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't generate the digest." },
      { status: 502 },
    );
  }
}
