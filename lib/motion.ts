import type { Variants, Transition } from "framer-motion";

// High-Impact Glassmorphism motion primitives for "Community Hero".
// Emphasizes pop, spring, and glowing neon states.

export const easeOut: Transition["ease"] = [0.17, 0.67, 0.23, 0.99];

export const spring: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 25,
  mass: 1.2,
};

/** Dramatic rise, scale up and fade for cards/sections. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 400, damping: 30 } },
};

/** Parent that staggers its children in. */
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03, delayChildren: 0.02 } },
};

/** Single staggered child (pair with `stagger`). */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 600, damping: 25 } },
};

/**
 * Scale-in entrance for chips, badges, and count pills.
 * Extremely bouncy pop-in.
 */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 600, damping: 20, mass: 1 },
  },
};

/**
 * Slide-up entrance for persistent UI (BottomNav, floating pills).
 */
export const slideUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 400, damping: 25 } },
};
