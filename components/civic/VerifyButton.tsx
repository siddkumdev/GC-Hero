"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, ThumbsUp, Users } from "lucide-react";
import { spring } from "@/lib/motion";
import type { ConfirmState, VerifyResultDTO } from "@/lib/types";

// F4 — community verification ("I see this too"). One-tap corroboration of an existing issue,
// no photo / no Gemini. Optimistic, satisfying count bump; the server enforces one per citizen
// per issue (DB unique + reporter check), so re-taps and reporters are handled gracefully.
//
// `full` = the issue-detail block (label + people copy). `compact` = the map popup (tight button).
export default function VerifyButton({
  clusterId,
  initialCount,
  initialState,
  variant = "full",
}: {
  clusterId: string;
  initialCount: number;
  initialState: ConfirmState;
  variant?: "full" | "compact";
}) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [state, setState] = useState<ConfirmState>(initialState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirmed = state !== "can";

  async function confirm() {
    if (confirmed || busy) return;
    setBusy(true);
    setError("");

    let res: Response | null = null;
    try {
      res = await fetch(`/api/clusters/${clusterId}/verify`, { method: "POST" });
    } catch {
      setError("Network error — try again.");
      setBusy(false);
      return;
    }

    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (res.status === 201) {
      const dto = data as VerifyResultDTO;
      setCount(dto.verifiedCount);
      setState("verified");
      router.refresh(); // keep the dashboard/map credibility figure in sync on next view
    } else if (res.status === 409) {
      // Already corroborated (reported or verified earlier) — reflect the true state, no bump.
      setState((data.state as ConfirmState) ?? "verified");
    } else if (res.status === 401) {
      router.push("/login?next=" + encodeURIComponent(location.pathname));
    } else {
      setError(data.error ?? "Couldn't record that — try again.");
    }
  }

  const label =
    state === "reported"
      ? "You reported this"
      : state === "verified"
        ? "You confirmed this"
        : "I see this too";

  // --- Compact (map popup) ---------------------------------------------------------------
  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={confirm}
        disabled={confirmed || busy}
        title={confirmed ? label : "Confirm you've seen this issue too"}
        className={`cv-chip ${confirmed ? "" : "cursor-pointer"}`}
        style={
          confirmed
            ? { color: "var(--c-ok)", background: "var(--c-ok-bg)", borderColor: "var(--c-ok-bd)" }
            : { color: "var(--c-accent-strong)", borderColor: "var(--c-accent-ring)" }
        }
      >
        {busy ? (
          <Loader2 size={12} className="animate-spin" />
        ) : confirmed ? (
          <Check size={12} strokeWidth={2.6} />
        ) : (
          <ThumbsUp size={12} strokeWidth={2.4} />
        )}
        {confirmed ? label : "I see this too"}
        {count > 0 && <strong style={{ color: "inherit" }}>· {count}</strong>}
      </button>
    );
  }

  // --- Full (issue detail) ---------------------------------------------------------------
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={confirm}
          disabled={confirmed || busy}
          className={`cv-btn ${confirmed ? "cv-btn-secondary" : "cv-btn-primary"}`}
          style={
            confirmed
              ? { color: "var(--c-ok)", borderColor: "var(--c-ok-bd)", background: "var(--c-ok-bg)" }
              : undefined
          }
        >
          <AnimatePresence mode="wait" initial={false}>
            {busy ? (
              <motion.span key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Loader2 size={16} className="animate-spin" />
              </motion.span>
            ) : confirmed ? (
              <motion.span key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring}>
                <Check size={16} strokeWidth={2.6} />
              </motion.span>
            ) : (
              <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ThumbsUp size={16} strokeWidth={2.4} />
              </motion.span>
            )}
          </AnimatePresence>
          {label}
        </button>

        <span className="flex items-center gap-1.5 text-sm" style={{ color: "var(--c-muted)" }}>
          <Users size={14} strokeWidth={2.2} />
          {count > 0 ? (
            <>
              <AnimatedCount value={count} />
              {" "}
              {count === 1 ? "citizen also confirms" : "citizens also confirm"} this
            </>
          ) : (
            "Be the first to confirm this"
          )}
        </span>
      </div>

      {error && (
        <span className="text-xs" style={{ color: "var(--c-high)" }}>
          {error}
        </span>
      )}
    </div>
  );
}

// Tiny pop when the confirm count bumps — the satisfying "+1" beat.
function AnimatedCount({ value }: { value: number }) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.strong
        key={value}
        initial={{ y: 6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -6, opacity: 0 }}
        transition={spring}
        style={{ color: "var(--c-ink)", display: "inline-block" }}
      >
        {value}
      </motion.strong>
    </AnimatePresence>
  );
}
