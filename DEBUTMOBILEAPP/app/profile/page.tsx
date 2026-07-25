import { BackHeader, Screen } from "@/components/screen"
import { ProfileView } from "@/components/profile/profile-view"

export const metadata = { title: "Profile — Texxel" }

export default function ProfilePage() {
  return (
    <Screen>
      <BackHeader title="Profile" subtitle="Appearance & account" href="/" />
      <ProfileView />
    </Screen>
  )
}
