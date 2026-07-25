import { notFound } from "next/navigation"
import { MoreHorizontal } from "lucide-react"
import { BackHeader, Screen } from "@/components/screen"
import { TaskDetail } from "@/components/tasks/task-detail"
import { tasks } from "@/lib/mock-data"

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const task = tasks.find((t) => t.id === id)
  if (!task) notFound()

  return (
    <Screen>
      <BackHeader
        title={task.project}
        subtitle="Task details"
        href="/tasks"
        action={
          <button
            type="button"
            aria-label="More options"
            className="press grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-soft"
          >
            <MoreHorizontal className="size-5" strokeWidth={2.2} />
          </button>
        }
      />
      <TaskDetail task={task} />
    </Screen>
  )
}
