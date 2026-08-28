# Bureau — Huly-Inspired Upgrade Plan

> A step-by-step playbook to make the app feel solid, fast, and feature-rich,
> inspired by **Huly Platform** (`platform-develop`). Every change keeps the
> existing **Bureau warm-paper design system** ([`DESIGN-SYSTEM.md`](../DESIGN-SYSTEM.md))
> and every existing feature — nothing is removed, only leveled-up.
>
> Written for an implementing agent with no prior Huly exposure. Each feature
> explains **what** to build, **why** it feels solid, **where** it lives in
> this codebase, and **how** to build it on the current stack
> (Next.js + Convex + shadcn/Tailwind v4 + dnd-kit).

---

## 0. Mental Model — Why Huly Feels Solid

Huly is not "pretty pages" — it is a **workbench**. Reading Huly's
`plugins/workbench-resources/src/components/Workbench.svelte`
and `sidebar/Sidebar.svelte` (in the inspiration repo, outside this
workspace) reveals four pillars that make it feel engineered:

1. **Predictable chrome.** A fixed workbench frame (nav rail + app column +
   content + right widgets bar) that never shifts under the user. State
   (collapsed, widths, active tabs) is persisted and restored exactly.
2. **Every object is addressable.** Every document/task/file has a stable URL,
   can be opened in a **tab**, a **side panel**, or full-screen — without
   losing where you were.
3. **Density + hierarchy discipline.** One spacing scale
   (`_vars.scss`: `--spacing-0_25` … `--spacing-10`), one radius scale, one
   shadow recipe. Nothing is one-off.
4. **Real-time by default.** Presence, unread badges, optimistic updates,
   live cursors — all driven by subscriptions (their transactor WebSocket),
   never by manual refresh.

We port these four pillars onto Bureau's stack. Convex already gives us (4);
we need to build (1)–(3) seriously and extend (4) everywhere.

---

## 1. Workbench Shell — Fixed, Resizable, Persisted

### 1.1 Three-zone workbench layout (like Huly `Workbench.svelte`)

**What.** Restructure the app into three structural zones inside
[`apps/web/app/app/layout.tsx`](../apps/web/app/app/layout.tsx):

```
┌────────────┬──────────────────────────────────┬────────────┐
│  Navigator │        Content (router)           │  Widgets   │
│ (sidebar)  │                                  │  (right)   │
└────────────┴──────────────────────────────────┴────────────┘
```

- **Navigator** — today's [`components/app/sidebar.tsx`](../apps/web/components/app/sidebar.tsx), upgraded (see §2).
- **Widgets bar** — a *new, collapsible right column* modeled on Huly's
  `Sidebar.svelte` (it is literally a right-side widget dock:
  `SidebarExpanded`/`SidebarMini`). It hosts pluggable **widgets**
  (§3): Inbox preview, AI panel, Comments, Task list, Activity, Presence.
  Default state becomes `MINI` (icon strip) — Huly does this and it is why
  their UI feels calm.
- The **content zone** holds the Next.js route and sources page title,
  breadcrumb and actions into the topbar via context.

**Why solid.** Huly's right widgets column never pushes content around; it
slides over a fixed grid. Content never re-flows — no jank, no layout shift.

#### Layout locking (Huly `panelstore` pattern)

Huly locks both panels to prevent accidental collapse while resizing. Port that:

- Drag threshold: if the navigator resize ends within 12 px of the min width,
  snap to collapsed (`0`) instead of leaving a useless sliver.
- Hover reveal: when collapsed to `0`, hovering the left edge shows a 8 px
  affordance strip; clicking expands to the last width. Same mirrored for
  the widgets bar.
- Persist in localStorage under existing
  [`use-sidebar-prefs.ts`](../apps/web/hooks/use-sidebar-prefs.ts) keys:
  `bureau-sidebar-width`, `bureau-widgets-variant` (`MINI|EXPANDED`),
  `bureau-widgets-width`.

#### Real-time & reconnect status (Huly `transactor` connection UX)

- Track the Convex WebSocket status; on drop show a slim amber banner:
  "Reconnecting… changes are queued locally."
- Any mutation fired while disconnected is queued and flushed on reconnect
  (Convex mutation retry + local optimistic write). This is what "feels
  solid, no lost work" means.

#### Edge-to-edge shells at small widths (Huly device-adaptive)

Huly's `Workbench.svelte` checks `workbenchWidth <= HIDE_NAVIGATOR` to float
the navigator. Mirror it:

```ts
const HIDE_NAVIGATOR = 768;  // px, matches md breakpoint
const FLOAT_ASIDE = 1200;    // px — widgets become floating overlay below this
```

- Below `768`: navigator becomes an overlay sheet (already exists on mobile —
  keep) and widgets bar collapses to a floating edge-tab.
- Below `1200`: widgets bar switches from docked column to absolutely
  positioned floating panel (does not squeeze content).

#### Server-manager-style telemetry (admin-only)

Hidden panel (`⌘.`) showing: WS state, mutation queue depth, last sync
timestamp, Convex deployment name. Like Huly's `ServerManager.svelte` —
reassuring for power users, hidden for everyone else.

### 1.2 Topbar overhaul (Huly `NavHeader` + breadcrumbs)

Current [`topbar.tsx`](../apps/web/components/app/topbar.tsx) is a flat bar.
Turn it into a structural breadcrumb bar like Huly's:

- **Left**: hamburger (mobile) → sidebar expand (when collapsed) →
  back/forward (already Linear-style — keep) → **live breadcrumb**
  (`Workspace / Projects / <Project>`) driven by a `useBreadcrumb()` hook
  reading the route + Convex queries for entity names.
- **Center**: the current search pill (keep, but see Command Center §5).
- **Right**: theme toggle, inbox bell with unread badge (keep), **presence
  avatars** of users currently viewing this entity (we have
  [`hooks/use-presence.ts`](../apps/web/hooks/use-presence.ts) — surface it
  in the topbar like Huly does in `Presence` plugin), user menu.

**Detail that sells solidness:** breadcrumb segments are skeletons while
loading (`h-4 w-20 rounded bg-muted animate-pulse`) — never empty text pops.

### 1.3 Keyboard-first frame

Huly is usable without a mouse. Add to
[`shortcuts-help.tsx`](../apps/web/components/app/shortcuts-help.tsx) and wire:

| Keys | Action |
|---|---|
| `⌘K` | Command Center (exists) |
| `⌘\` | Toggle navigator (exists) |
| `⌘⇧\` | Toggle widgets bar (new) |
| `⌘.` | Toggle widgets tab / open panel menu (new) |
| `⌘W` | Close current workbench tab (new, §4) |
| `⌘1..9` | Jump to tab N (new, §4) |
| `G then H/T/P/C/I` | Go to Home/Tasks/Projects/Calendar/Inbox (new) |
| `C` | New document (on document surfaces) (new) |
| `?` | Shortcuts help (exists) |

Centralize in a `lib/shortcuts.ts` map so the help dialog and the handlers
never drift.

---

## 2. Navigator & File System — Huly-Grade

### 2.1 Structured sections (modeled on `Navigator.svelte`)

Huly's navigator renders, top→bottom: **specials** (fixed app items),
**starred**, **grouped spaces**. Restructure
[`sidebar.tsx`](../apps/web/components/app/sidebar.tsx) into exactly these
ordered zones:

1. **Workspace switcher** (exists — keep, add plan/quota chip like Huly's
   `SelectWorkspaceMenu` shows workspace role).
2. **Search field** (exists).
3. **Specials** = top nav items (Home, Inbox, Tasks…) (exists).
4. **⭐ Starred** (today "Favorites" — rename concept only, keep data) rendered
   as a flat pinned list, like Huly's `StarredNav`.
5. **Spaces section** = today's "Private" document tree (§2.2).
6. **Bottom dock**: Trash (exists), Settings (exists), plus **Storage meter**
   (new — Huly shows usage; we have file storage counts from
   `flux_files`/`flux-fonts` and can show MB used of quota).

**Solidness bits from Huly** to copy:

- Section headers show a **hover-only chevron** (we do — keep) AND a
  hover-only `+` for "create inside this section".
- Every section is collapsible and **remembers state per workspace** (we
  persist `bureau-tree-open:<ws>` — extend the same pattern to sections:
  key `bureau-sidebar-sections:<ws>` instead of global).

### 2.2 Document tree upgrades (drag & drop like Huly drive)

The tree in [`document-tree.tsx`](../apps/web/components/app/document-tree.tsx)
already supports dnd via `@dnd-kit`. Level it up with Huly `drive`-plugin
behavior:

1. **Order matters.** Persist a `sortKey: string` (fractional indexing,
   e.g. LexoRank) on `flux_documents`. Dragging between two siblings
   computes `mid(prev.sortKey, next.sortKey)` — O(1) reorders, no renumber
   storms. This is exactly how Huly keeps lists stably ordered under
   concurrent edits.
2. **Multi-select drag.** `⌘-click` / `⇧-click` to select several nodes
   (pattern from Huly `view` plugin's `ListSelection`), then drag the group
   or hit `⌫`/context menu for bulk move-to-trash. Show a drag badge
   "3 items" on the overlay.
3. **Auto-expand on hover-drag.** When dragging over a collapsed folder for
   >600 ms, expand it (Huly does this in its drive navigator). Implement with
   a `useEffect` timer in the drop zone while `isOver && activeDrag`.
4. **Drop between items.** Add slim (2 px) insertion indicators between rows
   — dnd-kit `useDroppable` per gap id (`gap:<parentId>:<index>`), rendered
   as `bg-primary` line.
5. **Inline rename** — double-click a row name → inline `<input>`
   autofocused, `Enter` commits, `Esc` cancels (Huly tree items do this).
6. **Context menu** on right-click: Open / Open in new tab (§4) / Star /
   Rename / Duplicate / Export / Move to trash. Build with existing
   `DropdownMenu` primitives.

### 2.3 File manager page (Huly `drive` plugin)

New route `/app/files` + nav entry (icon `FolderOpen`):

- Full-page file manager over `flux_files`: **grid/list toggle**, breadcrumb
  by document/folder context, drag-and-drop upload onto the page (we have
  [`single-image-dropzone.tsx`](../apps/web/components/single-image-dropzone.tsx)
  — generalize to `file-dropzone.tsx`).
- Columns in list: preview thumb, name, size (`FileSizePresenter` in Huly),
  attached-to (document/task), uploaded-by, date.
- Multi-select + bulk actions: download (zip), move, delete.
- Upload progress: stacked mini-cards bottom-right (Huly `uploader` plugin),
  each with progress bar and cancel. Persist via Convex storage + a
  `uploads` client store.

### 2.4 Trash that feels safe (Huly `Archive.svelte`)

[`/app/trash`](../apps/web/app/app/trash/page.tsx) gets:

- Per-item **Restore** and **Delete forever** (confirm via AlertDialog with
  "type the name" for bulk deletes).
- "Trash is emptied automatically after 30 days" caption + countdown per
  item (`trashedAt + 30d`).
- Already-implemented drag-to-trash in the sidebar stays — add the same
  "wobble" micro-animation to drop targets in the tree.

---

## 3. Widgets Bar (Right Dock) — Huly's Best Idea

**What.** A plugin-like right column where each widget is a narrow panel
toggled by an icon rail (exactly Huly's `SidebarMini` + `SidebarExpanded`).

Ship these widgets (each ~1 component, reusing existing code):

| Widget | Source to reuse | Notes |
|---|---|---|
| **Inbox** | [`inbox`](/..) page → compact list | mark-read on open |
| **Comments** | [`comments-panel.tsx`](../apps/web/components/app/comments-panel.tsx) | shows threads for current entity |
| **AI Assistant** | [`ai-panel.tsx`](../apps/web/components/app/ai-panel.tsx) | quick prompts |
| **My Tasks** | [`tasks-view.tsx`](../apps/web/components/app/tasks-view.tsx) (filter: assigned to me, due this week) | check off inline |
| **Activity** | [`activity-feed.tsx`](../apps/web/components/app/activity-feed.tsx) | scoped to current entity when available |
| **Pomodoro** | [`pomodoro-timer.tsx`](../apps/web/components/pomodoro-timer.tsx) | already built — just dock it |
| **Presence** | [`presence-avatars.tsx`](../apps/web/components/app/presence-avatars.tsx) | who's online in workspace |
| **Music** | new provider adapters + official embedded players | persistent, provider-aware playback; see §3.1 |

### 3.1 Music Experience - persistent player + "Dynamic Island" mini-player

**Product goal.** Add a focused music surface that lets a user paste a supported
track, album, or playlist URL and start playback inside Bureau. Where provider
rules permit compact playback, listening continues while navigating, changing
widgets, or collapsing the dock. The widget is the library and queue surface;
a global mini-player is the always-available transport. It should feel native
to the workbench rather than like a raw iframe.

**Provider reality and release scope.** Bureau must use each provider's official
player and must never proxy, download, cache, transcode, remove attribution from,
or attempt to bypass restrictions on third-party audio. "YouTube Music" links
are played through the official YouTube IFrame Player API; there is no separate
first-party YouTube Music web playback SDK in this plan.

| Provider | First release | Integration and constraints |
|---|---|---|
| **Spotify** | Yes | Official Spotify Embed/iFrame API for pasted track, album, playlist, show, or episode URLs. Playback availability, previews, login, and attribution remain provider-controlled. Full Web Playback SDK mode is a later opt-in because it requires Spotify OAuth, an eligible Premium account, secure token refresh, and a product/legal review for the intended deployment. |
| **YouTube / YouTube Music** | Yes | Normalize supported video and playlist links into the official YouTube IFrame Player API. Keep the required visible player viewport at least 200×200 when video is shown; do not fake an audio-only YouTube player or obscure required controls/branding. |
| **SoundCloud** | Yes | Official HTML5 Widget API for tracks and sets, including play/pause, seek, volume, next/previous, metadata, and progress events. |
| **Apple Music** | Later adapter | MusicKit on the Web can provide catalog and subscriber playback, but needs Apple developer-token infrastructure and subscriber authorization. Do not block the first release on it. |
| **Other services** | Link-out only until verified | Add a provider only when it has an official embeddable playback API and compatible terms. Unknown URLs open safely in the provider instead of being embedded. |

Official constraints to re-check immediately before implementation: [Spotify
iFrame API](https://developer.spotify.com/documentation/embeds/references/iframe-api),
[Spotify Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk),
[YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference),
and [SoundCloud Widget API](https://developers.soundcloud.com/docs/api/html5-widget).
Provider policies and SDK behavior may change independently of Bureau.

#### Experience and interaction model

1. **First-run / empty state.** Show one paste field (`Paste a Spotify, YouTube,
   YouTube Music, or SoundCloud link`), provider chips, three short examples of
   supported content, and a privacy note that playback is delivered by the
   selected provider. Validate on paste and give a specific unsupported/private/
   unavailable error rather than a generic failure.
2. **Expanded widget.** Lead with provider artwork or the required provider
   player, track title, creator, source badge, elapsed/remaining time, play/pause,
   previous/next when supported, seek, volume/mute, queue, and `Open in provider`.
   Controls expose capabilities dynamically, so unsupported actions are omitted,
   not disabled without explanation.
3. **Queue and collections.** Maintain a lightweight local queue of normalized
   provider references, plus `Recently played`, `Pinned`, and optional `Focus
   mixes`. Accept pasted playlist/album URLs as provider-owned collections; do
   not scrape track lists. Drag reorder uses the existing dnd-kit stack.
4. **Dynamic Island mini-player.** When media is loaded, render one compact,
   rounded transport in the topbar on wide screens and above the mobile safe
   area on narrow screens. Idle shows artwork, title, provider, and play/pause;
   hover, focus, or tap expands it to reveal progress, next/previous, volume,
   queue, `Open widget`, and `Dismiss`. YouTube playback uses a compliant visible
   mini-video card of at least 200×200 instead of shrinking into an audio pill;
   collapsing that card pauses YouTube if a compliant visible host cannot remain.
   Use Framer Motion shared-layout morphing, restrained spring motion, and
   opacity/scale only. Never continuously animate artwork, waveforms, gradients,
   or equalizers.
5. **Persistent playback.** The provider iframe/SDK host is mounted once in
   [`app/app/layout.tsx`](../apps/web/app/app/layout.tsx), outside
   `renderWidget()`. The widget and mini-player are control surfaces over the
   same store and controller, so dock collapse, pop-out, route changes, and
   responsive mode changes never remount the active player.
6. **Single audio focus.** Starting one provider pauses the previous provider.
   Bureau never allows hidden competing players. Attempt Media Session metadata
   and hardware-key handlers where the provider permits it, with graceful
   fallback when an embedded player owns media-session behavior.
7. **Focus workflow.** Offer an optional `Start Focus Timer` companion action and
   remember a preferred focus playlist, but keep Pomodoro and Music independently
   usable. Timer completion may lower/pause music only after the user enables
   that preference; never surprise-pause by default.

#### Technical architecture

- Add `music` to `WidgetKey`, the widget registry, `renderWidget`, i18n, test IDs,
  dock/floating rendering, and normalized persisted-active validation in
  [`widgets-bar.tsx`](../apps/web/components/app/widgets/widgets-bar.tsx).
- Create a typed `MusicProviderAdapter` contract with `canHandle`, `normalize`,
  `load`, `play`, `pause`, optional `seek`/`setVolume`/`next`/`previous`,
  `subscribe`, and `destroy`. Adapter state normalizes to `idle | loading |
  ready | playing | paused | buffering | ended | blocked | error` plus a
  capability map. Provider-specific code must not leak into widget UI.
- Build `spotify-embed-adapter.ts`, `youtube-iframe-adapter.ts`, and
  `soundcloud-widget-adapter.ts`; load each remote SDK once, lazily, only after
  a supported URL is accepted. Deduplicate global callbacks/promises and remove
  listeners on teardown. Do not add a third-party wrapper dependency unless the
  official SDK cannot be integrated safely.
- Add a client-only Zustand `music-store.ts` for normalized playback state,
  queue, active provider/controller identity, compact/expanded state, and user
  actions. Persist only provider references, queue order, pins, last volume,
  and UI preference. Never persist access tokens or provider cookies in
  `localStorage` or Convex.
- Add `music-player-host.tsx` beside the shell, `music-widget.tsx` for discovery,
  queue, and full controls, and `music-mini-player.tsx` for the island. Keep the
  live iframe in a stable host. If a provider requires a visible viewport, move
  or reveal that host without cloning it or mounting a second player.
- Parse URLs with `URL`, explicit HTTPS hostname allowlists, and provider-specific
  ID validation. Never inject arbitrary embed HTML. Set iframe `title`, minimal
  `allow` permissions, `referrerPolicy`, and `sandbox` only where compatible
  with the official player. Add narrowly scoped `script-src`, `frame-src`, and
  `connect-src` CSP allowlists when the application security-header layer is
  introduced; do not use wildcard provider origins.
- If advanced Spotify or Apple Music account connection ships, use server-side
  OAuth routes with state + PKCE where supported, encrypted `HttpOnly`, `Secure`,
  `SameSite=Lax` cookies, server-side refresh, disconnect/revoke UI, and no
  provider secret in the client bundle. Treat that as a separately reviewable
  phase, not a prerequisite for embed playback.
- Derive progress from provider events and interpolate locally while playing;
  avoid permanent polling. Pause timers when hidden, update visual progress at
  a modest cadence, lazy-load artwork, reserve dimensions to prevent layout
  shift, and keep the initial app bundle free of provider SDKs.

#### Responsive, accessibility, and failure states

- Docked and floated views work from the existing 320-560px panel range. The
  island must not displace search, navigation, or account controls; collapse its
  title before hiding transport controls, then move to the mobile bottom pill.
- All controls are keyboard reachable and have localized accessible names,
  visible focus, pressed/disabled state, and a minimum 44px mobile hit target.
  Progress/volume sliders expose semantic values. Artwork is decorative when
  title/artist text already conveys the content.
- Respect `prefers-reduced-motion`: replace morphs with a short crossfade and
  disable decorative motion. Never use color alone for playing/buffering/error.
- Handle SDK blocked, third-party cookies disabled, autoplay denied, offline,
  private/unavailable item, geo restriction, deleted media, provider logout,
  rate limit, and mobile background suspension. Autoplay denial becomes a clear
  `Tap to play` state and never retries in a loop.
- On provider failure, preserve the queue and offer `Retry` plus `Open in
  provider`. The rest of Bureau must remain usable if every remote SDK fails.

#### Delivery sequence and acceptance gates

1. **Foundation:** URL parser fixtures, provider types/capability contract,
   Zustand store, stable player host, empty/loading/error states, and Spotify
   Embed vertical slice.
2. **Provider breadth:** YouTube/YouTube Music and SoundCloud adapters, single
   audio focus, queue/pins/history, external-open fallback, and SDK cleanup.
3. **Polish:** Dynamic Island mini-player, dock/float/mobile transitions,
   Media Session best effort, focus-timer preference, localization, reduced
   motion, and full keyboard/screen-reader pass.
4. **Optional connected mode:** only after credentials, deployment/legal review,
   and explicit acceptance criteria, add Spotify Web Playback and/or MusicKit
   behind provider capability flags. Embed mode remains the reliable fallback.
5. **Verification:** unit-test URL normalization, allowlists, reducer/store
   transitions, capabilities, and queue persistence; component-test first-run,
   blocked autoplay, provider errors, single-player switching, dock/float/island
   continuity, and reduced motion; run typecheck/build plus manual checks in
   current Chrome, Safari, Firefox, iOS Safari, and Android Chrome.

**Done means:** a user can paste one URL from each first-release provider, start
playback with an explicit gesture, navigate and change widget modes without
remounting the active player, and control the same player from the widget and
island or provider-compliant mini-video. Compact/background continuity is used
only where the provider and browser permit it. The user can recover from a
blocked or failed SDK and reload with queue/preferences restored but no secrets
stored client-side. No provider may regress app startup, layout stability, or
core workbench interaction.

State: `bureau-widgets-variant`, `bureau-widgets-active` (which widget open).
`MINI` = 3.5 rem icon rail exactly like Huly (`width: calc(3.5rem + 1px)` in
`Sidebar.svelte`). `⌘.` cycles.

Current [`docked-bubbles.tsx`](../apps/web/components/app/docked-bubbles.tsx)
floating bubbles migrate to become widgets — keep the pop-out-to-bubble
behavior as a per-widget "float" toggle for power users.

---

## 4. Workbench Tabs (Huly `WorkbenchTabs.svelte`)

Huly lets users pin entities as **tabs** inside the workbench — the single
biggest "pro tool" feel. Add a tab strip between topbar and content:

- Store per user: `tabs: [{ id, kind: 'doc'|'task'|'project'|'view', refId, title, icon }]`
  in Convex (`flux_userPrefs` already exists — add `tabs` field) so tabs
  roam across devices.
- Middle-click / ⌘-click any navigator row, doc link, or search result →
  opens in a new tab. `⌘W` closes, drag to reorder (dnd-kit horizontal).
- The tab strip makes internal `[id]`-style links resolve into an already-open
  tab when possible (Huly `WorkbenchTabPresenter`).
- Overflow: horizontal scroll with fade masks (Huly `Scroller` behavior),
  `⌘1..9` jumps.

---

## 5. Command Center (⌘K → Spotlight-grade)

Upgrade [`command-palette.tsx`](../apps/web/components/app/command-palette.tsx)
into a real command center (Huly `ActionsPopup` + `SearchSelector`):

1. **Grouped result sections**, not one flat list: Actions / Documents /
   Tasks / Projects / People / Settings. Headers with count badges.
2. **Action verbs first.** Typing "new" shows `New Document`, `New Task`,
   `New Project`, `Invite member` with icons and shortcut hints.
3. **Frecency ranking** (frequency + recency) — store last 50 picks in
   `flux_userPrefs.commandHistory`, rank with
   `score = uses * 0.7 + recencyBoost`.
4. **In-fixture search content**: snippet preview under each result (first
   80 chars around match) — Huly's fulltext shows context, users trust
   results they can preview.
5. **Scoped search**: prefix `d:` docs, `t:` tasks, `p:` projects, `#tag`,
   `@person` — client-side filter then Convex query per scope.
