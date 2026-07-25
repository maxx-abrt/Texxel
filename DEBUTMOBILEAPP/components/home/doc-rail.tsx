import Link from "next/link"
import { AvatarStack, SectionTitle } from "@/components/kit"
import { docs, toneVar } from "@/lib/mock-data"

export function DocRail() {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle title="Continue where you left off" />

      <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1">
        {docs.map((d) => (
          <Link
            key={d.id}
            href={`/docs/${d.id}`}
            className="press flex w-[188px] shrink-0 snap-start flex-col rounded-3xl border border-border bg-card p-4 shadow-soft"
          >
            <span
              className="grid size-9 place-items-center rounded-2xl text-base"
              style={{ background: `color-mix(in oklch, ${toneVar(d.tone)} 16%, var(--card))` }}
              aria-hidden="true"
            >
              {d.emoji}
            </span>
            <span className="mt-3 text-[15px] font-semibold leading-snug tracking-[-0.015em] text-pretty">
              {d.title}
            </span>
            <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{d.excerpt}</span>
            <span className="mt-3 flex items-center justify-between">
              <AvatarStack people={d.collaborators} size={20} />
              <span className="text-[11px] font-medium text-muted-foreground">{d.editedAt}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
