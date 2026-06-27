import "server-only";
import type { Category, Severity } from "@/lib/config";

// SYSTEM LAYER. The report flow is two phases: /analyze (Gemini reads the photo) then
// /confirm (the user files the reviewed/edited complaint). Between them we stash the
// expensive, security-sensitive bits — the embedding and the saved image — server-side
// instead of round-tripping them through the browser. Demo-scale: a single-process
// in-memory map with a TTL is enough and keeps the embedding off the client.
//
// Trade-off: a server restart / HMR reload drops pending analyses; confirm then returns a
// clear "expired" error and the user re-submits. Acceptable for the hackathon runtime.

export interface PendingAnalysis {
  userId: string;
  imagePath: string;
  category: Category;
  severity: Severity;
  description: string;
  department: string;
  embedding: number[];
  lat: number;
  lng: number;
  createdAt: number;
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes
// Hard cap: if too many analyses accumulate (e.g. a burst attack), evict the oldest
// entries beyond this limit regardless of TTL.
const MAX_STORE_SIZE = 500;
const store = new Map<string, PendingAnalysis>();

function sweep() {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, p] of store) {
    if (p.createdAt < cutoff) store.delete(id);
  }
  // Hard-cap eviction: remove the oldest entries if we still exceed MAX_STORE_SIZE.
  if (store.size > MAX_STORE_SIZE) {
    const sorted = [...store.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
    const toEvict = sorted.slice(0, store.size - MAX_STORE_SIZE);
    for (const [id] of toEvict) store.delete(id);
  }
}

// Background sweep: proactively clear expired entries every 5 minutes so the Map
// doesn't grow unboundedly between writes (e.g. if /analyze callers never /confirm).
// The interval is unref'd so it doesn't prevent the process from exiting in tests.
if (typeof setInterval !== "undefined") {
  const timer = setInterval(sweep, 5 * 60 * 1000);
  // Node.js: allow GC / process exit without waiting for the interval.
  if (typeof timer === "object" && "unref" in timer) (timer as NodeJS.Timeout).unref();
}

export function putPending(id: string, value: PendingAnalysis): void {
  sweep();
  store.set(id, value);
}

export function takePending(id: string): PendingAnalysis | null {
  sweep();
  const p = store.get(id);
  if (!p) return null;
  store.delete(id); // single-use: consumed on confirm
  return p;
}
