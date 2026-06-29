"use client";
import { useEffect } from "react";

// Stamps data-ff="1" on <html> when running in Firefox.
// CSS in globals.css uses this to disable backdrop-filter,
// which is expensive in Firefox when the background is animated.
export default function FirefoxDetect() {
  useEffect(() => {
    if (/Firefox\//.test(navigator.userAgent)) {
      document.documentElement.dataset.ff = "1";
    }
  }, []);
  return null;
}
