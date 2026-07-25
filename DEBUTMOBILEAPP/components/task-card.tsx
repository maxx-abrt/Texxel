import Link from "next/link"
import { Clock, Flag, ListChecks } from "lucide-react"
import { AvatarStack, Badge, ProgressBar } from "@/components/kit"
import { priorityTone, statusLabel, statusTone, toneVar, type Task } from "@/lib/mock-data"

export function TaskCard({ task, compact = false }: { task: Task; compact?: boolean }) {
  const done = task.subtasks.filter((s) => s.done).length
  const isDone = task.status === "done"

  return (
    <Link
      href={`/tasks/${task.id}`}
      className="press flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 shadow-soft"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2"
          style={{
            borderColor: isDone ? toneVar("mint") : `color-mix(in oklch, ${toneVar(priorityTone[task.priority])} 55%, var(--border))`,
            background: isDone ? toneVar("mint") : "transparent",
          }}
        >
          {isDone ? <span className="size-1.5 rounded-full bg-card" /> : null}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={`block text-[15px] font-semibold leading-snug tracking-[-0.015em] text-pretty ${
              isDone ? "text-muted-foreground line-through" : ""
            }`}
          >
            {task.title}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span className="font-semibold" style={{ color: toneVar(priorityTone[task.priority]) }}>
              {task.project}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" strokeWidth={2.4} />
              {task.due}, {task.time}
            </span>
          </span>
        </span>

        <Badge tone={statusTone[task.status]}>{statusLabel[task.status]}</Badge>
      </div>

      {!compact ? (
        <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3">
          <div className="flex items-center gap-2">
            <AvatarStack people={task.assignees} size={22} />
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Flag className="size-3" strokeWidth={2.4} style={{ color: toneVar(priorityTone[task.priority]) }} />
              {task.priority}
            </span>
          </div>

          {task.subtasks.length ? (
            <div className="flex w-28 items-center gap-2">
              <ListChecks className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2.2} />
              <ProgressBar value={(done / task.subtasks.length) * 100} tone={statusTone[task.status]} />
              <span className="font-mono text-[10px] font-bold tabular-nums text-muted-foreground">
                {done}/{task.subtasks.length}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {task.labels.map((l) => (
                <span
                  key={l}
                  className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                >
                  {l}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </Link>
  )
}
