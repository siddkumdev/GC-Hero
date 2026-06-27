import Link from "next/link";
import { findClustersWithFilter } from "@/lib/db/clusters";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  STATUSES,
  urgencyScore,
  type Severity,
} from "@/lib/config";
import ClusterCard from "@/components/civic/ClusterCard";
import DigestCard from "@/components/civic/DigestCard";
import StaggerList from "@/components/civic/StaggerList";


export const dynamic = "force-dynamic";

// Dashboard: tracked clusters (de-duplicated issues), filterable, sorted by urgency.
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const category =
    sp.category && (CATEGORIES as readonly string[]).includes(sp.category)
      ? sp.category
      : undefined;
  const status =
    sp.status && (STATUSES as readonly string[]).includes(sp.status)
      ? sp.status
      : undefined;

  // Migrated from Prisma — 2026-06-24
  const clusters = await findClustersWithFilter({ category, status });

  const ranked = clusters
    .map((c) => ({
      ...c,
      urgency: urgencyScore(c.severity as Severity, c.reportCount),
    }))
    .sort((a, b) => b.urgency - a.urgency);

  const totalReports = ranked.reduce((s, c) => s + c.reportCount, 0);
  const filtered = Boolean(category || status);

  return (
    <div className="flex flex-col gap-5 w-full lg:max-w-2xl lg:mx-auto">
      <div className="flex flex-col gap-1">
        <span className="cv-eyebrow">GCHeros</span>
        <h1 className="text-2xl">Civic issues</h1>
        <p className="text-sm" style={{ color: "var(--c-muted)" }}>
          {ranked.length} tracked issue{ranked.length === 1 ? "" : "s"} ·{" "}
          {totalReports} report{totalReports === 1 ? "" : "s"}, sorted by urgency
        </p>
      </div>

      <DigestCard />

      {/* Filters */}
      <form method="get" className="cv-card p-4 flex flex-wrap gap-3 items-end">
        <label
          className="flex flex-col gap-1.5 text-sm flex-1 min-w-28"
          style={{ color: "var(--c-muted)" }}
        >
          Category
          <select name="category" defaultValue={category ?? ""} className="cv-field">
            <option value="">All</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label
          className="flex flex-col gap-1.5 text-sm flex-1 min-w-28"
          style={{ color: "var(--c-muted)" }}
        >
          Status
          <select
            name="status"
            defaultValue={status ?? ""}
            className="cv-field"
            style={{ textTransform: "capitalize" }}
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="cv-btn cv-btn-primary">
          Apply
        </button>
        {filtered && (
          <Link href="/" className="cv-link self-center text-sm">
            Clear
          </Link>
        )}
      </form>

      {ranked.length === 0 ? (
        <div
          className="cv-card p-8 text-center text-sm"
          style={{ color: "var(--c-muted)" }}
        >
          {filtered
            ? "No issues match these filters."
            : "No issues yet. Tap + to report the first one."}
        </div>
      ) : (
        <StaggerList>
          {ranked.map((c) => (
            <li key={c.id}>
              <ClusterCard cluster={c} />
            </li>
          ))}
        </StaggerList>
      )}
    </div>
  );
}

