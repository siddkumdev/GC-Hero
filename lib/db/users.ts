import { db, toDate } from "@/lib/firestore";
import type { User } from "@/types/models";
import { randomUUID } from "crypto";

const USERS = "users";

function docToUser(id: string, data: FirebaseFirestore.DocumentData): User {
  return {
    id,
    email: data.email as string,
    name: data.name as string,
    createdAt: toDate(data.createdAt),
  };
}

export async function findUserById(id: string): Promise<User | null> {
  const doc = await db.collection(USERS).doc(id).get();
  if (!doc.exists) return null;
  return docToUser(doc.id, doc.data()!);
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const snap = await db.collection(USERS).where("email", "==", email).limit(1).get();
  if (snap.empty) return null;
  return docToUser(snap.docs[0].id, snap.docs[0].data());
}

/** Used by /api/auth/login: creates on first sign-in, updates name on re-login. */
export async function upsertUserUpdateName(email: string, name: string): Promise<User> {
  const existing = await findUserByEmail(email);
  if (existing) {
    await db.collection(USERS).doc(existing.id).update({ name });
    return { ...existing, name };
  }
  return createUser(email, name);
}

/** Used by server action loginAction: name is locked at first sign-in, never overwritten. */
export async function upsertUserLockName(email: string, name: string): Promise<User> {
  const existing = await findUserByEmail(email);
  if (existing) return existing;
  return createUser(email, name);
}

export async function createUser(email: string, name: string): Promise<User> {
  const id = randomUUID();
  const now = new Date();
  await db.collection(USERS).doc(id).set({ email, name, createdAt: now });
  return { id, email, name, createdAt: now };
}

export async function deleteAllUsers(): Promise<void> {
  const snap = await db.collection(USERS).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}
