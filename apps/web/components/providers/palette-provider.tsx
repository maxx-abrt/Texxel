"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

const PALETTES: Record<string, { light: string; dark: string }> = {
  coral:   { light: "oklch(0.655 0.21 22)",  dark: "oklch(0.72 0.19 22)"  },
  violet:  { light: "oklch(0.6 0.22 270)",   dark: "oklch(0.68 0.2 270)"  },
  blue:    { light: "oklch(0.6 0.2 245)",    dark: "oklch(0.67 0.18 245)" },
  teal:    { light: "oklch(0.6 0.14 185)",   dark: "oklch(0.67 0.13 185)" },
  emerald: { light: "oklch(0.6 0.17 155)",   dark: "oklch(0.67 0.15 155)" },
  amber:   { light: "oklch(0.72 0.17 70)",   dark: "oklch(0.78 0.15 70)"  },
  rose:    { light: "oklch(0.65 0.22 355)",  dark: "oklch(0.72 0.2 355)"  },
  slate:   { light: "oklch(0.42 0.02 260)",  dark: "oklch(0.82 0.01 260)" },
};

function applyStoredPalette(resolvedTheme?: string) {
  if (typeof window === "undefined") return;
  const id = localStorage.getItem("bureau-palette") ?? "coral";
  const palette = PALETTES[id] ?? PALETTES.coral;
  const isDark = resolvedTheme === "dark" || document.documentElement.classList.contains("dark");
  const value = isDark ? palette.dark : palette.light;
  const root = document.documentElement;
  root.style.setProperty("--primary", value);
  root.style.setProperty("--ring", value);
  root.style.setProperty("--sidebar-primary", value);
}

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    applyStoredPalette(resolvedTheme);
  }, [resolvedTheme]);

  return <>{children}</>;
}
