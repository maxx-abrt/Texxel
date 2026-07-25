import type { ReactNode, CSSProperties } from "react"
import { cn } from "@/lib/utils"
import { toneVar, type Tone } from "@/lib/mock-data"

/* ------------------------------- Surface ------------------------------- */

export function Card({
  children,
  className,
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      style={style}
      className={cn(
        "rounded-3xl border border-border bg-card p-4 shadow-soft",
        "[border-curve:continuous]",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SectionTitle({
  title,
  action,
  className,
}: {
  title: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-end justify-between gap-3 px-1", className)}>
      <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
      {action}
    </div>
  )
}

/* ------------------------------- Avatars ------------------------------- */

const avatarTones: Record<string, Tone> = {
  MA: "coral",
  SL: "ocean",
  JD: "mint",
  TR: "amber",
  KP: "violet",
  MR: "ocean",
  CA: "coral",
}

export function Avatar({
  initials,
  size = 36,
  className,
}: {
  initials: string
  size?: number
  className?: string
}) {
  const tone = avatarTones[initials] ?? "ocean"
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.36),
        background: `color-mix(in oklch, ${toneVar(tone)} 22%, var(--card))`,
        color: `color-mix(in oklch, ${toneVar(tone)} 78%, var(--foreground))`,
      }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight",
        "ring-1 ring-inset ring-black/5",
        className,
      )}
    >
      {initials}
    </span>
  )
}

export function AvatarStack({ people, size = 24 }: { people: string[]; size?: number }) {
  return (
    <div className="flex items-center">
      {people.slice(0, 3).map((p, i) => (
        <Avatar
          key={p + i}
          initials={p}
          size={size}
          className={cn("ring-2 ring-card", i > 0 && "-ml-2")}
        />
      ))}
      {people.length > 3 ? (
        <span
          style={{ width: size, height: size, fontSize: size * 0.33 }}
          className="-ml-2 inline-flex items-center justify-center rounded-full bg-secondary font-semibold text-muted-foreground ring-2 ring-card"
        >
          +{people.length - 3}
        </span>
      ) : null}
    </div>
  )
}

/* -------------------------------- Badges ------------------------------- */

export function Badge({
  children,
  tone = "coral",
  className,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      style={{
        background: `color-mix(in oklch, ${toneVar(tone)} 15%, var(--card))`,
        color: `color-mix(in oklch, ${toneVar(tone)} 80%, var(--foreground))`,
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-tight",
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Dot({ tone = "coral" }: { tone?: Tone }) {
  return (
    <span
      aria-hidden="true"
      style={{ background: toneVar(tone) }}
      className="size-1.5 shrink-0 rounded-full"
    />
  )
}

export function IconTile({
  children,
  tone = "coral",
  size = 40,
  soft = true,
  className,
}: {
  children: ReactNode
  tone?: Tone
  size?: number
  soft?: boolean
  className?: string
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        background: soft ? `color-mix(in oklch, ${toneVar(tone)} 14%, var(--card))` : toneVar(tone),
        color: soft ? `color-mix(in oklch, ${toneVar(tone)} 82%, var(--foreground))` : "#fff",
      }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-2xl [border-curve:continuous]",
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ------------------------------- Progress ------------------------------ */

export function ProgressBar({
  value,
  tone = "coral",
  className,
}: {
  value: number
  tone?: Tone
  className?: string
}) {
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-secondary", className)}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: toneVar(tone),
          transition: "width 700ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        className="h-full rounded-full"
      />
    </div>
  )
}

export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  tone = "coral",
  children,
}: {
  value: number
  size?: number
  stroke?: number
  tone?: Tone
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--secondary)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={toneVar(tone)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c.toFixed(1)}
          strokeDashoffset={offset.toFixed(1)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">{children}</span>
    </div>
  )
}
