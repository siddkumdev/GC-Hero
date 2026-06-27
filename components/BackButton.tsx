"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 2) {
          router.back();
        } else {
          router.push(fallback);
        }
      }}
      className="cv-link text-sm inline-flex items-center gap-1.5"
      style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
    >
      <ArrowLeft size={15} strokeWidth={2.4} />
      Back
    </button>
  );
}
