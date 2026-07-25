import { Screen } from "@/components/screen"
import { AssistantView } from "@/components/assistant/assistant-view"

export const metadata = { title: "Assistant — Texxel" }

export default function AssistantPage() {
  return (
    <Screen stagger={false}>
      <AssistantView />
    </Screen>
  )
}
