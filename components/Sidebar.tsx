import Link from "next/link";
import { User as UserIcon } from "lucide-react";
import LogoIcon from "@/components/LogoIcon";
import { getCurrentUser } from "@/lib/session";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";
import SidebarNavLinks from "@/components/SidebarNavLinks";

export default async function Sidebar() {
  const user = await getCurrentUser();

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-[var(--c-border)] p-6 h-[100vh] sticky top-0 bg-[var(--c-surface-2)] backdrop-blur-xl" style={{ willChange: "transform" }}>
      <Link href="/" className="flex items-center gap-2 mb-2 group">
        <span
          className="grid h-9 w-9 place-items-center rounded-xl shadow-[0_4px_12px_var(--c-accent-ring)] border border-[var(--c-accent-weak)] transition-transform duration-500 ease-out group-hover:scale-105 group-hover:shadow-[0_0_20px_var(--c-accent-ring)]"
          style={{ background: "var(--c-accent)", color: "var(--c-on-accent)" }}
        >
          <LogoIcon size={20} strokeWidth={2.5} />
        </span>
        <span
          className="cv-display text-[1.4rem] font-black tracking-tighter"
          style={{ color: "var(--c-ink)" }}
        >
          GC<span style={{ color: "var(--c-accent)" }}>Heros</span>
        </span>
      </Link>

      <SidebarNavLinks />

      <div className="mt-auto flex flex-col gap-4 pt-4 border-t border-[var(--c-border-strong)]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--c-faint)]">Theme</span>
          <ThemeToggle />
        </div>
        
        {user ? (
          <div className="flex items-center justify-between mt-2">
            <span className="cv-chip shadow-[0_0_5px_var(--c-accent-ring)]" title={user.name}>
              <UserIcon size={12} strokeWidth={2.4} className="text-[var(--c-accent)]" />
              {user.name.split(" ")[0]}
            </span>
            <LogoutButton />
          </div>
        ) : (
          <Link href="/login" className="cv-btn cv-btn-secondary text-sm w-full mt-2">
            Sign in
          </Link>
        )}
      </div>
    </aside>
  );
}
