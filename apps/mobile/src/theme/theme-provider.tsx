import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

import { storage } from "@/src/utils/storage";
import {
  accentPresets,
  darkColors,
  highContrastDark,
  highContrastLight,
  lightColors,
  mix,
  readableOn,
  shadow as shadowRecipe,
  spacing as baseSpacing,
  type AccentId,
  type Colors,
} from "./tokens";

export type ThemeMode = "light" | "dark" | "system";

/** Display size presets — the app ships intentionally compact (1.0). */
export const DISPLAY_SIZES = [
  { id: "compact", label: "Compact", scale: 0.9 },
  { id: "default", label: "Default", scale: 1 },
  { id: "large", label: "Large", scale: 1.12 },
  { id: "xlarge", label: "Extra large", scale: 1.28 },
] as const;

export type DisplaySizeId = (typeof DISPLAY_SIZES)[number]["id"];

type Preferences = {
  mode: ThemeMode;
  accentId: AccentId;
  displaySize: DisplaySizeId;
  boldText: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
};

const DEFAULTS: Preferences = {
  mode: "system",
  accentId: "coral",
  displaySize: "compact",
  boldText: false,
  highContrast: false,
  reduceMotion: false,
};

const KEYS: Record<keyof Preferences, string> = {
  mode: "bureau.theme.mode",
  accentId: "bureau.theme.accent",
  displaySize: "bureau.a11y.displaySize",
  boldText: "bureau.a11y.boldText",
  highContrast: "bureau.a11y.highContrast",
  reduceMotion: "bureau.a11y.reduceMotion",
};

type ThemeValue = Preferences & {
  c: Colors;
  isDark: boolean;
  accent: string;
  onAccent: string;
  accentTint: string;
  /** Text/size multiplier from the display-size preference. */
  scale: number;
  /** Scale an arbitrary dimension with the display-size preference. */
  sp: (value: number) => number;
  /** `false` when the user asked for reduced motion. */
  animate: boolean;
  setMode: (mode: ThemeMode) => void;
  setAccentId: (id: AccentId) => void;
  setDisplaySize: (id: DisplaySizeId) => void;
  setBoldText: (value: boolean) => void;
  setHighContrast: (value: boolean) => void;
  setReduceMotion: (value: boolean) => void;
  shadow: (level: 1 | 2 | 3) => ReturnType<typeof shadowRecipe>;
  tint: (color: string, ratio?: number) => string;
  toneText: (color: string) => string;
  spacing: typeof baseSpacing;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [mode, accent, size, bold, contrast, motionOff] = await Promise.all([
        storage.getItem<string>(KEYS.mode, ""),
        storage.getItem<string>(KEYS.accentId, ""),
        storage.getItem<string>(KEYS.displaySize, ""),
        storage.getItem<string>(KEYS.boldText, ""),
        storage.getItem<string>(KEYS.highContrast, ""),
        storage.getItem<string>(KEYS.reduceMotion, ""),
      ]);
      if (!alive) return;
      setPrefs((current) => ({
        mode: mode === "light" || mode === "dark" || mode === "system" ? mode : current.mode,
        accentId: accentPresets.some((p) => p.id === accent) ? (accent as AccentId) : current.accentId,
        displaySize: DISPLAY_SIZES.some((s) => s.id === size) ? (size as DisplaySizeId) : current.displaySize,
        boldText: bold === "1" ? true : bold === "0" ? false : current.boldText,
        highContrast: contrast === "1" ? true : contrast === "0" ? false : current.highContrast,
        reduceMotion: motionOff === "1" ? true : motionOff === "0" ? false : current.reduceMotion,
      }));
    })();
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs((current) => ({ ...current, [key]: value }));
    void storage.setItem(KEYS[key], typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  }, []);

  const isDark = prefs.mode === "system" ? system === "dark" : prefs.mode === "dark";

  const value = useMemo<ThemeValue>(() => {
    const base = isDark ? darkColors : lightColors;
    const c: Colors = prefs.highContrast
      ? { ...base, ...(isDark ? highContrastDark : highContrastLight) }
      : base;
    const accent = accentPresets.find((p) => p.id === prefs.accentId)?.hex ?? accentPresets[0].hex;
    const scale = DISPLAY_SIZES.find((s) => s.id === prefs.displaySize)?.scale ?? 1;

    return {
      ...prefs,
      c,
      isDark,
      accent,
      onAccent: readableOn(accent),
      accentTint: mix(accent, c.card, isDark ? 0.24 : 0.15),
      scale,
      sp: (v: number) => Math.round(v * scale),
      animate: !prefs.reduceMotion,
      setMode: (mode) => update("mode", mode),
      setAccentId: (id) => update("accentId", id),
      setDisplaySize: (id) => update("displaySize", id),
      setBoldText: (v) => update("boldText", v),
      setHighContrast: (v) => update("highContrast", v),
      setReduceMotion: (v) => update("reduceMotion", v),
      shadow: (level) => shadowRecipe(level, isDark),
      tint: (color, ratio = isDark ? 0.24 : 0.14) => mix(color, c.card, ratio),
      toneText: (color) => mix(color, c.foreground, isDark ? 0.55 : 0.8),
      spacing: baseSpacing,
    };
  }, [isDark, prefs, update]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
