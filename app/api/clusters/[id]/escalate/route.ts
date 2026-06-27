import { NextResponse } from "next/server";
import { findClusterWithReportsAndUsers } from "@/lib/db/clusters";
import { draftEscalationEmail } from "@/lib/gemini";
import { CATEGORY_LABELS, type Category } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cluster = await findClusterWithReportsAndUsers(id);
    if (!cluster) {
      return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
    }

    const representative = cluster.reports[0];
    const description = representative?.description || cluster.summary;
    const department = representative?.department || "Local Authorities";

    const emailDraft = await draftEscalationEmail({
      category: CATEGORY_LABELS[cluster.category as Category] ?? cluster.category,
      severity: cluster.severity,
      description,
      reportCount: cluster.reportCount,
      department,
    });

    return NextResponse.json(emailDraft, { status: 200 });
  } catch (error: any) {
    console.error("[escalate] Error drafting escalation:", error);
    return NextResponse.json(
      { error: error.message || "Failed to draft escalation" },
      { status: 500 }
    );
  }
}
