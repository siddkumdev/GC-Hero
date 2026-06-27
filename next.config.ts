import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow loading the dev server (and its /_next/* JS chunks) from phones on the LAN.
  // Without this, Next 16 blocks cross-origin dev requests, so client JS never hydrates
  // on the phone (map + report appear dead). Add your machine's LAN IP/hostnames here.
  allowedDevOrigins: ["192.168.2.241"],
  // Required for Cloud Run: produces a self-contained server bundle under .next/standalone.
  output: "standalone",
};

export default nextConfig;
