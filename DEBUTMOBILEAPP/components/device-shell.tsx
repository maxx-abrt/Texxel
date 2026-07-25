"use client"

import type { ReactNode } from "react"
import { Signal, Wifi, BatteryFull } from "lucide-react"
import { TabBar } from "@/components/tab-bar"
import { useAccent } from "@/components/accent-provider"

function StatusBar() {
  return (
    <div className="relative z-30 flex h-12 shrink-0 items-center justify-between px-7 pt-1 text-foreground">
      <span className="font-mono text-[13px] font-semibold tracking-tight tabular-nums">9:41</span>
      <div className="pointer-events-none absolute left-1/2 top-2 h-7 w-[100px] -translate-x-1/2 rounded-full bg-ink" />
      <div className="flex items-center gap-1.5">
        <Signal className="size-3.5" strokeWidth={2.4} />
        <Wifi className="size-3.5" strokeWidth={2.4} />
        <BatteryFull className="size-4" strokeWidth={2.2} />
      </div>
    </div>
  )
}

export function DeviceShell({ children }: { children: ReactNode }) {
  const { dark } = useAccent()

  return (
    <div className="device-stage flex min-h-dvh w-full items-center justify-center gap-16 bg-background md:p-10">
      <aside className="hidden max-w-[280px] flex-col gap-4 xl:flex">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground shadow-soft">
          <span className="size-1.5 rounded-full bg-primary" />
          Texxel mobile
        </div>
        <h1 className="text-3xl font-semibold leading-tight tracking-[-0.03em] text-balance">
          A calm workspace that fits in one hand.
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          Projects, tasks, schedule and an AI assistant — wrapped in a warm paper interface. Tap through the tab bar,
          open a project, then change the accent in Profile.
        </p>
        <ul className="mt-1 flex flex-col gap-2 text-sm text-muted-foreground">
          {["Five full screens", "Live progress + charts", "Six accent presets", "Light and dark"].map((f) => (
            <li key={f} className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary/70" />
              {f}
            </li>
          ))}
        </ul>
      </aside>

      <div className="relative shrink-0">
        <div
          aria-hidden="true"
          className="absolute -inset-8 hidden rounded-[4rem] bg-primary/10 blur-3xl md:block"
        />
        <div
          className="relative h-dvh w-full overflow-hidden bg-background md:h-[860px] md:w-[400px] md:rounded-[3.25rem] md:border-[10px] md:shadow-lift"
          style={{ borderColor: dark ? "#171615" : "#26251f" }}
        >
          <StatusBar />
          <main className="no-scrollbar relative h-[calc(100%-3rem)] overflow-y-auto overscroll-contain">
            {children}
          </main>
          <TabBar />
        </div>
      </div>
    </div>
  )
}
