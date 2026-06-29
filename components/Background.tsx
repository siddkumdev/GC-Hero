// Server component — no client JS needed. CSS @keyframes run off-main-thread.
// [data-ff] .cv-bg-orb { animation-play-state: paused } in globals.css freezes
// them in Firefox where compositing animated large gradients causes jank.
export default function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-[var(--c-bg)]">
      <div
        className="cv-bg-orb cv-orb-1 absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full opacity-10 dark:opacity-20"
      />
      <div
        className="cv-bg-orb cv-orb-2 absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full opacity-[0.08] dark:opacity-15"
      />
      <div
        className="cv-bg-orb cv-orb-pulse absolute top-[30%] left-[30%] w-[40vw] h-[40vw] rounded-full opacity-[0.05] dark:opacity-10"
      />
    </div>
  );
}
