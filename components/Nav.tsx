import Link from "next/link";
import { User, Search } from "lucide-react";
import LogoIcon from "@/components/LogoIcon";
import { getCurrentUser } from "@/lib/session";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";

// REF-2: ultra-slim single-line header — no card, no shadow, just a hairline
// border-bottom. Horizontal padding comes from the page container so the logo
// aligns exactly with the content below it.
export default async function Nav() {
  const user = await getCurrentUser();
  return (
    <header
      className="h-14 flex items-center gap-3 border-b sticky top-0 z-40 rounded-b-xl px-4 mb-4 lg:hidden"
      style={{ 
        borderColor: "var(--c-border)",
        background: "var(--c-surface-2)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)"
      }}
    >
      <Link href="/" className="flex items-center gap-2">
        <span
          className="grid h-8 w-8 place-items-center rounded-lg shadow-[0_0_10px_var(--c-accent-ring)]"
          style={{ background: "var(--c-accent)", color: "var(--c-on-accent)" }}
        >
          <LogoIcon size={18} strokeWidth={2.4} />
        </span>
        <span
          className="cv-display text-[1.1rem] font-bold tracking-tight"
          style={{ color: "var(--c-ink)" }}
        >
          GC<span style={{ color: "var(--c-accent)", textShadow: "0 0 8px var(--c-accent-ring)" }}>Heros</span>
        </span>
      </Link>
      <div className="flex-1" />
      <ThemeToggle />
      {user ? (
        <span className="flex items-center gap-2">
          <Link
            href="/search"
            aria-label="Search issues"
            title="Search issues"
            className="cv-icon-btn"
            data-tour="search-btn"
          >
            <Search size={18} strokeWidth={2.2} />
          </Link>
          <span className="cv-chip shadow-[0_0_5px_var(--c-accent-ring)]" title={user.name}>
            <User size={12} strokeWidth={2.4} className="text-[var(--c-accent)]" />
            {user.name.split(" ")[0]}
          </span>
          <LogoutButton />
        </span>
      ) : (
        <Link href="/login" className="cv-btn cv-btn-primary text-sm">
          Sign in
        </Link>
      )}
    </header>
  );
}
