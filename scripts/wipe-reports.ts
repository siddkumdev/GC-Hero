import "dotenv/config";
import { promises as fs } from "fs";
import path from "path";

// Clears all civic-issue data — reports, their clusters, verifications, and uploaded images —
// for a clean slate, while keeping user accounts intact (so you stay signed in).
// Invoke with `npm run db:wipe`.
// Migrated from Prisma — 2026-06-24

// Bootstrap Firebase Admin before importing db functions.
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

async function deleteCollection(name: string): Promise<number> {
  const snap = await db.collection(name).get();
  if (snap.empty) return 0;
  for (let i = 0; i < snap.docs.length; i += 500) {
    const batch = db.batch();
    snap.docs.slice(i, i + 500).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  return snap.docs.length;
}

async function main() {
  const verCount = await deleteCollection("verifications");
  const repCount = await deleteCollection("reports");
  const cluCount = await deleteCollection("clusters");

  let removedFiles = 0;
  try {
    const entries = await fs.readdir(UPLOAD_DIR);
    await Promise.all(
      entries
        .filter((name) => !name.startsWith("."))
        .map(async (name) => {
          await fs.rm(path.join(UPLOAD_DIR, name), { force: true });
          removedFiles++;
        }),
    );
  } catch {
    // Upload dir may not exist yet — nothing to clean.
  }

  console.log(
    `Wiped ${verCount} verification(s), ${repCount} report(s), ${cluCount} cluster(s), ${removedFiles} uploaded file(s). Users kept.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
