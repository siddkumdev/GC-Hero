import "dotenv/config";

// Bootstrap Firebase Admin before anything else.
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

// Seeds demo users + clusters so the dashboard/map/digest demo works immediately
// without needing the Gemini API. Idempotent: checks for existing data before inserting.
// Run with: npm run db:seed

const DEPARTMENT_BY_CATEGORY: Record<string, string> = {
  pothole: "Public Works Department (Roads)",
  water_leak: "Water Supply & Sewerage Board",
  broken_streetlight: "Municipal Electrical Department",
  garbage: "Solid Waste Management Department",
  other: "Municipal Grievance Cell",
};

// Deterministic pseudo-embeddings (768-dim), same as the old Prisma seed.
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function embeddingFrom(seed: string, jitter = 0): number[] {
  const base = makeRng(hashString(seed));
  const noise = makeRng(hashString(seed + ":" + jitter));
  return Array.from({ length: 768 }, () => base() * 2 - 1 + (noise() - 0.5) * 0.02);
}

const FIRST = [
  "Asha", "Ravi", "Meera", "Sanjay", "Priya", "Imran", "Deepa", "Vikram",
  "Lakshmi", "Arjun", "Fatima", "Rahul", "Neha", "Karthik", "Sneha",
];

async function checkAlreadySeeded(): Promise<boolean> {
  const snap = await db.collection("users").where("email", "==", "demo@communityhero.app").limit(1).get();
  return !snap.empty;
}

async function createUser(email: string, name: string): Promise<string> {
  const snap = await db.collection("users").where("email", "==", email).limit(1).get();
  if (!snap.empty) return snap.docs[0].id;
  const ref = db.collection("users").doc();
  await ref.set({ email, name, createdAt: new Date() });
  return ref.id;
}

async function seedCluster(opts: {
  users: string[];
  category: string;
  severity: string;
  status: string;
  seed: string;
  center: { lat: number; lng: number };
  count: number;
  descriptions: string[];
  verifiers?: number;
}) {
  const jitterRng = makeRng(hashString(opts.seed + ":geo"));
  const points = Array.from({ length: opts.count }, () => ({
    lat: opts.center.lat + (jitterRng() - 0.5) * 0.0009,
    lng: opts.center.lng + (jitterRng() - 0.5) * 0.0009,
  }));
  const centroidLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const centroidLng = points.reduce((s, p) => s + p.lng, 0) / points.length;

  const reporterIds = new Set(
    Array.from({ length: opts.count }, (_, i) => opts.users[i % opts.users.length]),
  );
  const verifierPool = opts.users.filter((u) => !reporterIds.has(u));
  const verifierCount = Math.min(opts.verifiers ?? 0, verifierPool.length);

  const department = DEPARTMENT_BY_CATEGORY[opts.category];
  const title = `${opts.category.replace(/_/g, " ")} near ${opts.center.lat.toFixed(5)}, ${opts.center.lng.toFixed(5)}`;
  const summary = opts.descriptions[0];
  const now = new Date();

  const clusterRef = db.collection("clusters").doc();
  await clusterRef.set({
    category: opts.category,
    severity: opts.severity,
    status: opts.status,
    title,
    summary,
    centroidLat,
    centroidLng,
    reportCount: opts.count,
    verifiedCount: verifierCount,
    createdAt: now,
    updatedAt: now,
    resolutionImagePath: null,
    resolutionConfidence: null,
    resolutionReasoning: null,
    resolvedAt: null,
  });
  const clusterId = clusterRef.id;

  // Verifications (deterministic ID: ${clusterId}_${userId})
  for (let i = 0; i < verifierCount; i++) {
    await db
      .collection("verifications")
      .doc(`${clusterId}_${verifierPool[i]}`)
      .set({ clusterId, userId: verifierPool[i], createdAt: now });
  }

  // Reports
  for (let i = 0; i < opts.count; i++) {
    const description = opts.descriptions[i % opts.descriptions.length];
    const userId = opts.users[i % opts.users.length];
    await db.collection("reports").doc().set({
      category: opts.category,
      severity: opts.severity,
      description,
      department,
      complaintDraft: `Subject: ${title}\n\nTo the ${department},\n\n${description} Residents request prompt inspection and resolution.\n\nThank you.`,
      isValid: true,
      imagePath: "/globe.svg",
      lat: points[i].lat,
      lng: points[i].lng,
      embedding: JSON.stringify(embeddingFrom(opts.seed, i)),
      userId,
      clusterId,
      createdAt: new Date(now.getTime() + i * 1000), // staggered so order is stable
    });
  }

  return clusterId;
}

