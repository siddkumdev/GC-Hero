import { NextResponse } from "next/server";
import { findClusterWithReportsAndUsers } from "@/lib/db/clusters";
import { generateActionPlan } from "@/lib/gemini";
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

    const actionPlan = await generateActionPlan({
      category: CATEGORY_LABELS[cluster.category as Category] ?? cluster.category,
      severity: cluster.severity,
      description,
      reportCount: cluster.reportCount,
    });

    return NextResponse.json({ actionPlan }, { status: 200 });
  } catch (error: any) {
    console.error("[action-plan] Error generating action plan:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate action plan" },
      { status: 500 }
    );
  }
}
