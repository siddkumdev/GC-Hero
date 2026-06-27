"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Images,
  MapPin,
  Crosshair,
  Sparkles,
  TriangleAlert,
  RefreshCw,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Plus,
  X,
} from "lucide-react";
import { fadeUp, spring } from "@/lib/motion";
import AnalyzingStages, { ANALYZE_STAGES } from "@/components/civic/AnalyzingStages";
import AiResultCard from "@/components/civic/AiResultCard";
import FiledResult from "@/components/civic/FiledResult";
import type { AnalyzeResultDTO, ConfirmResultDTO, ResolveResultDTO } from "@/lib/types";

type Phase =
  | "capture"
  | "analyzing"
  | "reveal"
  | "filed"
  | "rejected"
  | "error"
  | "resolving"
  | "resolved";

const STAGE_MS = 700;
const MIN_ANALYZE_MS = 2100; // floor so the staged reveal always feels deliberate
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function ReportFlow() {
  const [phase, setPhase] = useState<Phase>("capture");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locStatus, setLocStatus] = useState("");

  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<AnalyzeResultDTO | null>(null);
  const [complaint, setComplaint] = useState("");
  const [confirmResult, setConfirmResult] = useState<ConfirmResultDTO | null>(null);
  const [filing, setFiling] = useState(false);
  const [message, setMessage] = useState("");
  const [retryable, setRetryable] = useState(false);
  // F1 auto-path: result of a "Yes, check it" before/after verification.
  const [resolveResult, setResolveResult] = useState<ResolveResultDTO | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string | null>(null);

  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  function onPick(f: File | null) {
    // Revoke any previous blob URL to avoid memory accumulation.
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    setMessage("");
  }

  function captureLocation() {
    if (!("geolocation" in navigator)) {
      setLocStatus("Geolocation unavailable — enter coordinates manually.");
      return;
    }
    setLocStatus("Locating…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
        setLocStatus("Location captured");
      },
      () => setLocStatus("Location denied — enter coordinates manually."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function resetToCapture() {
    onPick(null);
    setFileKey((k) => k + 1);
    setResult(null);
    setConfirmResult(null);
    setComplaint("");
    setMessage("");
    setRetryable(false);
    setResolveResult(null);
    setResolutionNote(null);
    setPhase("capture");
  }

  function validCoords() {
    const la = Number(lat);
    const ln = Number(lng);
    return (
      Number.isFinite(la) && Number.isFinite(ln) &&
      la >= -90 && la <= 90 && ln >= -180 && ln <= 180
    );
  }

  async function analyze() {
    if (!file) {
      setMessage("Add a photo first — take one or choose from your gallery.");
      return;
    }
    if (!validCoords()) {
      setMessage("Enter a valid latitude (-90..90) and longitude (-180..180).");
      return;
    }

    setPhase("analyzing");
    setStage(0);
    // Floor the staged moment so it always feels deliberate, even if Gemini is fast.
    const minDelay = sleep(MIN_ANALYZE_MS);
    stageTimer.current = setInterval(() => {
      setStage((s) => (s < ANALYZE_STAGES.length - 1 ? s + 1 : s));
    }, STAGE_MS);

    const form = new FormData();
    form.append("image", file);
    form.append("lat", lat);
    form.append("lng", lng);

    let res: Response | null = null;
    try {
      res = await fetch("/api/reports/analyze", { method: "POST", body: form });
    } catch {
      stopTimer();
      setMessage("Network error — please try again.");
      setRetryable(true);
      setPhase("error");
      return;
    }

    const data = await res.json().catch(() => ({}));

    await minDelay; // resolves immediately if the call already took longer
    stopTimer();
    setStage(ANALYZE_STAGES.length);
    await sleep(380);

    if (res.status === 200) {
      const dto = data as AnalyzeResultDTO;
      setResult(dto);
      setComplaint(dto.complaintDraft);
      setPhase("reveal");
    } else if (res.status === 422) {
      setMessage(data.reason ?? "This photo isn't a civic issue we can act on.");
      setPhase("rejected");
    } else if (res.status === 503) {
      setMessage("Gemini is busy right now. Your photo is still loaded — just tap Try again.");
      setRetryable(true);
      setPhase("error");
    } else if (res.status === 401) {
      setMessage("Your session expired. Please sign in again.");
      setRetryable(false);
      setPhase("error");
    } else {
      setMessage(data.error ?? "Something went wrong analyzing the photo.");
      setRetryable(true);
      setPhase("error");
    }
  }

  function stopTimer() {
    if (stageTimer.current) {
      clearInterval(stageTimer.current);
      stageTimer.current = null;
    }
  }

  // Clean up the interval if the component unmounts mid-analysis
  // (e.g. the user navigates away while Gemini is running).
  useEffect(() => {
    return () => {
      stopTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmReport() {
    if (!result) return;
    setFiling(true);
    let res: Response | null = null;
    try {
      res = await fetch("/api/reports/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId: result.analysisId, complaintDraft: complaint }),
      });
    } catch {
      setFiling(false);
      setMessage("Network error while filing — please try again.");
      setPhase("error");
      return;
    }
    setFiling(false);
    const data = await res.json().catch(() => ({}));

    if (res.status === 201) {
      setConfirmResult(data as ConfirmResultDTO);
      setPhase("filed");
    } else if (res.status === 410) {
      setMessage("This analysis expired. Please re-submit the photo to analyze it again.");
      setPhase("error");
    } else {
      setMessage(data.error ?? "Couldn't file the report. Please try again.");
      setPhase("error");
    }
  }

  // F1 auto-path. The user tapped "Yes, check it" — verify their photo against the nearby open
  // issue's original. On a confident fix we land on the resolved screen; otherwise we fall back
  // to the reveal with a note so they can still file it as a new report.
  async function checkResolved() {
    const clusterId = result?.resolutionSuggestion?.clusterId;
    if (!file || !clusterId) return;
    setResolutionNote(null);
    setPhase("resolving");

    const form = new FormData();
    form.append("image", file);

    let res: Response | null = null;
    try {
      res = await fetch(`/api/clusters/${clusterId}/resolve`, { method: "POST", body: form });
    } catch {
      setResolutionNote(
        "Network error — couldn't verify. You can still file this as a new report.",
      );
      setPhase("reveal");
      return;
    }

    const data = await res.json().catch(() => ({}));
    const fallback = " You can still file this as a new report below.";
    if (res.status === 200) {
      const dto = data as ResolveResultDTO;
      if (dto.statusChanged) {
        setResolveResult(dto);
        setPhase("resolved");
      } else {
        setResolutionNote(`Gemini couldn't confirm it's fixed: ${dto.reasoning}${fallback}`);
        setPhase("reveal");
      }
    } else if (res.status === 503) {
      setResolutionNote("Gemini is busy — couldn't check right now." + fallback);
      setPhase("reveal");
    } else {
      setResolutionNote((data.error ?? "Couldn't verify the photo.") + fallback);
      setPhase("reveal");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <AnimatePresence mode="wait">
        {phase === "capture" && (
          <motion.div
            key="capture"
            variants={fadeUp}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-5"
          >
            {/* Photo capture — front and center */}
            <div className="cv-card flex flex-col gap-4 p-4">
              <div
                className="relative grid min-h-[200px] place-items-center overflow-hidden rounded-[22px]"
                style={{
                  background: "var(--c-surface-2)",
                  border: preview ? "1px solid var(--c-border)" : "1px dashed var(--c-border-strong)",
                }}
              >
                {preview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Selected" className="h-[240px] w-full object-cover" />
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={() => {
                        onPick(null);
                        setFileKey((k) => k + 1);
                      }}
                      className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full"
                      style={{ background: "rgba(20,24,31,0.55)", color: "#fff", backdropFilter: "blur(2px)" }}
                    >
                      <X size={16} strokeWidth={2.6} />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                    <span
                      className="grid h-12 w-12 place-items-center rounded-full"
                      style={{ background: "var(--c-accent-weak)", color: "var(--c-accent-strong)" }}
                    >
                      <Camera size={22} />
                    </span>
                    <p className="text-sm font-medium" style={{ color: "var(--c-ink)" }}>
                      Photograph the issue
                    </p>
                    <p className="text-xs" style={{ color: "var(--c-faint)" }}>
                      A pothole, leak, broken streetlight, or garbage
                    </p>
                  </div>
                )}
              </div>

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
            </div>

            {/* Location */}
            <div className="cv-card flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <span className="cv-eyebrow flex items-center gap-1.5">
                  <MapPin size={12} /> Location
                </span>
                <button type="button" onClick={captureLocation} className="cv-btn cv-btn-ghost text-sm">
                  <Crosshair size={15} /> Use my location
                </button>
              </div>
              {locStatus && (
                <span className="text-xs" style={{ color: "var(--c-muted)" }}>
                  {locStatus}
                </span>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--c-muted)" }}>
                  Latitude
                  <input value={lat} onChange={(e) => setLat(e.target.value)} className="cv-field" placeholder="12.97160" />
                </label>
                <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--c-muted)" }}>
                  Longitude
                  <input value={lng} onChange={(e) => setLng(e.target.value)} className="cv-field" placeholder="77.59460" />
                </label>
              </div>
            </div>

            {message && (
              <p className="flex items-center gap-2 text-sm" style={{ color: "var(--c-high)" }}>
                <TriangleAlert size={15} /> {message}
              </p>
            )}

            <button type="button" onClick={analyze} className="cv-btn cv-btn-primary py-3.5">
              <Sparkles size={17} /> Analyze with Gemini
            </button>
          </motion.div>
        )}

        {phase === "analyzing" && preview && (
          <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AnalyzingStages imageUrl={preview} stage={stage} />
          </motion.div>
        )}

        {phase === "reveal" && result && (
          <motion.div key="reveal" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <AiResultCard
              result={result}
              complaint={complaint}
              onComplaintChange={setComplaint}
              onConfirm={confirmReport}
              onDiscard={resetToCapture}
              filing={filing}
              onCheckResolved={checkResolved}
              resolutionNote={resolutionNote}
            />
          </motion.div>
        )}

        {phase === "resolving" && (
          <motion.div
            key="resolving"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="cv-elevated p-8"
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <Loader2 size={28} className="animate-spin" style={{ color: "var(--c-accent-strong)" }} />
              <div className="flex flex-col gap-1">
                <h2 className="text-lg">Verifying the fix</h2>
                <p className="text-sm" style={{ color: "var(--c-muted)" }}>
                  Gemini is comparing your photo to the original report…
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {phase === "resolved" && resolveResult && (
          <motion.div key="resolved" variants={fadeUp} initial="hidden" animate="show" className="cv-elevated p-6">
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
                <h2 className="text-xl">AI confirmed it&apos;s fixed</h2>
                <p className="text-sm" style={{ color: "var(--c-muted)" }}>
                  Gemini verified your photo against the original — the existing issue is now
                  marked resolved.
                </p>
              </div>
              <div
                className="w-full rounded-[15px] p-4 text-left text-sm"
                style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border)" }}
              >
                <span className="cv-eyebrow flex items-center gap-1.5">
                  <Sparkles size={12} /> Gemini&apos;s reasoning
                </span>
                <p className="pt-1.5" style={{ color: "var(--c-text)" }}>
                  {resolveResult.reasoning}
                </p>
                <p className="pt-1 text-xs" style={{ color: "var(--c-faint)" }}>
                  Confidence {(resolveResult.confidence * 100).toFixed(0)}%
                </p>
              </div>
              <div className="flex w-full flex-col gap-2.5 pt-1">
                {result?.resolutionSuggestion && (
                  <Link
                    href={`/issues/${result.resolutionSuggestion.clusterId}`}
                    className="cv-btn cv-btn-primary w-full"
                  >
                    View resolved issue <ArrowRight size={16} />
                  </Link>
                )}
                <button type="button" onClick={resetToCapture} className="cv-btn cv-btn-secondary">
                  <Plus size={16} /> Report another
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {phase === "filed" && confirmResult && (
          <motion.div key="filed" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <FiledResult
              result={confirmResult}
              category={result?.category ?? "other"}
              onReportAnother={resetToCapture}
            />
          </motion.div>
        )}

        {phase === "rejected" && (
          <motion.div key="rejected" variants={fadeUp} initial="hidden" animate="show" className="cv-elevated p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <span
                className="grid h-14 w-14 place-items-center rounded-full"
                style={{ background: "var(--c-med-bg)", color: "var(--c-med)", border: "1px solid var(--c-med-bd)" }}
              >
                <TriangleAlert size={28} />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg">Not a civic issue</h2>
                <p className="text-sm" style={{ color: "var(--c-muted)" }}>{message}</p>
              </div>
              <button type="button" onClick={resetToCapture} className="cv-btn cv-btn-primary">
                <RefreshCw size={16} /> Try another photo
              </button>
            </div>
          </motion.div>
        )}

        {phase === "error" && (
          <motion.div key="error" variants={fadeUp} initial="hidden" animate="show" className="cv-elevated p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <span
                className="grid h-14 w-14 place-items-center rounded-full"
                style={{ background: "var(--c-high-bg)", color: "var(--c-high)", border: "1px solid var(--c-high-bd)" }}
              >
                <TriangleAlert size={28} />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg">Something went wrong</h2>
                <p className="text-sm" style={{ color: "var(--c-muted)" }}>{message}</p>
              </div>
              <div className="flex gap-2.5">
                {result ? (
                  <button type="button" onClick={() => setPhase("reveal")} className="cv-btn cv-btn-secondary">
                    Back to result
                  </button>
                ) : null}
                {retryable && !result ? (
                  <>
                    <button type="button" onClick={analyze} className="cv-btn cv-btn-primary">
                      <RefreshCw size={16} /> Try again
                    </button>
                    <button type="button" onClick={resetToCapture} className="cv-btn cv-btn-ghost">
                      Start over
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={resetToCapture} className="cv-btn cv-btn-primary">
                    <RefreshCw size={16} /> Start over
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
