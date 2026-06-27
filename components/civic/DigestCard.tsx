"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, RefreshCw, Loader2, Layers, Users, CheckCircle2 } from "lucide-react";
import { fadeUp } from "@/lib/motion";
import type { DigestResponseDTO } from "@/lib/types";

// F3 — AI community digest. Loads client-side so the dashboard stays instant and degrades
// gracefully if Gemini is unavailable. The digest itself is cached server-side per data-signature.
export default function DigestCard() {
  const [data, setData] = useState<DigestResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState("");

  // Network only — no setState — so it's safe to await from inside an effect.
  const fetchDigest = useCallback(async (refresh: boolean) => {
    const res = await fetch(`/api/digest${refresh ? "?refresh=1" : ""}`);
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json } as { status: number; json: DigestResponseDTO & { error?: string } };
  }, []);

  const apply = useCallback((status: number, json: DigestResponseDTO & { error?: string }) => {
    if (status === 401) {
      setHidden(true); // signed-out: don't show the card at all
    } else if (status === 200) {
      setData(json);
    } else {
      setError(json.error ?? "Couldn't generate the digest right now.");
    }
  }, []);

  // Refresh button: event handler, so synchronous setState is fine here.
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { status, json } = await fetchDigest(true);
      apply(status, json);
    } catch {
      setError("Couldn't reach the digest service.");
    } finally {
      setLoading(false);
    }
  }, [fetchDigest, apply]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status, json } = await fetchDigest(false);
        if (!cancelled) apply(status, json);
      } catch {
        if (!cancelled) setError("Couldn't reach the digest service.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchDigest, apply]);

  if (hidden) return null;

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="cv-ai-surface overflow-hidden"
      style={{
        borderRadius: "var(--c-radius-lg)",
        boxShadow: "var(--c-shadow-float)",
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid var(--c-border)" }}
      >
        <span
          className="cv-eyebrow flex items-center gap-1.5"
          style={{ color: "var(--c-accent-strong)" }}
        >
          <Sparkles size={14} /> AI community digest
        </span>
        <button
          type="button"
          aria-label="Refresh digest"
          onClick={refresh}
          disabled={loading}
          className="cv-icon-btn"
          title="Regenerate"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
        </button>
      </div>

      <div className="flex flex-col gap-4 p-5">
        {loading && !data ? (
          <div className="flex flex-col gap-2" aria-hidden>
            <div className="cv-skeleton h-4 w-full" />
            <div className="cv-skeleton h-4 w-[92%]" />
            <div className="cv-skeleton h-4 w-3/4" />
          </div>
        ) : error ? (
          <p className="text-sm" style={{ color: "var(--c-high)" }}>
            {error}
          </p>
        ) : data ? (
          <>
            <p className="text-sm leading-relaxed" style={{ color: "var(--c-ink)" }}>
              {data.digest}
            </p>
            <div className="flex flex-wrap gap-2">
              <Stat Icon={Layers} label="issues" value={data.stats.totalIssues} />
              <Stat Icon={Users} label="reports" value={data.stats.totalReports} />
              <Stat Icon={CheckCircle2} label="resolved" value={data.stats.resolvedCount} />
            </div>
            <span className="text-xs" style={{ color: "var(--c-muted)" }}>
              {data.cached ? "Cached" : "Freshly generated"} ·{" "}
              {new Date(data.generatedAt).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </>
        ) : null}
      </div>
    </motion.div>
  );
}

function Stat({
  Icon,
  label,
  value,
}: {
  Icon: typeof Layers;
  label: string;
  value: number;
}) {
  return (
    <span
      className="cv-chip"
      style={{
        color: "var(--c-ink)",
      }}
    >
      <Icon size={12} strokeWidth={2.4} style={{ color: "var(--c-muted)" }} />
      <strong>{value}</strong> {label}
    </span>
  );
}