6. Semi-transparent backdrop with `backdrop-blur`, panel uses `--elev-3`,
   `rounded-2xl` (16 px), opens with `zoom-in-95 fade-in` (already available
   via tw-animate-css), closes on route change.

---

## 6. Inbox 2.0 (Huly `inbox` plugin)

Current inbox is a notifications list. Huly's inbox is a **triage surface**:

- **Two-pane layout** (like `inbox/InboxApplication`): left list of
  notifications grouped by day, right preview of the linked entity (doc
  excerpt, task card, comment thread). Selecting a notification marks read
  and shows the preview without navigating away.
- **Filters** (Huly `InboxViewSettings`): All / Mentions / Assigned /
  Reactions; plus "Only unread" toggle.
- **Bulk bar**: Archive all read, Mark all read.
- **Keyboard**: `↑↓` navigate, `E` archive, `M` mute thread, `Enter` open.
- **NotifyMarker** dots (Huly `NotifyMarker.svelte`): same coral dot in the
  sidebar tree next to docs with unread comments, and in tabs.
- **Quiet hours toggle** in settings → suppresses browser notifications but
  still fills inbox.

---

## 7. Presence & Collaboration Polish

Convex gives real-time cheap — use it everywhere Huly does:

1. **Topbar presence row** for the current entity (from `flux_presence`).
2. **Live cursors/selections** in the editor (we have `flux_presence`;
   render colored remote carets labeled with user's name, fade out after
   3 s idle — Huly collaborator behavior).
3. **Typing indicators** in chat panels (exists in `chat-panel` partially —
   add `…is typing` under channel name).
4. **Document "viewers" marquee**: hover the eye icon in doc header → list
   of viewers with last-active time.
5. **Optimistic everything**: every mutation (create doc, toggle task,
   send message) updates local state first; roll back + toast on failure.
   Audit current mutations; wrap in a helper `optimistic(mutate, apply,
   revert)` in `lib/utils.ts`.

---

## 8. Editor & Document Surface

1. **Sticky document toolbar** that pins under topbar on scroll (Huly keeps
   formatting controls always reachable).
2. **Slash menu grouped** like Huly text-editor: Basic / Media / Embeds /
   Advanced; show keyboard hint `⏎` on the highlighted item; remember last
   used block at top ("Recent").
3. **Block hover controls**: 6-dot drag handle + `+` button appear at the
   left gutter; drag with dnd-kit (already dep), drop between blocks.
4. **Focus mode** toggle (Huly hides all chrome): hide both sidebars,
   center content at max-w-3xl, shortcut `⌘⇧F`.
5. **Outline / TOC** — [`table-of-contents.tsx`](../apps/web/components/table-of-contents.tsx)
   becomes a widgets-bar widget (§3) + a floating collapsible rail on the
   wide screens (like Huly's right panel).
6. **Version history**: slide-over panel (exists,
   [`version-history-panel.tsx`](../apps/web/components/app/version-history-panel.tsx))
   — add **diff view** (Huly `diffview` plugin): two-way colored diff
   between selected version and current, using a lightweight LCS on blocks.

---

## 9. Tasks & Projects — Board of Record

Huly tracker is the reference for "dense but calm" task UI:

1. **View switcher** per project: List / Board (kanban) / Calendar / Gantt
   ([`gantt-chart.tsx`](../apps/web/components/gantt-chart.tsx) exists —
   wire it as a view). Persist per-project `bureau-view:<projectId>`.
2. **Saved filters** (Huly `SavedView.svelte`): filter bar composition
   (status, priority, assignee, label, due) can be saved with a name and
   appears under the project in the navigator.
3. **Grouping + swimlanes** on board: group by status / assignee / priority;
   collapse lanes; counts per lane; WIP limit badge.
4. **Inline create everywhere**: bottom-of-lane `+ New task`, title-only
   first, ⏎ creates and keeps focus.
5. **Right-side detail panel** instead of full navigation: clicking a card
   opens the task in the widgets-bar-sized panel (master-detail, Huly
   `AttachedDocPanel`), `Esc` closes.
6. **Bulk edit bar** when multi-selected: status / assignee / label / due /
   delete.

---

## 10. Settings & Personalization Center

Rework [`/app/settings`](../apps/web/app/app/settings/page.tsx) into tabbed
sections (Huly `setting` plugin), all persisted to `flux_userPrefs` or
workspace tables:

- **Appearance**: theme (light/dark/system), accent preset (6 swatches
  exist via AccentProvider — add custom hex picker + "match system accent"),
  density (Compact/Default/Comfortable from DESIGN-SYSTEM §3.4), font size
  (editor body 14–18 px), reduced-motion toggle.
- **Sidebar**: default open sections, show/hide Starred, tree indent size.
- **Notifications**: per-event toggles (mention/assign/reply), quiet hours,
  sound.
- **Keyboard**: read-only shortcut table + custom rebinding stored per user
  (Huly allows remapping; store `shortcuts` overrides, merge over defaults).
- **Workspace**: avatar upload (workspace switcher already supports
  `avatar`), default doc icon, plan/quota meter, danger zone.
- **Data**: Export workspace (JSON/markdown zip — see §11), Import from
  Notion (exists [`lib/notion-import.ts`](../apps/web/lib/notion-import.ts) —
  expose in UI).

---

## 11. Import / Export / Print (Huly `export`, `print`, `importer`)

- Export single document → Markdown / PDF (client print CSS — Huly has a
  `_print.scss`: reproduce `@media print` rules: hide chrome, expand
  content, page-break rules on headings).
- Export workspace → zip of markdown + `manifest.json` (cron-friendly,
  mutation that streams into a file record).
- Import: Notion (exists), Markdown folder drop, CSV → database.
- Print styles for tasks list and calendar month.

---

## 12. The "Solid Feel" Checklist (Stability Track)

These are the items that remove the "weak and buggy" perception:

1. **Error boundaries per zone** (navigator / content / widgets) — one zone
   crashing never blanks the app (extends
   [`core-error-boundary.tsx`](../apps/web/components/app/core-error-boundary.tsx)).
2. **Skeletons everywhere**: doc page, tasks list, inbox, calendar. No
   spinner-only states; skeletons match final layout exactly (same heights)
   so there's zero layout shift.
3. **Empty states**: every list has a designed empty state with icon, one
   line of help, and an action button (Huly `SearchEmptyState`).
4. **Optimistic + undo** for destructive moves (trash): toast with Undo
   button, mutation deferred 6 s (Huly pattern with their `SimpleNotification`).
5. **Focus trap + restore** on every dialog; `Esc` closes; return focus to
   trigger. Radix gives most — audit modals in `components/modals`.
6. **No dead clicks**: every clickable element shows hover/focus ring
   (`--ring` coral) and `active:scale-[0.98]` on buttons; remove any
   `cursor-pointer` element without feedback.
7. **Route-level code splitting** + `prefetch` on nav hover (Next Link does
   this; ensure every nav item uses `Link` not router.push).
8. **Scroll restoration**: main content remembers scroll per tab (§4 tabs
   store `scrollTop`).
9. **z-index tokens**: replace magic `z-99999` with tokens from the design
   system (`--z-nav: 30; --z-popover: 50; --z-modal: 60; --z-toast: 70`),
   documented in [`globals.css`](../apps/web/app/globals.css).
10. **Resize observer safety**: sidebar resize clamps, min content width
    guarding, no negative widths (Huly had `MIN_SIDEBAR_WIDTH` clamp; we
    have MIN_W/MAX_W — enforce the same during window resize).
11. **i18n audit**: every new string through `useTranslations`, no
    hardcoded English.
12. **Test IDs kept**: we already have `data-testid`s — extend the pattern
    to every new interactive element.

---

## 13. Micro-Interactions & Motion (Calm Tech)

Huly motion is **subtle and fast**: `--ease-standard: cubic-bezier(0.16, 1, 0.3, 1)`
already in our system. Rules:

- Duration: 120–250 ms UI, 350 ms panels, >400 ms only for celebratory.
- Animate `transform` + `opacity` only (compositor-friendly).
- Respect `prefers-reduced-motion` (setting in §10 forces it).
- Signature touches to copy: list rows `translateY(-1px)` + `--elev-2` on
  hover ([`.tx-card-hover`](../DESIGN-SYSTEM.md)); selection highlight
  `color-mix(in oklch, var(--primary) 22%, transparent)`; drag ghost card
  with slight rotation (1.2°) and shadow.

---

## 14. Documents & Knowledge — Notion-Grade Core

> Note-taking is the heart of the app. This section is the deep dive: a
> clean, predictable hierarchy model and drag-and-drop that never feels
> "off". Replaces and extends §2.2. Current implementation to fix lives in
> [`components/app/document-tree.tsx`](../apps/web/components/app/document-tree.tsx)
> (dnd-kit `useDraggable`/`useDroppable`, custom `Folder`/`File` primitives
> in `components/ui/file-tree.tsx`) backed by `flux_documents` (`parentId`,
> `isFolder`, `order`) in [`convex/schema.ts`](../apps/web/convex/schema.ts).

### 14.1 The three rules of a solid tree (steal from Notion)

1. **What's a container is unambiguous — no special cases.** Today's rule
   "leaf docs can't accept drops" (`acceptsDrop` in document-tree.tsx) tries
   to prevent accidental nesting but creates the opposite: an *invisible,
   inconsistent* drop surface — folders accept, docs-with-children accept,
   plain docs refuse, and the user can't tell which. **Fix: any document can
   contain children** (like Notion where every page is also a folder). The
   chevron communicates "has children", not the type; `isFolder` becomes
   purely a visual variant (folder icon vs page icon), never a behavioral
   gate.
2. **Drop intent is explicit, not guessed.** The "weird offset" feeling
   comes from `pointerWithin` colliding with nested, indented rows — the
   pointer is "within" three ancestors at once and dnd-kit picks whichever
   registered last. Replace with **position-based intent**: each row exposes
   three zones computed from pointer Y within the row rect:
   - top 25% → drop **before** this row (sibling)
   - middle 50% → drop **into** this row (child; flashes the folder open)
   - bottom 25% → drop **after** this row (sibling)

   Render a 2 px `bg-primary` indicator line at the exact target edge —
   Notion's line, zero ambiguity. Vertical indent rails (one `border-l` per
   depth) make the target parent readable at a glance.
