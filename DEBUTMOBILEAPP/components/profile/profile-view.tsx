"use client"

import { Bell, Check, ChevronRight, Moon, Palette, Shield, Sun, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, IconTile, ProgressRing } from "@/components/kit"
import { useAccent } from "@/components/accent-provider"
import { projects, tasks, user } from "@/lib/mock-data"

export function ProfileView() {
  const { accent, accentName, setAccent, presets, dark, toggleDark } = useAccent()
  const completed = tasks.filter((t) => t.status === "done").length

  const stats = [
    { label: "Projects", value: projects.length },
    { label: "Tasks done", value: completed + 38 },
    { label: "Day streak", value: user.streak },
  ]

  return (
    <>
      <section className="flex flex-col items-center gap-3 rounded-[28px] border border-border bg-card p-6 text-center shadow-soft">
        <ProgressRing value={user.focusScore} size={88} stroke={5}>
          <Avatar initials={user.initials} size={70} />
        </ProgressRing>
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]">{user.name}</h1>
          <p className="text-[13px] text-muted-foreground">
            {user.role} · {user.workspace}
          </p>
        </div>
        <dl className="mt-2 grid w-full grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-secondary/70 py-3">
              <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{s.label}</dt>
              <dd className="mt-0.5 font-mono text-[19px] font-bold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-3xl border border-border bg-card p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <IconTile tone="coral" size={38}>
            <Palette className="size-[18px]" strokeWidth={2.2} />
          </IconTile>
          <div className="flex-1">
            <p className="text-[14px] font-semibold">Accent colour</p>
            <p className="text-[11px] text-muted-foreground">{accentName} is applied across the app</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {presets.map((p) => {
            const on = p.hex === accent
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setAccent(p.id)}
                aria-label={`Use ${p.name} accent`}
                aria-pressed={on}
                className={cn("press grid size-11 place-items-center rounded-2xl ring-offset-2 ring-offset-card", on && "ring-2")}
                style={{ background: p.hex, boxShadow: on ? `0 0 0 2px ${p.hex}` : undefined }}
              >
                {on ? <Check className="size-5 text-white" strokeWidth={3} /> : null}
              </button>
            )
          })}
        </div>
      </section>

      <button
        type="button"
        onClick={toggleDark}
        aria-pressed={dark}
        className="press flex items-center gap-3 rounded-3xl border border-border bg-card p-4 text-left shadow-soft"
      >
        <IconTile tone={dark ? "violet" : "amber"} size={38}>
          {dark ? <Moon className="size-[18px]" strokeWidth={2.2} /> : <Sun className="size-[18px]" strokeWidth={2.2} />}
        </IconTile>
        <span className="flex-1">
          <span className="block text-[14px] font-semibold">{dark ? "Dark" : "Light"} appearance</span>
          <span className="block text-[11px] text-muted-foreground">Tap to switch the whole interface</span>
        </span>
        <span
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors",
            dark ? "bg-primary" : "bg-secondary",
          )}
        >
          <span
            className={cn(
              "absolute top-1 size-5 rounded-full bg-card shadow-soft transition-transform",
              dark ? "translate-x-6" : "translate-x-1",
            )}
          />
        </span>
      </button>

      <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        {[
          { icon: Bell, label: "Notifications", hint: "Mentions, tasks", tone: "ocean" as const },
          { icon: Users, label: "Workspace members", hint: "6 people", tone: "mint" as const },
          { icon: Shield, label: "Privacy & security", hint: "Passkey enabled", tone: "violet" as const },
        ].map((row, i) => (
          <button
            key={row.label}
            type="button"
            className={cn("press flex w-full items-center gap-3 p-4 text-left", i > 0 && "border-t border-border/70")}
          >
            <IconTile tone={row.tone} size={38}>
              <row.icon className="size-[18px]" strokeWidth={2.2} />
            </IconTile>
            <span className="flex-1">
              <span className="block text-[14px] font-semibold">{row.label}</span>
              <span className="block text-[11px] text-muted-foreground">{row.hint}</span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground" strokeWidth={2.4} />
          </button>
        ))}
      </section>

      <p className="pb-2 text-center font-mono text-[11px] text-muted-foreground">Texxel · v1.0 concept</p>
    </>
  )
}
