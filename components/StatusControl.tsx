"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATUSES } from "@/lib/config";

// Simulated municipal status lifecycle control (stub for real municipal-API integration).
export default function StatusControl({
  clusterId,
  status,
}: {
  clusterId: string;
  status: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [busy, setBusy] = useState(false);

  async function update(next: string) {
    setBusy(true);
    const res = await fetch(`/api/clusters/${clusterId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(false);
    if (res.ok) {
      setCurrent(next);
      router.refresh();
    }
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span style={{ color: "var(--c-muted)" }}>Status</span>
      <select
        value={current}
        disabled={busy}
        onChange={(e) => update(e.target.value)}
        className="cv-field w-auto"
        style={{ textTransform: "capitalize" }}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