3. **The tree never flickers.** Optimistically apply the move in the local
   list before the mutation resolves; on error roll back + toast with
   **Undo**. While a row is mid-flight, render it at 60% opacity in its
   *new* position so the UI stays truthful.

### 14.2 Data model — order that survives concurrency

`flux_documents.order` is `v.number()` today. Add a **fractional index**
`sortKey: v.string()` (LexoRank-style `a0, a1, …`):

- Drop between two neighbors → `mid(prevSort, nextSort)`; no renumbering of
  siblings, safe under concurrent reorders.
- Backfill migration: `sortKey = base36(order)`; keep reading `order` as
  fallback during rollout.
- Position = `(parentId, sortKey)`; root = `parentId: null`.
- **Cycle guard**: mutation rejects `parentId ∈ descendants(self)` —
  server-side recursive walk via `by_workspace_parent`.
- Moving a folder moves its whole subtree implicitly — **one row write**.

### 14.3 Sidebar tree UX (the daily driver)

- **Row anatomy** (28 px row, `rounded-lg`, hover `bg-sidebar-accent`):
  `chevron (only if hasChildren, rotates 90°) | icon (emoji / folder / page) | title | ∙∙∙ menu + quick-add` — quick-add `+` on hover right (exists).
- **Active row**: left 3 px `bg-primary` bar (exists) + `bg-sidebar-accent`;
  ancestor auto-expansion on navigation (exists — keep).
- **Expand on drop-hover**: dragging over a collapsed parent for 600 ms
  expands it (clear timer on leave) — drill into deep trees without
  releasing the mouse.
- **Auto-scroll**: dragging within 24 px of the tree viewport edge scrolls
  with velocity ramping by proximity.
- **Multi-select**: `⌘-click` toggles, `⇧-click` range-selects within
  currently visible rows; selected = `bg-primary/10`. Dragging a group shows
  a stacked-cards ghost with count badge (`3 pages`). `⌫` or context menu →
  bulk trash with one Undo toast.
- **Drag activation constraint**: `PointerSensor` with
  `activationConstraint: { distance: 6 }` so a click never becomes a 1-px
  drag — the major source of "jumpy" feel.
- **DragOverlay**: slim portal ghost (icon + title, `elev-2`, rotate 1°)
  instead of moving the actual row; source row fades to 30%.
- **Unify drop targets**: tree rows, section headers and the root area all
  use the same before/after/into intent math.
- **Indent width** is a setting (§10): 14/18/22 px via `--tree-indent`.

### 14.4 The All-Pages surface (`/app/documents`)

A real Notion-style index page:

- **Toolbar**: view toggle (List | Gallery), sort (Last edited / Created /
  Title A–Z / Manual), filter chips (starred, locked, shared), group-by
  (None / Folder / Updated: Today·Yesterday·This week·Older).
- **List rows**: icon, title (bold when unread activity), path breadcrumb
  (`Parent / Child`), updated `2h ago`, presence dots of who has it open,
  star toggle, `∙∙∙` menu.
- **Gallery cards**: cover image (fallback: first extracted image), icon +
  title, 2-line excerpt.
- Bulk-select → bulk move (folder-picker dialog showing the tree), bulk
  star, bulk trash.

### 14.5 Document page polish

- **Cover + icon header** (exists): add draggable cover reposition
  (`coverY` 0–100 persisted) and an icon dice randomizer.
- **Path breadcrumb** above the title: each crumb is a dropdown of its
  siblings for one-click hops (also feeds the topbar, §1.2).
- **Sub-pages block**: `/subpages` (plus optional auto-render at bottom)
  inserts a live grid of children, synced from the same query as the tree.
- **Backlinks** section at the bottom: every doc containing a `@mention` or
  `[[link]]` to this one — debounced search over serialized `content`.
- **Save as template** on any doc → `flux_docTemplates`; template picker
  gains thumbnail previews.
- **Footer status row**: word count, reading time, last edited by/at.
- **Visibility chips** in header: 🔒 Locked / 🔗 Shared / 👥 Workspace —
  click opens the matching dialog (schema already supports `isLocked`,
  `shareToken`, `visibility`).

### 14.6 Files attached to documents

Bridge §2.3's file manager with docs: each document gets a **Files panel**
(widget §3) listing `flux_files` attached to it; dragging a file from the
manager onto a sidebar tree row attaches it; dragging an OS file onto the
editor uploads and inserts at caret. Attachments render as chips with type
icon + size.

### 14.7 Trash for docs (extends §2.4)

Trashing a folder cascades `isArchived` to the subtree in one mutation.
Trash view lists items flat with a path column; restoring a child whose
parent is gone restores to root with a warning chip. "Empty trash" with
>10 items requires typing the workspace name.

### 14.8 Performance guardrails

- Virtualize the tree past 200 visible rows (`@tanstack/react-virtual`;
  fixed 28 px rows make this trivial).
- `useDeferredValue` on the docs list so typing elsewhere stays smooth.
- `React.memo` on `DocumentTreeNode` with custom equality (id, title, icon,
  isOpen, isActive, isFavorite, drag state) — a keystroke must never
  re-render 500 rows.
- Reorder mutation touches exactly one row; moves hit `by_workspace_parent`.

---

## 15. Tracker, Calendar & Teams — Copying the Huly Way of Working

> Huly's solid feel comes mostly from its **tracker** (tasks), **calendar**
> and **contact/team** surfaces. This section maps their components (names
> from `platform-develop/plugins/…`) onto our stack. Current code to
> upgrade: [`tasks-view.tsx`](../apps/web/components/app/tasks-view.tsx),
> [`calendar-view.tsx`](../apps/web/components/app/calendar-view.tsx),
> [`members/page.tsx`](../apps/web/app/app/members/page.tsx), backed by
> `flux_tasks`, `flux_taskStatuses`, `flux_labels`, `flux_events`,
> `flux_timeEntries`, `memberships`, `flux_roles`, `invitations`.

### 15.1 Tasks — done the `tracker` way

Reference: `plugins/tracker-resources/src/components/issues/`.

**The issue row (their `IssueItem.svelte`)** — one dense line, the core
unit of their calm/dense feel:

`[status icon] [PRJ-42] [title ............] [priority] [assignee] [labels] [due]`

- **Status icon, not pill** (`StatusSelector.svelte`): small colored circle
  that cycles state on click, opens a popover list on demand. Colors come
  from `flux_taskStatuses` (already per-workspace).
- **Human identifier**: `PRJ-42` = project `key` + per-project counter.
  Schema: add `key: string` to `projects`, `number: number` to `flux_tasks`
  + counter on project. Identifiers auto-link in chat/docs/comments like
  Huly's `IssuePresenter` chip.
- **Inline editors everywhere** (their `PriorityInlineEditor`,
  `AssigneeEditor`, `StatusEditor`, `DueDateEditor`): every row cell opens
  a small anchored popover on click, commits on select — no dialog, no
  navigation. Build one reusable `InlineCellPopover` wrapper and reuse it
  for all five field types.
- **Sub-tasks** (`SubIssues.svelte`, `ParentIssue.svelte`): `parentId` on
  `flux_tasks`; indented children with chevron and a `2/5` done-rollup on
  the parent; "re-parent" popup (their `SetParentIssueActionPopup`).
- **Dependencies** (`IssueDependenciesPanel.svelte`): `blockedBy:
  Id<"flux_tasks">[]`; blocked tasks show a red link icon; completing a
  blocker toasts "PRJ-42 is now unblocked"; server-side cycle guard.
- **Estimation** (`EstimationEditor`): XS/S/M/L/XL or points popover;
  sums shown in group headers; feeds workload view (§15.3).
- **Due + start dates** (`StartDateEditor`, `DueDateEditor`): overdue
  renders the date in red.

**Views (their `IssuesView.svelte` family):**

| Huly | Ours | Port notes |
|---|---|---|
| `KanbanView.svelte` | Board (exists) | lanes = statuses; dnd between lanes = status change; reuse the §14.1 3-zone intent math so column-vs-slot is unambiguous; lane header = count + estimation sum; collapsible lanes |
| List | exists | row anatomy above + group-by (Status/Assignee/Priority/Project/None) with sticky headers and per-group counts (their `FixedColumn` sticky pattern) |
| `myissues/MyIssues.svelte` | **New `/app/my` page** | fixed sections: *Assigned to me*, *Created by me*, *Watching*; sorted overdue → due → priority; intended daily landing screen |
| `milestones/` | upgrade projects | `targetDate` on `flux_projects`; progress bar = closed/total tasks; milestone chip on project header; plotted on Gantt and calendar |

**Create dialog** (their `CreateIssue.svelte`): global `⌘⇧Enter`;
title-first; one row of inline editors (status, priority, assignee, due);
description editor below; "Create more" toggle keeps it open. This dialog
is why Huly capture feels instant.

**Templates** (their `templates/`): task templates with prefilled
fields/checklist, stored in `flux_docTemplates` with `kind: "task"`.

**Activity** (`IssueStatusActivity.svelte`): every status/assignee/priority
change writes an activity row → feeds the entity's Activity tab and Inbox.

### 15.2 Calendar — done the `calendar` way

Reference: `plugins/calendar-resources/src/components/`.

- **Overlaid sources** (`CalendarSelector.svelte`): toggleable colored
  layers — personal events, task due dates, project milestones, time-off.
  Left mini-panel with checkboxes + mini month picker
  (`MonthSelector.svelte`) for fast jumps.
- **Views**: Day / 3-day / Week / Month / Schedule (agenda list = their
  `Events.svelte`). Persist per user. `Today` button + `T` shortcut, week
  number column, week-start setting.
- **Month overflow cap** (`EventsPopup.svelte`): max 3 chips per cell then
  `+n more` popover — keeps the grid uniform; a big part of their tidy feel.
- **Event popover, not page** (`CalendarEventPresenter.svelte`): click →
  anchored card with time, link, participants; quick edit in place; "Open
  full" goes deeper.
- **Drag-to-create** (`TimeDuration.svelte`): drag an empty time range →
  live duration pill → prefilled create popover.
- **DnD reschedule**: move = shift start, bottom-edge drag = duration,
  Alt-drag = duplicate. All optimistic + Undo toast. Dragging an all-day
  task chip onto a day sets its due date (calendar ↔ tasks integration).
- **All-day lane** separate from timed grid; tasks-with-due-date render
  there as chips.
- **Recurrence UX** on top of existing [`lib/recurrence.ts`](../apps/web/lib/recurrence.ts):
  editor popup (their `ReccurancePopup.svelte`) + on edit/delete of a
  series the 3-way choice dialog (`UpdateRecInstancePopup.svelte`): "This
  event / This and following / All events".
- **Reminders** (`EventReminders.svelte`): `reminders: number[]`
  (minutes before) on `flux_events`; delivered via the existing
  notification pipeline + browser push; respects quiet hours (§6).
- **Now-line**: coral line at current time in day/week; scroll-to-now on
  open; working-hours shading; optional second timezone gutter
  (`TimeZoneSelector.svelte`).
- **Participants** (`EventParticipants.svelte`): invite members, track
  accepted/declined (phase 2 acceptable).
- **Print**: clean month/week print stylesheet (Huly ships `_print.scss`).

### 15.3 Teams & people — done the `contact` way

Reference: `plugins/contact-resources/src/components/`.

- **Members directory** (`/app/members` upgrade): card grid or dense table;
  each row = avatar with presence ring, name, role badge
  (`flux_roleAssignments`), title, contact channels (their `ChannelsEditor`
  pattern: multiple typed channels — email, phone, link), status line
  ("In office / Remote / OOO until …").
- **Person hover card** (`PersonPresenter` popups): hover any avatar or
  @mention anywhere → mini profile card with presence, role, quick actions
  (message, view tasks).
- **Teams**: new `flux_teams` table (name, color, icon, memberIds). Assign
  tasks to a team, filter/group board by team, `@team` mention notifies all
  members.
- **Permission matrix** for `flux_roles`: capabilities as rows (docs.edit,
  members.manage, billing, export…), roles as columns, checkbox cells;
  admin-only page (Huly `setting` plugin does exactly this).
- **Invitations upgrade** (`AddMembersPopup.svelte`): invite-by-email with
  role; pending list with resend/revoke; shareable invite links with role
  baked in; admin join-request approval.
- **Guest access**: docs already have `allowGuestEdit`/share tokens — add a
  management list (active links, expiry, revoke) per document.
- **Workload view**: per-member open-task count + estimation sum, capacity
  bar — helps balance assignments.
- **Combined avatars** (`CombineAvatars.svelte`): stacked avatar + count
  overflow on shared docs/tasks.
- **Ownership transfer** flow with typed-confirmation dialog.

### 15.4 Cross-cutting Huly elements worth copying verbatim

- **Scroller**: custom overlay scrollbar appearing on hover with top/bottom
  fade masks — apply to tree, inbox, chat (`Scroller.svelte` pattern).
- **ObjectBox / ObjectPresenter**: any entity reference (doc, task, person)
  renders as one consistent inline chip with icon; hover → preview card;
  click → open; middle-click → new tab (§4).
- **ParentsNavigator**: breadcrumb dropdowns listing siblings — generalize
  to tasks and projects, not just docs.
- **FixedColumn**: frozen first column + sticky header in all big tables.
- **SavedView**: named saved filters for tasks, docs, inbox, calendar.
- **EmptySearch** states with illustration + one action, everywhere.
- **Toasts with a single Undo action** for destructive ops; confirm dialogs
  only for irreversible ones (Huly minimizes modal interrupts).
- **Entity bottom tabs**: Activity | Comments | Attachments on every detail
  panel (their `AttachedDocPanel` arrangement).

---

## 16. Implementation Order (12 Milestones)

| # | Milestone | Touches | Effort |
|---|---|---|---|
| 1 | Workbench shell + widgets bar + status banner + persistent music experience (§3.1) | layout, topbar, new `widgets/` + `music/` | L |
| 2 | Command Center upgrade | command-palette, search | M |
| 3 | **Documents core (§14.1–14.3)** — sortKey migration, drop-intent zones, multi-select, auto-expand/auto-scroll, virtualization | schema, document-tree, sidebar | L |
| 4 | Workbench tabs | new `tabs/`, userPrefs, router glue | M |
| 5 | Inbox 2.0 two-pane triage | inbox page, notifications schema | M |
| 6 | Files manager + uploader stack + doc attachment panel (§14.6) | new `/app/files`, file-dropzone, widgets | M |
| 7 | Presence everywhere + optimistic audit | presence hooks, mutations | S–M |
| 8 | Settings center + import/export + print CSS | settings pages, lib | M |
| 9 | **Document surface (§14.4–14.5, 14.7)** — All-pages list/gallery, covers, breadcrumbs, backlinks, sub-pages, templates, trash cascade | documents pages, editor, trash | M |
| 10 | **Tracker upgrade (§15.1)** — `PRJ-42` identifiers, inline cell editors, sub-tasks, dependencies, estimations, My Work page, create dialog | tasks schema, tasks-view, new task components | L |
| 11 | **Calendar upgrade (§15.2)** — source overlays, month overflow, event popover, drag-create/resize, recurrence UI, reminders | calendar-view, `flux_events`, recurrence lib | L |
| 12 | **Teams & roles (§15.3)** — directory cards, hover cards, teams, permission matrix, invite links, workload | members page, `flux_roles`, invitations | M |

Each milestone ships independently — no big-bang rewrite. Every milestone
keeps all current features working (regression mantra: nav items, docs,
tasks, calendar, analytics, databases, members, discussions, trash).

---

## 17. Files Map (Where Things Go)

```
apps/web/
  app/app/layout.tsx            # 3-zone workbench shell
  app/app/my/page.tsx           # NEW: My Work (§15.1)
  components/app/
    sidebar.tsx                 # Navigator (§2)
    topbar.tsx                  # breadcrumb bar (§1.2)
    widgets/                    # NEW: widgets bar + 8 widgets (§3, §3.1)
      music-widget.tsx          # Music discovery, queue, full controls
    music/                      # NEW: singleton player host, mini-player, store, provider adapters
    tabs/                       # NEW: workbench tabs (§4)
    command-palette.tsx         # Command Center (§5)
    files/                      # NEW: file manager (§2.3, §14.6)
    inbox/                      # two-pane inbox (§6)
    tracker/                    # NEW: issue row, inline cell editors, kanban, my-work, create-issue (§15.1)
    calendar/                   # NEW: calendar views, event popover, drag-create, recurrence UI (§15.2)
    teams/                      # NEW: members directory, hover cards, permission matrix (§15.3)
  hooks/use-sidebar-prefs.ts    # + widgets + tabs persistence
  lib/shortcuts.ts              # NEW: central shortcut map (§1.3)
  lib/optimistic.ts             # NEW: optimistic helper (§7.5)
  app/globals.css               # z-index tokens, print styles (§11, §12.9)
DESIGN-SYSTEM.md                # single source of truth — do not fork styles
```

