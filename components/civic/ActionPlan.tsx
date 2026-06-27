"use client";

import { useState } from "react";
import { HardHat, Loader2, Wrench } from "lucide-react";

export default function ActionPlan({ clusterId }: { clusterId: string }) {
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generatePlan() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clusters/${clusterId}/action-plan`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate plan");
      setPlan(data.actionPlan);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="cv-card p-5 flex flex-col gap-3 border border-orange-500/20">
      <div className="flex items-center gap-2">
        <span
          className="grid h-8 w-8 place-items-center rounded-lg"
          style={{ background: "rgba(249, 115, 22, 0.1)", color: "rgb(249, 115, 22)" }}
        >
          <HardHat size={18} strokeWidth={2.4} />
        </span>
        <h2 className="text-base font-semibold" style={{ color: "rgb(249, 115, 22)" }}>
          AI Action Plan
        </h2>
      </div>
      
      {!plan && !loading && (
        <div className="flex flex-col gap-2">
          <p className="text-sm" style={{ color: "var(--c-muted)" }}>
            Generate a step-by-step resolution plan for city maintenance crews based on this issue's details.
          </p>
          <button
            type="button"
            onClick={generatePlan}
            className="cv-btn text-sm w-fit mt-1 border border-orange-500/30 hover:bg-orange-500/10"
            style={{ color: "rgb(249, 115, 22)" }}
          >
            <Wrench size={16} /> Generate Plan
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--c-muted)" }}>
          <Loader2 size={16} className="animate-spin" />
          Analyzing civic data...
        </div>
      )}

      {error && (
        <div className="text-sm text-red-500 bg-red-500/10 p-2 rounded-md">
          {error}
        </div>
      )}

      {plan && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--c-faint)" }}>
            City Worker Briefing
          </p>
          <pre className="cv-well p-3.5 text-sm whitespace-pre-wrap font-sans leading-relaxed border-none bg-orange-500/5">
            {plan}
          </pre>
        </div>
      )}
    </section>
  );
}
