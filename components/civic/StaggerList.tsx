"use client";

import { motion } from "framer-motion";
import { stagger } from "@/lib/motion";

/**
 * Client-side wrapper that staggers its children in using the shared `stagger`
 * Framer Motion variant. Used by the dashboard feed and search results so cards
 * animate in sequentially on load rather than all appearing at once.
 *
 * Children should be <li> elements whose inner component uses `staggerItem`.
 */
export default function StaggerList({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <motion.ul
      variants={stagger}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-3"
    >
      {children}
    </motion.ul>
  );
}
