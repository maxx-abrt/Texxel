"use client"

import { createContext, use, useMemo, useState, type ReactNode } from "react"
import { accentPresets } from "@/lib/mock-data"

type AccentContext = {
  accent: string
  accentName: string
  setAccent: (id: string) => void
  presets: typeof accentPresets
  dark: boolean
  toggleDark: () => void
}

const Ctx = createContext<AccentContext | null>(null)

/** luma > 168 → dark ink, else warm paper */
function readableOn(hex: string) {
  const v = hex.replace("#", "")
  const r = Number.parseInt(v.slice(0, 2), 16)
  const g = Number.parseInt(v.slice(2, 4), 16)
  const b = Number.parseInt(v.slice(4, 6), 16)
  const luma = 0.299 * r + 0.587 * g + 0.114 * b
  return luma > 168 ? "#31302e" : "#faf6f2"
}

export function AccentProvider({ children }: { children: ReactNode }) {
  const [accentId, setAccentId] = useState("coral")
  const [dark, setDark] = useState(false)

  const preset = accentPresets.find((p) => p.id === accentId) ?? accentPresets[0]

  const value = useMemo<AccentContext>(
    () => ({
      accent: preset.hex,
      accentName: preset.name,
      setAccent: setAccentId,
      presets: accentPresets,
      dark,
      toggleDark: () => setDark((d) => !d),
    }),
    [preset.hex, preset.name, dark],
  )

  return (
    <Ctx.Provider value={value}>
      <div
        className={dark ? "dark contents" : "contents"}
        style={
          {
            "--primary": preset.hex,
            "--primary-foreground": readableOn(preset.hex),
            "--ring": preset.hex,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </Ctx.Provider>
  )
}

export function useAccent() {
  const ctx = use(Ctx)
  if (!ctx) throw new Error("useAccent must be used inside AccentProvider")
  return ctx
}
