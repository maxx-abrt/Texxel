import { Screen } from "@/components/screen"
import { ScheduleView } from "@/components/schedule/schedule-view"

export const metadata = { title: "Schedule — Texxel" }

export default function SchedulePage() {
  return (
    <Screen>
      <ScheduleView />
    </Screen>
  )
}
