"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  Building2,
  Users,
  MapPinned,
  Pencil,
  Send,
  Loader2,
  Wrench,
  X,
  TriangleAlert,
} from "lucide-react";
import { stagger, staggerItem } from "@/lib/motion";
import { categoryMeta, severityMeta } from "@/components/civic/meta";
import type { AnalyzeResultDTO } from "@/lib/types";

// The reveal: Gemini's structured reading presented as a confident, editable result card.
export default function AiResultCard({
  result,
  complaint,
  onComplaintChange,
  onConfirm,
  onDiscard,
  filing,
  onCheckResolved,
  resolutionNote,
}: {
  result: AnalyzeResultDTO;
  complaint: string;
  onComplaintChange: (v: string) => void;
  onConfirm: () => void;
  onDiscard: () => void;
  filing: boolean;
  // F1 auto-path: invoked when the user taps "Yes, check it" on the resolution suggestion.
  onCheckResolved?: () => void;
  // A short note shown after an inconclusive resolution check (issue stays open; file as new).
  resolutionNote?: string | null;
}) {
  const cat = categoryMeta(result.category);
  const sev = severityMeta(result.severity);
  const preview = result.clusterPreview;
  const suggestion = result.resolutionSuggestion;
  // The suggestion is soft + dismissible: hidden once acted on, declined, or already noted.
  const [dismissed, setDismissed] = useState(false);
  const showSuggestion = Boolean(suggestion) && !dismissed && !resolutionNote;

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="cv-elevated overflow-hidden"
    >
      {/* AI banner */}
      <motion.div
        variants={staggerItem}
        className="cv-ai-surface flex items-center gap-2 px-5 py-3"
        style={{ borderBottom: "1px solid var(--c-border)" }}
      >
        <Sparkles size={16} style={{ color: "var(--c-accent-strong)" }} />
        <span className="cv-eyebrow" style={{ color: "var(--c-accent-strong)" }}>
          Gemini analysis · complete
        </span>
      </motion.div>

      <div className="flex flex-col gap-5 p-5">
        {/* F1 auto-path: soft, dismissible "is this resolved?" suggestion. Never blocks filing. */}
        {showSuggestion && suggestion && (
          <motion.div
            variants={staggerItem}
            className="flex flex-col gap-3 rounded-[13px] p-3.5"
            style={{ background: "var(--c-accent-weak)", border: "1px solid var(--c-border)" }}
          >
            <div className="flex items-start gap-3">
              <Wrench size={18} style={{ color: "var(--c-accent-strong)", marginTop: 1 }} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                <span className="font-semibold" style={{ color: "var(--c-ink)" }}>
                  Updating an existing report nearby?
                </span>
                <span style={{ color: "var(--c-muted)" }}>
                  There&apos;s an open issue {suggestion.distanceMeters}m away. If your photo shows
                  it fixed, Gemini can verify and resolve it.
                </span>
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setDismissed(true)}
                className="cv-btn cv-btn-ghost shrink-0 p-1.5"
              >
                <X size={15} />
              </button>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onCheckResolved}
                disabled={filing}
                className="cv-btn cv-btn-secondary flex-1"
              >
                <Sparkles size={15} /> Yes, check it
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="cv-btn cv-btn-ghost flex-1"
              >
                No, it&apos;s new
              </button>
            </div>
          </motion.div>
        )}

        {/* Inconclusive resolution check → keep filing as a new report. */}
        {resolutionNote && (
          <motion.div
            variants={staggerItem}
            className="flex items-start gap-3 rounded-[13px] p-3.5 text-sm"
            style={{ background: "var(--c-med-bg)", border: "1px solid var(--c-med-bd)" }}
          >
            <TriangleAlert size={18} style={{ color: "var(--c-med)", marginTop: 1 }} />
            <span style={{ color: "var(--c-muted)" }}>{resolutionNote}</span>
          </motion.div>
        )}

        {/* Detected category + thumbnail */}
        <motion.div variants={staggerItem} className="flex items-center gap-3.5">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-[13px]"
            style={{
              background: "var(--c-accent-weak)",
              color: "var(--c-accent-strong)",
              border: "1px solid var(--c-border)",
            }}
          >
            <cat.Icon size={22} strokeWidth={2.1} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="cv-eyebrow">Detected issue</span>
            <h2 className="text-lg leading-tight">{cat.label}</h2>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.imagePath}
            alt={result.description}
            className="h-12 w-12 shrink-0 rounded-[11px] object-cover"
            style={{ border: "1px solid var(--c-border-strong)" }}
          />
        </motion.div>

        {/* Severity + justification */}
        <motion.div
          variants={staggerItem}
          className="flex flex-col gap-2 rounded-[13px] p-3.5"
          style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="cv-eyebrow">Severity</span>
            <span className={`cv-chip ${sev.badgeClass}`}>
              <sev.Icon size={13} strokeWidth={2.4} />
              {sev.label}
            </span>
          </div>
          <p className="text-sm" style={{ color: "var(--c-text)" }}>
            {result.severityReason}
          </p>
        </motion.div>

        {/* Routing */}
        <motion.div variants={staggerItem} className="flex items-center gap-3">
          <Building2 size={18} style={{ color: "var(--c-muted)" }} />
          <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
            <span style={{ color: "var(--c-muted)" }}>Routing to</span>
            <ArrowRight size={14} style={{ color: "var(--c-faint)" }} />
            <span className="truncate font-semibold" style={{ color: "var(--c-ink)" }}>
              {result.department}
            </span>
          </div>
        </motion.div>

        {/* Live clustering preview */}
        <motion.div
          variants={staggerItem}
          className="flex items-start gap-3 rounded-[13px] p-3.5"
          style={
            preview.matched
              ? { background: "var(--c-accent-weak)", border: "1px solid var(--c-border)" }
              : { background: "var(--c-surface-2)", border: "1px solid var(--c-border)" }
          }
        >
          {preview.matched ? (
            <Users size={18} style={{ color: "var(--c-accent-strong)", marginTop: 1 }} />
          ) : (
            <MapPinned size={18} style={{ color: "var(--c-muted)", marginTop: 1 }} />
          )}
          <div className="flex flex-col gap-0.5 text-sm">
            {preview.matched ? (
              <>
                <span className="font-semibold" style={{ color: "var(--c-ink)" }}>
                  Found {preview.currentCount} similar report
                  {preview.currentCount === 1 ? "" : "s"} within{" "}
                  {Math.round(preview.distanceMeters ?? preview.radiusMeters)}m
                </span>
                <span style={{ color: "var(--c-muted)" }}>
                  Yours will join this tracked issue and raise its priority.
                </span>
              </>
            ) : (
              <>
                <span className="font-semibold" style={{ color: "var(--c-ink)" }}>
                  First report of this issue here
                </span>
                <span style={{ color: "var(--c-muted)" }}>
                  You&apos;re starting a new tracked case for the city.
                </span>
              </>
            )}
          </div>
        </motion.div>

        {/* Editable complaint */}
        <motion.div variants={staggerItem} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="cv-eyebrow flex items-center gap-1.5">
              <Pencil size={12} /> Drafted complaint · editable
            </span>
            <span className="text-xs" style={{ color: "var(--c-faint)" }}>
              {complaint.trim().length} chars
            </span>
          </div>
          <textarea
            value={complaint}
            onChange={(e) => onComplaintChange(e.target.value)}
            rows={8}
            className="cv-field resize-y leading-relaxed"
            style={{ fontSize: "0.875rem", minHeight: "9rem" }}
          />
          <p className="text-xs" style={{ color: "var(--c-faint)" }}>
            Gemini drafted this from your photo. Review and tweak before filing.
          </p>
        </motion.div>

        {/* Actions */}
        <motion.div variants={staggerItem} className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onConfirm}
            disabled={filing || complaint.trim().length === 0}
            className="cv-btn cv-btn-primary flex-1"
          >
            {filing ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Filing…
              </>
            ) : (
              <>
                <Send size={16} /> {preview.matched ? "Add to this issue" : "File report"}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={filing}
            className="cv-btn cv-btn-ghost"
          >
            Discard
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
