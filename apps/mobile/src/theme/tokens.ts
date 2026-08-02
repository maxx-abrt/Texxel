/**
 * Bureau — native design tokens ("Warm Paper").
 *
 * Mirrors `packages/ui/src/index.ts` (the platform-agnostic source used by the
 * web app) and adds React-Native-only values: shadow recipes, font families,
 * hit-slop sizes. Kept local so Metro never has to resolve outside the app
 * directory — if you change a colour here, change it in `packages/ui` too.
 *
 * The base scale is deliberately compact ("slightly zoomed out") so more
 * content fits on a phone; users can scale it back up from Settings →
 * Accessibility → Display size.
 */
import { Platform, type TextStyle, type ViewStyle } from "react-native";

export const tones = {
  coral: "#E14B3D",
  ocean: "#2f7ea6",
  mint: "#1f9d76",
  amber: "#d98324",
  violet: "#7c5cff",
  rose: "#e5487f",
  red: "#c93c2a",
} as const;

export type ToneName = keyof typeof tones;

export const accentPresets = [
  { id: "coral", name: "Coral", hex: "#E14B3D" },
  { id: "ocean", name: "Ocean", hex: "#2f7ea6" },
  { id: "mint", name: "Mint", hex: "#1f9d76" },
  { id: "amber", name: "Amber", hex: "#d98324" },
  { id: "violet", name: "Violet", hex: "#7c5cff" },
  { id: "rose", name: "Rose", hex: "#e5487f" },
] as const;

export type AccentId = (typeof accentPresets)[number]["id"];

export const lightColors = {
  background: "#faf6f2",
  foreground: "#31302e",
  card: "#fffdfa",
  secondary: "#f1eae3",
  muted: "#f2ece5",
  mutedForeground: "#7a746d",
  accentSoft: "#f7ded9",
  accentSoftForeground: "#803c35",
  border: "#e9e1d8",
  borderStrong: "#d8cec3",
  destructive: "#c93c2a",
  ink: "#31302e",
  onInk: "#faf6f2",
  overlay: "rgba(49, 48, 46, 0.32)",
  /** Tint used by frosted-glass surfaces (tab bar, sheets). */
  glass: "rgba(255, 253, 250, 0.72)",
  glassBorder: "rgba(255, 255, 255, 0.65)",
};

export const darkColors: typeof lightColors = {
  background: "#242220",
  foreground: "#faf6f2",
  card: "#31302e",
  secondary: "#3a3936",
  muted: "#413f3c",
  mutedForeground: "#b3ada6",
  accentSoft: "#4a3430",
  accentSoftForeground: "#f2c3bb",
  border: "#4a4844",
  borderStrong: "#5c5a56",
  destructive: "#e05741",
  ink: "#171614",
  onInk: "#faf6f2",
  overlay: "rgba(11, 10, 9, 0.55)",
  glass: "rgba(49, 48, 46, 0.66)",
  glassBorder: "rgba(255, 255, 255, 0.12)",
};

/** High-contrast overrides layered on top of the base palettes. */
export const highContrastLight: Partial<typeof lightColors> = {
  foreground: "#1c1b1a",
  mutedForeground: "#57524c",
  border: "#cdc2b6",
  borderStrong: "#a89c8e",
};

export const highContrastDark: Partial<typeof lightColors> = {
  foreground: "#ffffff",
  mutedForeground: "#d5d0c9",
  border: "#6b6863",
  borderStrong: "#8b8781",
};

export type Colors = typeof lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 11,
  lg: 14,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  sm: 8,
  md: 11,
  lg: 16,
  xl: 20,
  xxl: 26,
  pill: 999,
} as const;

export const font = {
  regular: "PlusJakartaSans-Regular",
  medium: "PlusJakartaSans-Medium",
  semibold: "PlusJakartaSans-SemiBold",
  bold: "PlusJakartaSans-Bold",
  extrabold: "PlusJakartaSans-ExtraBold",
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) as string,
} as const;

export const type = {
  display: { fontFamily: font.extrabold, fontSize: 25, lineHeight: 29, letterSpacing: -0.8 },
  title: { fontFamily: font.bold, fontSize: 18, lineHeight: 23, letterSpacing: -0.4 },
  section: { fontFamily: font.semibold, fontSize: 15, lineHeight: 20, letterSpacing: -0.2 },
  body: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, letterSpacing: -0.1 },
  bodyStrong: { fontFamily: font.semibold, fontSize: 14, lineHeight: 19, letterSpacing: -0.2 },
  label: { fontFamily: font.semibold, fontSize: 12.5, lineHeight: 16, letterSpacing: -0.1 },
  caption: { fontFamily: font.medium, fontSize: 11, lineHeight: 14.5, letterSpacing: 0 },
  overline: { fontFamily: font.bold, fontSize: 10, lineHeight: 12.5, letterSpacing: 1 },
} satisfies Record<string, TextStyle>;

/** Bolder family for the "Bold text" accessibility switch. */
export const boldFamilyFor: Record<string, string> = {
  [font.regular]: font.medium,
  [font.medium]: font.semibold,
  [font.semibold]: font.bold,
  [font.bold]: font.extrabold,
  [font.extrabold]: font.extrabold,
};

/** Warm-tinted elevation. Tier 1 = resting card, tier 2 = floating surface. */
export function shadow(level: 1 | 2 | 3, isDark: boolean): ViewStyle {
  if (isDark) {
    const opacity = [0.28, 0.4, 0.55][level - 1];
    return {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: level * 3 },
      shadowOpacity: opacity,
      shadowRadius: level * 7,
      elevation: level * 3,
    };
  }
  const opacity = [0.05, 0.08, 0.12][level - 1];
  return {
    shadowColor: "#8a5b46",
    shadowOffset: { width: 0, height: level * 3 },
    shadowOpacity: opacity,
    shadowRadius: level * 7,
    elevation: level * 2,
  };
}

export const motion = {
  fast: 140,
  base: 240,
  slow: 420,
} as const;

/** sRGB blend — the runtime stand-in for CSS `color-mix()`. */
export function mix(a: string, b: string, ratio: number): string {
  const pa = toRgb(a);
  const pb = toRgb(b);
  const r = Math.round(pa.r * ratio + pb.r * (1 - ratio));
  const g = Math.round(pa.g * ratio + pb.g * (1 - ratio));
  const bl = Math.round(pa.b * ratio + pb.b * (1 - ratio));
  return `#${hex(r)}${hex(g)}${hex(bl)}`;
}

export function alpha(color: string, a: number): string {
  if (color.startsWith("rgba")) return color;
  const { r, g, b } = toRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function readableOn(color: string): string {
  const { r, g, b } = toRgb(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 168 ? "#31302e" : "#ffffff";
}

function toRgb(color: string): { r: number; g: number; b: number } {
  let h = color.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const int = parseInt(h, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function hex(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}
