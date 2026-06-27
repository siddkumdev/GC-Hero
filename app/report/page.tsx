import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import ReportFlow from "@/components/civic/ReportFlow";

export const dynamic = "force-dynamic";

// Server-guarded: only signed-in users can reach the reporting flow.
// Wrapped in `.civic` (the new design language) with a warm full-bleed backdrop. This is
// the design proof screen; other screens remain on the prior theme until rollout.
export default async function ReportPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col w-full lg:max-w-2xl lg:mx-auto">
      <header className="flex flex-col gap-1 pb-5">
        <span className="cv-eyebrow">GCHeros</span>
        <h1 className="text-2xl">Report an issue</h1>
        <p className="text-sm" style={{ color: "var(--c-muted)" }}>
          Snap a photo — Gemini reads it, drafts the complaint, and routes it for you.
        </p>
      </header>

      {user ? (
        <ReportFlow />
      ) : (
        <div className="cv-card p-6 text-center" style={{ color: "var(--c-muted)" }}>
          Please{" "}
          <Link href="/login" style={{ color: "var(--c-accent-strong)", fontWeight: 600 }}>
            sign in
          </Link>{" "}
          to report an issue.
        </div>
      )}
    </div>
  );
}
