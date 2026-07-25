"use client"

import { useMemo, useState } from "react"
import { AtSign, CalendarClock, CheckCheck, FileText, SquareCheck, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, IconTile } from "@/components/kit"
import { notifications as seed, type Notification, type Tone } from "@/lib/mock-data"

const filters = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "mention", label: "Mentions" },
  { id: "task", label: "Tasks" },
] as const

const kindMeta: Record<Notification["kind"], { icon: React.ElementType; tone: Tone }> = {
  mention: { icon: AtSign, tone: "coral" },
  task: { icon: SquareCheck, tone: "mint" },
  meeting: { icon: CalendarClock, tone: "ocean" },
  file: { icon: FileText, tone: "amber" },
  member: { icon: UserPlus, tone: "violet" },
}

export function InboxView() {
  const [items, setItems] = useState(seed)
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all")

  const visible = useMemo(() => {
    if (filter === "all") return items
    if (filter === "unread") return items.filter((n) => n.unread)
    return items.filter((n) => n.kind === filter)
  }, [items, filter])

  const unread = items.filter((n) => n.unread).length

  return (
    <>
      <header className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {unread ? `${unread} unread` : "You are all caught up"}
            </p>
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em]">Inbox</h1>
          </div>
          <button
            type="button"
            onClick={() => setItems((prev) => prev.map((n) => ({ ...n, unread: false })))}
            className="press inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-[12px] font-semibold text-muted-foreground shadow-soft"
          >
            <CheckCheck className="size-4" strokeWidth={2.4} />
            Mark all read
          </button>
        </div>

        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={cn(
                "press shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-semibold",
                filter === f.id
                  ? "border-transparent bg-ink text-background"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <div key={filter} className="stagger flex flex-col gap-2">
        {visible.map((n) => {
          const meta = kindMeta[n.kind]
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setItems((prev) => prev.map((p) => (p.id === n.id ? { ...p, unread: false } : p)))}
              className={cn(
                "press flex gap-3 rounded-3xl border p-4 text-left shadow-soft",
                n.unread ? "border-primary/25 bg-card" : "border-border bg-card/60",
              )}
            >
              <div className="relative shrink-0">
                <Avatar initials={n.initials} size={40} />
                <IconTile tone={meta.tone} size={20} className="absolute -bottom-1 -right-1 ring-2 ring-card">
                  <meta.icon className="size-3" strokeWidth={2.6} />
                </IconTile>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-semibold leading-snug tracking-[-0.01em]">
                    {n.title}
                    <span className="font-normal text-muted-foreground"> {n.context}</span>
                  </p>
                  <span className="shrink-0 font-mono text-[11px] font-semibold text-muted-foreground">{n.time}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground text-pretty">
                  {n.body}
                </p>
                {n.kind === "mention" || n.kind === "task" ? (
                  <div className="mt-3 flex gap-2">
                    <span className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground">
                      {n.kind === "mention" ? "Reply" : "Open task"}
                    </span>
                    <span className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-bold text-muted-foreground">
                      Snooze
                    </span>
                  </div>
                ) : null}
              </div>

              {n.unread ? <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" /> : null}
            </button>
          )
        })}

        {!visible.length ? (
          <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No notifications in this filter.
          </p>
        ) : null}
      </div>
    </>
  )
}
