"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { House, SquareCheck, CalendarDays, Bell, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { href: "/", label: "Home", icon: House },
  { href: "/tasks", label: "Tasks", icon: SquareCheck },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/inbox", label: "Inbox", icon: Bell, badge: 3 },
]

export function TabBar() {
  const pathname = usePathname()
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))
  const assistantActive = pathname.startsWith("/assistant")

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center pb-5"
    >
      <div className="pointer-events-auto relative flex items-center gap-1 rounded-full border border-border/60 bg-card/85 p-1.5 shadow-lift backdrop-blur-xl">
        {tabs.slice(0, 2).map((t) => (
          <TabItem key={t.href} {...t} active={isActive(t.href)} />
        ))}

        <Link
          href="/assistant"
          aria-label="AI assistant"
          className={cn(
            "press relative mx-1 grid size-12 place-items-center rounded-full text-primary-foreground",
            assistantActive ? "bg-ink" : "bg-primary",
          )}
        >
          <span className="absolute inset-0 animate-breathe rounded-full bg-primary/30 blur-md" aria-hidden="true" />
          <Sparkles className="relative size-5" strokeWidth={2.2} />
        </Link>

        {tabs.slice(2).map((t) => (
          <TabItem key={t.href} {...t} active={isActive(t.href)} />
        ))}
      </div>
    </nav>
  )
}

function TabItem({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
  badge?: number
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "press relative grid size-11 place-items-center rounded-full",
        active ? "bg-secondary text-foreground" : "text-muted-foreground",
      )}
    >
      <Icon className="size-[18px]" strokeWidth={active ? 2.4 : 2} />
      {badge ? (
        <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 font-mono text-[9px] font-bold leading-4 text-primary-foreground">
          {badge}
        </span>
      ) : null}
      <span className="sr-only">{label}</span>
      {active ? (
        <span className="absolute -bottom-0.5 size-1 rounded-full bg-primary" aria-hidden="true" />
      ) : null}
    </Link>
  )
}
