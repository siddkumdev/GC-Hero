"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
    router.push("/login");
  }
  return (
    <button
      type="button"
      onClick={logout}
      aria-label="Sign out"
      title="Sign out"
      className="cv-icon-btn"
    >
      <LogOut size={17} strokeWidth={2.2} />
    </button>
  );
}
