"use client";

import Link from "next/link";
import { ThumbsUp } from "lucide-react";
import { motion } from "framer-motion";
import CategoryIcon from "@/components/CategoryIcon";
import { SeverityPill, StatusPill, CountPill } from "@/components/Badges";
import { severityAccent } from "@/components/civic/meta";
import { CATEGORY_LABELS, type Category } from "@/lib/config";
import { staggerItem } from "@/lib/motion";

// Shared feed row for a tracked cluster — used by the dashboard and natural-language search so
// the two stay visually identical and don't drift.
export default function ClusterCard({
  cluster,
}: {
  cluster: {
    id: string;
    category: string;
    severity: string;
    status: string;
    summary: string;
    reportCount: number;
    verifiedCount?: number;
  };
}) {
  return (
    <motion.div
      variants={staggerItem}
      style={{ borderRadius: "var(--c-radius)" }}
    >
      <Link
        href={`/issues/${cluster.id}`}
        className="cv-card p-4 flex gap-3.5 items-center"
        style={{ borderLeft: `4px solid ${severityAccent(cluster.severity)}` }}
      >
        <CategoryIcon category={cluster.category} />
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <span className="cv-display font-semibold" style={{ color: "var(--c-ink)" }}>
            {CATEGORY_LABELS[cluster.category as Category] ?? cluster.category}
          </span>
          <span className="text-sm line-clamp-2" style={{ color: "var(--c-muted)" }}>
            {cluster.summary}
          </span>
          <div className="flex flex-wrap gap-1.5 pt-1.5">
            <SeverityPill severity={cluster.severity} />
            <StatusPill status={cluster.status} />
            <CountPill count={cluster.reportCount} />
            {/* F4 — lightweight "I see this too" corroborations, shown only when present. */}
            {cluster.verifiedCount ? (
              <span
                className="cv-chip"
                style={{ color: "var(--c-accent-strong)", borderColor: "var(--c-accent-ring)" }}
                title={`${cluster.verifiedCount} citizen${cluster.verifiedCount === 1 ? "" : "s"} also confirmed this`}
              >
                <ThumbsUp size={12} strokeWidth={2.4} />
                {cluster.verifiedCount} confirm
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
