import { Screen } from "@/components/screen"
import { TasksView } from "@/components/tasks/tasks-view"

export const metadata = { title: "Tasks — Texxel" }

export default function TasksPage() {
  return (
    <Screen>
      <TasksView />
    </Screen>
  )
}
