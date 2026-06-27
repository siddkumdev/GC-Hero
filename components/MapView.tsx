"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { LocateFixed } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { CATEGORY_LABELS, type Category } from "@/lib/config";
import { categoryMeta, severityAccent } from "@/components/civic/meta";
import type { ConfirmState } from "@/lib/types";

// Map provider is isolated here so swapping Leaflet -> Google Maps later is localized
// (see .memory/decisions-log.md).

// Severity → ring color (matches the Civic semantic tokens in globals.css).
const SEV_HEX: Record<string, string> = {
  high: "#FF3366",
  med: "#FFCC00",
  low: "#3399FF",
};

// ---------------------------------------------------------------------------
// Pin icon factory — memoized so renderToStaticMarkup only runs once per
// unique (category, severity, count, resolved) combination. This was the
// primary source of map lag: previously called on every render.
// ---------------------------------------------------------------------------
const iconCache = new Map<string, L.DivIcon>();

function pinIcon(
  category: string,
  severity: string,
  count: number,
  resolved: boolean,
): L.DivIcon {
  const key = `${category}:${severity}:${count}:${resolved}`;
  if (iconCache.has(key)) return iconCache.get(key)!;

  const color = resolved ? "#9ca3af" : (SEV_HEX[severity] ?? SEV_HEX.low);
  const { Icon } = categoryMeta(category);
  const glyph = renderToStaticMarkup(
    <Icon size={18} strokeWidth={2.2} color={color} />,
  );
  const badge = count > 1 ? `<span class="cv-pin-count">${count}</span>` : "";
  const resolvedStyle = resolved
    ? "opacity:0.5;filter:grayscale(0.7);"
    : "";

  const icon = L.divIcon({
    // Larger wrapper = larger tap target (44×44 minimum for mobile accessibility).
    // The visual bubble stays 36×36 centred inside the tap area.
    className: "cv-pin-wrap",
    html: `<div class="cv-pin-bubble" style="border-color:${color};${resolvedStyle}">${glyph}${badge}</div>`,
    iconSize: [44, 44],   // ↑ was 36×36 — larger tap target
    iconAnchor: [22, 22],
  });

  iconCache.set(key, icon);
  return icon;
}

export interface MapCluster {
  id: string;
  centroidLat: number;
  centroidLng: number;
  category: string;
  severity: string;
  status: string;
  summary: string;
  reportCount: number;
  verifiedCount: number;
  confirmState: ConfirmState;
}



// ---------------------------------------------------------------------------
// "Locate me" button — reads GPS and flies the map to the user's position.
// ---------------------------------------------------------------------------
function LocateButton() {
  const map = useMap();
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);

  const locate = useCallback(() => {
    if (!navigator.geolocation) { setDenied(true); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.flyTo([pos.coords.latitude, pos.coords.longitude], 15, {
          animate: true,
          duration: 1.2,
        });
        setLoading(false);
      },
      () => {
        setDenied(true);
        setLoading(false);
      },
      { timeout: 8000 },
    );
  }, [map]);

  return (
    <div className="leaflet-top leaflet-right" style={{ top: 12, right: 12 }}>
      <div className="leaflet-control">
        <button
          type="button"
          onClick={locate}
          disabled={loading || denied}
          aria-label={denied ? "Location access denied" : "Go to my location"}
          title={denied ? "Location access denied" : "Go to my location"}
          className="cv-icon-btn"
          style={{
            background: "var(--c-surface)",
            border: "1px solid var(--c-border)",
            boxShadow: "var(--c-shadow-md)",
            width: 36,
            height: 36,
            borderRadius: 8,
            color: denied ? "var(--c-faint)" : loading ? "var(--c-accent)" : "var(--c-muted)",
          }}
        >
          <LocateFixed
            size={17}
            strokeWidth={2.2}
            className={loading ? "animate-spin" : ""}
          />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Moves the attribution to the bottom-left so it never overlaps the pill
// (which is centred at the bottom). Required attribution stays visible and
// compliant with OpenStreetMap's CC BY-SA licence.
// ---------------------------------------------------------------------------
function CustomAttribution() {
  const map = useMap();
  // useEffect isn't available inside react-leaflet hooks; the map instance is
  // already initialised by the time this renders, so set it synchronously.
  map.attributionControl.setPosition("bottomleft");
  return null;
}

// ---------------------------------------------------------------------------
// Main MapView
// ---------------------------------------------------------------------------
export default function MapView({ clusters }: { clusters: MapCluster[] }) {
  const router = useRouter();

  // Stable center on first render only (clusters[0] is arbitrary; default to
  // Bengaluru if there are no issues yet).
  const center = useMemo<[number, number]>(() => {
    if (clusters.length === 0) return [12.9716, 77.5946];
    // Use the centroid of all cluster centroids so the map starts centred on
    // the actual issue density, not just the first item in the list.
    const avgLat =
      clusters.reduce((s, c) => s + c.centroidLat, 0) / clusters.length;
    const avgLng =
      clusters.reduce((s, c) => s + c.centroidLng, 0) / clusters.length;
    return [avgLat, avgLng];
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentionally fixed on mount

  return (
    <>
      <MapContainer
        className="cv-map"
        center={center}
        zoom={13}
        style={{ height: "calc(100dvh - 200px)", minHeight: 420, width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CustomAttribution />
        <LocateButton />
        {clusters.map((c) => (
          <Marker
            key={c.id}
            position={[c.centroidLat, c.centroidLng]}
            icon={pinIcon(c.category, c.severity, c.reportCount, c.status === "resolved")}
            eventHandlers={{ click: () => router.push(`/issues/${c.id}`) }}
          />
        ))}
      </MapContainer>
    </>
  );
}

