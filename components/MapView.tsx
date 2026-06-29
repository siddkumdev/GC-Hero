"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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

// The average lat/lng of all seed clusters. MapView offsets every pin by
// (userLat - DATA_CENTROID.lat, userLng - DATA_CENTROID.lng) so demo data
// appears in the viewer's real neighbourhood regardless of where they are.
const DATA_CENTROID = { lat: 12.972, lng: 77.637 };

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
// Moves the attribution to the bottom-left so it never overlaps the pill.
// ---------------------------------------------------------------------------
function CustomAttribution() {
  const map = useMap();
  map.attributionControl.setPosition("bottomleft");
  return null;
}

// ---------------------------------------------------------------------------
// FlyToOffset — child of MapContainer so it can call useMap().
// Watches for a geoOffset and flies the map to the localized centroid.
// ---------------------------------------------------------------------------
function FlyToOffset({
  geoOffset,
  clusters,
}: {
  geoOffset: { lat: number; lng: number } | null;
  clusters: MapCluster[];
}) {
  const map = useMap();
  useEffect(() => {
    if (!geoOffset || clusters.length === 0) return;
    const avgLat = clusters.reduce((s, c) => s + c.centroidLat, 0) / clusters.length;
    const avgLng = clusters.reduce((s, c) => s + c.centroidLng, 0) / clusters.length;
    map.flyTo(
      [avgLat + geoOffset.lat, avgLng + geoOffset.lng],
      13,
      { animate: true, duration: 1.2 },
    );
  }, [geoOffset]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// ---------------------------------------------------------------------------
// Main MapView
// ---------------------------------------------------------------------------
export default function MapView({ clusters }: { clusters: MapCluster[] }) {
  const router = useRouter();

  // Geo-offset: shifts every demo pin to the viewer's real neighbourhood.
  const [geoOffset, setGeoOffset] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoOffset({
          lat: pos.coords.latitude  - DATA_CENTROID.lat,
          lng: pos.coords.longitude - DATA_CENTROID.lng,
        });
      },
      () => { /* permission denied — keep Bangalore coords */ },
      { timeout: 6000, maximumAge: 300_000 },
    );
  }, []);

  // Apply offset to every cluster before rendering markers.
  const localizedClusters = useMemo(() => {
    if (!geoOffset) return clusters;
    return clusters.map((c) => ({
      ...c,
      centroidLat: c.centroidLat + geoOffset.lat,
      centroidLng: c.centroidLng + geoOffset.lng,
    }));
  }, [clusters, geoOffset]);

  // Stable initial center on first render (before geolocation resolves).
  // FlyToOffset will move the camera once geoOffset is known.
  const center = useMemo<[number, number]>(() => {
    if (clusters.length === 0) return [DATA_CENTROID.lat, DATA_CENTROID.lng];
    const avgLat = clusters.reduce((s, c) => s + c.centroidLat, 0) / clusters.length;
    const avgLng = clusters.reduce((s, c) => s + c.centroidLng, 0) / clusters.length;
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
        <FlyToOffset geoOffset={geoOffset} clusters={clusters} />
        {localizedClusters.map((c) => (
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

