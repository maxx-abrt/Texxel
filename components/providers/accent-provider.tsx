"use client";

// Applies the user's accent color across the app by overriding CSS variables
// at runtime. Persisted in Convex (flux_userPrefs.accentColor) and cached in
// localStorage so there is no flash of the default accent on reload.
import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export const ACCENT_PRESETS: { name: string; color: string }[] = [
  { name: "coral", color: "#fb5648" },
  { name: "ocean", color: "#2f7ea6" },
  { name: "mint", color: "#1f9d76" },
  { name: "amber", color: "#d98324" },
  { name: "violet", color: "#7c5cff" },
  { name: "rose", color: "#e5487f" },
];

export const DEFAULT_ACCENT = ACCENT_PRESETS[0].color;
const CACHE_KEY = "flux-accent";
const VARS = ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring", "--flux-coral"];

function readableForeground(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma > 168 ? "#211f1d" : "#ffffff";
}

/** Apply (or clear with null) the accent color on :root. */
export function applyAccent(color: string | null | undefined) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!color || color === DEFAULT_ACCENT) {
    for (const v of VARS) root.style.removeProperty(v);
    root.style.removeProperty("--primary-foreground");
    root.style.removeProperty("--sidebar-primary-foreground");
    root.style.removeProperty("--flux-coral-soft");
    return;
  }
  for (const v of VARS) root.style.setProperty(v, color);
  const fg = readableForeground(color);
  root.style.setProperty("--primary-foreground", fg);
  root.style.setProperty("--sidebar-primary-foreground", fg);
  root.style.setProperty("--flux-coral-soft", `color-mix(in oklch, ${color} 14%, var(--background))`);
}

export function cacheAccent(color: string | null) {
  try {
    if (color && color !== DEFAULT_ACCENT) localStorage.setItem(CACHE_KEY, color);
    else localStorage.removeItem(CACHE_KEY);
  } catch {}
}

// ─── Interface density (root font scale; rem-based spacing follows) ─────────
export type Density = "compact" | "default" | "comfortable";
const DENSITY_KEY = "flux-density";
const DENSITY_PX: Record<Density, string> = {
  compact: "14.5px",
  default: "16px",
  comfortable: "17px",
};

export function applyDensity(d: Density | null | undefined) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!d || d === "default") root.style.removeProperty("font-size");
  else root.style.setProperty("font-size", DENSITY_PX[d]);
  root.dataset.density = d ?? "default";
}

export function cacheDensity(d: Density | null) {
  try {
    if (d && d !== "default") localStorage.setItem(DENSITY_KEY, d);
    else localStorage.removeItem(DENSITY_KEY);
  } catch {}
}

/** Mount once inside the authenticated app shell. Renders nothing. */
export function AccentProvider() {
  const prefs = useQuery(api.flux_userPrefs.get);

  // Instant paint from cache (before Convex answers).
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) applyAccent(cached);
      const d = localStorage.getItem(DENSITY_KEY) as Density | null;
      if (d) applyDensity(d);
    } catch {}
  }, []);

  // Authoritative value from prefs.
  useEffect(() => {
    if (prefs === undefined) return; // still loading
    const color = prefs?.accentColor ?? null;
    applyAccent(color);
    cacheAccent(color);
    const d = ((prefs as any)?.density as Density | undefined) ?? "default";
    applyDensity(d);
    cacheDensity(d);
  }, [prefs]);

  return null;
}
