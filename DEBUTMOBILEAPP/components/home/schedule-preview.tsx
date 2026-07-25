import Link from "next/link"
import { Clock } from "lucide-react"
import { AvatarStack, SectionTitle } from "@/components/kit"
import { events, toneVar } from "@/lib/mock-data"

export function SchedulePreview() {
  const upcoming = events.slice(0, 3)

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle
        title="Today"
        action={
          <Link href="/schedule" className="press text-[13px] font-semibold text-primary">
            Full schedule
          </Link>
        }
      />

      <div className="flex flex-col gap-2">
        {upcoming.map((e) => (
          <Link
            key={e.id}
            href="/schedule"
            className="press flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft"
          >
            <span
              className="h-11 w-1 shrink-0 rounded-full"
              style={{ background: toneVar(e.tone) }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold tracking-[-0.01em]">{e.title}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="size-3" strokeWidth={2.4} />
                {e.start} – {e.end}
              </span>
            </span>
            <AvatarStack people={e.attendees} size={22} />
          </Link>
        ))}
      </div>
    </section>
  )
}
