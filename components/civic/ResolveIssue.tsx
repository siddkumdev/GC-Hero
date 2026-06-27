"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Images,
  CheckCircle2,
  Sparkles,
  Loader2,
  RefreshCw,
  TriangleAlert,
  Wrench,
  X,
} from "lucide-react";
import { fadeUp, spring } from "@/lib/motion";
import type { ResolveResultDTO } from "@/lib/types";

type Phase = "idle" | "ready" | "checking" | "unresolved" | "error";

// F1 manual path. Lets anyone upload an "after" photo and have Gemini verify (before/after)
// whether the issue is fixed. Shares the same /api/clusters/[id]/resolve endpoint and verdict
// logic as the report-flow auto path. If already resolved, shows the AI's confirmation instead.
export default function ResolveIssue({
  clusterId,
  resolved,
  originalImagePath,
  resolutionImagePath,
  resolutionReasoning,
  resolutionConfidence,
}: {
  clusterId: string;
  resolved: boolean;
  originalImagePath: string | null;
  resolutionImagePath: string | null;
  resolutionReasoning: string | null;
  resolutionConfidence: number | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [message, setMessage] = useState("");
  const [verdict, setVerdict] = useState<ResolveResultDTO | null>(null);
  const successRef = useRef(false);

  // Already resolved → show the AI's confirmation (satisfying payoff, persists across reloads).
  if (resolved) {
    return (
      <ResolvedCard
        before={originalImagePath}
        after={resolutionImagePath}
        reasoning={resolutionReasoning}
        confidence={resolutionConfidence}
      />
    );
  }

  function onPick(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    setMessage("");
    setPhase(f ? "ready" : "idle");
  }

  function reset() {
    onPick(null);
    setFileKey((k) => k + 1);
    setVerdict(null);
    setMessage("");
    setPhase("idle");
  }

  async function check() {
    if (!file) return;
    setPhase("checking");
    const form = new FormData();
    form.append("image", file);

    let res: Response | null = null;
    try {
      res = await fetch(`/api/clusters/${clusterId}/resolve`, {
        method: "POST",
        body: form,
      });
    } catch {
      setMessage("Network error — please try again.");
      setPhase("error");
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (res.status === 200) {
      const dto = data as ResolveResultDTO;
      setVerdict(dto);
      if (dto.statusChanged) {
        // Confirmed fixed → refresh so the page re-renders into the resolved state.
        successRef.current = true;
        router.refresh();
      } else {
        setPhase("unresolved");
      }
    } else if (res.status === 503) {
      setMessage("Gemini is busy right now. Your photo is still loaded — just tap Try again.");
      setPhase("error");
    } else {
      setMessage(data.error ?? "Couldn't verify the photo. Please try again.");
      setPhase("error");
    }
  }

  return (
    <div className="cv-card flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Wrench size={15} style={{ color: "var(--c-muted)" }} />
        <span className="cv-eyebrow">Resolution check</span>
      </div>

      <AnimatePresence mode="wait">
        {(phase === "idle" || phase === "ready") && (
          <motion.div key="capture" variants={fadeUp} initial="hidden" animate="show" className="flex flex-col gap-3">
            <p className="text-sm" style={{ color: "var(--c-muted)" }}>
              Think it&apos;s fixed? Upload an &ldquo;after&rdquo; photo and Gemini will compare it
              to the original to confirm.
            </p>
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="After"
                className="h-44 w-full rounded-[12px] object-cover"
                style={{ border: "1px solid var(--c-border)" }}
              />
            )}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5">
              <div className="lg:hidden">
                <label className="cv-btn cv-btn-secondary cursor-pointer w-full">
                  <Camera size={16} /> {preview ? "Retake" : "Take photo"}
                  <input
                    key={`cam-${fileKey}`}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => onPick(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
              </div>
              <label className="cv-btn cv-btn-secondary cursor-pointer">
                <Images size={16} /> Gallery
                <input
                  key={`lib-${fileKey}`}
                  type="file"
                  accept="image/*"
                  onChange={(e) => onPick(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>
            </div>
            {phase === "ready" && (
              <button type="button" onClick={check} className="cv-btn cv-btn-primary">
                <Sparkles size={16} /> Verify with Gemini
              </button>
            )}
          </motion.div>
        )}

        {phase === "checking" && (
          <motion.div
            key="checking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 py-3"
          >
            <Loader2 size={18} className="animate-spin" style={{ color: "var(--c-accent-strong)" }} />
            <span className="text-sm" style={{ color: "var(--c-muted)" }}>
              Comparing your photo to the original…
            </span>
          </motion.div>
        )}

        {phase === "unresolved" && verdict && (
          <motion.div key="unresolved" variants={fadeUp} initial="hidden" animate="show" className="flex flex-col gap-3">
            <div
              className="flex items-start gap-3 rounded-[12px] p-3.5"
              style={{ background: "var(--c-med-bg)", border: "1px solid var(--c-med-bd)" }}
            >
              <TriangleAlert size={18} style={{ color: "var(--c-med)", marginTop: 1 }} />
              <div className="flex flex-col gap-0.5 text-sm">
                <span className="font-semibold" style={{ color: "var(--c-ink)" }}>
                  Gemini couldn&apos;t confirm it&apos;s fixed
                </span>
                <span style={{ color: "var(--c-muted)" }}>{verdict.reasoning}</span>
                <span className="text-xs pt-0.5" style={{ color: "var(--c-faint)" }}>
                  Confidence {(verdict.confidence * 100).toFixed(0)}% · issue left open
                </span>
              </div>
            </div>
            <button type="button" onClick={reset} className="cv-btn cv-btn-secondary">
              <RefreshCw size={16} /> Try another photo
            </button>
          </motion.div>
        )}

        {phase === "error" && (
          <motion.div key="error" variants={fadeUp} initial="hidden" animate="show" className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-sm" style={{ color: "var(--c-high)" }}>
              <TriangleAlert size={15} /> {message}
            </p>
            <div className="flex gap-2.5">
              <button type="button" onClick={check} className="cv-btn cv-btn-primary" disabled={!file}>
                <RefreshCw size={16} /> Try again
              </button>
              <button type="button" onClick={reset} className="cv-btn cv-btn-ghost">
                <X size={16} /> Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// The "AI confirmed it's fixed" payoff — before/after side by side with Gemini's reasoning.
function ResolvedCard({
  before,
  after,
  reasoning,
  confidence,
}: {
  before: string | null;
  after: string | null;
  reasoning: string | null;
  confidence: number | null;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="cv-elevated flex flex-col gap-4 p-5"
    >
      <div className="flex items-center gap-2.5">
        <motion.span
          initial={{ scale: 0, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={spring}
          className="grid h-9 w-9 place-items-center rounded-full"
          style={{ background: "var(--c-ok-bg)", color: "var(--c-ok)", border: "1px solid var(--c-ok-bd)" }}
        >
          <CheckCircle2 size={20} strokeWidth={2.2} />
        </motion.span>
        <div className="flex flex-col">
          <span className="cv-eyebrow" style={{ color: "var(--c-ok)" }}>
            Gemini confirmed · resolved
          </span>
          <h2 className="text-base font-semibold">AI verified this is fixed</h2>
        </div>
      </div>

      {(before || after) && (
        <div className="grid grid-cols-2 gap-2.5">
          <BeforeAfterTile label="Before" src={before} />
          <BeforeAfterTile label="After" src={after} />
        </div>
      )}

      {reasoning && (
        <div
          className="rounded-[12px] p-3.5 text-sm"
          style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border)" }}
        >
          <span className="cv-eyebrow flex items-center gap-1.5">
            <Sparkles size={12} /> Gemini&apos;s reasoning
          </span>
          <p className="pt-1.5" style={{ color: "var(--c-text)" }}>
            {reasoning}
          </p>
          {confidence != null && (
            <p className="pt-1 text-xs" style={{ color: "var(--c-faint)" }}>
              Confidence {(confidence * 100).toFixed(0)}%
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}

function BeforeAfterTile({ label, src }: { label: string; src: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="cv-eyebrow">{label}</span>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={label}
          className="h-32 w-full rounded-[12px] object-cover"
          style={{ border: "1px solid var(--c-border)" }}
        />
      ) : (
        <div
          className="grid h-32 w-full place-items-center rounded-[12px] text-xs"
          style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border)", color: "var(--c-faint)" }}
        >
          No photo
        </div>
      )}
    </div>
  );
}
