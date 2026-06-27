"use client";

import dynamic from "next/dynamic";
import type { MapCluster } from "@/components/MapView";

// Leaflet touches `window`, so load the map only in the browser (ssr: false).
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div
      className="cv-skeleton"
      style={{
        height: "calc(100dvh - 200px)",
        minHeight: 420,
        width: "100%",
        borderRadius: "var(--c-radius)",
      }}
    />
  ),
});

export default function MapClient({ clusters }: { clusters: MapCluster[] }) {
  return <MapView clusters={clusters} />;
}

