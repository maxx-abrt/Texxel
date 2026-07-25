import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { AvatarStack, ProgressBar, SectionTitle } from "@/components/kit"
import { projects, toneVar } from "@/lib/mock-data"

export function ProjectRail() {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle
        title="Active projects"
        action={
          <Link href="/tasks" className="press text-[13px] font-semibold text-primary">
            See all
          </Link>
        }
      />

      <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="press w-[212px] shrink-0 snap-start rounded-3xl border border-border bg-card p-4 shadow-soft"
            style={{
              background: `linear-gradient(170deg, color-mix(in oklch, ${toneVar(p.tone)} 13%, var(--card)) 0%, var(--card) 62%)`,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
                style={{
                  background: `color-mix(in oklch, ${toneVar(p.tone)} 20%, transparent)`,
                  color: `color-mix(in oklch, ${toneVar(p.tone)} 82%, var(--foreground))`,
                }}
              >
                {p.client}
              </span>
              <ArrowRight
                className="size-4 shrink-0 text-muted-foreground"
                strokeWidth={2.2}
                style={{ color: toneVar(p.tone) }}
              />
            </div>

            <p className="mt-6 text-[17px] font-semibold leading-tight tracking-[-0.02em]">{p.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">Now: {p.currentStep}</p>

            <div className="mt-4 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span className="font-mono tabular-nums">
                {p.done}/{p.total} tasks
              </span>
              <span>Due {p.due}</span>
            </div>
            <ProgressBar value={(p.done / p.total) * 100} tone={p.tone} className="mt-2" />

            <div className="mt-4 flex items-center justify-between">
              <AvatarStack people={p.members} size={22} />
              <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: toneVar(p.tone) }}>
                {Math.round((p.done / p.total) * 100)}%
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
