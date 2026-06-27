"use client";

import { motion } from "framer-motion";
import { User } from "lucide-react";
import { spring } from "@/lib/motion";

// "Reported by N citizens" as a credibility signal: a stack of citizen avatars + a count.
// Used in the report-flow reveal, on the issue detail, and in the map popup (A2).
export default function CitizenCount({
  count,
  max = 5,
  highlightNew = false,
}: {
  count: number;
  max?: number;
  /** Pop the last avatar in (the just-added report). */
  highlightNew?: boolean;
}) {
  const shown = Math.min(count, max);
  const overflow = count - shown;

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center">
        {Array.from({ length: shown }).map((_, i) => {
          const isLast = i === shown - 1;
          return (
            <motion.span
              key={i}
              initial={highlightNew && isLast ? { scale: 0, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ ...spring, delay: highlightNew && isLast ? 0.5 : 0 }}
              className="grid h-7 w-7 place-items-center rounded-full border-2"
              style={{
                marginLeft: i === 0 ? 0 : -9,
                background: "var(--c-accent-weak)",
                borderColor: "var(--c-surface)",
                color: "var(--c-accent-strong)",
                zIndex: i,
              }}
            >
              <User size={13} strokeWidth={2.2} />
            </motion.span>
          );
        })}
        {overflow > 0 && (
          <span
            className="grid h-7 min-w-7 place-items-center rounded-full border-2 px-1 text-[0.66rem] font-bold"
            style={{
              marginLeft: -9,
              background: "var(--c-surface-2)",
              borderColor: "var(--c-surface)",
              color: "var(--c-muted)",
              zIndex: max,
            }}
          >
            +{overflow}
          </span>
        )}
      </div>
      <span className="text-sm" style={{ color: "var(--c-muted)" }}>
        Reported by{" "}
        <strong style={{ color: "var(--c-ink)" }}>
          {count} citizen{count === 1 ? "" : "s"}
        </strong>
      </span>
    </div>
  );
}
