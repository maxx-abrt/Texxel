import Link from "next/link"
import { ArrowUpRight, TrendingUp } from "lucide-react"
import { ProgressRing } from "@/components/kit"
import { focusWeek, user } from "@/lib/mock-data"

export function FocusCard() {
  const peak = Math.max(...focusWeek.map((d) => d.value))

  return (
    <section className="relative overflow-hidden rounded-[28px] bg-ink p-5 text-background shadow-lift">
      <div
        aria-hidden="true"
        className="absolute -right-16 -top-20 size-52 rounded-full bg-primary/35 blur-2xl"
      />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-background/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
            <TrendingUp className="size-3" strokeWidth={2.6} />
            Focus score
          </p>
          <p className="mt-3 font-mono text-[38px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
            {user.focusScore}
            <span className="text-lg text-background/50">/100</span>
          </p>
          <p className="mt-2 max-w-[170px] text-[13px] leading-snug text-background/70 text-pretty">
            Up 14% this week. Your best block is Thursday morning.
          </p>
        </div>

        <ProgressRing value={user.focusScore} size={72} stroke={7}>
          <span className="font-mono text-[13px] font-bold tabular-nums">{user.focusScore}%</span>
        </ProgressRing>
      </div>

      <div className="relative mt-5 flex items-end justify-between gap-2">
        {focusWeek.map((d, i) => (
          <div key={d.day + i} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-16 w-full items-end justify-center">
              <div
                style={{
                  height: `${(d.value / peak) * 100}%`,
                  animation: `bar-grow 700ms cubic-bezier(0.16,1,0.3,1) ${i * 60}ms both`,
                  transformOrigin: "bottom",
                  background: d.value === peak ? "var(--primary)" : "color-mix(in oklch, var(--background) 22%, transparent)",
                }}
                className="w-full max-w-2.5 rounded-full"
              />
            </div>
            <span className="text-[10px] font-medium text-background/50">{d.day}</span>
          </div>
        ))}
      </div>

      <Link
        href="/assistant"
        className="press mt-4 flex items-center justify-between rounded-2xl bg-background/10 px-4 py-3 text-[13px] font-semibold backdrop-blur"
      >
        Ask the assistant to plan my day
        <ArrowUpRight className="size-4" strokeWidth={2.4} />
      </Link>
    </section>
  )
}
