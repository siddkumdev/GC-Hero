"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Sparkles,
  X,
  Loader2,
  MapPin,
  Calendar,
  TriangleAlert,
  Quote,
} from "lucide-react";
import { fadeUp, stagger, staggerItem } from "@/lib/motion";
import { categoryMeta, severityMeta, statusMeta } from "@/components/civic/meta";
import ClusterCard from "@/components/civic/ClusterCard";
import type { SearchFilter, SearchResponseDTO, SearchResultDTO } from "@/lib/types";

const EXAMPLES = [
  "high-severity water issues this week",
  "resolved potholes",
  "garbage near Whitefield",
  "open streetlight problems",
];

// F2 — natural-language search. The bar sends free text to Gemini (intent → filter); our code
// filters our data. Parsed facets render as removable chips so the result feels controllable;
// removing a chip re-filters WITHOUT re-calling Gemini.
export default function SearchView() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SearchFilter | null>(null);
  const [results, setResults] = useState<SearchResultDTO[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runQuery(q: string) {
    const text = q.trim();
    if (!text) return;
    setQuery(text);
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 200) {
        const dto = data as SearchResponseDTO;
        setFilter(dto.filter);
        setResults(dto.results);
      } else if (res.status === 401) {
        setError("Please sign in to search.");
      } else {
        setError(data.error ?? "Couldn't run that search. Try rephrasing.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Re-filter on a chip edit: no Gemini, just re-run the modified filter server-side.
  async function applyFilter(next: SearchFilter) {
    setFilter(next);
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 200) {
        setResults((data as SearchResponseDTO).results);
      } else {
        setError(data.error ?? "Couldn't update the filter.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  function clearFacet(key: "category" | "severity" | "status" | "location" | "date" | "text") {
    if (!filter) return;
    const next: SearchFilter = { ...filter };
    if (key === "date") {
      next.dateFrom = null;
      next.dateTo = null;
    } else {
      next[key] = null;
    }
    applyFilter(next);
  }

  const chips = filter ? buildChips(filter) : [];

  return (
    <div className="flex flex-col gap-5 w-full lg:max-w-3xl lg:mx-auto">
      <div className="flex flex-col gap-1">
        <span className="cv-eyebrow">GCHeros</span>
        <h1 className="text-2xl">Search issues</h1>
        <p className="text-sm" style={{ color: "var(--c-muted)" }}>
          Ask in plain language — Gemini turns it into filters you can fine-tune.
        </p>
      </div>

      {/* Search bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runQuery(query);
        }}
        className="cv-card flex items-center gap-2 p-2 pl-3.5"
      >
        <Search size={18} style={{ color: "var(--c-faint)" }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. high-severity water issues near Whitefield this week"
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--c-ink)" }}
        />
        <button type="submit" disabled={loading} className="cv-btn cv-btn-primary text-sm">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          Search
        </button>
      </form>

      {/* Example prompts (only before the first search) */}
      {results === null && !loading && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => runQuery(ex)}
              className="cv-chip"
              style={{ cursor: "pointer" }}
            >
              <Quote size={11} strokeWidth={2.4} /> {ex}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="flex items-center gap-2 text-sm" style={{ color: "var(--c-high)" }}>
          <TriangleAlert size={15} /> {error}
        </p>
      )}

      {/* Parsed filter chips */}
      <AnimatePresence>
        {filter && chips.length > 0 && (
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-2"
          >
            <span className="cv-eyebrow flex items-center gap-1.5" style={{ color: "var(--c-accent-strong)" }}>
              <Sparkles size={12} /> Gemini parsed this as
            </span>
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <motion.button
                  key={chip.key}
                  variants={staggerItem}
                  type="button"
                  onClick={() => clearFacet(chip.key)}
                  className="cv-chip cv-sev-low"
                  style={{ cursor: "pointer" }}
                  title="Remove this filter"
                >
                  <chip.Icon size={12} strokeWidth={2.4} />
                  {chip.label}
                  <X size={12} strokeWidth={2.6} style={{ marginLeft: 2, opacity: 0.7 }} />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      {results !== null && (
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: "var(--c-muted)" }}>
            {results.length} matching issue{results.length === 1 ? "" : "s"}
          </p>
          {results.length === 0 ? (
            <div className="cv-card p-8 text-center text-sm" style={{ color: "var(--c-muted)" }}>
              No issues match. Try removing a filter chip or rephrasing.
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {results.map((c) => (
                <li key={c.id}>
                  <ClusterCard cluster={c} />
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      )}
    </div>
  );
}

// Translate a SearchFilter into displayable, removable chips. 'date' collapses from/to into one.
function buildChips(filter: SearchFilter) {
  const chips: { key: "category" | "severity" | "status" | "location" | "date" | "text"; label: string; Icon: typeof MapPin }[] = [];

  if (filter.category) {
    const m = categoryMeta(filter.category);
    chips.push({ key: "category", label: m.label, Icon: m.Icon });
  }
  if (filter.severity) {
    const m = severityMeta(filter.severity);
    chips.push({ key: "severity", label: `${m.label} severity`, Icon: m.Icon });
  }
  if (filter.status) {
    const m = statusMeta(filter.status);
    chips.push({ key: "status", label: m.label, Icon: m.Icon });
  }
  if (filter.location) {
    const km = (filter.location.radiusMeters / 1000).toFixed(km1(filter.location.radiusMeters));
    chips.push({
      key: "location",
      label: `near ${filter.location.name} (~${km}km)`,
      Icon: MapPin,
    });
  }
  if (filter.dateFrom || filter.dateTo) {
    chips.push({ key: "date", label: dateLabel(filter.dateFrom, filter.dateTo), Icon: Calendar });
  }
  if (filter.text) {
    chips.push({ key: "text", label: `“${filter.text}”`, Icon: Quote });
  }
  return chips;
}

function km1(meters: number): number {
  return meters % 1000 === 0 ? 0 : 1;
}

function fmt(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dateLabel(from: string | null, to: string | null): string {
  if (from && to) return `${fmt(from)} – ${fmt(to)}`;
  if (from) return `from ${fmt(from)}`;
  if (to) return `until ${fmt(to)}`;
  return "date";
}
