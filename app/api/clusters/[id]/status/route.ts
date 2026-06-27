import { NextResponse } from "next/server";
import { z } from "zod";
import { updateCluster } from "@/lib/db/clusters";
import { getCurrentUser } from "@/lib/session";
import { STATUSES } from "@/lib/config";

// Simulated municipal status lifecycle (stub for real municipal-API integration).
const bodySchema = z.object({ status: z.enum(STATUSES) });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  // Migrated from Prisma — 2026-06-24
  const cluster = await updateCluster(id, { status: parsed.data.status });
  return NextResponse.json({ cluster });
}