async function main() {
  if (await checkAlreadySeeded()) {
    console.log("Already seeded — demo@communityhero.app exists. Run db:wipe first to reseed.");
    return;
  }

  // Users
  const demoId = await createUser("demo@communityhero.app", "Demo Citizen");
  const userIds: string[] = [demoId];
  for (let i = 0; i < FIRST.length; i++) {
    userIds.push(await createUser(`${FIRST[i].toLowerCase()}${i}@example.com`, `${FIRST[i]} K.`));
  }

  // Clusters — Koramangala / Indiranagar / Jayanagar / MG Road
  await seedCluster({ users: userIds, category: "pothole", severity: "high", status: "acknowledged", seed: "pothole-koramangala", center: { lat: 12.9352, lng: 77.6245 }, count: 12, verifiers: 3, descriptions: ["A large pothole spans the width of the road, exposing loose gravel.", "Deep pothole near the junction is forcing vehicles to swerve.", "Water-filled pothole hides its depth and is a hazard at night."] });
  await seedCluster({ users: userIds, category: "garbage", severity: "med", status: "submitted", seed: "garbage-indiranagar", center: { lat: 12.9719, lng: 77.6412 }, count: 4, verifiers: 2, descriptions: ["An uncleared garbage pile is overflowing onto the footpath.", "Mixed waste dumped at the street corner is attracting stray animals."] });
  await seedCluster({ users: userIds, category: "water_leak", severity: "high", status: "in_progress", seed: "waterleak-jayanagar", center: { lat: 12.9299, lng: 77.5826 }, count: 2, descriptions: ["A burst pipeline is leaking continuously and flooding the road."] });
  await seedCluster({ users: userIds, category: "broken_streetlight", severity: "low", status: "submitted", seed: "streetlight-mg-road", center: { lat: 12.9756, lng: 77.6068 }, count: 1, descriptions: ["A streetlight stays off after dark, leaving the stretch unlit."] });

  // Clusters — Whitefield / ITPL
  await seedCluster({ users: userIds, category: "pothole", severity: "high", status: "acknowledged", seed: "pothole-itpl-main-rd", center: { lat: 12.9852, lng: 77.7359 }, count: 9, verifiers: 4, descriptions: ["A wide pothole on ITPL Main Road is forcing two-wheelers into oncoming traffic.", "Crater-like pothole near the Hotel Zuri stretch jolts every passing vehicle.", "Rain-filled pothole on the service road hides its depth and is risky after dark."] });
  await seedCluster({ users: userIds, category: "garbage", severity: "med", status: "submitted", seed: "garbage-maruthi-nagar", center: { lat: 12.9866, lng: 77.7338 }, count: 5, descriptions: ["An overflowing garbage pile at the Maruthi Nagar corner spills onto the footpath.", "Uncleared mixed waste near the EPIP gate is attracting stray dogs."] });
  await seedCluster({ users: userIds, category: "broken_streetlight", severity: "low", status: "submitted", seed: "streetlight-epip-zone", center: { lat: 12.9841, lng: 77.7371 }, count: 3, descriptions: ["A streetlight on the EPIP Zone road stays off after dark, leaving the stretch unlit.", "Two consecutive poles are dark, making the pavement unsafe at night."] });
  await seedCluster({ users: userIds, category: "water_leak", severity: "high", status: "in_progress", seed: "waterleak-whitefield", center: { lat: 12.9838, lng: 77.7349 }, count: 2, descriptions: ["A burst pipeline near the industrial area is leaking continuously and flooding the road."] });

  const [clusterCount, reportCount] = await Promise.all([
    db.collection("clusters").count().get().then((s) => s.data().count),
    db.collection("reports").count().get().then((s) => s.data().count),
  ]);
  console.log(`Seeded ${userIds.length} users, ${clusterCount} clusters, ${reportCount} reports.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
