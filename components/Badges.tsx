import { Users } from "lucide-react";
import { severityMeta, statusMeta } from "@/components/civic/meta";

// Civic semantic chips for severity and status, plus the "N citizens" credibility count.
// Colors are consistent across feed, map, and detail (see components/civic/meta.tsx).

export function SeverityPill({ severity }: { severity: string }) {
  const { label, badgeClass, Icon } = severityMeta(severity);
  return (
    <span className={`cv-chip ${badgeClass}`}>
      <Icon size={12} strokeWidth={2.4} />
      {label}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const { label, badgeClass, Icon } = statusMeta(status);
  return (
    <span className={`cv-chip ${badgeClass}`}>
      <Icon size={12} strokeWidth={2.4} />
      {label}
    </span>
  );
}

// The clustering payoff ("N citizens, one issue") — made to pop in teal so it reads as the
// credibility signal, not just another grey chip.
export function CountPill({ count }: { count: number }) {
  return (
    <span
      className="cv-chip"
      style={{
        color: "var(--c-accent-strong)",
        background: "var(--c-accent-weak)",
        borderColor: "var(--c-accent-ring)",
        fontWeight: 700,
      }}
    >
      <Users size={13} strokeWidth={2.4} />
      {count} citizen{count === 1 ? "" : "s"}
    </span>
  );
}
