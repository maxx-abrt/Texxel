"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Plus, SlidersHorizontal, LayoutGrid, Rows3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge, ProgressBar } from "@/components/kit"
import { TaskCard } from "@/components/task-card"
import { statusLabel, statusTone, tasks as allTasks, toneVar, type Task } from "@/lib/mock-data"

const filters = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "in_progress", label: "In progress" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
] as const

const boardColumns: Task["status"][] = ["planned", "in_progress", "review", "done"]

export function TasksView() {
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all")
  const [view, setView] = useState<"list" | "board">("list")

  const visible = useMemo(() => {
    if (filter === "all") return allTasks
    if (filter === "today") return allTasks.filter((t) => t.due === "Today")
    return allTasks.filter((t) => t.status === filter)
  }, [filter])

  const completed = allTasks.filter((t) => t.status === "done").length

  return (
    <>
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Texxel HQ</p>
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em]">Tasks</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Filter tasks"
              className="press grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-soft"
            >
              <SlidersHorizontal className="size-[18px]" strokeWidth={2.2} />
            </button>
            <button
              type="button"
              aria-label="New task"
              className="press grid size-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft"
            >
              <Plus className="size-5" strokeWidth={2.6} />
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] font-semibold text-muted-foreground">Week progress</p>
            <p className="font-mono text-[13px] font-bold tabular-nums">
              {completed}/{allTasks.length}
            </p>
          </div>
          <ProgressBar value={(completed / allTasks.length) * 100} className="mt-3" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {boardColumns.map((s) => (
              <Badge key={s} tone={statusTone[s]}>
                {allTasks.filter((t) => t.status === s).length} {statusLabel[s].toLowerCase()}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="no-scrollbar -mx-5 flex flex-1 gap-2 overflow-x-auto px-5">
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
          <button
            type="button"
            onClick={() => setView((v) => (v === "list" ? "board" : "list"))}
            aria-label={view === "list" ? "Switch to board view" : "Switch to list view"}
            className="press grid size-10 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-soft"
          >
            {view === "list" ? (
              <LayoutGrid className="size-[18px]" strokeWidth={2.2} />
            ) : (
              <Rows3 className="size-[18px]" strokeWidth={2.2} />
            )}
          </button>
        </div>
      </header>

      {view === "list" ? (
        <div key={filter} className="stagger flex flex-col gap-2">
          {visible.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
          {!visible.length ? (
            <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nothing here. Enjoy the quiet.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5">
          {boardColumns.map((col) => {
            const items = visible.filter((t) => t.status === col)
            return (
              <div key={col} className="w-[250px] shrink-0 snap-start">
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className="size-2 rounded-full" style={{ background: toneVar(statusTone[col]) }} />
                  <p className="text-[13px] font-semibold">{statusLabel[col]}</p>
                  <span className="font-mono text-[11px] font-bold text-muted-foreground">{items.length}</span>
                </div>
                <div className="stagger flex min-h-24 flex-col gap-2 rounded-3xl bg-secondary/60 p-2">
                  {items.map((t) => (
                    <TaskCard key={t.id} task={t} compact />
                  ))}
                  {!items.length ? (
                    <p className="p-4 text-center text-xs text-muted-foreground">Empty</p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Link
        href="/schedule"
        className="press mt-1 flex items-center justify-between rounded-3xl border border-border bg-card p-4 text-[13px] font-semibold shadow-soft"
      >
        Plan these on the calendar
        <span className="text-primary">Open schedule</span>
      </Link>
    </>
  )
}
