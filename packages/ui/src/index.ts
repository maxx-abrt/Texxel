/**
 * Bureau — shared design tokens ("Warm Paper").
 *
 * Single source of truth for the palette used by BOTH the Next.js web app
 * (apps/web) and the Expo mobile app (apps/mobile). Platform-agnostic: plain
 * data only, no CSS and no React Native imports.
 */

export const palette = {
  light: {
    background: "#faf6f2",
    foreground: "#31302e",
    card: "#fffdfa",
    cardForeground: "#31302e",
    secondary: "#f1eae3",
    muted: "#f2ece5",
    mutedForeground: "#7a746d",
    accentSoft: "#f9e3dc",
    accentSoftForeground: "#8a3524",
    border: "#e9e1d8",
    borderStrong: "#d8cec3",
    destructive: "#c93c2a",
    /** Inverted surface used by hero cards + the floating tab bar. */
    ink: "#31302e",
    onInk: "#faf6f2",
  },
  dark: {
    background: "#242220",
    foreground: "#faf6f2",
    card: "#31302e",
    cardForeground: "#faf6f2",
    secondary: "#3a3936",
    muted: "#413f3c",
    mutedForeground: "#b3ada6",
    accentSoft: "#4c3a33",
    accentSoftForeground: "#f4c4b8",
    border: "#4a4844",
    borderStrong: "#5c5a56",
    destructive: "#e05741",
    ink: "#171614",
    onInk: "#faf6f2",
  },
} as const;

/** Semantic tone colours (status pills, project tints, charts). */
export const tones = {
  coral: "#e55a42",
  ocean: "#2f7ea6",
  mint: "#1f9d76",
  amber: "#d98324",
  violet: "#7c5cff",
  rose: "#e5487f",
  red: "#c93c2a",
} as const;

export type ToneName = keyof typeof tones;

/** Runtime-selectable brand accents (mirrors the web app's accent presets). */
export const accentPresets = [
  { id: "coral", name: "Coral", hex: "#e55a42" },
  { id: "ocean", name: "Ocean", hex: "#2f7ea6" },
  { id: "mint", name: "Mint", hex: "#1f9d76" },
  { id: "amber", name: "Amber", hex: "#d98324" },
  { id: "violet", name: "Violet", hex: "#7c5cff" },
  { id: "rose", name: "Rose", hex: "#e5487f" },
] as const;

export type AccentId = (typeof accentPresets)[number]["id"];

/** 8pt-derived spacing scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  "2xl": 28,
  pill: 999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 17,
  xl: 20,
  "2xl": 24,
  "3xl": 28,
  "4xl": 34,
} as const;

export const duration = {
  fast: 140,
  base: 220,
  slow: 420,
} as const;

/** Decelerate curve used everywhere ("motion is calm"). */
export const easingStandard = [0.16, 1, 0.3, 1] as const;

/**
 * sRGB colour blend — the runtime stand-in for CSS `color-mix()`.
 * `ratio` is the weight of `a` (0..1).
 */
export function mix(a: string, b: string, ratio: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa.r * ratio + pb.r * (1 - ratio));
  const g = Math.round(pa.g * ratio + pb.g * (1 - ratio));
  const bl = Math.round(pa.b * ratio + pb.b * (1 - ratio));
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Pick a readable foreground for an arbitrary accent (luma threshold 168). */
export function readableOn(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma > 168 ? "#31302e" : "#ffffff";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const int = parseInt(h, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
}
