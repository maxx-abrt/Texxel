import { Screen } from "@/components/screen"
import { SearchView } from "@/components/search/search-view"

export const metadata = { title: "Search — Texxel" }

export default function SearchPage() {
  return (
    <Screen stagger={false}>
      <SearchView />
    </Screen>
  )
}
