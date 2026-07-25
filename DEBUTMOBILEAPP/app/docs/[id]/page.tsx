import { notFound } from "next/navigation"
import { Check, Clock, Share2 } from "lucide-react"
import { BackHeader, Screen } from "@/components/screen"
import { AvatarStack, Badge } from "@/components/kit"
import { docs, toneVar } from "@/lib/mock-data"

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const doc = docs.find((d) => d.id === id)
  if (!doc) notFound()

  return (
    <Screen>
      <BackHeader
        title={doc.title}
        subtitle={`Edited ${doc.editedAt}`}
        href="/"
        action={
          <button
            type="button"
            aria-label="Share document"
            className="press grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-soft"
          >
            <Share2 className="size-[18px]" strokeWidth={2.2} />
          </button>
        }
      />

      <header
        className="rounded-[28px] border border-border p-5 shadow-soft"
        style={{
          background: `linear-gradient(170deg, color-mix(in oklch, ${toneVar(doc.tone)} 14%, var(--card)) 0%, var(--card) 70%)`,
        }}
      >
        <span className="text-3xl" aria-hidden="true">
          {doc.emoji}
        </span>
        <h1 className="mt-3 text-[24px] font-semibold leading-tight tracking-[-0.03em] text-balance">{doc.title}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground text-pretty">{doc.excerpt}</p>
        <div className="mt-4 flex items-center justify-between">
          <AvatarStack people={doc.collaborators} size={24} />
          <Badge tone={doc.tone}>
            <Clock className="size-3" strokeWidth={2.6} />
            {doc.words} words
          </Badge>
        </div>
      </header>

      <article className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-5 shadow-soft">
        {doc.blocks.map((b, i) => {
          if (b.type === "h2")
            return (
              <h2 key={i} className="mt-1 text-[16px] font-semibold tracking-[-0.015em]">
                {b.text}
              </h2>
            )
          if (b.type === "quote")
            return (
              <blockquote
                key={i}
                className="rounded-r-xl border-l-2 py-1 pl-3 text-[14px] italic leading-relaxed text-muted-foreground"
                style={{ borderColor: toneVar(doc.tone) }}
              >
                {b.text}
              </blockquote>
            )
          if (b.type === "bullet")
            return (
              <p key={i} className="flex gap-2 text-[14px] leading-relaxed text-pretty">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden="true" />
                {b.text}
              </p>
            )
          if (b.type === "todo")
            return (
              <p key={i} className="flex items-center gap-2.5 text-[14px] leading-relaxed">
                <span
                  className="grid size-5 shrink-0 place-items-center rounded-md border-2"
                  style={{
                    borderColor: b.done ? toneVar("mint") : "var(--border)",
                    background: b.done ? toneVar("mint") : "transparent",
                  }}
                  aria-hidden="true"
                >
                  {b.done ? <Check className="size-3 text-card" strokeWidth={3.2} /> : null}
                </span>
                <span className={b.done ? "text-muted-foreground line-through" : ""}>{b.text}</span>
              </p>
            )
          return (
            <p key={i} className="text-[14px] leading-relaxed text-muted-foreground text-pretty">
              {b.text}
            </p>
          )
        })}
      </article>
    </Screen>
  )
}
