import { Screen } from "@/components/screen"
import { InboxView } from "@/components/inbox/inbox-view"

export const metadata = { title: "Inbox — Texxel" }

export default function InboxPage() {
  return (
    <Screen>
      <InboxView />
    </Screen>
  )
}
