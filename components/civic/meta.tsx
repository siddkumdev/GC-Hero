import {
  Construction,
  Droplets,
  Lightbulb,
  Trash2,
  MapPin,
  TriangleAlert,
  CircleAlert,
  Info,
  CircleDot,
  Eye,
  Wrench,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import type { Category, Severity, Status } from "@/lib/config";

// Single source of truth for the "civic" design language's icons + semantic colors.
// Distinct, purposeful category icons (no emoji); severity/status colors are consistent
// across feed, map, and detail. See .memory/design-system.md.

export const CATEGORY_META: Record<Category, { label: string; Icon: LucideIcon }> = {
  pothole: { label: "Pothole", Icon: Construction },
  water_leak: { label: "Water leak", Icon: Droplets },
  broken_streetlight: { label: "Broken streetlight", Icon: Lightbulb },
  garbage: { label: "Garbage / waste", Icon: Trash2 },
  other: { label: "Other", Icon: MapPin },
};

export function categoryMeta(category: string) {
  return CATEGORY_META[category as Category] ?? CATEGORY_META.other;
}

export const SEVERITY_META: Record<
  Severity,
  { label: string; badgeClass: string; Icon: LucideIcon }
> = {
  high: { label: "High", badgeClass: "cv-sev-high", Icon: TriangleAlert },
  med: { label: "Medium", badgeClass: "cv-sev-med", Icon: CircleAlert },
  low: { label: "Low", badgeClass: "cv-sev-low", Icon: Info },
};

export function severityMeta(severity: string) {
  return SEVERITY_META[severity as Severity] ?? SEVERITY_META.low;
}

// Severity → solid accent color (for the card left-border accent — REF: instant scanability).
const SEVERITY_ACCENT: Record<Severity, string> = {
  high: "var(--c-high)",
  med: "var(--c-med)",
  low: "var(--c-low)",
};

export function severityAccent(severity: string) {
  return SEVERITY_ACCENT[severity as Severity] ?? SEVERITY_ACCENT.low;
}

export const STATUS_META: Record<
  Status,
  { label: string; badgeClass: string; Icon: LucideIcon }
> = {
  submitted: { label: "Submitted", badgeClass: "cv-sev-low", Icon: CircleDot },
  acknowledged: { label: "Acknowledged", badgeClass: "cv-sev-low", Icon: Eye },
  in_progress: { label: "In progress", badgeClass: "cv-sev-med", Icon: Wrench },
  resolved: { label: "Resolved", badgeClass: "cv-sev-ok", Icon: CheckCircle2 },
};

export function statusMeta(status: string) {
  return STATUS_META[status as Status] ?? STATUS_META.submitted;
}
