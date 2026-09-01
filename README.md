# Bureau

> Your second brain. Notes, tasks, projects, calendar, databases, chat and
> accounting in one calm, real-time workspace, on the web and in your pocket.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Expo](https://img.shields.io/badge/Expo-SDK%2054-20232a?logo=expo&logoColor=white)](https://expo.dev/)
[![Convex](https://img.shields.io/badge/Convex-real--time-1e1b4b?logo=convex&logoColor=white)](https://convex.dev/)
[![WorkOS](https://img.shields.io/badge/WorkOS-AuthKit-6366f1?logo=workos&logoColor=white)](https://workos.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10-f69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Turborepo](https://img.shields.io/badge/Turbo-2-ef4444?logo=turborepo&logoColor=white)](https://turbo.build/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![BlockNote](https://img.shields.io/badge/BlockNote-0.47-1e293b)](https://www.blocknotejs.org/)
[![License](https://img.shields.io/badge/License-Private-4a4844)](#license)

Bureau is a connected workspace built on a single conviction: the apps you
use every day should feel like one product, not five. Documents, tasks,
projects, calendar, databases, chat, files and accounting share one identity,
one workspace graph and one real-time backend, so a mention in a doc shows up
in your inbox, a task links to a project that links to an invoice, and the
mobile app opens to the exact same state you left on the web.

The repo ships two first-party clients that talk to the same Convex
deployment:

- **`apps/web`** a Next.js 16 (App Router) app on `bureau.a2esuite.com`
- **`apps/mobile`** an Expo SDK 54 app (iOS and Android, `org.a2e.bureau`)

Both consume a vendored client, **`@a2e/core`**, that bridges to a second
shared Convex deployment (the A2E Core) where identity, workspaces, drive,
calendar, tasks, contacts, notifications and federated search live for the
whole A2E suite. One login, two backends, five apps that stay in sync.

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Monorepo layout](#monorepo-layout)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Self-host walkthrough](#self-host-walkthrough)
- [Deploying](#deploying)
- [Mobile authentication](#mobile-authentication)
- [Scripts](#scripts)
- [Keeping `@a2e/core` fresh](#keeping-a2ecore-fresh)
- [Troubleshooting](#troubleshooting)
- [Further reading](#further-reading)
- [License](#license)

---

## Features

### Documents
- BlockNote block editor with slash commands, drag-and-drop blocks and
  BlockNote-compatible JSON stored on the server.
- Nested document tree with fractional-index ordering, icons, covers and
  cover crop repositioning.
- Version history, document templates, table of contents and outline.
- Share via public link, guest edit mode for anonymous visitors, passphrase
  locks (client-side AES-GCM with PBKDF2 key derivation and hints).
- Export to PDF and DOCX, custom workspace font library and per-document
  typography and page setup.
- Inline comment threads anchored to text, with reactions and resolve.
- Real-time presence for both signed-in users and anonymous guests.

### Tasks
- Kanban boards with workspace-custom statuses, colors and "is done" flags.
- Subtasks, dependencies (`blockedBy`), t-shirt estimations and PRJ-42 style
  human identifiers (`projects.key` + per-project `number`).
- Priorities, labels, due/start dates, assignees, comments and a 7-day
  trash bin with a daily cron that hard-deletes expired entries.
- Bulk import, time tracking entries logged against tasks and/or projects.

### Projects
- Status pipeline (planning, active, completed, on_hold), members and leads,
  Gantt chart, milestones and a project health dashboard on the home page.

### Calendar
- Events with project/task linking, color coding, location and reminders.
- Recurrence engine: interval, days of week, monthly position, end-after-N
  and until-date, with exception dates for skipped occurrences.

### Databases
- Notion-style custom databases with table, gallery, kanban and calendar
  views, configurable columns and per-row cells.

### Chat and discussions
- Channels scoped to workspace, project or custom, with public/private
  visibility and posting roles.
- Threaded replies, emoji reactions, @user and @entity mentions, read
  cursors and attachments routed through the core drive.

### Files and drive
- Uploads flow through the A2E Core drive (`@a2e/core` `useUpload`) with
  `sourceApp: "bureau"` attribution, so files are visible to every suite
  app. The workspace font library lives here too.

### Accounting (A2EMoney tables)
- Invoices with line items, tax rates, statuses and client linking.
- Expenses and income, recurring entries, categories and tags.
- Clients directory, book sheets and entries, fiches and grant reports.
- Receipts and linked documents stored in core drive.

### Real-time and workbench
- Live presence avatars, optimistic mutations and a reconnect banner that
  queues changes while the Convex WebSocket is down.
- Workbench shell with persisted tabs, resizable navigator and widgets bar.
- Command palette (Cmd/Ctrl+K) with frecency-ranked history and federated
  search across the suite.
- Inbox, activity feed, mentions, quiet hours and a contribution grid.
- AI assistant panel (Gemini primary, AIML fallback) and a Pomodoro timer.

### Identity, multi-workspace and roles
- WorkOS AuthKit cookie sessions on web, sealed keychain sessions on mobile.
- Multi-workspace, invitations, owner/admin/member/viewer base roles plus
  Discord-style custom roles with granular permissions and teams.
- Entitlements and usage quotas surfaced through an upgrade dialog.

### Mobile
- Expo Router tab shell: Home, Docs, Tasks, Analytics, Profile.
- Detail screens for documents, projects and tasks, inbox and search.
- Sealed session handoff (see [Mobile authentication](#mobile-authentication))
  and Face ID unlock.

### Design system
- "Warm Paper" palette: warm neutrals instead of cold grays, coral brand
  accent, six runtime-selectable accent presets (Coral, Ocean, Mint, Amber,
  Violet, Rose).
- Light and dark themes, Plus Jakarta Sans typography, iconsax Bulk icons
  and lucide primitives, shadcn/ui (new-york) on Radix.
- Full French and English localization via `next-intl` (default `fr`).

---

## Architecture

Bureau runs against **two Convex deployments**, validated by the same
WorkOS access token:

```
+-- apps/web (Next.js) - apps/mobile (Expo) ----------------+
|  own Convex deployment  ->  veracious-reindeer-573        |
|    app-domain tables:                                     |
|      flux_*  (documents, chat, projects, databases, ...)  |
|      a2e_*   (invoices, expenses, clients, books, ...)    |
|                                                            |
|  @a2e/core (packages/a2e-core)  ->  second Convex client   |
|    <CoreProvider> -> <WorkspaceProvider> -> typed hooks    |
+------------------------------------------------------------+
            |  same WorkOS access token validates on both
            v
+-- A2E Core - superb-grasshopper-152 (the shared DB) ------+
| users - workspaces - memberships - invitations - roles     |
| plans/entitlements/usage - drive (B2) - events - tasks     |
| contacts - notifications - activities - comments - links   |
| intents - shares - presence - prefs - search - pushTokens  |
+------------------------------------------------------------+
```

### What lives where

Apply this test before adding a table or field:

> Could another suite app ever read or reference this record?
> Yes -> core. No -> this app. Unsure -> this app plus a `links` row to the
> core entity.

| Domain | Owner | Notes |
|---|---|---|
| users, workspaces, memberships, invitations, roles | core | `useWorkspace()`, `useMembers()`, `useMyPermissions()` |
| plans, entitlements, usage/quotas | core | `useEntitlement()`, `useQuota()` + `UpgradeDialog` |
| files, attachments, fonts, avatars | core drive | `useUpload({ sourceApp: "bureau" })`, `useFileUrl()` |
| calendar events + attendees | core | `useEvents()`, `expandEvents()` |
| tasks, statuses, labels | core | `useTasks()`, `useTaskStatuses()` |
| contacts / people directory | core | `useContacts()`, back-reference via `contactLinks` |
| notifications, activities, comments, presence, prefs, search | core | suite-wide surfaces |
| documents, blocks, templates, versions | app (`flux_documents`) | shared as a pointer via drive + `links` |
| channels, messages, threads | app (`flux_chat*`) | high write volume, app-shaped |
| projects, databases, tags, time entries | app (`flux_*`) | exposed cross-app via `links` / `intents` |
| accounting: books, invoices, expenses, fiches, grant reports | app (`a2e_*`) | clients -> core contacts, receipts -> core drive |

Every core module is flag-enabled and **defaults to ON** in
`apps/web/lib/core-flags.ts`. Set `NEXT_PUBLIC_A2E_CORE_<MODULE>=0` to fall
back to the legacy local path for one module during an incident.

### The additive-only law

Never rename, remove or change the meaning of a shared table, field, index,
function or required arg. Add, dual-write, migrate readers, leave the old
field forever. That is what lets every suite app run a different vendored
version of `@a2e/core` against one live backend.

Read **[`docs/A2E-CORE.md`](./docs/A2E-CORE.md)** before touching anything
shared: the env matrix, the service bridge, the sync workflow and the full
troubleshooting playbook.

---

## Monorepo layout

```
bureau/
+- apps/
|   +- web/          Next.js 16 (App Router) + Convex functions  ->  bureau.a2esuite.com
|   +- mobile/       Expo SDK 54 (Expo Router)                   ->  Bureau (iOS / Android)
+- packages/
|   +- a2e-core/     @a2e/core - shared A2E suite client (vendored, see VENDORED.md)
|   +- api/          @bureau/api - tRPC router shared by web + mobile (WorkOS session bridge)
|   +- ui/           @bureau/ui - "Warm Paper" design tokens, spacing, radii, color helpers
|   +- config/       @bureau/config - shared TypeScript base config
+- docs/
|   +- A2E-CORE.md       shared data layer contract
|   +- UPGRADE-PLAN.md   Huly-inspired workbench upgrade playbook
|   +- ci/               ready-to-use GitHub Actions workflows
+- scripts/
|   +- sync-a2e-core.mjs  refresh packages/a2e-core from upstream
|   +- add-i18n-keys.py   helper for next-intl key extraction
|   +- generate-logos.mjs brand asset generator
+- turbo.json            task pipeline
+- pnpm-workspace.yaml   workspace definition
```

### Web app routes (`apps/web/app/app`)

| Route | Purpose |
|---|---|
| `/` | Dashboard: greeting, quick actions, contribution grid, widgets |
| `/documents` and `/documents/[documentId]` | Document tree and BlockNote editor |
| `/tasks` and `/tasks/trash` | Kanban boards and the 7-day trash bin |
| `/projects` and `/projects/[projectId]` | Projects with Gantt and members |
| `/calendar` | Calendar with recurrence and reminders |
| `/databases` and `/databases/[databaseId]` | Notion-style databases |
| `/discussions` | Channels and threads |
| `/files` | Core drive browser |
| `/inbox` | Notifications and mentions |
| `/activity` | Workspace activity feed |
| `/analytics` | Charts and reports |
| `/members` | Members, roles and teams |
| `/settings` and `/settings/roles` | Workspace and role configuration |
| `/trash` | Restorable deleted documents |

### Convex modules (`apps/web/convex`)

`flux_documents`, `flux_chat`, `flux_projects`, `flux_tasks`,
`flux_taskStatuses`, `flux_databases`, `flux_events`, `flux_presence`,
`flux_comments`, `flux_commentThreads`, `flux_fonts`, `flux_roles`,
`flux_teams`, `flux_time`, `flux_userPrefs`, `global_search`,
`notifications`, `activities`, `invitations`, `users`, `workspaces`,
`projects`, plus the `a2e_*` accounting modules (`a2e_invoices`,
`a2e_expenses`, `a2e_clients`, `a2e_books`, `a2e_fiches`, `a2e_grantReports`,
`a2e_categories`, `a2e_documents`). `coreSync.ts` is the secret-gated
service bridge to the A2E Core deployment.

---

## Tech stack

| Layer | Web | Mobile |
|---|---|---|
| Framework | Next.js 16 (App Router) | Expo SDK 54 + Expo Router |
| Data | Convex (real-time) | Convex (real-time, same deployment) |
| Auth | WorkOS AuthKit (cookie session) | WorkOS AuthKit (sealed keychain session) |
| Typed RPC | tRPC (`@bureau/api`) | tRPC client (`@bureau/api` types) |
| Editor | BlockNote 0.47 | Native block editor (BlockNote-compatible JSON) |
| Icons | iconsax-reactjs (Bulk) + lucide-react | iconsax-react-native (Bulk) |
| Design tokens | `@bureau/ui` | `@bureau/ui` |
| Styling | Tailwind CSS v4 (CSS-first) + shadcn/ui | Native + `@bureau/ui` tokens |
| i18n | next-intl (fr / en) | expo-localization + custom i18n |
| Animations | framer-motion + tw-animate-css | react-native-reanimated |
| Charts | recharts | (web view + native) |
| Package manager | pnpm 10 (corepack) | pnpm 10 (workspace) |
| Build orchestration | Turborepo 2 | Turborepo 2 |

---

## Prerequisites

- **Node.js** >= 20
- **pnpm** 10 (enabled via `corepack enable`)
- A **Convex** account (free tier works) for the app deployment, and
  optionally access to the shared A2E Core deployment
- A **WorkOS** application (User Management + AuthKit)
- An **Expo** account with EAS configured (only for mobile builds)
- Optional: **Resend** (transactional email), **Google Gemini** and/or
  **AIML** API keys (AI assistant), **AWS S3** credentials if you opt out
  of the core drive

---

## Self-host walkthrough

### 1. Clone and install

```bash
git clone <your-fork-url> bureau
cd bureau
corepack enable
pnpm install
```

### 2. Create the app's Convex deployment

From `apps/web`:

```bash
cd apps/web
npx convex dev
```

`convex dev` creates a new deployment, writes `CONVEX_DEPLOYMENT` and
`NEXT_PUBLIC_CONVEX_URL` into `.env.local`, pushes the schema in
`convex/schema.ts` and starts watching your functions. Keep this running in
one terminal while you develop.

### 3. (Recommended) Link the shared A2E Core deployment

Bureau works standalone with all `NEXT_PUBLIC_A2E_CORE_*` flags off, but the
cross-app features (suite-wide identity, drive, federated search, shared
calendar/tasks/contacts) require the A2E Core deployment. If you have
access, set:

```bash
NEXT_PUBLIC_CONVEX_CORE_URL=https://superb-grasshopper-152.eu-west-1.convex.cloud
NEXT_PUBLIC_A2E_CORE_NOTIFICATIONS=1
NEXT_PUBLIC_A2E_CORE_EVENTS=1
NEXT_PUBLIC_A2E_CORE_TASKS=1
NEXT_PUBLIC_A2E_CORE_PRESENCE=1
NEXT_PUBLIC_A2E_CORE_PREFS=1
NEXT_PUBLIC_A2E_CORE_SEARCH=1
NEXT_PUBLIC_A2E_CORE_QUOTAS=1
NEXT_PUBLIC_A2E_CORE_ROLES=1
NEXT_PUBLIC_A2E_CORE_ACTIVITIES=1
NEXT_PUBLIC_A2E_CORE_CONTACTS=1
NEXT_PUBLIC_A2E_DRIVE=1
```

Then add this app's WorkOS client id to the core deployment's
`WORKOS_SUITE_CLIENT_IDS` env var so core trusts its tokens. No code change
on either side.

### 4. Create a WorkOS application

In the WorkOS dashboard:

1. Create a User Management application.
2. Set the redirect URI to `http://localhost:3000/callback` for local dev
   (and `https://<your-domain>/callback` in production).
3. Copy the Client ID and API key into `.env.local`:

```bash
WORKOS_CLIENT_ID=client_xxx
WORKOS_API_KEY=sk_xxx
WORKOS_COOKIE_PASSWORD=change_me_min_32_chars_long_secret
WORKOS_REDIRECT_URI=http://localhost:3000/callback
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`WORKOS_COOKIE_PASSWORD` must be at least 32 characters and is used to seal
the session cookie (web) and the keychain blob (mobile handoff).

### 5. Copy the env templates

The web app reads from `apps/web/.env.local`:

```bash
cp apps/web/.env.example apps/web/.env.local
# fill in the values from steps 2-4 and any optional integrations
```

The mobile app reads from `apps/mobile/.env`:

```bash
cp apps/mobile/.env.example apps/mobile/.env
# EXPO_PUBLIC_API_URL, EXPO_PUBLIC_CONVEX_URL,
# EXPO_PUBLIC_CONVEX_CORE_URL, EXPO_PUBLIC_WORKOS_CLIENT_ID
```

### 6. Set server-only env on the Convex deployment

Some secrets must never be exposed to the browser. Set them on the Convex
deployment directly:

```bash
cd apps/web
npx convex env set A2E_SERVICE_SECRET=$(openssl rand -hex 32)
npx convex env set CONVEX_CORE_URL=https://superb-grasshopper-152.eu-west-1.convex.cloud
```

`A2E_SERVICE_SECRET` authenticates the `coreSync.ts` service bridge that
lets this app's Convex call core Convex server-to-server. It is never a
`NEXT_PUBLIC_` var.

### 7. Run the apps

```bash
# web (Next.js on :3000) - run in one terminal
pnpm dev:web

# Convex dev (schema + functions hot reload) - run in another terminal
cd apps/web && npx convex dev

# mobile (Metro) - run in a third terminal
pnpm dev:mobile
```

Open `http://localhost:3000`, sign in through WorkOS, create a workspace
and you are in. The mobile app can be opened in an iOS simulator or Android
emulator from the Metro dev server.

---

## Deploying

### Web (Vercel + Convex)

1. Push the repo to GitHub and import it into Vercel. Set the root directory
   to `apps/web` (or keep the monorepo root and let Vercel infer it).
2. In the Vercel project settings, add every variable from
   `apps/web/.env.example`. The full matrix:

   | Variable | Where | Value |
   |---|---|---|
   | `NEXT_PUBLIC_CONVEX_URL` | Vercel | your app's Convex URL |
   | `NEXT_PUBLIC_CONVEX_CORE_URL` | Vercel | the A2E Core URL (or omit if standalone) |
   | `NEXT_PUBLIC_A2E_CORE_*`, `NEXT_PUBLIC_A2E_DRIVE` | Vercel | `1` (default ON in code; `0` disables a module) |
   | `WORKOS_CLIENT_ID` / `WORKOS_API_KEY` / `WORKOS_COOKIE_PASSWORD` / `WORKOS_REDIRECT_URI` | Vercel | your WorkOS app credentials |
   | `NEXT_PUBLIC_APP_URL` | Vercel | `https://<your-domain>` |
   | `CONVEX_DEPLOY_KEY` | Vercel | prod deploy key of your Convex deployment |
   | `A2E_SERVICE_SECRET`, `CONVEX_CORE_URL` | **Convex deployment** (`npx convex env set`) | service bridge, never `NEXT_PUBLIC_` |
   | `RESEND_API_KEY`, `RESEND_FROM`, `GEMINI_API_KEY`, `AIML_API_KEY` | Vercel | optional integrations |

3. Deploy the Convex backend:

   ```bash
   cd apps/web
   npx convex deploy --env prod
   ```

4. Deploy the web app on Vercel (a `git push` is enough if auto-deploy is
   on, or use the Vercel dashboard).

### Mobile (EAS Build + Submit)

```bash
cd apps/mobile

# development build (internal distribution)
eas build --profile development --platform ios
eas build --profile development --platform android

# production build
eas build --profile production --platform ios
eas build --profile production --platform android

# submit to the stores
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

`eas.json` ships `development`, `preview` (internal) and `production`
profiles with `autoIncrement` on for production. The bundle id is
`org.a2e.bureau` on both platforms and the URL scheme is `bureau://`.

---

## Mobile authentication

The Expo app never sees the WorkOS API key or a raw refresh token:

1. The app opens `<API>/api/mobile/auth/start?redirect=bureau://auth` in a
   system auth session.
2. WorkOS AuthKit signs the user in and returns to the app's existing
   `/callback` route on the web.
3. `/api/mobile/auth/handoff` re-seals `{ accessToken, refreshToken, user }`
   with `WORKOS_COOKIE_PASSWORD` and deep-links back as
   `bureau://auth?session=<sealed>`.
4. The app stores that opaque blob in the device keychain and swaps it for a
   short-lived access token through `trpc.session.exchange` whenever Convex
   asks for one.

No additional WorkOS redirect URI is required for production, because the
handoff reuses the existing `/callback` route.

---

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run every workspace `dev` task in parallel via Turbo |
| `pnpm dev:web` | Run only the Next.js web app (`apps/web` on `:3000`) |
| `pnpm dev:mobile` | Run only the Expo app (Metro bundler) |
| `pnpm build` | Build every workspace package (`turbo run build`) |
| `pnpm lint` | Lint every workspace package |
| `pnpm typecheck` | Typecheck every workspace package |
| `pnpm clean` | Remove build artifacts and Turbo caches |
| `pnpm sync:core` | Refresh `packages/a2e-core` from upstream (see below) |

Inside `apps/web`: `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm serve`,
`pnpm lint`, `pnpm typecheck`. Inside `apps/mobile`: `pnpm start`,
`pnpm ios`, `pnpm android`, `pnpm web`, `pnpm lint`, `pnpm typecheck`,
`pnpm reset-project`.

---

## Keeping `@a2e/core` fresh

`packages/a2e-core` is a verbatim vendored copy of
`A2E-Core/packages/core` (see
[`packages/a2e-core/VENDORED.md`](./packages/a2e-core/VENDORED.md) for the
rationale). Refresh it with either:

```bash
# from a local checkout of A2E-Core
A2E_CORE_PATH="../A2E Core" pnpm sync:core

# straight from GitHub
GITHUB_TOKEN=ghp_xxx pnpm sync:core --ref v0.3.0
```

For automation, copy the ready-to-use workflow into `.github/workflows`:

```bash
mkdir -p .github/workflows
cp docs/ci/sync-a2e-core.yml .github/workflows/
# then add the repo secret A2E_CORE_TOKEN (read access to maxx-abrt/A2E-Core)
```

It runs weekly, on manual dispatch, or when A2E-Core sends a
`repository_dispatch` (`event_type: a2e-core-release`), typechecks the
vendored copy and opens a PR when it drifted. Enable it once per app repo
and "change core once, every app gets a PR" becomes the default.

---

## Troubleshooting

**Symptom: `Uncaught Error: [CONVEX Q(<module>:<fn>)] Server Error` and the
page says it could not load.**

A core function rejected the call. Nine times out of ten it is an id from
the wrong deployment: core validates `v.id("workspaces")` against its own
database and asserts membership, so passing this app's local workspace id
(or a core id to a local `v.id("flux_*")` arg) is a server error. Rules:

- Every core call takes the id from `useCoreWorkspaceId()` (the local
  workspace's `coreId`, membership-verified), never `useWorkspace()` from
  `@/hooks/use-flux-workspace`.
- Core-sourced rows are tagged `_isCore` in the UI; anything keyed on them
  (comments, subtasks, time entries) must use core, not the local sidecar.
- Members and assignees must come from the same backend as the entity
  (core member ids are not local member ids).

**Where to look, in order:**

1. **Settings, "Espace partage A2E"**
   (`components/app/core-status-card.tsx`): core host, shared session,
   linked workspace id, membership verified, modules running on core. This
   panel answers "is the link healthy?" instantly.
2. **Convex dashboard, core deployment, Logs**: the real error message
   (`Forbidden: you are not a member of this workspace`,
   `Not authenticated`, `User not provisioned yet`,
   `ArgumentValidationError`).
3. **Token trust**: core must accept this app's WorkOS issuer. Core's
   `auth.config.ts` trusts `WORKOS_ISSUER_CLIENT_ID`,
   `WORKOS_CLIENT_ID` and every id in `WORKOS_SUITE_CLIENT_IDS`. Symptom
   when untrusted: all core reads fail (`Not authenticated`), including
   `workspaces.listMine`, and the status panel shows "session: not
   connected".
4. **Link state**: a workspace created before core adoption gets its
   `coreId` from the `WorkspaceLinkBridge` on login; the status panel's
   "link this workspace to core" button forces it for an owner.

**Guaranteed non-regression**: `CoreErrorBoundary` (mounted in
`apps/web/app/app/layout.tsx`) catches any core failure, calls
`disableCoreModules()` and re-renders. The page keeps working on local
data with a banner and a retry instead of dying. Every `coreFlags.*` read
is a live getter, which is what makes that runtime degradation possible
without a refactor.

---

## Further reading

- [`docs/A2E-CORE.md`](./docs/A2E-CORE.md) the shared data layer contract,
  env matrix, service bridge and full troubleshooting playbook
- [`DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md) the Warm Paper design system,
  color tokens, component patterns and structural ideas
- [`docs/UPGRADE-PLAN.md`](./docs/UPGRADE-PLAN.md) the Huly-inspired
  workbench upgrade playbook
- [`packages/a2e-core/VENDORED.md`](./packages/a2e-core/VENDORED.md) why
  `@a2e/core` is vendored and how to keep it in sync
- [`apps/web/.env.example`](./apps/web/.env.example) and
  [`apps/mobile/.env.example`](./apps/mobile/.env.example) the canonical
  environment templates

---

## License

This repository is **private** and distributed under an **UNLICENSED**
license. All packages declare `"private": true` and `"license": "UNLICENSED"`.
No public distribution or contribution is granted. Contact the maintainer
for any usage request.
