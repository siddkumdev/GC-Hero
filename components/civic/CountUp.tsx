"use client";

import { useEffect, useState } from "react";
import { animate } from "framer-motion";
import { easeOut } from "@/lib/motion";

// Gentle count-up for cluster numbers (e.g. 11 -> 12 as a new report joins).
export default function CountUp({
  from,
  to,
  duration = 0.9,
}: {
  from: number;
  to: number;
  duration?: number;
}) {
  const [val, setVal] = useState(from);

  useEffect(() => {
    const controls = animate(from, to, {
      duration,
      ease: easeOut,
      onUpdate: (v) => setVal(Math.round(v)),
    });
    return () => controls.stop();
  }, [from, to, duration]);

  return <>{val}</>;
}
