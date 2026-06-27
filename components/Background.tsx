"use client";
import { motion } from "framer-motion";

export default function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-[var(--c-bg)] transition-colors duration-300">
      {/* Cyan orb */}
      <motion.div
        className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full opacity-10 dark:opacity-20"
        style={{ background: 'radial-gradient(circle, var(--c-accent) 0%, transparent 70%)' }}
        animate={{
          x: ["0%", "20%", "0%"],
          y: ["0%", "10%", "0%"],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      {/* Magenta orb */}
      <motion.div
        className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full opacity-[0.08] dark:opacity-15"
        style={{ background: 'radial-gradient(circle, var(--c-magenta) 0%, transparent 70%)' }}
        animate={{
          x: ["0%", "-15%", "0%"],
          y: ["0%", "-20%", "0%"],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      {/* Ambient center orb */}
      <motion.div
        className="absolute top-[30%] left-[30%] w-[40vw] h-[40vw] rounded-full opacity-[0.05] dark:opacity-10"
        style={{ background: 'radial-gradient(circle, var(--c-accent-strong) 0%, transparent 70%)' }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.15, 0.1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}
