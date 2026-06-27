"use client";

import { useState } from "react";
import { Megaphone, Loader2 } from "lucide-react";

export default function EscalateIssue({ clusterId }: { clusterId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleEscalate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/clusters/${clusterId}/escalate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to escalate");
      
      const mailtoUrl = `mailto:?subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(data.body)}`;
      window.location.href = mailtoUrl;
    } catch (err: any) {
      alert("Failed to escalate: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleEscalate}
      disabled={loading}
      className="cv-btn cv-btn-secondary text-sm disabled:opacity-50"
      title="Draft formal email to local authorities"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <Megaphone size={16} />}
      Escalate
    </button>
  );
}
