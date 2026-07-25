import { notFound } from "next/navigation"
import { CalendarDays, Flag, MoreHorizontal, Target, Users } from "lucide-react"
import { BackHeader, Screen } from "@/components/screen"
import { AvatarStack, Badge, IconTile, ProgressRing, SectionTitle } from "@/components/kit"
import { TaskCard } from "@/components/task-card"
import { projects, tasks, toneVar, type Project } from "@/lib/mock-data"

const projectStatusLabel: Record<Project["status"], string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = projects.find((p) => p.id === id)
  if (!project) notFound()

  const projectTasks = tasks.filter((t) => t.projectId === project.id)
  const openTasks = projectTasks.filter((t) => t.status !== "done")
  const doneTasks = projectTasks.filter((t) => t.status === "done")
  const percent = Math.round((project.done / project.total) * 100)

  return (
    <Screen>
      <BackHeader
        title={project.name}
        subtitle={`${project.client} · Due ${project.due}`}
        href="/"
        action={
          <button
            type="button"
            aria-label="Project options"
            className="press grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-soft"
          >
            <MoreHorizontal className="size-[18px]" strokeWidth={2.2} />
          </button>
        }
      />

      <header
        className="rounded-[28px] border border-border p-5 shadow-soft"
        style={{
          background: `linear-gradient(170deg, color-mix(in oklch, ${toneVar(project.tone)} 15%, var(--card)) 0%, var(--card) 70%)`,
        }}
      >
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <span
              className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
              style={{
                background: `color-mix(in oklch, ${toneVar(project.tone)} 20%, transparent)`,
                color: `color-mix(in oklch, ${toneVar(project.tone)} 82%, var(--foreground))`,
              }}
            >
              {project.client}
            </span>
            <h1 className="mt-3 text-[24px] font-semibold leading-tight tracking-[-0.03em] text-balance">
              {project.name}
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground text-pretty">
              Now working on {project.currentStep.toLowerCase()}
            </p>
          </div>

          <ProgressRing value={percent} size={72} stroke={7} tone={project.tone}>
            <span className="font-mono text-[15px] font-bold tabular-nums" style={{ color: toneVar(project.tone) }}>
              {percent}%
            </span>
          </ProgressRing>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
          <AvatarStack people={project.members} size={26} />
          <Badge tone={project.tone}>
            <Flag className="size-3" strokeWidth={2.6} />
            {projectStatusLabel[project.status]}
          </Badge>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Target, label: "Tasks done", value: `${project.done}/${project.total}` },
          { icon: Users, label: "Team", value: String(project.members.length) },
          { icon: CalendarDays, label: "Due", value: project.due },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-start gap-2 rounded-3xl border border-border bg-card p-3 shadow-soft"
          >
            <IconTile tone={project.tone} size={30}>
              <stat.icon className="size-4" strokeWidth={2.3} />
            </IconTile>
            <span className="font-mono text-[15px] font-bold tabular-nums leading-none">{stat.value}</span>
            <span className="text-[11px] leading-tight text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <SectionTitle
          title="Open tasks"
          action={
            <span className="font-mono text-[13px] font-semibold tabular-nums text-muted-foreground">
              {openTasks.length}
            </span>
          }
        />
        {openTasks.length ? (
          openTasks.map((task) => <TaskCard key={task.id} task={task} />)
        ) : (
          <p className="rounded-3xl border border-dashed border-border bg-card/60 p-5 text-center text-[13px] text-muted-foreground">
            No open tasks on this project.
          </p>
        )}
      </section>

      {doneTasks.length ? (
        <section className="flex flex-col gap-3">
          <SectionTitle title="Completed" />
          {doneTasks.map((task) => (
            <TaskCard key={task.id} task={task} compact />
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <SectionTitle title="Milestones" />
        <ol className="flex flex-col rounded-3xl border border-border bg-card p-5 shadow-soft">
          {[
            { label: "Kickoff & discovery", state: "done" as const },
            { label: project.currentStep, state: "current" as const },
            { label: "Handoff & QA", state: "todo" as const },
            { label: "Launch", state: "todo" as const },
          ].map((m, i, arr) => (
            <li key={m.label} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  aria-hidden="true"
                  className="mt-1 grid size-3 shrink-0 place-items-center rounded-full ring-4 ring-card"
                  style={{
                    background:
                      m.state === "todo" ? "var(--secondary)" : toneVar(m.state === "done" ? "mint" : project.tone),
                  }}
                />
                {i < arr.length - 1 ? <span className="my-1 w-px flex-1 bg-border" aria-hidden="true" /> : null}
              </div>
              <div className={i < arr.length - 1 ? "pb-5" : ""}>
                <p
                  className={`text-[14px] font-semibold tracking-[-0.01em] ${
                    m.state === "todo" ? "text-muted-foreground" : ""
                  }`}
                >
                  {m.label}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {m.state === "done" ? "Completed" : m.state === "current" ? "In progress" : "Not started"}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </Screen>
  )
}
