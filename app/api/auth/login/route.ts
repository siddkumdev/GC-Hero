import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertUserUpdateName } from "@/lib/db/users";
import { setSession } from "@/lib/session";

// Trim + lowercase before validating — mobile keyboards add stray spaces / capitals.
const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).optional(),
});

// Minimal login: upsert a user by email, set the session cookie. No password (demo auth).
export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const email = parsed.data.email;
  const name = parsed.data.name?.trim() || email.split("@")[0];

  // Migrated from Prisma — 2026-06-24
  const user = await upsertUserUpdateName(email, name);

  await setSession(user.id);
  return NextResponse.json({ id: user.id, email: user.email, name: user.name });
}
