import { cookies } from "next/headers";
import { findUserById } from "@/lib/db/users";

// Lightweight multi-user auth: an httpOnly cookie holding the user id. Enough to attribute
// reports and demo "N citizens reported this". No OAuth by design (see decisions-log.md).

export const SESSION_COOKIE = "ch_session";

export async function getCurrentUser() {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  return findUserById(id);
}

export async function setSession(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
