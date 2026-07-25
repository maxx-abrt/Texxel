import Link from "next/link"
import { SectionTitle } from "@/components/kit"
import { Screen } from "@/components/screen"
import { GreetingHeader } from "@/components/home/greeting-header"
import { FocusCard } from "@/components/home/focus-card"
import { ProjectRail } from "@/components/home/project-rail"
import { SchedulePreview } from "@/components/home/schedule-preview"
import { DocRail } from "@/components/home/doc-rail"
import { TaskCard } from "@/components/task-card"
import { tasks } from "@/lib/mock-data"

export default function HomePage() {
  const priority = tasks.filter((t) => t.due === "Today" && t.status !== "done").slice(0, 2)

  return (
    <Screen>
      <GreetingHeader />
      <FocusCard />
      <ProjectRail />

      <section className="flex flex-col gap-3">
        <SectionTitle
          title="Needs you first"
          action={
            <Link href="/tasks" className="press text-[13px] font-semibold text-primary">
              All tasks
            </Link>
          }
        />
        <div className="flex flex-col gap-2">
          {priority.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>
      </section>

      <SchedulePreview />
      <DocRail />
    </Screen>
  )
}
