"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ArrowLeft } from "lucide-react";

const STORAGE_KEY = "ghero_onboarding_v1";
const PAD = 10;

const STEPS = [
  {
    target: "feed",
    title: "Your area's civic issues",
    body: "Every reported problem, automatically clustered so duplicates never pile up — sorted by urgency so the worst issues rise first.",
    placement: "below" as const,
  },
  {
    target: "filters",
    title: "Filter by category or status",
    body: "Narrow down to potholes, leaks, broken lights, and more — or see only what's unresolved.",
    placement: "below" as const,
  },
  {
    target: "map-btn",
    title: "Explore on the map",
    body: "Switch to map view to see issue pins across your neighbourhood streets. Tap any pin for details.",
    placement: "above" as const,
  },
  {
    target: "fab",
    title: "Report a new issue",
    body: "Tap + to photograph a problem. AI classifies it, drafts a complaint, and merges duplicates — in under 10 seconds.",
    placement: "above" as const,
  },
  {
    target: "search-btn",
    title: "Natural-language search",
    body: "Ask anything: 'potholes near me last week' or 'unresolved water leaks'. The AI understands what you mean.",
    placement: "below" as const,
  },
];

type Rect = { top: number; left: number; width: number; height: number };

function getRect(target: string): Rect | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
}

export default function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const computeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const computeRect = useCallback((s: number) => {
    const r = getRect(STEPS[s].target);
    setRect(r);
  }, []);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      const t = setTimeout(() => setVisible(true), 700);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    // Scroll target into view then recompute position
    const el = document.querySelector(`[data-tour="${STEPS[step].target}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    computeTimer.current = setTimeout(() => computeRect(step), 380);
    return () => { if (computeTimer.current) clearTimeout(computeTimer.current); };
  }, [visible, step, computeRect]);

  // Recompute on resize
  useEffect(() => {
    if (!visible) return;
    const handler = () => computeRect(step);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [visible, step, computeRect]);

  const finish = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }, []);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else finish();
  }, [step, finish]);

  const back = useCallback(() => {
    if (step > 0) setStep((s) => s - 1);
  }, [step]);

  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Tooltip position: centred horizontally, above or below the spotlight rect
  const vp = typeof window !== "undefined" ? { w: window.innerWidth, h: window.innerHeight } : { w: 390, h: 844 };
  const tooltipW = Math.min(vp.w - 32, 340);

  let tooltipY = vp.h / 2 - 80;
  if (rect) {
    tooltipY = cur.placement === "above"
      ? rect.top - 16        // card will translateY(-100%) from this point
      : rect.top + rect.height + 16;
  }

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Click-anywhere-to-skip overlay (behind spotlight) */}
          <motion.div
            key="bg"
            className="fixed inset-0 z-[9000]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            onClick={finish}
          />

          {/* Spotlight: box-shadow creates the dark vignette; the div itself is the "hole" */}
          <AnimatePresence mode="wait">
            {rect ? (
              <motion.div
                key="spotlight"
                className="fixed z-[9001] pointer-events-none"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  top: rect.top,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height,
                }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 280, damping: 28 }}
                style={{
                  borderRadius: 14,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)",
                  border: "1.5px solid var(--c-accent)",
                  boxSizing: "border-box",
                }}
              />
            ) : (
              // No element found — full dim overlay without a hole
              <motion.div
                key="dim"
                className="fixed inset-0 z-[9001] pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{ background: "rgba(0,0,0,0.72)" }}
              />
            )}
          </AnimatePresence>

          {/* Tooltip card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`tip-${step}`}
              className="fixed z-[9002] pointer-events-auto"
              style={{
                top: tooltipY,
                left: "50%",
                width: tooltipW,
                x: "-50%",
                ...(cur.placement === "above" ? { y: "-100%" } : { y: 0 }),
              }}
              initial={{ opacity: 0, scale: 0.93, y: cur.placement === "above" ? "calc(-100% + 12px)" : 12 }}
              animate={{ opacity: 1, scale: 1, y: cur.placement === "above" ? "-100%" : 0 }}
              exit={{ opacity: 0, scale: 0.93, y: cur.placement === "above" ? "calc(-100% + 8px)" : 8 }}
              transition={{ type: "spring", stiffness: 420, damping: 30, delay: 0.08 }}
            >
              <div
                className="cv-card p-5 flex flex-col gap-4"
                style={{
                  border: "1px solid var(--c-border-strong)",
                  boxShadow: "var(--c-shadow-float), 0 0 24px var(--c-accent-weak)",
                }}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span
                      className="text-[11px] font-semibold uppercase tracking-widest"
                      style={{ color: "var(--c-accent)" }}
                    >
                      {step + 1} of {STEPS.length}
                    </span>
                    <h3
                      className="cv-display text-[1rem] font-semibold leading-snug"
                      style={{ color: "var(--c-ink)" }}
                    >
                      {cur.title}
                    </h3>
                  </div>
                  <button
                    onClick={finish}
                    aria-label="Skip tour"
                    className="cv-icon-btn shrink-0 mt-0.5"
                  >
                    <X size={15} strokeWidth={2.5} />
                  </button>
                </div>

                <p className="text-sm leading-relaxed" style={{ color: "var(--c-text)" }}>
                  {cur.body}
                </p>

                {/* Progress dots + buttons */}
                <div className="flex items-center justify-between gap-3">
                  {/* Animated progress dots */}
                  <div className="flex items-center gap-1.5">
                    {STEPS.map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{ width: i === step ? 18 : 6 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        style={{
                          height: 6,
                          borderRadius: 3,
                          background: i === step ? "var(--c-accent)" : "var(--c-border-strong)",
                        }}
                      />
                    ))}
                  </div>

                  <div className="flex gap-2">
                    {step > 0 && (
                      <button
                        onClick={back}
                        className="cv-btn text-sm py-1.5 px-3 flex items-center gap-1"
                      >
                        <ArrowLeft size={14} strokeWidth={2.5} />
                      </button>
                    )}
                    <button
                      onClick={next}
                      className="cv-btn cv-btn-primary text-sm py-1.5 px-4 flex items-center gap-1.5"
                    >
                      {isLast ? "Done" : "Next"}
                      {!isLast && <ChevronRight size={14} strokeWidth={2.5} />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
