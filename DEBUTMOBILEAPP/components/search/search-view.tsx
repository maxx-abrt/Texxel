"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, FileText, Folder, Search, SquareCheck, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { IconTile } from "@/components/kit"
import { docs, projects, tasks, type Tone } from "@/lib/mock-data"

type Result = {
  id: string
  href: string
  title: string
  meta: string
  kind: "Task" | "Doc" | "Project"
  tone: Tone
  icon: React.ElementType
}

const suggestions = ["Design system", "Onboarding", "Roadmap", "Acme", "Brand"]

export function SearchView() {
  const [q, setQ] = useState("")
  const [scope, setScope] = useState<"all" | "Task" | "Doc" | "Project">("all")

  const index = useMemo<Result[]>(
    () => [
      ...tasks.map((t) => ({
        id: t.id,
        href: `/tasks/${t.id}`,
        title: t.title,
        meta: `${t.project} · ${t.due}`,
        kind: "Task" as const,
        tone: "coral" as Tone,
        icon: SquareCheck,
      })),
      ...docs.map((d) => ({
        id: d.id,
        href: `/docs/${d.id}`,
        title: d.title,
        meta: `Doc · ${d.editedAt} · ${d.words} words`,
        kind: "Doc" as const,
        tone: "ocean" as Tone,
        icon: FileText,
      })),
      ...projects.map((p) => ({
        id: p.id,
        href: `/projects/${p.id}`,
        title: p.name,
        meta: `${p.client} · ${p.done}/${p.total} tasks`,
        kind: "Project" as const,
        tone: "mint" as Tone,
        icon: Folder,
      })),
    ],
    [],
  )

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return index.filter((r) => {
      const scoped = scope === "all" || r.kind === scope
      const matched = !needle || `${r.title} ${r.meta}`.toLowerCase().includes(needle)
      return scoped && matched
    })
  }, [index, q, scope])

  return (
    <>
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-card px-4 py-3 shadow-soft">
            <Search className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={2.2} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tasks, docs, projects"
              aria-label="Search workspace"
              className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
            />
            {q ? (
              <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="press text-muted-foreground">
                <X className="size-4" strokeWidth={2.6} />
              </button>
            ) : null}
          </div>
          <Link href="/" className="press text-[13px] font-semibold text-primary">
            Cancel
          </Link>
        </div>

        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {(["all", "Task", "Doc", "Project"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              aria-pressed={scope === s}
              className={cn(
                "press shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-semibold capitalize",
                scope === s ? "border-transparent bg-ink text-background" : "border-border bg-card text-muted-foreground",
              )}
            >
              {s === "all" ? "Everything" : `${s}s`}
            </button>
          ))}
        </div>

        {!q ? (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQ(s)}
                className="press rounded-full bg-secondary px-3 py-1.5 text-[12px] font-semibold text-muted-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <p className="px-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {results.length} result{results.length === 1 ? "" : "s"}
      </p>

      <div key={`${q}-${scope}`} className="stagger flex flex-col gap-2">
        {results.map((r) => (
          <Link
            key={r.kind + r.id}
            href={r.href}
            className="press flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft"
          >
            <IconTile tone={r.tone} size={38}>
              <r.icon className="size-[18px]" strokeWidth={2.2} />
            </IconTile>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold tracking-[-0.01em]">{r.title}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{r.meta}</span>
            </span>
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={2.4} />
          </Link>
        ))}
        {!results.length ? (
          <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No matches for &ldquo;{q}&rdquo;. Try a different term.
          </p>
        ) : null}
      </div>
    </>
  )
}
