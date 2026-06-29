"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Map, Plus, Search } from "lucide-react";

export default function SidebarNavLinks() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="flex flex-col gap-4 mt-8 flex-1">
      <Link
        href="/"
        aria-label="Dashboard"
        className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-[var(--c-surface-muted)] text-[var(--c-faint)] hover:text-[var(--c-ink)] aria-[pressed=true]:text-[var(--c-accent)] aria-[pressed=true]:bg-[var(--c-accent-weak)]"
        aria-pressed={isActive("/")}
      >
        <LayoutGrid size={20} strokeWidth={2.2} />
        <span className="font-medium text-sm">Dashboard</span>
      </Link>
      <Link
        href="/map"
        aria-label="Map"
        className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-[var(--c-surface-muted)] text-[var(--c-faint)] hover:text-[var(--c-ink)] aria-[pressed=true]:text-[var(--c-accent)] aria-[pressed=true]:bg-[var(--c-accent-weak)]"
        aria-pressed={isActive("/map")}
        data-tour="map-btn"
      >
        <Map size={20} strokeWidth={2.2} />
        <span className="font-medium text-sm">Map</span>
      </Link>
      <Link
        href="/search"
        aria-label="Search"
        className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-[var(--c-surface-muted)] text-[var(--c-faint)] hover:text-[var(--c-ink)] aria-[pressed=true]:text-[var(--c-accent)] aria-[pressed=true]:bg-[var(--c-accent-weak)]"
        aria-pressed={isActive("/search")}
        data-tour="search-btn"
      >
        <Search size={20} strokeWidth={2.2} />
        <span className="font-medium text-sm">Search</span>
      </Link>
      <div className="my-2 border-t border-[var(--c-border-strong)]" />
      <Link
        href="/report"
        className="cv-btn cv-btn-primary w-full justify-center"
        data-tour="fab"
      >
        <Plus size={18} strokeWidth={2.4} />
        Report Issue
      </Link>
    </nav>
  );
}
