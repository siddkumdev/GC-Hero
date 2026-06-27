"use client";

import { motion } from "framer-motion";
import { ScanLine, Tags, Gauge, FileText, Check, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const ANALYZE_STAGES: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: "read", label: "Reading image", Icon: ScanLine },
  { key: "classify", label: "Classifying issue", Icon: Tags },
  { key: "severity", label: "Assessing severity", Icon: Gauge },
  { key: "draft", label: "Drafting report", Icon: FileText },
];

// The staged "Analyzing…" moment. `stage` advances on a timer while the real Gemini call is
// in flight; the reveal waits for both to finish. This is the perception layer made visible.
export default function AnalyzingStages({
  imageUrl,
  stage,
}: {
  imageUrl: string;
  stage: number;
}) {
  return (
    <div className="cv-elevated cv-ai-surface flex flex-col items-center gap-6 p-6">
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="cv-eyebrow flex items-center gap-1.5">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--c-accent)" }}
          />
          Gemini · analyzing
        </span>
        <h2 className="text-lg">Reading your photo</h2>
      </div>

      {/* Photo with a teal scan beam sweeping over it. */}
      <div
        className="relative h-44 w-full max-w-[260px] overflow-hidden rounded-[14px]"
        style={{ border: "1px solid var(--c-border-strong)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Submitted" className="h-full w-full object-cover" />
        <motion.div
          aria-hidden
          className="absolute inset-x-0 h-16"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(14,147,132,0.28), transparent)",
            boxShadow: "0 0 18px 2px rgba(14,147,132,0.35)",
          }}
          initial={{ y: -64 }}
          animate={{ y: 176 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ boxShadow: "inset 0 0 0 1.5px rgba(14,147,132,0.25)" }}
        />
      </div>

      {/* Stage checklist. */}
      <ol className="flex w-full max-w-[260px] flex-col gap-2.5">
        {ANALYZE_STAGES.map((s, i) => {
          const done = i < stage;
          const active = i === stage;
          return (
            <li key={s.key} className="flex items-center gap-3">
              <span
                className="grid h-7 w-7 place-items-center rounded-full transition-colors"
                style={{
                  background: done
                    ? "var(--c-accent)"
                    : active
                      ? "var(--c-accent-weak)"
                      : "var(--c-surface-2)",
                  color: done
                    ? "var(--c-on-accent)"
                    : active
                      ? "var(--c-accent-strong)"
                      : "var(--c-faint)",
                  border: active ? "1px solid var(--c-accent)" : "1px solid var(--c-border)",
                }}
              >
                {done ? (
                  <Check size={15} strokeWidth={3} />
                ) : active ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <s.Icon size={14} />
                )}
              </span>
              <span
                className="text-sm transition-colors"
                style={{
                  color: active
                    ? "var(--c-ink)"
                    : done
                      ? "var(--c-muted)"
                      : "var(--c-faint)",
                  fontWeight: active ? 600 : 500,
                }}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
