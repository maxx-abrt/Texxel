import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"

export function Screen({
  children,
  className,
  stagger = true,
}: {
  children: ReactNode
  className?: string
  stagger?: boolean
}) {
  return (
    <div className={cn("flex flex-col gap-5 px-5 pb-32 pt-1", stagger && "stagger", className)}>{children}</div>
  )
}

export function BackHeader({
  title,
  subtitle,
  href = "/",
  action,
}: {
  title: string
  subtitle?: string
  href?: string
  action?: ReactNode
}) {
  return (
    <header className="flex items-center gap-3">
      <Link
        href={href}
        aria-label="Go back"
        className="press grid size-10 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground shadow-soft"
      >
        <ChevronLeft className="size-5" strokeWidth={2.2} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold tracking-[-0.01em]">{title}</p>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  )
}
