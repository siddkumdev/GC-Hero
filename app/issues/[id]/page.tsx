import { notFound } from "next/navigation";
import { ArrowLeft, Zap } from "lucide-react";
import BackButton from "@/components/BackButton";
import { findClusterWithReportsAndUsers } from "@/lib/db/clusters";
import {
  CATEGORY_LABELS,
  urgencyScore,
  type Category,
  type Severity,
} from "@/lib/config";
import StatusControl from "@/components/StatusControl";
import CategoryIcon from "@/components/CategoryIcon";
import { severityAccent } from "@/components/civic/meta";
import { SeverityPill, StatusPill } from "@/components/Badges";
import CitizenCount from "@/components/civic/CitizenCount";
import ResolveIssue from "@/components/civic/ResolveIssue";
import VerifyButton from "@/components/civic/VerifyButton";
import EscalateIssue from "@/components/civic/EscalateIssue";
import { getCurrentUser } from "@/lib/session";
import { confirmStatesFor } from "@/lib/verification";

export const dynamic = "force-dynamic";

// Tracked issue (cluster) detail: "Reported by N citizens", member reports, complaint draft,
// and a simulated status control.
export default async function IssuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Migrated from Prisma — 2026-06-24
  const cluster = await findClusterWithReportsAndUsers(id);

  if (!cluster) notFound();

  // F4 — current citizen's relationship to this issue (so the verify button renders correctly
  // on first paint, before any interaction). null when signed out → treated as "can" confirm.
  const user = await getCurrentUser();
  const confirmState = user
    ? (await confirmStatesFor(user.id, [cluster.id]))[cluster.id] ?? "can"
    : "can";

  const urgency = urgencyScore(cluster.severity as Severity, cluster.reportCount);
  const representative = cluster.reports[0];
  // Reports come back newest-first; the ORIGINAL ("before") photo is the earliest member report.
  const originalImagePath =
    cluster.reports[cluster.reports.length - 1]?.imagePath ?? null;

  return (
    <div className="flex flex-col gap-5 w-full lg:max-w-3xl lg:mx-auto">
      <BackButton fallback="/" />

      <div
        className="cv-elevated p-5 flex flex-col gap-4"
        style={{ borderLeft: `4px solid ${severityAccent(cluster.severity)}` }}
      >
        <div className="flex items-center gap-3">
          <CategoryIcon category={cluster.category} className="cv-icon-tile-lg" size={24} />
          <div className="flex flex-col">
            <h1 className="text-xl">
              {CATEGORY_LABELS[cluster.category as Category] ?? cluster.category}
            </h1>
            <span className="text-sm" style={{ color: "var(--c-muted)" }}>
              Routed to {representative?.department ?? "—"}
            </span>
          </div>
        </div>
        <p style={{ color: "var(--c-text)" }}>{cluster.summary}</p>
        <CitizenCount count={cluster.reportCount} />
        {/* F4 — one-tap community corroboration ("I see this too"). */}
        <div className="flex flex-wrap items-center gap-2">
          <VerifyButton
            clusterId={cluster.id}
            initialCount={cluster.verifiedCount}
            initialState={confirmState}
          />
          <EscalateIssue clusterId={cluster.id} />
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <SeverityPill severity={cluster.severity} />
          <StatusPill status={cluster.status} />
          <span className="cv-chip">
            <Zap size={12} strokeWidth={2.4} />
            Urgency {urgency.toFixed(1)}
          </span>
        </div>
        <div className="pt-1" style={{ borderTop: "1px solid var(--c-border)" }}>
          <div className="pt-3">
            <StatusControl clusterId={cluster.id} status={cluster.status} />
          </div>
        </div>
      </div>

      <ResolveIssue
        clusterId={cluster.id}
        resolved={cluster.status === "resolved"}
        originalImagePath={originalImagePath}
        resolutionImagePath={cluster.resolutionImagePath ?? null}
        resolutionReasoning={cluster.resolutionReasoning ?? null}
        resolutionConfidence={cluster.resolutionConfidence ?? null}
      />

      {representative && (
        <section className="cv-card p-5 flex flex-col gap-2">
          <div className="cv-eyebrow">Draft complaint · representative</div>
          <pre className="cv-well p-3.5 text-sm whitespace-pre-wrap font-sans leading-relaxed">
            {representative.complaintDraft}
          </pre>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">
          Individual reports ({cluster.reports.length})
        </h2>
        <ul className="flex flex-col gap-3">
          {cluster.reports.map((r) => (
            <li key={r.id} className="cv-card p-3 flex gap-3 items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={r.imagePath}
                alt={r.description}
                className="w-16 h-16 rounded-[12px]"
                style={{ objectFit: "cover", border: "1px solid var(--c-border)" }}
              />
              <div className="flex flex-col gap-1 text-sm min-w-0">
                <div style={{ color: "var(--c-text)" }}>{r.description}</div>
                <div style={{ color: "var(--c-faint)" }}>
                  by {r.user.name} · {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
