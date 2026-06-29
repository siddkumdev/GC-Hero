import "dotenv/config";

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
//
// DATA_CENTROID for MapView.tsx geolocation offset: { lat: 12.972, lng: 77.637 }
// MapView reads this constant and offsets all cluster pins to the viewer's real location.

const DEPARTMENT_BY_CATEGORY: Record<string, string> = {
  pothole: "Public Works Department (Roads)",
  water_leak: "Water Supply & Sewerage Board",
  broken_streetlight: "Municipal Electrical Department",
  garbage: "Solid Waste Management Department",
  other: "Municipal Grievance Cell",
};

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

// Cluster definitions — coordinates are around the DATA_CENTROID (12.972, 77.637).
// MapView.tsx applies a geoOffset so pins appear near the viewer's actual location.
const DEMO_CLUSTERS = [
  {
    seed: "ph-major-junction",
    category: "pothole",
    severity: "high",
    status: "acknowledged",
    center: { lat: 12.9720, lng: 77.6380 },
    count: 14,
    verifiers: 5,
    descriptions: [
      "A large pothole spanning nearly the full width of the lane has been worsening since last month's rains. Vehicles swerve into the opposite lane to avoid it.",
      "Deep crater-like depression on this road. Water pools here after rain, making the true depth invisible and causing axle damage.",
      "Multiple potholes have merged into one large excavation. Two motorcycles have reportedly fallen here this week alone.",
    ],
    images: ["/images/demo/pothole-1.jpg", "/images/demo/pothole-2.jpg"],
  },
  {
    seed: "ph-side-road",
    category: "pothole",
    severity: "high",
    status: "acknowledged",
    center: { lat: 12.9695, lng: 77.6280 },
    count: 9,
    verifiers: 4,
    descriptions: [
      "A wide pothole is forcing two-wheelers into oncoming traffic. The road surface crumbles further with every passing truck.",
      "Rain-filled pothole on the service lane hides its depth, making it risky especially at night.",
      "Pothole has grown to span half the road width. Causes severe jolting to vehicles and is close to a school entry gate.",
    ],
    images: ["/images/demo/pothole-2.jpg", "/images/demo/pothole-3.jpg"],
  },
  {
    seed: "ph-minor-residential",
    category: "pothole",
    severity: "med",
    status: "submitted",
    center: { lat: 12.9760, lng: 77.6450 },
    count: 3,
    verifiers: 0,
    descriptions: [
      "A pothole roughly 30 cm across has appeared near the T-junction. Deepens significantly after each rainfall.",
    ],
    images: ["/images/demo/pothole-3.jpg"],
  },
  {
    seed: "gb-market-overflow",
    category: "garbage",
    severity: "high",
    status: "in_progress",
    center: { lat: 12.9640, lng: 77.6310 },
    count: 6,
    verifiers: 2,
    descriptions: [
      "Overflowing waste bins and scattered garbage has been accumulating for over 10 days. Foul smell and flies are a serious health hazard for nearby residents.",
      "Mixed waste — food scraps, plastic, broken glass — is dumped at this corner daily. Stray animals rummage through it and spread waste further onto the footpath.",
    ],
    images: ["/images/demo/garbage-1.jpg", "/images/demo/garbage-3.jpg"],
  },
  {
    seed: "gb-illegal-dumping",
    category: "garbage",
    severity: "med",
    status: "submitted",
    center: { lat: 12.9780, lng: 77.6420 },
    count: 4,
    verifiers: 1,
    descriptions: [
      "An illegal dumping site has formed in the vacant plot at this corner. Construction debris mixed with domestic waste.",
      "Garbage pile at the corner spills onto the footpath, forcing pedestrians onto the road.",
    ],
    images: ["/images/demo/garbage-1.jpg"],
  },
  {
    seed: "wl-burst-main",
    category: "water_leak",
    severity: "high",
    status: "in_progress",
    center: { lat: 12.9710, lng: 77.6470 },
    count: 5,
    verifiers: 3,
    descriptions: [
      "A burst main is gushing water at high pressure, creating a pool that has blocked one lane. Vehicles unable to pass. Enormous wastage of drinking water.",
      "Water pipe fracture is causing significant road flooding. The surface is breaking up under the water pressure and needs urgent repair.",
    ],
    images: ["/images/demo/water-2.jpg", "/images/demo/water-3.jpg"],
  },
  {
    seed: "wl-underground-seepage",
    category: "water_leak",
    severity: "high",
    status: "submitted",
    center: { lat: 12.9680, lng: 77.6350 },
    count: 3,
    verifiers: 1,
    descriptions: [
      "Underground pipe seepage is causing the road surface to soften and develop cracks. Has been slowly leaking for 2 weeks with no municipal response.",
    ],
    images: ["/images/demo/water-2.jpg"],
  },
  {
    seed: "sl-main-junction",
    category: "broken_streetlight",
    severity: "low",
    status: "submitted",
    center: { lat: 12.9730, lng: 77.6300 },
    count: 4,
    verifiers: 2,
    descriptions: [
      "Street lamp at this junction has been non-functional for 3 weeks. Commuters and pedestrians are at serious safety risk after sunset.",
      "Two consecutive street poles are dark, making the entire stretch hazardous for pedestrians and cyclists at night.",
    ],
    images: ["/images/demo/streetlight-1.jpg"],
  },
  {
    seed: "sl-residential-lane",
    category: "broken_streetlight",
    severity: "low",
    status: "submitted",
    center: { lat: 12.9800, lng: 77.6380 },
    count: 2,
    verifiers: 0,
    descriptions: [
      "Street light in this residential lane is flickering and goes completely dark after midnight. Repeated calls to the electricity department have gone unanswered.",
    ],
    images: ["/images/demo/streetlight-1.jpg"],
  },
  {
    seed: "other-collapsed-footpath",
    category: "other",
    severity: "med",
    status: "submitted",
    center: { lat: 12.9660, lng: 77.6400 },
    count: 2,
    verifiers: 0,
    descriptions: [
      "A large section of footpath has collapsed, exposing underground drainage infrastructure. Pedestrians are forced onto the busy road.",
      "Footpath tiles have buckled and cracked, raising sharp edges. A serious tripping hazard especially for the elderly and children.",
    ],
    images: ["/images/demo/pothole-1.jpg"],
  },
];

