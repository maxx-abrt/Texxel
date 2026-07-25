"use client"

import { useState } from "react"
import { Check, Clock, Flag, Folder, MessageSquare, Plus } from "lucide-react"
import { Avatar, AvatarStack, Badge, ProgressBar, ProgressRing } from "@/components/kit"
import { priorityTone, statusLabel, statusTone, toneVar, type Task } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

export function TaskDetail({ task }: { task: Task }) {
  const [subtasks, setSubtasks] = useState(task.subtasks)
  const [status, setStatus] = useState(task.status)

  const done = subtasks.filter((s) => s.done).length
  const pct = subtasks.length ? (done / subtasks.length) * 100 : status === "done" ? 100 : 35

  return (
    <>
      <section className="rounded-[28px] border border-border bg-card p-5 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Badge tone={priorityTone[task.priority]}>
              <Flag className="size-3" strokeWidth={2.6} />
              {task.priority} priority
            </Badge>
            <h1 className="mt-3 text-[22px] font-semibold leading-tight tracking-[-0.025em] text-pretty">
              {task.title}
            </h1>
          </div>
          <ProgressRing value={pct} size={64} stroke={6} tone={statusTone[status]}>
            <span className="font-mono text-[12px] font-bold tabular-nums">{Math.round(pct)}%</span>
          </ProgressRing>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3">
          {[
            { icon: Folder, label: "Project", value: task.project },
            { icon: Clock, label: "Due", value: `${task.due}, ${task.time}` },
          ].map((row) => (
            <div key={row.label} className="rounded-2xl bg-secondary/70 p-3">
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <row.icon className="size-3" strokeWidth={2.4} />
                {row.label}
              </dt>
              <dd className="mt-1 truncate text-[13px] font-semibold">{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex items-center justify-between">
          <AvatarStack people={task.assignees} size={26} />
          <div className="flex flex-wrap gap-1.5">
            {task.labels.map((l) => (
              <span key={l} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {l}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[15px] font-semibold">Status</h2>
          <span className="font-mono text-[11px] font-bold text-muted-foreground">tap to change</span>
        </div>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {(Object.keys(statusLabel) as Task["status"][]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              aria-pressed={status === s}
              className={cn(
                "press flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-semibold",
                status === s ? "border-transparent text-background" : "border-border bg-card text-muted-foreground",
              )}
              style={status === s ? { background: toneVar(statusTone[s]) } : undefined}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: status === s ? "currentColor" : toneVar(statusTone[s]) }}
              />
              {statusLabel[s]}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-4 shadow-soft">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold">Subtasks</h2>
          <span className="font-mono text-[12px] font-bold tabular-nums text-muted-foreground">
            {done}/{subtasks.length || 0}
          </span>
        </div>
        <ProgressBar value={pct} tone={statusTone[status]} className="mt-3" />

        <ul className="mt-3 flex flex-col divide-y divide-border/70">
          {subtasks.map((s, i) => (
            <li key={s.title}>
              <button
                type="button"
                onClick={() =>
                  setSubtasks((prev) => prev.map((p, pi) => (pi === i ? { ...p, done: !p.done } : p)))
                }
                className="press flex w-full items-center gap-3 py-3 text-left"
                aria-pressed={s.done}
              >
                <span
                  className="grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors"
                  style={{
                    borderColor: s.done ? toneVar("mint") : "var(--border)",
                    background: s.done ? toneVar("mint") : "transparent",
                  }}
                >
                  {s.done ? <Check className="size-3 text-card" strokeWidth={3.2} /> : null}
                </span>
                <span className={cn("text-[14px] font-medium", s.done && "text-muted-foreground line-through")}>
                  {s.title}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="press mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-[13px] font-semibold text-muted-foreground"
        >
          <Plus className="size-4" strokeWidth={2.6} />
          Add subtask
        </button>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-[15px] font-semibold">Activity</h2>
        {[
          { who: "SL", text: "Pushed the new spacing tokens — ready for review.", when: "12m" },
          { who: "JD", text: "Blocked on the API shape, I will ping backend.", when: "1h" },
        ].map((c) => (
          <div key={c.who} className="flex gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft">
            <Avatar initials={c.who} size={30} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-relaxed text-pretty">{c.text}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{c.when} ago</p>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-3 shadow-soft">
          <MessageSquare className="size-4 shrink-0 text-muted-foreground" strokeWidth={2.2} />
          <input
            placeholder="Add a comment"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
          <button type="button" className="press text-[13px] font-semibold text-primary">
            Send
          </button>
        </div>
      </section>
    </>
  )
}
