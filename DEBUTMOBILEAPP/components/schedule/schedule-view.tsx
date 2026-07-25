"use client"

import { useState } from "react"
import { CalendarPlus, ChevronLeft, ChevronRight, Video } from "lucide-react"
import { cn } from "@/lib/utils"
import { AvatarStack, Badge } from "@/components/kit"
import { events, scheduleDays, toneVar } from "@/lib/mock-data"

const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17]

function label(h: number) {
  if (h === 12) return "12 PM"
  return h > 12 ? `${h - 12} PM` : `${h} AM`
}

export function ScheduleView() {
  const [active, setActive] = useState(25)
  const dayEvents = active === 25 ? events : events.slice(0, 3)

  return (
    <>
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">July 2026</p>
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em]">Schedule</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous week"
              className="press grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-soft"
            >
              <ChevronLeft className="size-[18px]" strokeWidth={2.2} />
            </button>
            <button
              type="button"
              aria-label="Next week"
              className="press grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-soft"
            >
              <ChevronRight className="size-[18px]" strokeWidth={2.2} />
            </button>
          </div>
        </div>

        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {scheduleDays.map((d) => {
            const on = d.date === active
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => setActive(d.date)}
                aria-pressed={on}
                className={cn(
                  "press flex w-14 shrink-0 flex-col items-center gap-1 rounded-3xl border py-3",
                  on ? "border-transparent bg-ink text-background" : "border-border bg-card",
                )}
              >
                <span className={cn("text-[11px] font-semibold", on ? "text-background/70" : "text-muted-foreground")}>
                  {d.label}
                </span>
                <span className="font-mono text-[17px] font-bold tabular-nums">{d.date}</span>
                <span
                  className="size-1 rounded-full"
                  style={{ background: on ? "var(--primary)" : "var(--border)" }}
                  aria-hidden="true"
                />
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between rounded-3xl border border-border bg-card p-4 shadow-soft">
          <div>
            <p className="text-[13px] font-semibold">{dayEvents.length} events today</p>
            <p className="mt-0.5 text-xs text-muted-foreground">4h 45m booked · 3h 15m free</p>
          </div>
          <button
            type="button"
            className="press inline-flex items-center gap-2 rounded-full bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground"
          >
            <CalendarPlus className="size-4" strokeWidth={2.4} />
            New
          </button>
        </div>
      </header>

      <section key={active} className="relative flex flex-col">
        {hours.map((h) => {
          const slot = dayEvents.filter((e) => e.hour === h)
          return (
            <div key={h} className="flex gap-3">
              <span className="w-14 shrink-0 pt-1 font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
                {label(h)}
              </span>
              <div className="flex-1 border-t border-dashed border-border pb-3">
                {slot.length ? (
                  <div className="flex flex-col gap-2 pt-1">
                    {slot.map((e) => (
                      <article
                        key={e.id}
                        className="animate-rise rounded-2xl p-3.5 shadow-soft"
                        style={{
                          background: `color-mix(in oklch, ${toneVar(e.tone)} 14%, var(--card))`,
                          borderLeft: `3px solid ${toneVar(e.tone)}`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-[14px] font-semibold leading-snug tracking-[-0.01em] text-pretty">
                            {e.title}
                          </h3>
                          <Badge tone={e.tone}>{e.start}</Badge>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">{e.meta}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <AvatarStack people={e.attendees} size={22} />
                          {e.tone === "ocean" || e.tone === "amber" ? (
                            <span
                              className="inline-flex items-center gap-1.5 text-[11px] font-semibold"
                              style={{ color: toneVar(e.tone) }}
                            >
                              <Video className="size-3.5" strokeWidth={2.4} />
                              Join call
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {e.start} – {e.end}
                            </span>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="h-8" />
                )}
              </div>
            </div>
          )
        })}
      </section>
    </>
  )
}
