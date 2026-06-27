"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { upsertUserLockName } from "@/lib/db/users";
import { setSession } from "@/lib/session";

// Server action: works without client JS (progressive enhancement) and sets the session
// cookie via a normal navigation, which mobile Safari handles reliably (unlike a fetch + client
// router push). Trim + lowercase to tolerate mobile-keyboard quirks.
const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().optional(),
});

export async function loginAction(formData: FormData) {
  const next = typeof formData.get("next") === "string" ? (formData.get("next") as string) : "";
  // Only allow relative paths to prevent open-redirect attacks.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/report";

  const parsed = schema.safeParse({
    email: formData.get("email"),
    name: formData.get("name") || undefined,
  });
  if (!parsed.success) {
    const errNext = safeNext !== "/report" ? `&next=${encodeURIComponent(safeNext)}` : "";
    redirect(`/login?error=1${errNext}`);
  }

  const email = parsed.data.email;
  const name = parsed.data.name?.trim() || email.split("@")[0];

  // One stable name per account: locked at first sign-in, never overwritten.
  // Migrated from Prisma — 2026-06-24
  const user = await upsertUserLockName(email, name);

  await setSession(user.id);
  redirect(safeNext);
}
