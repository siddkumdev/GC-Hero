"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, TrendingUp, Plus, ArrowRight } from "lucide-react";
import { fadeUp, spring } from "@/lib/motion";
import { categoryMeta } from "@/components/civic/meta";
import CountUp from "@/components/civic/CountUp";
import CitizenCount from "@/components/civic/CitizenCount";
import type { ConfirmResultDTO } from "@/lib/types";

// The payoff after filing: the duplicate collapses into one tracked issue, the count climbs,
// and priority bumps — the "watch duplicates merge" moment (A2).
export default function FiledResult({
  result,
  category,
  onReportAnother,
}: {
  result: ConfirmResultDTO;
  category: string;
  onReportAnother: () => void;
}) {
  const cat = categoryMeta(category);
  const merged = !result.isNew;

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="cv-elevated p-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <motion.span
          initial={{ scale: 0, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={spring}
          className="grid h-14 w-14 place-items-center rounded-full"
          style={{ background: "var(--c-ok-bg)", color: "var(--c-ok)", border: "1px solid var(--c-ok-bd)" }}
        >
          <CheckCircle2 size={30} strokeWidth={2.2} />
        </motion.span>

        <div className="flex flex-col gap-1">
          <h2 className="text-xl">Report filed</h2>
          <p className="text-sm" style={{ color: "var(--c-muted)" }}>
            <cat.Icon size={13} className="mr-1 inline align-[-2px]" />
            {cat.label} · routed to the responsible department
          </p>
        </div>

        {merged ? (
          <div
            className="flex w-full flex-col items-center gap-3 rounded-[15px] p-5"
            style={{ background: "var(--c-accent-weak)", border: "1px solid var(--c-border)" }}
          >
            <span className="cv-eyebrow" style={{ color: "var(--c-accent-strong)" }}>
              Duplicate merged
            </span>
            <div
              className="cv-display leading-none"
              style={{ fontSize: "3rem", fontWeight: 700, color: "var(--c-ink)" }}
            >
              <CountUp from={result.previousCount} to={result.reportCount} />
            </div>
            <CitizenCount count={result.reportCount} highlightNew />
            <span
              className="cv-chip cv-sev-med mt-1"
              style={{ fontSize: "0.78rem" }}
            >
              <TrendingUp size={13} strokeWidth={2.4} /> Priority raised
            </span>
          </div>
        ) : (
          <div
            className="flex w-full flex-col items-center gap-2 rounded-[15px] p-5"
            style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border)" }}
          >
            <span className="cv-eyebrow">New tracked issue</span>
            <p className="text-sm" style={{ color: "var(--c-text)" }}>
              You&apos;re the first to report this. We&apos;ll group anyone who reports it nearby.
            </p>
            <div className="pt-1">
              <CitizenCount count={result.reportCount} />
            </div>
          </div>
        )}

        <div className="flex w-full flex-col gap-2.5 pt-1">
          <Link href={`/issues/${result.clusterId}`} className="cv-btn cv-btn-primary w-full">
            View tracked issue <ArrowRight size={16} />
          </Link>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onReportAnother}
              className="cv-btn cv-btn-secondary flex-1"
            >
              <Plus size={16} /> Report another
            </button>
            <Link href="/" className="cv-btn cv-btn-secondary flex-1">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
