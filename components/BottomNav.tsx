"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Map, Plus, User } from "lucide-react";
import { motion } from "framer-motion";
import { slideUp } from "@/lib/motion";

// Civic bottom tab bar with a central report FAB. Lucide icons, hairline surface,
// accent-tinted active state (no neumorphism, no emoji).
export default function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <motion.nav
      variants={slideUp}
      initial="hidden"
      animate="show"
      className="fixed left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-50 lg:hidden"
      style={{ bottom: "calc(12px + env(safe-area-inset-bottom))" }}
    >
      <div
        className="flex items-center justify-between px-5 py-2.5"
        style={{
          background: "var(--c-surface-2)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          willChange: "transform",
          border: "1px solid var(--c-border)",
          borderRadius: "var(--c-radius-pill)",
          boxShadow: "var(--c-shadow-float)",
        }}
      >
        <Link
          href="/"
          aria-label="Dashboard"
          className="cv-nav-link"
          aria-pressed={isActive("/")}
        >
          <LayoutGrid size={21} strokeWidth={2} />
        </Link>
        <Link
          href="/map"
          aria-label="Map"
          className="cv-nav-link"
          aria-pressed={isActive("/map")}
          data-tour="map-btn"
        >
          <Map size={21} strokeWidth={2} />
        </Link>

        {/* Central FAB: report a new issue. */}
        <Link
          href="/report"
          aria-label="Report an issue"
          className="cv-fab -mt-8"
          title="Report an issue"
          data-tour="fab"
        >
          <Plus size={26} strokeWidth={2.4} />
        </Link>

        <Link
          href="/profile"
          aria-label="Profile"
          className="cv-nav-link"
          aria-pressed={isActive("/profile")}
        >
          <User size={21} strokeWidth={2} />
        </Link>
      </div>
    </motion.nav>
  );
}

