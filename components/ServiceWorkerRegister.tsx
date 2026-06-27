"use client";

import { useEffect } from "react";

// Registers the PWA service worker (installability). Functional only.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* non-fatal: app still works without the SW */
      });
    }
  }, []);
  return null;
}
