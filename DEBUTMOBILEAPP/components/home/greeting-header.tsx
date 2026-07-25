import Link from "next/link"
import { Search, Bell } from "lucide-react"
import { Avatar } from "@/components/kit"
import { user } from "@/lib/mock-data"

export function GreetingHeader() {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/profile" className="press flex min-w-0 flex-1 items-center gap-3" aria-label="Open profile">
          <Avatar initials={user.initials} size={40} />
          <span className="min-w-0">
            <span className="block text-xs font-medium text-muted-foreground">Good morning</span>
            <span className="block truncate text-[15px] font-semibold tracking-[-0.01em]">{user.name}</span>
          </span>
        </Link>
        <Link
          href="/search"
          aria-label="Search workspace"
          className="press grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-soft"
        >
          <Search className="size-[18px]" strokeWidth={2.2} />
        </Link>
        <Link
          href="/inbox"
          aria-label="Open inbox, 3 unread"
          className="press relative grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-soft"
        >
          <Bell className="size-[18px]" strokeWidth={2.2} />
          <span className="absolute right-2 top-2 size-2 rounded-full bg-primary ring-2 ring-card" />
        </Link>
      </div>

      <div>
        <h1 className="text-[27px] font-semibold leading-[1.12] tracking-[-0.035em] text-balance">
          Let&apos;s build something
          <br />
          great today.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          4 tasks due · 2 meetings · {user.streak}-day streak
        </p>
      </div>
    </header>
  )
}
