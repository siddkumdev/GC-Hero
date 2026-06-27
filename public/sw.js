// Minimal service worker for PWA installability. Network passthrough (no aggressive caching
// yet — avoids stale assets during development). Offline caching is a deferred enhancement.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Let the network handle requests; presence of a fetch handler enables install prompts.
});