async function checkAlreadySeeded(): Promise<boolean> {
  // Check clusters (not users) so db:wipe + db:seed works without wiping accounts.
  const snap = await db.collection("clusters").limit(1).get();
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
  images: string[];
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

  const department = DEPARTMENT_BY_CATEGORY[opts.category] ?? "Municipal Grievance Cell";
  const summary = opts.descriptions[0];
  const now = new Date();

  const clusterRef = db.collection("clusters").doc();
  await clusterRef.set({
    category: opts.category,
    severity: opts.severity,
    status: opts.status,
    title: `${opts.category.replace(/_/g, " ")} near ${opts.center.lat.toFixed(5)}, ${opts.center.lng.toFixed(5)}`,
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

  for (let i = 0; i < verifierCount; i++) {
    await db
      .collection("verifications")
      .doc(`${clusterId}_${verifierPool[i]}`)
      .set({ clusterId, userId: verifierPool[i], createdAt: now });
  }

  for (let i = 0; i < opts.count; i++) {
    const description = opts.descriptions[i % opts.descriptions.length];
    const imagePath = opts.images[i % opts.images.length];
    const userId = opts.users[i % opts.users.length];
    await db.collection("reports").doc().set({
      category: opts.category,
      severity: opts.severity,
      description,
      department,
      complaintDraft: `Subject: Civic Issue — ${opts.category.replace(/_/g, " ")} requiring urgent attention\n\nTo the ${department},\n\n${description} Residents request prompt inspection and resolution at the earliest.\n\nThank you.`,
      isValid: true,
      imagePath,
      lat: points[i].lat,
      lng: points[i].lng,
      embedding: JSON.stringify(embeddingFrom(opts.seed, i)),
      userId,
      clusterId,
      createdAt: new Date(now.getTime() + i * 1000),
    });
  }

  return clusterId;
}

async function main() {
  if (await checkAlreadySeeded()) {
    console.log("Already seeded — demo@communityhero.app exists. Run db:wipe first to reseed.");
    return;
  }

  const demoId = await createUser("demo@communityhero.app", "Demo Citizen");
  const userIds: string[] = [demoId];
  for (let i = 0; i < FIRST.length; i++) {
    userIds.push(await createUser(`${FIRST[i].toLowerCase()}${i}@example.com`, `${FIRST[i]} K.`));
  }

  for (const cluster of DEMO_CLUSTERS) {
    await seedCluster({ users: userIds, ...cluster });
    process.stdout.write(".");
  }
  console.log();

  const [clusterCount, reportCount] = await Promise.all([
    db.collection("clusters").count().get().then((s) => s.data().count),
    db.collection("reports").count().get().then((s) => s.data().count),
  ]);
  console.log(`Seeded ${userIds.length} users, ${clusterCount} clusters, ${reportCount} reports.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