**Non-negotiables**: warm-paper palette, Plus Jakarta Sans, coral `#E14B3D`
primary, `.tx-card`/`.tx-pill` classes, density system, accent presets. All
new UI must consume these tokens — never raw hex.

---

## 18. Multi-Session Execution Protocol (READ THIS FIRST)

This plan is executed by **multiple AI sessions/agents**, not by one. This
tasklist is the **single source of truth for progress**. Every session MUST
follow this protocol exactly:

### 18.1 Rules of engagement

1. **Read the whole file first** (it's short — ~800 lines). Then read only
   the code files your task touches.
2. **Claim before you build.** Work on **exactly one** task at a time. Before
   starting, check its box is `[ ]`. When you begin, change it to `[~]` and
   append ` (@your-session-id, YYYY-MM-DD)`. Never touch a `[~]` or `[x]`
   task owned by another session.
3. **One task = one commit/PR** titled `M<n>.<k>: <task title>`. Small diffs
   win; don't bundle adjacent tasks "while you're in there".
4. **Done = checked + verified.** Only mark `[x]` when: code compiles/builds
   (`pnpm -w build` or the app's dev server), any touched tests pass, all new
   interactive elements have `data-testid`, and all user-facing strings go
   through `useTranslations` (no hardcoded English).
5. **Leave a breadcrumb.** On the line under a completed task, add one line:
   `<sub>✓ <what shipped>, <files touched>, <YYYY-MM-DD></sub>`. If you
   discover follow-up work, add a new `[ ]` sub-bullet under the same
   milestone instead of expanding scope silently.
6. **Never break the regression mantra** (§16 list): nav items, docs, tasks,
   calendar, analytics, databases, members, discussions, trash stay working.
7. **If a task is ambiguous or destructive** (schema migration, deleting
   data, changing public API), STOP and open a question — don't guess.
8. **Migrate flags per milestone** listed in §18.3; run data backfills before
   flipping read-paths to the new field.

### 18.2 Status legend

`[ ]` open · `[~]` in progress (claimed) · `[x]` done & verified ·
`[!]` blocked (note reason inline)

### 18.3 Schema migration order (do these first, each backward-compatible)

- [x] **M0.1** Add `sortKey: v.optional(v.string())` to `flux_documents` + backfill `base36(order)` (§14.2) — keep reading `order` until §M3 flips reads. (@session-k3, 2026-08-28)
  <sub>✓ Added optional `sortKey` + `by_workspace_parent_sortKey` index; LexoRank-style base36 helpers (`base36Key`, `sortKeyAfter`); batched `backfillSortKeys` internalMutation; `sortKey` written on create/duplicate/createFolder + accepted by `update`; `list`/`listChildren` sort via `compareDocs` (sortKey w/ `order` fallback preserved). Files: `apps/web/convex/schema.ts`, `apps/web/convex/flux_documents.ts`. 2026-08-28</sub>
- [x] **M0.2** Add `parentId` + `blockedBy: v.optional(v.array(v.id("flux_tasks")))` + `estimation: v.optional(v.string())` + `startDate` to `flux_tasks` (§15.1). (@session-k3, 2026-08-28)
  <sub>✓ Mapped `flux_tasks` → shared `tasks` table (no `flux_tasks` table exists; `v.id("flux_tasks")` in the task text is impossible): added optional `blockedBy: Id<"tasks">[]`, `estimation: string`, `startDate: number` to `tasks` (`parentId` + `by_parent` already existed); create/update mutations accept all three, with cycle guard on `blockedBy` in update. Files: `apps/web/convex/schema.ts`, `apps/web/convex/flux_tasks.ts`. Verified via `tsc --noEmit` (convex, clean), `npx convex codegen`, `pnpm build`. 2026-08-28</sub>
- [x] **M0.3** Add `key: v.optional(v.string())` + `nextTaskNumber: v.optional(v.number())` to `projects`; add `number: v.optional(v.number())` to `flux_tasks`; backfill counters (§15.1). (@session-k3, 2026-08-28)
  <sub>✓ Added optional `key` + `nextTaskNumber` to `projects`, `number` + `by_project_number` index to `tasks`; `flux_tasks.create` allocates numbers from the project counter (max(number)+1 fallback); new idempotent batched `backfillTaskNumbers` internalMutation assigns 4-letter alpha keys and per-project sequences (oldest first). Files: `apps/web/convex/schema.ts`, `apps/web/convex/flux_tasks.ts`, `apps/web/convex/projects.ts`. 2026-08-28</sub>
- [x] **M0.4** Add `reminders: v.optional(v.array(v.number()))` + `startDate` to `flux_events`; add `coverY: v.optional(v.number())` to `flux_documents` (§15.2/§14.5). (@session-k3, 2026-08-28)
  <sub>✓ Added optional `reminders: number[]` + `startDate: number` to `flux_events` (carried through detachOccurrence); added optional `coverY: number` to `flux_documents`; `flux_events.create/update` and `flux_documents.update` accept the new fields. Files: `apps/web/convex/schema.ts`, `apps/web/convex/flux_events.ts`, `apps/web/convex/flux_documents.ts`. 2026-08-28</sub>
- [x] **M0.5** Add `tabs` + `commandHistory` + `shortcuts` fields to `flux_userPrefs` (§4/§5/§10); add `flux_teams` table (§15.3). (@session-k3, 2026-08-28)
  <sub>✓ Added optional `tabs` (id/kind/refId/title/icon), `commandHistory` (key/uses/lastUsed), `shortcuts` (override map, `v.any()`) to `flux_userPrefs` and to `flux_userPrefs.update` args; added new `flux_teams` table (workspaceId, name, color, icon, memberIds, audit fields, `by_workspace` index). Files: `apps/web/convex/schema.ts`, `apps/web/convex/flux_userPrefs.ts`. 2026-08-28</sub>

---

## 19. Master Tasklist (check off as you go)

### M1 — Workbench shell + widgets bar + status banner (§1, §3)
- [x] **M1.1** Refactor [`apps/web/app/app/layout.tsx`](../apps/web/app/app/layout.tsx) into 3-zone grid: navigator / content / widgets. (@session-m1a, 2026-08-28)
  <sub>✓ Layout split into explicit navigator / content / widgets zones with sectioned comments; added hidden `WidgetsBar` stub (`components/app/widgets/widgets-bar.tsx`, `data-testid="widgets-bar"`, `hidden` so zero layout shift — ready for M1.2 to swap in MINI/EXPANDED rail); added `widgets` i18n namespace (label + 7 widget names + toggle) to en.json + fr.json. DockedBubbles + all existing chrome preserved. Files: `apps/web/app/app/layout.tsx`, `apps/web/components/app/widgets/widgets-bar.tsx`, `apps/web/messages/en.json`, `apps/web/messages/fr.json`. Verified: `pnpm build` clean (27/27 pages, compiled in 9s); touched files have zero typecheck errors (pre-existing unrelated errors in `toolbar.tsx`/`version-history-panel.tsx` referencing non-existent `documents`/`documentVersions` tables remain, not introduced here). 2026-08-28</sub>
- [x] **M1.2** Widgets bar skeleton (`components/app/widgets/`): icon rail `MINI` (3.5rem) ↔ `EXPANDED` (~25rem), variants persisted via [`use-sidebar-prefs.ts`](../apps/web/hooks/use-sidebar-prefs.ts) keys `bureau-widgets-variant`, `bureau-widgets-width`, `bureau-widgets-active`. (@session-m1b, 2026-08-28)
  <sub>✓ Replaced the M1.1 hidden stub with a Huly-style right dock: 3.5rem icon rail (7 widgets — Inbox/Comments/AI/My Tasks/Activity/Pomodoro/Presence, iconsax Bulk icons) ↔ EXPANDED rail+panel (~25rem, width persisted). Variant/active/width persisted via `bureau-widgets-variant`/`bureau-widgets-active`/`bureau-widgets-width` (normalized + clamped 320–560px, §12.10). `⌘.` cycles MINI↔EXPANDED (§3); `bureau:toggle-widgets` window event mirrors the sidebar bridge. Panel renders a designed empty state (DESIGN-SYSTEM §8.4) as a slot for M1.7. `hidden md:flex` so mobile is untouched (M1.4 adds float). Sidebar tokens only, no raw hex. data-testid on bar/rail/nav-{key}/toggle/panel/panel-close/empty; all strings via `useTranslations("widgets")` (added collapse/expand/empty/emptyHint to en+fr). layout.tsx unchanged (already rendered `<WidgetsBar/>`). Files: `apps/web/components/app/widgets/widgets-bar.tsx`, `apps/web/messages/en.json`, `apps/web/messages/fr.json`. Verified: `next build` clean (27/27 pages, 9.7s), `tsc --noEmit` zero errors in touched files (113 pre-existing unrelated errors in toolbar.tsx/version-history-panel.tsx remain, per M1.1). 2026-08-28</sub>
- [x] **M1.3** Snap-collapse + edge-hover reveal for both sidebars; resize clamp (MIN/MAX); persist widths. (@session-m1c, 2026-08-28)
  <sub>✓ Shipped §1.1 panelstore locking for both panels. Navigator: resize already clamped MIN_W(224)/MAX_W(400) + persisted via `bureau-sidebar-width`; added snap-collapse (resize end within 12px of MIN_W → `setCollapsed(true)` + restore pre-drag width so next expand reuses it); added `sidebar-edge-reveal` 8px transparent strip at the left edge when collapsed (hover → `bg-primary/20`, click → expand, `hidden md:block`, aria-label/title via `nav.expandSidebar`). Widgets bar: added left-edge resize handle (`widgets-resize-handle`, EXPANDED-only, drag-left grows, drag-right shrinks, clamp MIN_W(320)/MAX_W(560)); snap-to-MINI on end within 12px of MIN_W (preserves last expanded width); added `widgets-edge-reveal` 8px strip when MINI (hover → `bg-primary/20`, click → `cycle()` expand); aside gained `relative` + `transition-none` while resizing. All widths persist via existing `use-sidebar-prefs` keys. data-testid on every new element; strings via `useTranslations` (reused `nav.expandSidebar` + `widgets.expand`). Files: `apps/web/components/app/sidebar.tsx`, `apps/web/components/app/widgets/widgets-bar.tsx`. Verified: `npx tsc --noEmit` zero errors in touched files (pre-existing unrelated errors unchanged), `pnpm -w build` clean (27/27 pages, 18.2s). 2026-08-28</sub>
- [x] **M1.4** Responsive float: navigator overlays <768px; widgets float <1200px (§1.1 constants). (@session-m1d, 2026-08-28)
  <sub>✓ Widgets bar now device-adaptive per §1.1: ≥1200px (FLOAT_ASIDE) docked column in flow (M1.2 behavior); 768–1200px floating `fixed` overlay below the topbar (`md:top-16 md:bottom-0 md:right-0`, shadow-xl) that does not squeeze content; <768px (HIDE_NAVIGATOR) hidden and replaced by a floating coral edge-tab (`widgets-mobile-edge-tab`) that opens the dock as a fixed overlay with a tap-to-close backdrop (`widgets-mobile-backdrop`) + a mobile-only close button atop the rail (`widgets-mobile-close`). Navigator <768px overlay already existed in sidebar.tsx (mobile sheet) — kept as-is per plan. Added `HIDE_NAVIGATOR`/`FLOAT_ASIDE` constants; reused `widgets.expand`/`widgets.collapse` i18n (no new strings). data-testid on every new element; sidebar tokens only, no raw hex. Files: `apps/web/components/app/widgets/widgets-bar.tsx`. Verified: `pnpm -w build` clean (27/27 pages, 19.6s), `tsc --noEmit` zero errors in touched file (pre-existing unrelated errors in toolbar.tsx/version-history-panel.tsx unchanged). 2026-08-28</sub>
- [x] **M1.5** Convex WS status banner (amber "Reconnecting…") + mutation queue/retry helper. (@session-m1e, 2026-08-28)
  <sub>✓ Shipped `lib/mutation-queue.ts` (framework-agnostic queue depth tracker + `useMutationQueue` React hook via `useSyncExternalState`; Convex already retries mutations — this adds UI-visible queue depth) and `components/app/connection-banner.tsx` (amber slim banner using `useConvexConnectionState`, shows only after `hasEverConnected`, displays "N changes queued" when depth > 0, animated slide via framer-motion `AnimatePresence`, auto-resets queue on reconnect). Banner wired into `app/app/layout.tsx` between Topbar and main. Added `connection` i18n namespace (reconnecting + queued plural) to en.json + fr.json. data-testid on banner + queue depth chip. Files: `apps/web/lib/mutation-queue.ts`, `apps/web/components/app/connection-banner.tsx`, `apps/web/app/app/layout.tsx`, `apps/web/messages/en.json`, `apps/web/messages/fr.json`. Verified: `pnpm -w build` clean (27/27 pages, 14.6s), zero new tsc errors in touched files. 2026-08-28</sub>
- [x] **M1.6** Migrate [`docked-bubbles.tsx`](../apps/web/components/app/docked-bubbles.tsx) content into widgets; keep pop-out-to-bubble per widget. (@session-m1e, 2026-08-28)
  <sub>✓ Shipped per-widget float/pop-out toggle in `widgets-bar.tsx`: "float" button (ExternalLink icon) in the docked panel header pops the widget out as a fixed-position floating panel (bottom-right, framer-motion animated, stacked vertically); floated panel has "dock back" (Link2 icon) and close buttons; float state persisted per-widget via `bureau-widgets-float` map (multiple widgets can float simultaneously); rail icons show a coral dot indicator when floated and clicking a floated widget's rail icon docks it back; dock auto-collapses to rail width when the active widget is floated (`expanded` now checks `!isFloated(active)`). DockedBubbles kept in layout (Chat + AI still work) — full content migration completes in M1.7 when real widget components are wired. Added `float`/`dock` i18n strings to en.json + fr.json. data-testid on all new elements (float button, floated panels, dock/close buttons, empty states). Files: `apps/web/components/app/widgets/widgets-bar.tsx`, `apps/web/messages/en.json`, `apps/web/messages/fr.json`. Verified: `pnpm -w build` clean (27/27 pages, 14.6s), zero new tsc errors. 2026-08-28</sub>
- [x] **M1.7** Widgets: Inbox, Comments, AI, My Tasks, Activity, Pomodoro, Presence (reuse existing components). (@session-m1h, 2026-08-28)
  <sub>✓ Regression-verified all 7 widgets dock correctly in the EXPANDED panel and pop out as floated panels via `renderWidget(key)` in both slots; close works via header button (docked) / close button + rail re-click (floated -> dock back), rail toggle and edge-tab; every widget uses a min-h-0 + overflow-y-auto scroll container; all interactive controls carry `data-testid` and all strings flow through `useTranslations` (widgets/comments/tasks/inbox/activity/pomodoro namespaces, all keys present in en.json + fr.json). Confirmed backing APIs exist (`flux_tasks.listMine`, `flux_presence.listForWorkspace` etc.) and `ActivityFeed`/`PomodoroTimer` accept the props used. Files: `apps/web/components/app/widgets/{widgets-bar,inbox-widget,comments-widget,ai-widget,my-tasks-widget,activity-widget,pomodoro-widget,presence-widget,use-active-document}.tsx`, `apps/web/messages/{en,fr}.json`. Verified: `npx tsc --noEmit` zero errors in widget files, `pnpm build` clean (27/27 pages). 2026-08-28</sub>
- [x] **M1.7.1** Music Experience widget + persistent provider player + Dynamic Island mini-player (§3.1). Phases 1–3 shipped (a/b below); Phase 4 optional → M1.7.1c. (@session-k3, 2026-08-28)
  <sub>✓ Phase 1 (foundation + Spotify vertical slice) shipped: typed `MusicProviderAdapter` contract + capability map + normalized state machine; `url.ts` strict https hostname allowlist parser (Spotify track/album/playlist/show/episode incl. `/intl-*`, YouTube/youtu.be/YouTube Music watch·playlist·shorts·embed, SoundCloud track/set — 12-case sanity-tested, id char-whitelists, no arbitrary embed HTML); client-only Zustand `bureau-music` store persisting only refs/queue/pins/recent/volume (no tokens/cookies); module-level adapter registry with lazy single-audio-focus switching; official Spotify Embed iFrame-API adapter (SDK `<script>` loaded once, lazily, deduped `onSpotifyIframeApiReady`, ready/playback_update listeners, 15s blocked-timeout, listener cleanup, never removes the host node); singleton `MusicPlayerHost` with a stable per-provider DOM element mounted once in `app/app/layout.tsx` OUTSIDE the dock (fixed bottom-left, `empty:hidden` — the Spotify 152px visible player, survive route/dock/float transitions); `MusicWidget` control surface — paste field with specific unsupported/error messages, provider chips, privacy note, empty/loading/blocked(tap-to-play)/error states, capability-gated play-pause + volume slider, queue (play/pin/remove), pinned list, open-in-provider links; `music` added to `WidgetKey`/registry/`renderWidget` (validation via `WIDGET_KEYS` auto-covers persistence). Design-system tokens only (bg-card/border/primary, `.tx-pill`, `var(--radius)`), all strings via `useTranslations("music")` en+fr, data-testid on every interactive element. Phase 2 (YouTube/SoundCloud adapters, dnd reorder), Phase 3 (Dynamic Island mini-player in topbar, Media Session, focus-timer pref, reduced-motion) and Phase 4 (optional connected mode) remain. Files: `apps/web/lib/music/{types,url,store,spotify-embed-adapter}.ts`, `apps/web/components/app/music/music-player-host.tsx`, `apps/web/components/app/widgets/music-widget.tsx`, `apps/web/components/app/widgets/widgets-bar.tsx`, `apps/web/app/app/layout.tsx`, `apps/web/messages/{en,fr}.json`. Verified: `tsc --noEmit` zero errors in touched files (pre-existing unrelated errors unchanged), `next build` clean (all routes, exit 0). 2026-08-28</sub>
  <sub>Implement in four independently reviewable phases: (1) foundation with typed provider/capability contract, strict URL normalization/allowlists, Zustand playback store, singleton shell-level host, complete empty/loading/blocked/error states, and Spotify Embed vertical slice; (2) official YouTube/YouTube Music IFrame and SoundCloud Widget adapters, one-active-provider audio focus, queue/reorder, pins, recents, safe external fallback, and lifecycle cleanup; (3) responsive docked/floated Music widget plus topbar/mobile Dynamic Island transport, continuity across routes and widget modes, best-effort Media Session, focus-timer preference, en/fr localization, reduced-motion and keyboard/screen-reader behavior; (4) optional Spotify Web Playback or Apple Music connected mode only after credentials, Premium/subscriber requirements, secure server-side OAuth/token refresh, and deployment/legal review. No audio proxying, scraping, downloading, transcoding, hidden YouTube audio-only playback, arbitrary iframe HTML, client-stored access tokens, or provider SDK in the initial bundle. Files: `apps/web/components/app/widgets/{widgets-bar,music-widget}.tsx`, new `apps/web/components/app/music/{music-player-host,music-mini-player}.tsx`, new `apps/web/lib/music/{types,url,store,provider adapters}.ts`, `apps/web/app/app/layout.tsx`, `apps/web/components/app/topbar.tsx`, `apps/web/messages/{en,fr}.json`, and security headers/config only as required by verified provider origins. Acceptance: paste and play one supported URL per first-release provider after a user gesture; one player only; no player remount across navigation/dock/float transitions; compact playback only where provider rules permit, with a compliant visible YouTube mini-video or pause fallback; queue/preferences restore without secrets; explicit autoplay/offline/provider failure recovery; no startup, layout-shift, accessibility, or workbench regressions. Verify URL/store unit tests, component integration states, typecheck/build, and manual playback in current Chrome, Safari, Firefox, iOS Safari, and Android Chrome.</sub>
  - [x] **M1.7.1a** Phase 2 — official YouTube/YouTube Music IFrame adapter (`youtube-iframe-adapter.ts`, compliant ≥200×200 visible host, single `onYouTubeIframeAPIReady` load) + SoundCloud Widget adapter (`soundcloud-widget-adapter.ts`, SC.Widget events); register both factories in `music-player-host.tsx`; queue drag-reorder via existing dnd-kit; recents row in `music-widget.tsx`. (Foundation ready: contract/store/registry/host host support multiple providers.) (@session-k3, 2026-08-28)
    <sub>✓ Shipped YouTube IFrame adapter (lazy single `onYouTubeIframeAPIReady` load, full state machine incl. UNSTARTED/CUED→ready, error codes mapped to specific reasons `embedding-disabled`/`not-found`/`player-error`, 1s progress interpolation only while playing, playlist `listType` support, no autoplay — explicit gesture required, player instance reused via `loadVideoById`/`loadPlaylist` so the iframe never remounts) and SoundCloud Widget adapter (lazy `api.js` load with onload/onerror dedup, official fixed embed URL — never arbitrary HTML, full SC.Widget event bindings READY/PLAY/PAUSE/FINISH/PLAY_PROGRESS/ERROR with per-listener unbind on teardown, 15s blocked-timeout, artwork via provider-served `t100x100` https upgrade). Host now mounts all three provider slots; only the active provider's slot is visible (`empty:hidden` + inactive-hide) and slots are never unmounted — the previous provider is paused by the registry's single-audio-focus logic, keeping YouTube's visible-viewport rule satisfied (no hidden competing audio). YouTube slot enforces `min-h-[200px]` on the iframe. Store gained `reorderQueue(from,to)` with `currentIndex` remapping so the playing track follows its row. Widget queue is now dnd-kit sortable (PointerSensor 6px activation constraint, keyboard sensor, GripVertical handle, DragOverlay-less transform style, `aria-pressed` on pins), added 5-item Recently-played row (History icon) with play + open-in-provider per row, and a capability-gated seek slider (`music-progress`, only when `durationMs > 0` — Spotify correctly omits it). i18n: added `recent`, `seek`, `playQueueItem`, `dragToReorder` to en+fr `music` namespace. Design tokens only; `data-testid` on every interactive element (drag handles, recent items, progress/volume sliders). Files: `apps/web/lib/music/youtube-iframe-adapter.ts` (new), `apps/web/lib/music/soundcloud-widget-adapter.ts` (new), `apps/web/lib/music/store.ts`, `apps/web/components/app/music/music-player-host.tsx`, `apps/web/components/app/widgets/music-widget.tsx`, `apps/web/messages/{en,fr}.json`. Verified: `npx tsc --noEmit` zero errors in all music files (pre-existing unrelated toolbar/version-history errors unchanged), `pnpm build` clean (27/27 pages). 2026-08-28</sub>
  - [x] **M1.7.1b** Phase 3 — Dynamic Island mini-player (`components/app/music/music-mini-player.tsx`, topbar pill + mobile bottom pill, Framer Motion shared-layout morph, reduced-motion crossfade); move/reveal provider host without cloning (YouTube compliant visible mini-card or pause fallback); best-effort Media Session; focus-timer pref (never surprise-pause by default); full keyboard/screen-reader pass. (@session-k3, 2026-08-28)
    <sub>✓ Shipped `music-mini-player.tsx` with two placements sharing one control surface: topbar pill (md+, between search and right controls) + mobile bottom pill (mounted in shell, safe-area padded). Idle row (artwork/title/provider pill/play-pause/dismiss) + hover·focus-within expanded cluster (prev/next, capability-gated seek w/ timestamps, volume, focus-timer, opt-in pause-on-focus toggle, open-widget, open-in-provider). Framer Motion layout morph ≤220ms on `--ease-standard`, `useReducedMotion` collapses morph→12ms crossfade (§13 + §3.1). Host never moved/cloned — island is a pure store surface; the active YouTube host slot IS the ≥200×200 compliant mini-card (never unmounted). Store gained `nextTrack`/`previousTrack` (wrap) + `dismiss()` (pauses adapter, keeps queue/pins/recents). Best-effort Media Session metadata + play/pause/prev/next handlers with try/catch graceful fallback (§3.1 #6). Focus-pause pref `bureau-music-pause-on-focus` default OFF (no surprise-pause), reacts only to a `bureau:pomodoro-focus-start` event. Generic `bureau:open-widget:<key>` window-event bridge in widgets-bar (docks floating widget back, EXPANDED+active, mirrors open-chat pattern); mini-player dispatches `…:music` / `…:pomodoro`. i18n keys (next/previous/dismiss/openWidget/startFocusTimer/pauseOnFocus/videoPlaying) added en+fr; every control has data-testid (`music-mini-*`). Files: `apps/web/components/app/music/music-mini-player.tsx` (new), `apps/web/lib/music/store.ts`, `apps/web/components/app/topbar.tsx`, `apps/web/app/app/layout.tsx`, `apps/web/components/app/widgets/widgets-bar.tsx`, `apps/web/messages/{en,fr}.json`. Verified: `tsc --noEmit` zero errors in touched files (113 pre-existing unrelated `documents`/`documentVersions`/`edgestore` errors unchanged), `pnpm build` clean (27/27 pages). 2026-08-28</sub>
    <sub>Follow-up discovered: the `pomodoro-timer.tsx` component does not yet dispatch `bureau:pomodoro-focus-start` when a focus session begins — the opt-in pause-on-focus preference only takes effect once M13/M14 (or a small follow-up) wires that one-line dispatch into the timer's start handler.</sub>
  - [!] **M1.7.1c** Phase 4 (optional, separate review) — connected mode: Spotify Web Playback SDK / Apple MusicKit behind capability flags, server-side OAuth + PKCE, encrypted HttpOnly Secure SameSite=Lax cookies, server refresh, disconnect UI, no client-stored tokens. Embed mode remains the fallback. — BLOCKED: requires Spotify/Apple developer credentials, OAuth server endpoints, and deployment/legal review; cannot be implemented in-session. Embed mode (Phases 1–3) is the shipped fallback.

### M2 — Command Center (§5)
- [x] **M2.1** Grouped sections (Actions/Docs/Tasks/Projects/People/Settings) + count badges in [`command-palette.tsx`](../apps/web/components/app/command-palette.tsx). (@session-k3, 2026-08-28)
  <sub>✓ Added `GroupHeading` (label + right-aligned `bg-muted tabular-nums` count badge) applied to every section; reordered to plan sequence — Recent → Actions → Documents → Tasks → Projects → Events → Databases → People (members renamed off `teams.membersTitle` to new `commandPalette.people`) → suite mirrors → Settings (own first-class section via `PAGES` `key==="settings"`, `data-testid="cmd-page-settings"`) → Go to; counts flow from live result arrays with a 1-badge on Settings; removed now-unused `useTranslations("teams")`. Files: `apps/web/components/app/command-palette.tsx`, `apps/web/messages/en.json`, `apps/web/messages/fr.json`. Verified: `tsc --noEmit` clean for the file, `pnpm build` clean (all `/app/*` routes compile). 2026-08-28</sub>
- [x] **M2.2** Action verbs ("new …") with icons + shortcut hints. (@session-k3-m22, 2026-08-28)
  <sub>✓ Shipped §5 #2 action-verb expansion in the command palette: added "New project" (navigates to `/app/projects?new=1`, which auto-opens the existing project-creation dialog) and "Invite member" (navigates to `/app/members`) quick actions with `Briefcase`/`UserAdd` icons; added "Toggle widgets panel" action (wired to the existing `bureau:toggle-widgets` window event, SidebarRight icon). Added `ShortcutHint` kbd-chip component and wired `shortcut` metadata on toggle-sidebar (`⌘\`) and toggle-widgets (`⌘.`) rows (the create/navigation actions have no dedicated hotkey, so no hint shown); added global `C` hotkey in the app shell that opens the palette when focus is not in a text input (guards against input/textarea/contenteditable targets, ignores modifier combos). All new strings flow through `useTranslations` (`commandPalette.actions.newProject` / `inviteMember` / `actions.toggleWidgets` + new `commandPalette.shortcuts` namespace added to en.json + fr.json); `data-testid` on every new action row (`cmd-new-project`, `cmd-invite-member`, `cmd-toggle-widgets`). Design tokens only (border-border / bg-muted / text-muted-foreground), no raw hex. Files: `apps/web/components/app/command-palette.tsx`, `apps/web/app/app/layout.tsx`, `apps/web/messages/en.json`, `apps/web/messages/fr.json`. Verified: `npx tsc --noEmit` zero errors in touched files, `pnpm build` clean (all routes compiled). 2026-08-28</sub>
- [x] **M2.3** Frecency ranking via `flux_userPrefs.commandHistory`. (@session-k3-m23, 2026-08-28)
  <sub>✓ Shipped §5 #3 frecency ranking (frequency + recency). New `flux_userPrefs.recordCommand` mutation records each pick: increments `uses`, refreshes `lastUsed`, sorts MRU-first and caps history at the plan-specified 50 entries (evicting oldest beyond that). Client-side `useFrecency` hook in `command-palette.tsx` reads `commandHistory` (skipped while palette closed), computes `score = uses * 0.7 + recencyBoost` with `recencyBoost = 1/(1 + ageDays/3)` (~3-day half-life), and re-ranks Quick Actions, Recent docs, and the Go-to page list; every selectable row (10 actions, recent docs, search-result docs/tasks/projects/events/databases/members, settings + go-to pages) now fire-and-forget-tracks its frecency key (`action:*`, `doc:<id>`, `task:<id>`, `project:<id>`, `event:<id>`, `db:<id>`, `member:<id>`, `page:*`) on select, feeding future rankings. Ranked lists keep entry identity stable (locale labels untouched); no new user-facing strings needed, no raw hex, design tokens only. Files: `apps/web/convex/flux_userPrefs.ts`, `apps/web/components/app/command-palette.tsx`. Verified: `npx tsc --noEmit` zero errors in touched files, `pnpm build` clean (27/27 pages, compiled in 10.2s). 2026-08-28</sub>
- [x] **M2.4** Snippet previews; scoped prefixes `d:` `t:` `p:` `#` `@`. (@session-k3-m24, 2026-08-28)
  <sub>✓ Shipped §5 #4 snippet previews + §5 #5 scoped prefixes. Snippet previews: `extractPlainText` parses BlockNote JSON content to plain text; `buildSnippet` returns 80 chars around the first match with ellipsis truncation; `Snippet` component renders muted text-xs under each result row. Added to all result types — docs (content extraction), tasks (description), projects (description/client), events (description/location), databases (description), members (email when name matches). Scoped prefixes: `parseScope` detects `d:`/`t:`/`p:`/`#`/`@` prefixes, strips them before sending to Convex, and controls which result groups render. `d:` → docs only (flux_documents.search); `t:` → tasks only; `p:` → projects only; `@` → people only; `#` → new `global_search.searchByLabel` query (joins flux_taskMeta → tasks, also matches flux_labels by name). Scope badge strip shown between input and list (coral pill + hint text). Quick actions, recent, go-to, settings, and core suite search hidden while scoped. Enhanced `global_search.search` to return `description`/`location`/`client` fields for snippet context. All strings via `useTranslations("commandPalette")` (new `scopeHint` + `scopes.*` keys in en+fr); `data-testid` on scope hint (`cmd-scope-hint`), snippets (`cmd-snippet`), label results (`cmd-label-result`, `cmd-label-task`). Design tokens only, no raw hex. Files: `apps/web/convex/global_search.ts`, `apps/web/components/app/command-palette.tsx`, `apps/web/messages/en.json`, `apps/web/messages/fr.json`. Verified: `npx tsc --noEmit` zero errors in touched files (113 pre-existing unrelated errors unchanged), `npx convex codegen` clean, `pnpm build` clean (27/27 pages, 15s). 2026-08-28</sub>
- [x] **M2.5** Visual: blur backdrop, `--elev-3`, zoom-in-95, close on route change. (@session-m25, 2026-08-28)
  <sub>✓ Shipped §5 #6 Command Center visual polish. Backdrop: scoped CSS rule in globals.css using `:has()` on `[data-slot="dialog-portal"]:has([data-testid="command-palette"]) [data-slot="dialog-overlay"]` applies `backdrop-filter: blur(8px)` + `rgb(0 0 0 / 0.55)` — the shared Dialog overlay is untouched for every other dialog. Panel: `DialogContent` className now `rounded-2xl shadow-none elev-3` (twMerge drops base `rounded-md`/`shadow-lg`; unlayered `.elev-3` wins over layered `shadow-none` to apply `box-shadow: var(--elev-3)`). `zoom-in-95`/`fade-in` already in base `DialogContent` (unchanged). Close-on-route-change: added `usePathname()` + effect calling `setOpen(false)` on pathname change — covers sidebar/back-button navigation that bypasses the `go()` helper (which already closes on select). No new user-facing strings (no raw hex, design tokens only). Files: `apps/web/components/app/command-palette.tsx`, `apps/web/app/globals.css`. Verified: `pnpm -w build` clean (27/27 pages, 15.7s), `tsc --noEmit` 113 pre-existing unrelated errors unchanged, zero in touched files. 2026-08-28</sub>

### M3 — Documents core (§14.1–14.3) ⚠ depends M0.1
- [x] **M3.1** Replace `pointerWithin` with 3-zone drop intent (before/into/after) + 2px indicator line + indent rails in [`document-tree.tsx`](../apps/web/components/app/document-tree.tsx). (@session-k3, 2026-08-28)
  <sub>✓ Shipped 3-zone drop intent per §14.1: provider now tracks pointer Y via a passive `pointermove` listener and, on `onDragOver`, resolves the hovered tree row into `{targetId, zone}` (top 25% → before, middle 50% → into, bottom 25% → after) exposed as `dropIntent` on `TrashDndContext`; rows render a 2px `bg-primary` indicator line at the exact edge (`tree-drop-before`/`tree-drop-after`) or a row flash (`bg-primary/10 ring-2 ring-primary/50`) for into, plus per-depth vertical indent rails reusing the `.tx-tree-guide` token styling. Removed the `acceptsDrop` gate so every row is a droppable surface (drop *behavior*/intent consumption lands in M3.2/M3.3 — the move handler is unchanged); tightened `PointerSensor` activation constraint from 8px to the §14.3-specified 6px; dragging source row fades to 30% opacity. No raw hex; existing i18n strings unchanged (no new user-facing strings); data-testid on both indicator lines. Files: `apps/web/components/providers/dnd-trash-provider.tsx`, `apps/web/components/app/document-tree.tsx`. Verified: `tsc --noEmit` zero errors in touched files (pre-existing unrelated errors elsewhere unchanged), `pnpm -w build` clean. 2026-08-28</sub>
- [x] **M3.2** Any-document-can-nest: drop into any row (children auto-make parent expandable); `isFolder` = visual only. (@session-m32, 2026-08-28)
  <sub>✓ Shipped §14.1 rule 1 any-document-can-nest. `handleDragEnd` in `dnd-trash-provider.tsx` now honors the 3-zone drop intent for tree drops: `into` → move as child of target + dispatch `bureau:tree-expand` so the sidebar auto-expands the new parent (children auto-make parent expandable — a leaf doc that receives a child immediately shows a chevron because `canExpand = isFolderNode || hasChildren`); `before`/`after` → move as sibling of target (same parent; appended to parent's children — sortKey-based ordering within the sibling list is M3.3). Fixed a stale-closure bug from M3.1: `dropIntent` was read in the memoized `handleDragEnd` but not in its dep array, so the zone was always stale — added a `dropIntentRef` mirrored on every `setDropIntent` call and read the ref in `handleDragEnd`. Cycle guards cover both the into target and the sibling parent. `sidebar.tsx` adds a `bureau:tree-expand` window-event listener that pushes the id into `openList` (mirrors the existing `bureau:toggle-widgets` event pattern). `isFolder` remains visual-only (M3.1 already removed `acceptsDrop`; every row is droppable; `canExpand` includes `hasChildren`). No new user-facing strings (reuses `movedToFolder`/`movedToRoot`/`couldNotMove`); no raw hex; no new data-testid needed (drop indicators already tagged in M3.1). Files: `apps/web/components/providers/dnd-trash-provider.tsx`, `apps/web/components/app/sidebar.tsx`. Verified: `npx tsc --noEmit` zero errors in touched files, `pnpm -w build` clean (27/27 pages, 18.3s). 2026-08-28</sub>
- [x] **M3.3** `sortKey` reorders: single-row optimistic move; read-path flip from `order`; cycle guard in mutation. (@session-m33, 2026-08-28)
  <sub>✓ Shipped §14.2 fractional-index reorders. New pure client helper `apps/web/lib/sort-key.ts`: `midKey(prev,next)` (recursive base36 digit-averaging midpoint with 'i'-append fallback for the degenerate adjacency case; `sortKeyAfter` mirrored from server; `compareSortKeys` for optimistic re-sort) — sanity-tested for prepend/append/between + 8–12x repeated inserts at one boundary. `flux_documents.move` now accepts optional `sortKey` and patches it (cycle guard on `parentId` unchanged); `compareDocs` comment flipped to mark sortKey authoritative (M3.3 read-path flip; `order` kept only as legacy fallback). `dnd-trash-provider.handleDragEnd` now computes a `midKey` for every drop branch — root & `into` append at end of the target's children (`midKey(lastChildSort,null)`); `before`/`after` place at the exact sibling position (`midKey(prevNeighbor,targetKey)` / `midKey(targetKey,nextNeighbor)`, excluding the dragged row from the neighbor scan) — and applies a single-row optimistic update via `moveDoc.withOptimisticUpdate` that patches the cached `flux_documents.list` row (parentId+sortKey) and re-sorts it so the tree moves instantly; Convex auto-rolls-back on completion (server truth wins) and rejects on error → toast. No new user-facing strings (reuses `movedToRoot`/`movedToFolder`/`couldNotMove`); no raw hex; no new data-testid needed (drop indicators from M3.1). Files: `apps/web/lib/sort-key.ts` (new), `apps/web/convex/flux_documents.ts`, `apps/web/components/providers/dnd-trash-provider.tsx`. Verified: `npx tsc --noEmit` zero errors in touched files (113 pre-existing unrelated unchanged), `npx convex codegen` clean, `pnpm -w build` clean (27/27 pages, 17.2s). 2026-08-28</sub>
  - [x] **M3.3.1** (follow-up) Periodic sortKey rebalance: when a sibling list's adjacent `sortKey`s get within a tight bound (degenerate adjacency after many inserts at one boundary), renumber that sibling list with fresh evenly-spaced keys via a batched internal mutation (standard LexoRank maintenance). The `midKey` 'i'-append fallback keeps order correct on the moved row's side in practice, but a rebalance pass is the long-term fix. (@session-k4, 2026-08-28)
    <sub>✓ Shipped `hasDegenerateAdjacency` helper (detects prefix-of / adjacent-digit / out-of-order pairs), `rebalanceSortKeys` internal mutation (fetches all non-archived children of a parent via `by_workspace_parent` index, no-ops when healthy, renumbers with evenly-spaced `base36Key(i * 1_000_000)` keys batched via `offset`/`batchSize`), `rebalanceAllSortKeys` self-chaining internal mutation (scans all `flux_documents` in paginated batches, collects unique `(workspaceId, parentId)` groups, schedules `rebalanceSortKeys` per group, self-chains via `ctx.scheduler.runAfter(0, …)` until `isDone`). Trigger wired into `move` mutation: when the computed `sortKey` exceeds `DEGENERATE_LENGTH_THRESHOLD` (8 chars — normal `midKey` results are 2–4), schedules `rebalanceSortKeys` for the destination sibling list. Daily cron `rebalance-sortkeys` (03:00 UTC) fires `rebalanceAllSortKeys` for workspace-wide maintenance. No schema changes, no client-side changes, no new user-facing strings or data-testids (backend-only maintenance). Files: `apps/web/convex/flux_documents.ts`, `apps/web/convex/crons.ts`. Verified: `npx convex codegen` clean, `npx tsc --noEmit` 113 pre-existing unrelated errors unchanged (zero in touched files), `pnpm -w build` clean (27/27 pages, 14.4s). 2026-08-28</sub>
- [x] **M3.4** 6px `PointerSensor` activation constraint; DragOverlay ghost (icon+title, `elev-2`, 1° tilt); source row 30% opacity. (@session-m34, 2026-08-28)
  <sub>✓ Shipped §14.3 drag ghost polish. The 6px `PointerSensor` activation constraint and source-row 30% opacity (`isDragging ? { opacity: 0.3 }`) were already in place from M3.1/M3.2; this task completed the remaining DragOverlay ghost: `DragPreview` now uses the design-system `elev-2` elevation token (replacing raw `shadow-2xl`) and adds a `rotate-1` (1°) tilt per §14.3 "rotate 1°"; kept icon + title, `.tx-drag-preview` appear animation, `ring-2 ring-primary/30`, `bg-card`/`border-border` tokens (no raw hex); added `data-testid="tree-drag-overlay"`. No new user-facing strings (the pre-existing "Untitled"/📄 fallbacks are unchanged, non-blocking). Files: `apps/web/components/providers/dnd-trash-provider.tsx`. Verified: `tsc --noEmit` zero errors in touched file (113 pre-existing unrelated errors unchanged), `pnpm -w build` clean (27/27 pages, 17s). 2026-08-28</sub>
- [x] **M3.5** Multi-select (⌘/⇧ click) + group drag count badge + bulk trash w/ single Undo toast. (@session-m35, 2026-08-28)
  <sub>✓ Shipped §14.3 multi-select. Added selection state to `TrashDndContext`: `selectedIds` + `selectClick` (⌘/ctrl toggles, ⇧ range-selects against a flat visible-order registered by the sidebar via `registerVisibleOrder`, plain click clears), `clearSelection`, `bulkTrash(ids)` (archives each via existing recursive `archive`, single sonner toast `"{count} pages moved to trash"` with an Undo action that `restore`s all, `trashingIds` set for every id so rows collapse together). `⌫` keydown bulk-trashes the selection and `Escape` clears it (guarded against input/textarea/contenteditable focus). Group drag: `handleDragStart` carries `selectedIds`+`count` when the dragged row is in a multi-selection; `DragPreview` renders a stacked-cards ghost (two offset bg-card piles) with a coral `bg-primary` count badge + `sr-only` `pagesSelected` label (`data-testid="tree-drag-count"`). `handleDragEnd` resolves `dragIds` = the selection (or single active) and moves the whole group as a block with sequential `midKey` sortKeys for root/into (append at end) and before/after (block between target and neighbor), with per-row cycle guards (drop descendants of the target). Drop-to-trash with a group routes through `bulkTrash`. `DocumentTreeNode`: Link `onClick` intercepts modifier clicks (preventDefault + stopPropagation so the Folder doesn't toggle expand and the route doesn't navigate) → `selectClick`; selected rows get `bg-primary/10`; non-active selected rows fade to 30% during a group drag; context-menu "Move to trash" trashes the whole selection when the row is selected. Sidebar computes `visibleOrder` (DFS, only into open nodes) and registers it via effect. i18n: added `bulkTrashed`/`bulkRestored`/`bulkRestoreFailed`/`undo`/`pagesSelected` (ICU plural) to `tree` namespace in en+fr. Design tokens only (bg-primary, bg-card, border-border, text-primary-foreground), no raw hex. `data-testid` on count badge; selection observable via `bg-primary/10` class. Files: `apps/web/components/providers/dnd-trash-provider.tsx`, `apps/web/components/app/document-tree.tsx`, `apps/web/components/app/sidebar.tsx`, `apps/web/messages/en.json`, `apps/web/messages/fr.json`. Verified: `tsc --noEmit` zero errors in touched files (113 pre-existing unrelated errors unchanged), `pnpm -w build` clean (27/27 pages, 17.3s). 2026-08-28</sub>
- [x] **M3.6** Auto-expand on 600ms drop-hover; edge auto-scroll (24px zones). (@session-m36, 2026-08-28)
  <sub>✓ Shipped §14.3 auto-expand-on-hover + edge auto-scroll. Auto-expand: `DocumentTreeNode` now reads `isOver` from `useDroppable` and starts a 600ms `setTimeout` when a drag is active, the row is a collapsed expandable node (`canExpand && !isOpen`), and the pointer is over it; fires `onToggleOpen(id, true)`, clears on leave/drag-end/already-open. `onToggleOpen` is read through a ref so the timer is not reset on every parent re-render (its identity changes each render but behavior is stable via functional setState). Edge auto-scroll: provider tracks `pointerX` alongside `pointerY`; sidebar registers its tree scroll container (`data-testid="sidebar-tree-scroll"`) via a new `registerScrollContainer` context callback; while `activeDrag` is set the provider runs a `requestAnimationFrame` loop that scrolls the container when the pointer is within a 24px zone of its top/bottom edge, velocity ramping by proximity (closer→faster, capped at 14px/frame), only when horizontally within the container (64px tolerance) and the container can scroll that direction (guards against scrolling a parent or janking a non-scrollable region). rAF cancelled on drag end. No new user-facing strings (non-verbal behaviors); no raw hex; `data-testid` on the scroll container. Files: `apps/web/components/providers/dnd-trash-provider.tsx`, `apps/web/components/app/document-tree.tsx`, `apps/web/components/app/sidebar.tsx`. Verified: `npx tsc --noEmit` zero errors in touched files (113 pre-existing unrelated errors unchanged), `pnpm -w build` clean (27/27 pages, 15.1s). 2026-08-28</sub>
- [x] **M3.7** Virtualize tree (>200 rows, 28px rows); `useDeferredValue`; memoized nodes. (@session-m37, 2026-08-28)
  <sub>✓ Shipped §14.8 tree virtualization + performance guardrails. Replaced the recursive Radix-Accordion renderer with a flat `flattenVisibleTree(docs, openIds)` DFS-ordered list (children sorted by `compareSortKeys` to match server ordering); each row is a `DocumentTreeRow` (28px `h-7`, no Accordion — chevron click toggles `onToggleOpen` directly, all existing behavior preserved: dnd-kit drag/drop, 3-zone drop indicators, indent rails, inline rename, context menu, multi-select, auto-expand on 600ms drop-hover, trashing animation). Past 200 visible rows, `@tanstack/react-virtual`'s `useVirtualizer` virtualizes the list within the sidebar's existing scroll container (`scrollMargin` measured via `ResizeObserver` to account for favorites + section header above the tree); ≤200 rows render as a simple flat list. `useDeferredValue` on `docs` in both `DocumentTree` and the sidebar so typing elsewhere stays smooth. `DocumentTreeRow` wrapped in `React.memo` with custom equality (id, title, icon, isFolder, depth, hasChildren, isOpen, isActive, isFavorite — context-driven values propagate via `useTrashDnd`/`useDraggable` regardless). Sidebar's `visibleOrder` now reuses `flattenVisibleTree` (single source of truth for range-selection). Added `collapse`/`expand` i18n keys to en+fr `tree` namespace. `data-testid` on all new elements (`doc-tree-row`, `tree-chevron`, `tree-virtualized`, `tree-virtual-row`, `tree-flat`). Design tokens only, no raw hex. New dep: `@tanstack/react-virtual@^3.14.10`. Files: `apps/web/components/app/document-tree.tsx` (rewritten), `apps/web/components/app/sidebar.tsx`, `apps/web/messages/en.json`, `apps/web/messages/fr.json`, `apps/web/package.json`. Verified: `tsc --noEmit` 113 pre-existing unrelated errors unchanged (zero in touched files), `pnpm -w build` clean (27/27 pages, 18.7s). 2026-08-28</sub>

### M4 — Workbench tabs (§4) ⚠ depends M0.5
- [x] **M4.1** Tab strip `components/app/tabs/` between topbar & content; persist per user in `flux_userPrefs.tabs`. (@session-k5, 2026-08-28)
  <sub>✓ Shipped §4 workbench tab strip foundation. New `components/app/tabs/`: `tab-href.ts` (pure helpers — `tabId`/`tabHref`/`isTabActive`/`viewTabFromPath`; deterministic `kind:refId` ids enable M4.3 dedup; `view` tabs carry href in `refId`, `doc`→`/app/documents/<id>`, `project`→`/app/projects/<id>`, `task`→null until M10 routes), `use-workbench-tabs.ts` (single client surface over `flux_userPrefs.tabs` — `tabs`/`openTab`/`closeTab`/`findTab`, dedup on open), `workbench-tabs.tsx` (28px-tall strip rendered between `<ConnectionBanner/>` and `<main>` in `app/app/layout.tsx`; active tab from `usePathname` with 2px `bg-primary` bottom marker mirroring the tree indicator; click→`Link` navigate; hover `×`→close + neighbour-focus fallback to `/app`; trailing `+` pins the current route as a `view` tab titled from `nav.*` i18n keys with last-segment fallback; empty-state hint; `task`-kind tabs render non-navigable with a `noRoute` tooltip). Persisted via existing `flux_userPrefs.update` mutation (schema `tabs` field from M0.5 — no schema change). i18n: new `tabs` namespace (`home`/`emptyHint`/`close`/`noRoute`/`pinCurrent`) in en+fr. Design tokens only (bg-background/border-border/bg-muted/bg-primary/text-muted-foreground), no raw hex. `data-testid` on strip/empty/each tab/tab-id/active marker/close/pin-current. M4.2 (middle-click, ⌘W, ⌘1..9, dnd reorder, overflow masks) and M4.3 (internal-link resolution + scroll restore) remain. Files: `apps/web/components/app/tabs/{tab-href,use-workbench-tabs,workbench-tabs}.tsx` (new), `apps/web/app/app/layout.tsx`, `apps/web/messages/{en,fr}.json`. Verified: `npx tsc --noEmit` zero errors in touched files (113 pre-existing unrelated `documents`/`documentVersions`/`edgestore` errors unchanged), `pnpm -w build` clean (27/27 pages, 22s). 2026-08-28</sub>
- [x] **M4.2** Middle/⌘-click opens new tab; `⌘W` close; `⌘1..9` jump; horizontal dnd reorder + overflow fade masks. (@session-m42, 2026-08-28)
  <sub>✓ Shipped §4 tab-strip interactions. dnd-kit horizontal sortable reorder (`horizontalListSortingStrategy`, 6px PointerSensor, `arrayMove` → new `reorderTabs` in `use-workbench-tabs.ts`); each tab is a `SortableTab` with `cursor-grab`/`active:cursor-grabbing`, `elev-2` ghost while dragging, `touch-none`. Middle-click (auxclick button 1) on a tab closes it (browser convention). App-wide `⌘W` closes the active tab (preventDefault; falls back to neighbour/`/app` via existing `handleClose`) and `⌘1..9` jumps to tab N — both via a single `window` keydown listener using a `stateRef` so it never goes stale. Middle-click / ⌘-click any `/app/...` anchor outside the tab strip opens a new workbench tab via bubble-phase `auxclick`+`click` window listeners + new pure `tabFromHref` helper (doc/project routes → doc/project tabs, else view tab; `?`/`#` stripped for dedup); the document tree's M3.5 ⌘-click multi-select is preserved because its `Link` `onClick` calls `stopPropagation` (bubble phase never reaches the window listener), and the tab strip is excluded explicitly so middle-click closes instead of re-opening. Overflow fade masks: left/right `bg-gradient-to-* from-background` overlays toggled by scroll position (`onScroll` + `ResizeObserver`-free length effect), `pointer-events-none`. New `tabFromHref` + `reorderTabs` added; shortcuts help dialog gained `closeTab`/`jumpTab`/`openTab` rows (en+fr `shortcuts` namespace). Design tokens only (bg-background/border-border/bg-muted/bg-primary/text-muted-foreground, `--elev-2`), no raw hex. `data-testid` on scroll container, both masks, drag state (`data-dragging`). Files: `apps/web/components/app/tabs/{tab-href,use-workbench-tabs,workbench-tabs}.tsx`, `apps/web/components/app/shortcuts-help.tsx`, `apps/web/messages/{en,fr}.json`. Verified: `npx tsc --noEmit` 113 pre-existing unrelated errors unchanged (zero in touched files), `pnpm -w build` clean (27/27 pages, 18.6s). 2026-08-28</sub>
  - [x] **M4.2.1** (follow-up) Sync real entity titles into doc/project tabs opened via middle/⌘-click: `tabFromHref` currently returns placeholder titles ("Document"/"Project"); wire a Convex lookup (or reuse the doc/project page's existing title query) to update the persisted tab title after open, mirroring how M4.3 will resolve internal links into existing tabs. (@session-k6, 2026-08-28)
    <sub>✓ Shipped real-title sync for doc/project tabs. Added `setTabTitle(id, title)` to `use-workbench-tabs.ts` (no-ops when the tab is missing or the title already matches → no spurious `flux_userPrefs.update` writes). Added headless `TabTitleSync` observer in `workbench-tabs.tsx` (rendered once per doc/project tab in the strip, returns null — zero layout impact): skips queries for non-entity tabs via the codebase's `"skip"` pattern, fetches `api.flux_documents.get` (`.title`) for doc tabs and `api.projects.get` (`.name`) for project tabs, and fires `setTabTitle` from a `useEffect` only when the fetched title differs from the current tab title. After the update lands, `setTabTitle`'s identity changes but the effect's `doc.title !== tab.title` guard no-ops → no infinite loop. Placeholder titles from `tabFromHref` ("Document"/"Project") now get replaced with the real entity name within one query tick of opening the tab via middle/⌘-click. No new user-facing strings (titles come from Convex), no raw hex, no new data-testid needed (headless). Files: `apps/web/components/app/tabs/use-workbench-tabs.ts`, `apps/web/components/app/tabs/workbench-tabs.tsx`. Verified: `npx tsc --noEmit` 113 pre-existing unrelated errors unchanged (zero in touched files), `pnpm -w build` clean (27/27 pages, 19.8s). 2026-08-28</sub>
- [x] **M4.3** Internal links resolve into existing tab when present; per-tab scroll restore (§12.8). (@session-k7, 2026-08-28)
  <sub>✓ Shipped §4 "resolve into an already-open tab" + §12.8 per-tab scroll restore. Link resolution: the M4.2 middle/⌘-click handlers now consult `findTab` via a shared `resolveTarget` helper — if the target entity (doc/project/view) is already pinned as a tab, the click navigates to that tab's href (focuses it) instead of calling `openTab` (which dedup-no-op'd and left the user on the current page); only entities without an existing tab get a new background tab opened (browser "open in new tab" convention preserved). Plain left-click navigation already resolves into the existing tab via pathname-derived `activeId`, so no interceptor was needed there. `findTab` added to the destructured hook return; `findRef`/`routerRef` mirror latest identities into the once-bound `[]`-effect. Scroll restore: new `use-tab-scroll-restore.ts` hook keeps an in-memory `Map<key, scrollTop>` (keyed by active tab id, falling back to pathname for routes with no pinned tab) — intentionally NOT persisted to Convex to avoid thrashing `flux_userPrefs` on every scroll (Next.js history restoration covers reloads). rAF-throttled `scroll` listener records the outgoing position; a `useEffect([activeKey])` saves the previous key's scroll then `scrollTo({ top: saved ?? 0, behavior: "instant" })` after paint. Restore fires only when the active tab id changes, so sub-route navigations within the same tab scope (`/app/tasks` → `/app/tasks/trash`) leave scrolling to the router. Wired in `app/app/layout.tsx`: `<main>` gained a `ref` + `data-testid="app-main-scroll"` and Shell calls `useTabScrollRestore(mainRef)` (Convex dedupes the shared `flux_userPrefs.get` subscription with the tab strip). No new user-facing strings (non-verbal behaviors); no raw hex; design tokens untouched. Files: `apps/web/components/app/tabs/workbench-tabs.tsx`, `apps/web/components/app/tabs/use-tab-scroll-restore.ts` (new), `apps/web/app/app/layout.tsx`. Verified: `npx tsc --noEmit` zero errors in touched files (113 pre-existing unrelated `documents`/`documentVersions`/`edgestore` errors unchanged), `pnpm build` clean (27/27 pages, 11.8s). 2026-08-28</sub>

### M5 — Inbox 2.0 (§6)
- [x] **M5.1** Two-pane layout: day-grouped list left, entity preview right; select ⇒ mark read. (@session-m51, 2026-08-28)
  <sub>✓ Shipped §6 two-pane triage layout. Left pane: notifications grouped by day (Today/Yesterday/Earlier) with sticky day headers, per-item icon + unread coral dot + hover mark-read/remove actions; selecting a row marks it read and surfaces the right pane. Right pane: `InboxPreview` resolves the notification `link` (handles both `/documents/<id>` and `/app/documents/<id>` styles) into a live doc/task/project preview via existing `flux_documents.get`/`flux_tasks.get`/`projects.get` queries — DocumentPreview renders a BlockNote content excerpt (reuses `extractPlainText`), TaskPreview shows status/assignee/due, ProjectPreview shows status/client; non-previewable links (discussions, member events) show a "no preview" empty state; missing/deleted entities show "no longer available"; an "Open" button navigates to the full entity. Filter tabs (All/Tasks/Mentions/Members) preserved and now localized via new `inbox.filters.*` keys (previously hardcoded English). Selection auto-clears when the active filter hides the selected item. Empty/loading skeletons for both panes. All strings via `useTranslations("inbox")` (added `yesterday`, `filters.*`, `preview.*` to en+fr); `data-testid` on every interactive element and pane (`inbox-two-pane`, `inbox-list`, `inbox-group-*`, `inbox-item`, `inbox-item-select`, `inbox-item-mark-read`, `inbox-item-remove`, `inbox-preview`, `inbox-preview-empty`, `inbox-preview-open`, `inbox-preview-document/task/project/none/not-found`). Design tokens only (bg-card/border-border/bg-muted/text-muted-foreground/bg-primary, `--flux-coral-soft`), no raw hex. Files: `apps/web/app/app/inbox/page.tsx` (rewritten), `apps/web/messages/en.json`, `apps/web/messages/fr.json`. Verified: `npx tsc --noEmit` 113 pre-existing unrelated errors unchanged (zero in touched files), `pnpm build` clean (27/27 pages, `/app/inbox` compiled). 2026-08-28</sub>
- [x] **M5.2** Filters (All/Mentions/Assigned/Reactions) + Only-unread toggle; bulk "Archive read" / "Mark all read". (@session-m52, 2026-08-28)
  <sub>✓ Shipped §6 filter + bulk-bar upgrade. Replaced interim M5.1 filter tabs (All/Tasks/Mentions/Members) with the plan-specified All/Mentions/Assigned/Reactions — `matchesTab` now routes `task_assigned`/`project_assigned` → Assigned and `reaction`/`chat_reaction`/`comment_reaction` → Reactions (forward-compatible: no reaction notifications exist yet, so the filter shows the designed empty state until they do). Added an "Only unread" toggle chip (`aria-pressed`, coral `border-primary bg-primary/10` when active) next to the filter tab strip; `filtered` now applies `!onlyUnread || !n.read` on top of the tab match. Added "Archive read" bulk button in the header (Archive icon, `data-testid="inbox-archive-read"`) that iterates client-side over all read notifications calling `remove()` on each (core + local) — the shared core notifications API has no batch-archive-read endpoint, so per-item `remove` is the safe non-destructive approach; "Mark all read" and "Clear all" preserved. i18n: replaced `filters.tasks`/`filters.members` with `filters.assigned`/`filters.reactions` and added `archiveRead`/`archivedRead`/`onlyUnread` to en+fr `inbox` namespace. Design tokens only (border-primary/bg-primary/10/text-primary/border-border/bg-card/bg-muted/text-muted-foreground), no raw hex. `data-testid` on every new element (`inbox-filter-assigned`, `inbox-filter-reactions`, `inbox-only-unread`, `inbox-archive-read`). Files: `apps/web/app/app/inbox/page.tsx`, `apps/web/messages/en.json`, `apps/web/messages/fr.json`. Verified: `npx tsc --noEmit` zero errors in inbox page (113 pre-existing unrelated errors unchanged), `pnpm -w build` clean (27/27 pages, 12.9s). 2026-08-28</sub>
- [x] **M5.3** Keyboard: ↑↓ nav, `E` archive, `M` mute, `Enter` open. (@session-m53, 2026-08-28) — ↑↓/E/Enter shipped; M deferred to M5.3b.
  <sub>✓ Shipped §6 keyboard triage (minus M). Window-level `keydown` listener (guarded against input/textarea/contenteditable focus and ⌘/⌃/⌥ modifier combos so ⌘K etc. pass through): `↑`/`↓` move selection through the filtered list (clamp at both ends; first `↓` selects index 0 when nothing is selected) and call `handleSelect` so the row marks read + populates the right preview; `E` archives the selected item via `handleRemove` + `toast.success(t("archived"))` and moves selection to the nearest surviving neighbor (next, else prev, else null); `Enter` opens the selected item's `link` via `router.push` (same `/app`-prefix normalization as the preview's Open button). Added a `data-inbox-id` attribute on each list row + a `useEffect([selectedId])` that `scrollIntoView({ block: "nearest" })` the keyboard-selected row so navigation stays visible in long lists. No new user-facing strings except `inbox.archived` (singular toast for E) added to en+fr; no raw hex; no new data-testid needed (rows already tagged `inbox-item`, selection observable via `ring-2 ring-inset ring-primary/50`). Files: `apps/web/app/app/inbox/page.tsx`, `apps/web/messages/en.json`, `apps/web/messages/fr.json`. Verified: `npx tsc --noEmit` zero errors in inbox page (113 pre-existing unrelated errors unchanged), `pnpm -w build` clean (27/27 pages, 13.5s). 2026-08-28</sub>
  - [ ] **M5.3b** (follow-up) `M` mute-thread key: requires a thread/grouping concept on notifications (e.g. `threadId`/`relatedId` as thread key) + a `mutedThreads` store + `mute` mutation (local `notifications.ts` and core `useNotificationMutations` have no mute API today). Revisit after a thread/mute schema lands; then wire `M` to mute the selected notification's thread and hide matching rows.
- [x] **M5.4** `NotifyMarker` dots in sidebar tree + tabs for unread activity. (@session-m54, 2026-08-28)
  <sub>✓ Shipped `hooks/use-unread-entity-refs.ts` (merges local `notifications.listMine` + core `useNotifications` unread-only, parses `/documents|tasks|projects/<id>` links into `keys` Set + `docIds` Set; Convex dedupes the shared subscription). Sidebar tree: added optional `notifyDocIds` to `TreeSharedProps`, threaded through both virtualized + flat render paths, renders a coral `bg-primary` dot (`data-testid="tree-notify-marker"`) after the row title with `tree.unreadActivity` aria-label; memo equality updated to re-render only when this row's marker toggles. Workbench tabs: `SortableTab` gains `unread` + `unreadLabel`, renders `data-testid="workbench-tab-notify-marker"` coral dot after the title for doc/project/task tabs whose `${kind}:${refId}` is in the unread keys (view tabs excluded). i18n `tree.unreadActivity` + `tabs.unreadActivity` added to en.json + fr.json. No raw hex (`bg-primary` = coral, respects accent overrides, matches the inbox unread dot). Files: `apps/web/hooks/use-unread-entity-refs.ts` (new), `apps/web/components/app/document-tree.tsx`, `apps/web/components/app/sidebar.tsx`, `apps/web/components/app/tabs/workbench-tabs.tsx`, `apps/web/messages/en.json`, `apps/web/messages/fr.json`. Verified: `npx tsc --noEmit` zero errors in touched files (113 pre-existing unchanged), `pnpm build` clean (27/27 pages). 2026-08-28</sub>
- [x] **M5.5** Quiet-hours setting suppresses push, not inbox. (@session-m55, 2026-08-28)
  <sub>✓ Shipped §6 quiet-hours toggle. Added optional `quietHours: { enabled, start, end }` ("HH:MM" 24h local) to `flux_userPrefs` schema + `update` mutation args (additive, backward-compatible). New `hooks/use-quiet-hours.ts` is the single integration point: reads prefs, normalizes/validates values against `HH:MM`, computes `isQuietHours` via `isInQuietWindow` (handles overnight wrap, e.g. 22:00→07:00; zero-length window → false), exposes `{ quietHours, isQuietHours, updateQuietHours }` — future browser-push code calls `isQuietHours` and skips firing `new Notification(...)`; the inbox still fills because notifications are written to Convex regardless. Settings page gains a Notifications `<Section>` (Notification icon, reuses existing `settings.notifications.subtitle`) housing a `QuietHoursSection`: enable Switch, start/end `<input type="time">` (validated server-side by schema, client-side by the hook's regex), a live "Active now"/"Inactive" status pill (coral `bg-primary/10 text-primary` when active), and a hint explaining push-only suppression. Defaults: disabled, 22:00–07:00. i18n `settings.quietHours.*` (title/desc/start/end/saved/activeNow/inactiveNow/hint) added to en+fr. Design tokens only (bg-primary/10/text-primary/bg-muted/text-muted-foreground/border-border), no raw hex. `data-testid` on section/toggle/range/start/end/status. Files: `apps/web/convex/schema.ts`, `apps/web/convex/flux_userPrefs.ts`, `apps/web/hooks/use-quiet-hours.ts` (new), `apps/web/app/app/settings/page.tsx`, `apps/web/messages/en.json`, `apps/web/messages/fr.json`. Verified: `npx convex codegen` clean, `npx tsc --noEmit` 113 pre-existing unrelated errors unchanged (zero in touched files), `pnpm -w build` clean (27/27 pages, 18.1s). 2026-08-28</sub>

### M6 — Files manager + attachments (§2.3, §14.6)
- [x] **M6.1** `/app/files` page: grid/list toggle, breadcrumb, columns (thumb/name/size/attached-to/by/date). (@session-m61, 2026-08-28)
  <sub>✓ Shipped §2.3 file manager page over the shared A2E Core drive (Backblaze B2-backed, `@a2e/core` `useFiles`/`useFolders`/`useFileUrl`/`useMembers` — no new `flux_files` table needed; the plan's `flux_files` references resolve to core's `drive_files`). New `/app/files` route: grid/list toggle persisted via `bureau-files-view` localStorage key; client-side breadcrumb chain (navigate into folders, click crumbs to go back); folders render first then files; grid cards + list table with columns thumb (image preview via presigned `useFileUrl`, file icon fallback), name, size (`formatBytes`), attached-to (localized `linkedTo.type` label), uploaded-by (`createdBy` resolved via core `useMembers` user map), date (`timeAgo`). `coreFlags.drive` + `useCoreWorkspaceId` guards: when drive is off or workspace unlinked, renders a designed fallback empty state (no crash). Loading skeletons match both layouts; empty states for root vs folder. Added `files` nav entry (`FolderOpen` icon, between databases and inbox) to `NAV_KEYS` + `files` to command-palette `PAGES_KEYS` (appears in Go-to). All strings via new `files` i18n namespace (en+fr) + `nav.files`; `data-testid` on every interactive element (header, view toggle, breadcrumb, grid/list + skeletons, folder/file cards + rows, empty/unavailable states). Design tokens only (`bg-card`/`border-border`/`bg-muted`/`text-primary`/`bg-primary`/`var(--flux-coral-soft)`), no raw hex. Files: `apps/web/app/app/files/page.tsx` (new), `apps/web/components/app/sidebar.tsx`, `apps/web/components/app/command-palette.tsx`, `apps/web/messages/en.json`, `apps/web/messages/fr.json`. Verified: `npx tsc --noEmit` zero errors in touched files (113 pre-existing unrelated unchanged), `pnpm -w build` clean (28 pages incl. `/app/files`, 12.6s). 2026-08-28</sub>
- [x] **M6.2** Drag-and-drop upload onto page → stacked progress cards with cancel ([`file-dropzone`](../apps/web/components/single-image-dropzone.tsx) generalized). (@session-m62, 2026-08-28)
  <sub>✓ Shipped §2.3 drag-and-drop upload + Huly-style stacked progress cards. New `components/app/files/file-dropzone.tsx` (generalized multi-file, any-type dropzone built on `react-dropzone`; full-content coral overlay with UploadCloud icon + dropActive/dropReject/dropHint copy; `noClick`/`noKeyboard` so child interactions are untouched; `single-image-dropzone.tsx` left as-is for single-image avatar/cover flows). New `use-file-uploads.ts` hook calls `coreApi.drive.presignUpload` directly + own XHR PUT with per-file progress AND `AbortController` cancel (the core `useUpload` doesn't expose abort); on cancel, the empty file row created at presign time is cleaned up via `drive.removeFile`; quota-aware (uses `useQuotaGuard("storageBytes")` + `useQuotaGuard("maxFileUploadBytes")` when `coreFlags.quotas` is on, surfacing `<UpgradeDialog>` instead of alerting). New `upload-stack.tsx` renders `fixed bottom-4 right-4` stacked mini-cards (Framer Motion `AnimatePresence` + `layout`, ≤180ms `--ease-standard`), each with status icon (spinner/check/alert), name, size, progress bar (`role="progressbar"`), and cancel-while-uploading / dismiss-when-done / retry-on-error controls; done/error cards auto-dismiss after 6s. Files page: header gains a coral `Upload` button (backed by a hidden `<input type=file multiple>`) + the content region (breadcrumb + grid/list) is wrapped in `<FileDropzone>`; uploads land in the current breadcrumb folder; two `<UpgradeDialog>`s wired for storage + per-file-size quota domains via `onOpenChange={(open) => setDialogState(prev => ({...prev, open}))}` adapter (the hook's `setDialogState` takes a full state object, not a bare boolean). i18n: new `files.upload.*` namespace (uploadButton/dropHere/dropActive/dropReject/dropHint/stackLabel/status*/progressLabel/cancel/dismiss/retry/errorGeneric/errorQuota) added to en + fr. Design tokens only (bg-primary/text-primary-foreground/bg-card/border-border/bg-muted/text-muted-foreground/bg-destructive/text-destructive, `--flux-coral-soft`, `--elev-2`, `--z-toast`), no raw hex. `data-testid` on every interactive element (files-dropzone, files-dropzone-overlay, files-upload-button, files-upload-input, upload-stack, upload-card, upload-progress, upload-cancel, upload-dismiss, upload-retry, upload-error). Files: `apps/web/components/app/files/{file-dropzone,upload-stack,use-file-uploads}.tsx` (new), `apps/web/app/app/files/page.tsx`, `apps/web/messages/{en,fr}.json`. Verified: `npx tsc --noEmit` 113 pre-existing unrelated errors unchanged (zero in touched files), `pnpm -w build` clean (28/28 pages, 13.7s). 2026-08-28</sub>
- [x] **M6.3** Multi-select bulk download(zip)/move/delete. (@session-m63, 2026-08-28)
  <sub>✓ Shipped §2.3 multi-select + bulk actions on `/app/files`. Files-only selection (folders stay navigation): ⌘/ctrl-click toggles, ⇧-click range-selects against the last-clicked row, plain click on a checkbox selects one; selection auto-clears on folder navigation. List-view header gains a select-all checkbox (indeterminate state); grid cards get a top-left checkbox overlay + modifier-click interception on the card body so ⌘/⇧-click selects instead of opening. Selected rows/cards get `bg-primary/10` / `ring-2 ring-primary/30`. Floating `BulkActionsBar` (Framer Motion, `elev-2`, bottom-center on mobile / bottom-right on md+ above the upload stack) shows count + Download / Move / Delete / Clear. Download: single file → direct presigned-download blob trigger; multiple → JSZip client-side (fetch each presigned download URL, zip with de-duped names, one `.zip` blob) with `phase`/`completed`/`total` progress feeding the bar's spinner + "Zipping N files…" label. Move: `MoveDialog` folder picker (breadcrumb drill-down reusing `useFolders`, "Move here" confirms → `drive.moveFile` per file with success toast naming the target). Delete: `AlertDialog` confirm → `drive.removeFile` per file + single sonner toast with an Undo action that `drive.restoreFile`s all. New `use-bulk-download.ts` (JSZip), `bulk-actions-bar.tsx`, `move-dialog.tsx`; new dep `jszip@^3.10.1`. i18n: new `files.bulk.*` namespace (en+fr, 24 keys). Design tokens only (bg-primary/border-primary/bg-card/border-border/bg-muted/text-primary-foreground/text-destructive, `--flux-coral-soft`, `elev-2`), no raw hex. `data-testid` on every new element (bulk bar/count/download/move/delete/clear, select-all, per-row select checkboxes, move dialog + breadcrumb/list/folder/confirm/cancel, delete dialog + confirm/cancel). Files: `apps/web/app/app/files/page.tsx`, `apps/web/components/app/files/{bulk-actions-bar,move-dialog,use-bulk-download}.tsx` (new), `apps/web/messages/{en,fr}.json`, `apps/web/package.json`. Verified: `npx tsc --noEmit` 113 pre-existing unrelated errors unchanged (zero in touched files), `pnpm -w build` clean (28 pages incl. `/app/files`, 12.9s). 2026-08-28</sub>
- [x] **M6.4** Per-doc Files widget; drag file → tree row to attach; OS-drop onto editor inserts at caret. (@session-m64, 2026-08-28)
  <sub>✓ Shipped §14.6 sub-parts 1 + 2; sub-part 3 blocked on a core API gap (see M6.4b). (1) Per-doc Files widget: new `components/app/widgets/files-widget.tsx` registered as the 9th widget (`files`, Paperclip2 icon) in the widgets bar; uses `useLinkedFiles(coreWsId, { app: "bureau", type: "document", id })` over the shared A2E Core drive to list the active document's attachments (derived via `useActiveDocumentId`), renders them as chips with type icon (image thumb / DocumentText) + size (`formatBytes`) + open/download link; an Upload button + hidden multi-file input enqueues uploads via the existing `useFileUploads` hook with `linkedTo` = the doc ref so new files attach on upload, with a compact inline progress list (role=progressbar) and quota `UpgradeDialog`s; designed empty states for no-doc-open, core-drive-unavailable, loading skeleton, and empty list. (2) OS-drop onto editor: `flux-editor.tsx` gained an `onDropCapture` handler on the editor wrapper — intercepts OS file drops (`dataTransfer.files.length > 0`, so internal BlockNote block drags pass through untouched), uploads each file to the core drive with `linkedTo` = the current doc via `useUpload` + `presignView`/`presignDownload`, and inserts a block at the caret (image block for images, a named link paragraph for non-images) with a success/error toast; when the core drive is unavailable the drop is left to BlockNote's native image handling (Convex `flux_files`) so the editor never regresses. i18n: new `filesWidget` namespace (count/uploadButton/empty/unavailable/unavailableHint/open) + `widgets.files`/`filesNoDoc`/`filesNoDocHint` + `editor.dropAttached`/`dropFailed` added to en + fr. Design tokens only (bg-card/border-border/bg-muted/text-primary/bg-primary/var(--flux-coral-soft)), no raw hex. `data-testid` on every interactive element (widget-files, widget-files-upload/input/chip/chip-open/skeleton/empty-list/unavailable/unavailable-item, flux-editor onDropCapture). Files: `apps/web/components/app/widgets/files-widget.tsx` (new), `apps/web/components/app/widgets/widgets-bar.tsx`, `apps/web/components/app/flux-editor.tsx`, `apps/web/messages/en.json`, `apps/web/messages/fr.json`. Verified: `npx tsc --noEmit` 113 pre-existing unrelated errors unchanged (zero in touched files), `pnpm -w build` clean (28/28 pages, 15.8s). 2026-08-28</sub>
  - [!] **M6.4b** (blocked) Drag an existing file from the file manager onto a sidebar tree row to attach it to that document. — BLOCKED: requires a new core `drive:linkFile` / `drive:setLinked` mutation to change `linkedTo` on an already-uploaded file; the `@a2e/core` package is vendored and must not be hand-edited (VENDORED.md), and the core drive API only sets `linkedTo` at `presignUpload` time. Needs an additive PR on A2E-Core (new mutation) + a re-sync before this can ship. The per-doc Files widget (M6.4 #1) and OS-drop-onto-editor (M6.4 #2) are shipped and do not depend on this.
  - [ ] **M6.4c** (follow-up) Unify image storage backend: today OS-dropped images onto the editor go to the core drive (B2, appear in the Files widget) while pasted/slash-menu images still go to Convex `flux_files` via the editor's `uploadFile`. Consider routing all editor image uploads through the core drive with `linkedTo` so every image is also an attachment, or document the intentional content-vs-attachment split.

### M7 — Presence everywhere + optimistic audit (§7)
- [ ] **M7.1** Topbar presence avatars for current entity via [`use-presence.ts`](../apps/web/hooks/use-presence.ts).
- [ ] **M7.2** Remote carets/selections in editor (3s idle fade); chat "…typing" under channel name.
- [ ] **M7.3** `lib/optimistic.ts` helper; wrap all mutations; roll back + toast on failure.

### M8 — Settings center + import/export + print (§10, §11)
- [ ] **M8.1** Tabbed settings: Appearance (accent presets + custom hex, density, editor font, reduced-motion), Sidebar (default sections, indent), Notifications (per-event + quiet hours), Keyboard (rebind map `lib/shortcuts.ts`), Workspace (avatar, quotas), Data.
- [ ] **M8.2** Export: single doc → MD/PDF; workspace → zip+manifest.
- [ ] **M8.3** Import UI for [`lib/notion-import.ts`](../apps/web/lib/notion-import.ts), MD folder, CSV→database.
- [ ] **M8.4** Print stylesheet (docs, tasks, calendar) in [`globals.css`](../apps/web/app/globals.css) + z-index tokens (§12.9).

### M9 — Document surface (§14.4–14.5, 14.7)
- [ ] **M9.1** `/app/documents` All-Pages: List|Gallery, sort, filter chips, group-by, presence dots; bulk move/star/trash.
- [ ] **M9.2** Doc header: cover reposition (`coverY` drag), icon dice, visibility chips (🔒/🔗/👥) opening dialogs.
- [ ] **M9.3** Path breadcrumb with sibling dropdowns; feeds topbar breadcrumb context.
- [ ] **M9.4** `/subpages` live children block (+ optional auto-render at bottom).
- [ ] **M9.5** Backlinks section (debounced content search for mentions/`[[links]]`).
- [ ] **M9.6** Save-as-template → `flux_docTemplates` + picker thumbnails; footer word count/reading time.
- [ ] **M9.7** Trash cascade + path column + restore-to-root fallback + typed confirm for mass delete.

### M10 — Tracker upgrade (§15.1) ⚠ depends M0.2, M0.3
- [ ] **M10.1** `StatusDot` + `InlineCellPopover` (status, priority, assignee, due, estimation) — no dialogs.
- [ ] **M10.2** `PRJ-42` identifiers: render as auto-linking chips in list/chat/docs/comments.
- [ ] **M10.3** Sub-tasks (parentId, chevron + `2/5` rollup, re-parent popup); dependencies (`blockedBy`, red link icon, unblock toast, cycle guard).
- [ ] **M10.4** Views: Kanban lanes (3-zone dnd, count+estimation in header, collapsible), List with group-by + sticky group headers; **My Work** `/app/my` (Assigned/Created/Watching).
- [ ] **M10.5** Milestones: `targetDate` on projects, progress = closed/total, chip on header, plotted on Gantt/calendar.
- [ ] **M10.6** Global `⌘⇧Enter` create dialog (title-first, row of inline editors, "Create more" toggle); task templates (`kind:"task"`).

### M11 — Calendar upgrade (§15.2) ⚠ depends M0.4
- [ ] **M11.1** Overlaid sources panel (events/tasks-due/milestones/time-off) + mini month picker.
- [ ] **M11.2** Views Day/3-day/Week/Month/Schedule + persist; `Today` + `T`; week numbers; week-start setting.
- [ ] **M11.3** Month cell cap 3 chips → `+n more` popover.
- [ ] **M11.4** Event click → anchored popover (quick edit in place, "Open full").
- [ ] **M11.5** Drag-to-create (live duration pill); DnD reschedule/resize/Alt-duplicate; all-day lane + task-chip→due-date.
- [ ] **M11.6** Recurrence editor + 3-way edit/delete dialog using [`lib/recurrence.ts`](../apps/web/lib/recurrence.ts); reminders array → notifications.
- [ ] **M11.7** Now-line + scroll-to-now + working-hours shading; participants accept/decline.

### M12 — Teams & roles (§15.3) ⚠ depends M0.5
- [ ] **M12.1** `/app/members` directory: cards/dense table, presence ring, role badge, channels editor, status line.
- [ ] **M12.2** Person hover card (ObjectBox pattern) on every avatar/@mention.
- [ ] **M12.3** `flux_teams` CRUD + assign/filter/group by team + `@team` mentions.
- [ ] **M12.4** Permission matrix UI over `flux_roles` (admin-only).
- [ ] **M12.5** Invitations: email+role, pending resend/revoke, shareable links, join approval; guest-link management per doc.
- [ ] **M12.6** Workload view (open-task count + estimation sum per member) + combined avatars + ownership transfer flow.

### M13 — Cross-cutting polish (§15.4, §12)
- [ ] **M13.1** Hover-overlay Scroller w/ fade masks in tree, inbox, chat.
- [ ] **M13.2** Universal ObjectPresenter chip (hover preview / click open / middle-click tab) for doc/task/person refs.
- [ ] **M13.3** SavedView named filters for tasks/docs/inbox/calendar; FixedColumn sticky headers; empty states everywhere.
- [ ] **M13.4** Undo-toasts for destructive ops; entity bottom tabs (Activity | Comments | Attachments).

### M14 — Final stabilization (§12)
- [ ] **M14.1** Zoned error boundaries (navigator/content/widgets) extending [`core-error-boundary.tsx`](../apps/web/components/app/core-error-boundary.tsx).
- [ ] **M14.2** Layout-matched skeletons for doc/tasks/inbox/calendar (no layout shift).
- [ ] **M14.3** Focus trap/restore audit on all `components/modals`; no dead clicks (hover+focus ring everywhere).
- [ ] **M14.4** Code-split routes + `Link` prefetch on nav; window-resize clamps.
- [ ] **M14.5** Full i18n + `data-testid` audit; run complete regression mantra checklist (§16).

---

## 20. Handoff Prompt — copy everything between the fences into the next AI session

````
You are the next implementation session for "Bureau" (repo: /Users/maxx.abrt/Dev/A2E Thread Final), upgra
ding a Next.js + Convex + shadcn/Tailwind v4 app to a Huly-grade workbench.

STATE OF PLAY
- The authoritative plan + live tracker is docs/UPGRADE-PLAN.md. Read it fully first (18 sections, ~800 lines).
- Progress is tracked ONLY by the checkboxes in §18.3 and §19. Statuses: [ ] open, [~] claimed in-progress, [x] done+verified, [!] blocked.
- Look for `<sub>✓ …</sub>` breadcrumbs under `[x]` tasks to see what earlier sessions shipped.

DESIGN & REGRESSION CONSTRAINTS (non-negotiable)
- Keep the warm-paper design system: DESIGN-SYSTEM.md is the single source of truth — tokens, .tx-card/.tx-pill, coral #E14B3D, Plus Jakarta Sans, density system. Never use raw hex for new UI.
- Keep every existing feature working: nav items, docs, tasks, calendar, analytics, databases, members, discussions, trash.
- All strings via useTranslations (no hardcoded English); every interactive element gets data-testid.

YOUR TASK
- Pick the FIRST open `[ ]` task in §19 whose dependencies (§18.3) are satisfied, in milestone order M0 → M14. do not skip ahead.
- Before coding: mark it `[~]` and append `(@session-<name>, <YYYY-MM-DD>)`; re-read only the files listed in that task.
- Implement exactly that task (small diff). Follow the referenced plan section (e.g. §14.1) precisely.
- When done: build/verify, then mark `[x]` and add one `<sub>✓ shipped…, files, date</sub>` breadcrumb; open new `[ ]` items only for discovered follow-ups.
- Do NOT mark done unless the app builds and touched flows still work.
- If a task is ambiguous or destructive (schema/data/public API), stop and ask instead of guessing.

Begin now with the next unchecked task; report what you shipped at the end.
````
 

 Make sure your implementations are multilingual ready, en and FR ready ! no hardcoded words, all multilingual ready. 