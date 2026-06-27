import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import {
  recordVerification,
  AlreadyCorroboratedError,
  ClusterNotFoundError,
} from "@/lib/verification";

export const runtime = "nodejs";

// F4 — community verification ("I see this too"). One-tap corroboration of an existing issue
// without filing a full report. No Gemini, no upload — pure system layer. The DB unique
// (clusterId, userId) plus the reporter check in recordVerification enforce one corroboration
// per citizen per issue, so the credibility signal can't be inflated.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await recordVerification(id, user.id);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ClusterNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof AlreadyCorroboratedError) {
      // 409 Conflict — the citizen already corroborated (reported or verified) this issue.
      return NextResponse.json({ error: err.message, state: err.state }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't record your confirmation." },
      { status: 500 },
    );
  }
}
