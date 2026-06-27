import Link from "next/link";
import { redirect } from "next/navigation";
import { User, FileText, Inbox, Plus } from "lucide-react";
import { findReportsByUserWithClusters } from "@/lib/db/reports";
import { getCurrentUser } from "@/lib/session";
import { CATEGORY_LABELS, type Category } from "@/lib/config";
import CategoryIcon from "@/components/CategoryIcon";
import { severityAccent } from "@/components/civic/meta";
import { SeverityPill, StatusPill } from "@/components/Badges";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

// Account / profile: who you are + the reports you've filed. Signed-out users are bounced
// to /login (the bottom-nav account tab lands here, so this is the redirect seam).
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Migrated from Prisma — 2026-06-24
  const reports = await findReportsByUserWithClusters(user.id);

  const joined = new Date(user.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-5 w-full lg:max-w-2xl lg:mx-auto">
      {/* Identity card */}
      <div className="cv-elevated p-6 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <span
            className="grid h-16 w-16 place-items-center rounded-full shrink-0"
            style={{
              background: "var(--c-accent-weak)",
              color: "var(--c-accent-strong)",
              border: "1px solid var(--c-border)",
            }}
          >
            <User size={30} strokeWidth={2} />
          </span>
          <div className="flex flex-col min-w-0">
            <h1 className="text-xl truncate">{user.name}</h1>
            <span className="text-sm truncate" style={{ color: "var(--c-muted)" }}>
              {user.email}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="cv-chip"
            style={{
              color: "var(--c-accent-strong)",
              background: "var(--c-accent-weak)",
              borderColor: "var(--c-accent-ring)",
              fontWeight: 700,
            }}
          >
            <FileText size={13} strokeWidth={2.4} />
            {reports.length} report{reports.length === 1 ? "" : "s"} filed
          </span>
          <span className="text-xs" style={{ color: "var(--c-faint)" }}>
            Member since {joined}
          </span>
        </div>
        <div className="flex gap-2 pt-1">
          <Link href="/report" className="cv-btn cv-btn-primary text-sm">
            Report an issue
          </Link>
          <LogoutButton />
        </div>
      </div>

      {/* My reports — recessed section so the cards read as a grouped collection. */}
      <div
        className="flex flex-col gap-3 rounded-[22px] p-4"
        style={{ background: "var(--c-surface-muted)" }}
      >
        <h2 className="cv-eyebrow px-1">My reports</h2>
        {reports.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span
              className="grid h-14 w-14 place-items-center rounded-full"
              style={{ background: "var(--c-surface)", color: "var(--c-faint)", border: "1px solid var(--c-border)" }}
            >
              <Inbox size={28} strokeWidth={1.8} />
            </span>
            <div className="flex flex-col gap-1">
              <p className="font-semibold" style={{ color: "var(--c-ink)" }}>
                No reports yet
              </p>
              <p className="text-sm" style={{ color: "var(--c-muted)" }}>
                Spot a pothole, leak, or broken light? You&apos;ll be the first to flag it.
              </p>
            </div>
            <Link href="/report" className="cv-btn cv-btn-primary text-sm">
              <Plus size={16} /> Report an issue
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {reports.map((r) => {
              const body = (
                <div
                  className="cv-card p-4 flex gap-3.5 items-center transition-colors hover:border-[var(--c-border-strong)]"
                  style={{ borderLeft: `4px solid ${severityAccent(r.severity)}` }}
                >
                  <CategoryIcon category={r.category} />
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <span
                      className="cv-display font-semibold"
                      style={{ color: "var(--c-ink)" }}
                    >
                      {CATEGORY_LABELS[r.category as Category] ?? r.category}
                    </span>
                    <span
                      className="text-sm line-clamp-2"
                      style={{ color: "var(--c-muted)" }}
                    >
                      {r.description}
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      <SeverityPill severity={r.severity} />
                      {r.cluster && <StatusPill status={r.cluster.status} />}
                    </div>
                  </div>
                </div>
              );
              return (
                <li key={r.id}>
                  {r.clusterId ? (
                    <Link href={`/issues/${r.clusterId}`}>{body}</Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
