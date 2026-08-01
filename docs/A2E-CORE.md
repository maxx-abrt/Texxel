# A2E Core — how the shared data layer is wired in this repo

> One suite, one identity, one shared database for everything cross-app.
> This document is the contract for Texxel/Bureau. The suite-wide contract lives
> in `A2E_APP_INTEGRATION_GUIDE.md` (A2E-Core repo) and wins on any conflict.

## 1. Two backends, one login

```
┌─ apps/web (Next.js) · apps/mobile (Expo) ─────────────────────┐
│  own Convex deployment  → veracious-reindeer-573              │
│    app-domain tables: flux_* (docs, chat, projects, …),      │
│                       a2e_*  (books, invoices, expenses, …)  │
│                                                              │
│  @a2e/core (packages/a2e-core)  → second Convex client        │
│    <CoreProvider> → <WorkspaceProvider> → typed hooks        │
└────────────────────────────────────────────────────┘
            │ same WorkOS access token validates on both
            ▼
┌─ A2E Core ─ superb-grasshopper-152 (the shared DB) ──────────┐
│ users · workspaces · memberships · invitations · roles         │
│ plans/entitlements/usage · drive (B2) · events · tasks        │
│ contacts · notifications · activities · comments · links       │
│ intents · shares · presence · prefs · search · pushTokens      │
└────────────────────────────────────────────────────┘
```

The shared database is **already single-instance**: its schema and functions exist
in exactly one place (the A2E-Core repo, deployed once). No app repo ever
redefines a shared table — that is the rule that keeps 5 apps consistent.

## 2. What lives where (decision test)

> *“Could another suite app ever read or reference this record?”* — yes → core,
> no → this app, unsure → this app + a `links` row to the core entity.

| Domain | Owner today | Notes |
|---|---|---|
| users, workspaces, memberships, invitations, roles, permissions | **core** | `useWorkspace()`, `useMembers()`, `useMyPermissions()` |
| plans, entitlements, usage/quotas | **core** | `useEntitlement()`, `useQuota()` + `UpgradeDialog` |
| files (documents attachments, chat attachments, fonts, avatars) | **core drive** | `useUpload({ sourceApp: "bureau", linkedTo })`, `useFileUrl()` |
| calendar events + attendees | **core** | `useEvents()`, `expandEvents()` |
| tasks, task statuses, labels | **core** | `useTasks()`, `useTaskStatuses()` |
| contacts / people directory (incl. `a2e_clients` counterparts) | **core** | `useContacts()`, back-reference via `contactLinks` |
| notifications (the bell), activities, comments, presence, prefs, search | **core** | suite-wide surfaces |
| documents & blocks, doc templates, versions | app (`flux_documents`, …) | shared *as a pointer*: publish/attach through drive + `links` |
| channels, messages, threads | app (`flux_chat`, …) | high write volume, app-shaped |
| projects, databases, tags, time entries | app (`flux_*`) | expose cross-app through `links` / `intents` |
| accounting: books, invoices, expenses, fiches, grant reports | app (`a2e_*`) | clients → core `contacts`, receipts → core drive |

Everything in the *core* rows above is already flag-enabled and **defaults to ON**
(`apps/web/lib/core-flags.ts`); set `NEXT_PUBLIC_A2E_CORE_<MODULE>=0` to fall back
to the legacy local path for one module during an incident.

## 3. Changing the shared database (one place, N apps)

```
1. PR on A2E-Core            → convex/schema.ts + convex/<module>.ts  (additive-only!)
2. packages/core/src/*       → typed hook + coreApi ref + CHANGELOG + version bump
3. npx convex deploy         → the shared DB is live for ALL apps instantly
4. git tag vX.Y.Z
5. each app: `pnpm sync:core` (or let the bot open the PR — §4)
```

Steps 1–3 are the only mandatory ones: the backend is shared, so a new table or
field is available to every app **the moment core is deployed** — no app-side
Convex change, ever.

Step 5 only refreshes the *typed client sugar*. And it is not even blocking:
core functions are addressed by name, so a brand-new core function can be called
from this app immediately via `apps/web/lib/core-api.ts`:

```ts
import { useCoreQuery } from "@a2e/core";
import { coreRef } from "@/lib/core-api";

const deals = useCoreQuery(coreRef.query<{ workspaceId: string }>("crm_deals:list"), { workspaceId });
```

Server-to-server (this app's Convex → core) goes through the secret-gated service
bridge only — `apps/web/convex/coreSync.ts`, `makeFunctionReference("sync:…")`,
`A2E_SERVICE_SECRET` + `CONVEX_CORE_URL` set on the Convex deployment. Same
property: no generated-API import, so core can evolve without touching this repo.

**Additive-only law**: never rename/remove a shared table, field, index, function
or required arg. Add, dual-write, migrate readers, leave the old field forever.
That is what lets 5 apps run different vendored versions against one live backend.

## 4. Keeping the vendored package fresh

`packages/a2e-core` is a verbatim copy of `A2E-Core/packages/core` (see
`packages/a2e-core/VENDORED.md` for the why). Two ways to refresh it:

```bash
A2E_CORE_PATH="../A2E Core" pnpm sync:core        # local checkout
GITHUB_TOKEN=ghp_xxx pnpm sync:core --ref v0.3.0  # straight from GitHub
```

Automated: `docs/ci/sync-a2e-core.yml` is a ready-to-use GitHub Actions workflow
that runs the same script weekly, on manual dispatch, or when A2E-Core sends a
`repository_dispatch` (`event_type: a2e-core-release`) — it typechecks and opens a
PR when the vendored copy drifted. Enable it once per app repo:

```bash
mkdir -p .github/workflows && cp docs/ci/sync-a2e-core.yml .github/workflows/
# then add the repo secret A2E_CORE_TOKEN (read access to maxx-abrt/A2E-Core)
```

(It ships under `docs/ci/` because a PAT without the `workflow` scope cannot push
files into `.github/workflows/` — copy it with your own account once.)
Do that in every suite app and “change core once → every app gets a PR” becomes
the default.

## 5. Should *all* data of *all* apps live in the core deployment?

Short answer: **all _shared_ data — yes, and that is already the design. All data
of every app in a single Convex deployment — no.** Reasons, in order of weight:

1. **Blast radius.** One deployment = one function namespace, one schema
   validation pass, one deploy. A bad migration or a hot query in the CRM would
   take Texxel, Bilan and Drive down together. Today a core deploy is a rare,
   reviewed, additive event; app deploys stay independent and frequent.
2. **No transactional gain.** Convex transactions are per-deployment, and
   cross-app writes are already async by design (`intents`, `links`). Merging
   everything buys no consistency you don't already have.
3. **The additive-only law does not scale to app churn.** Core can never rename
   or drop a field — that is acceptable for ~20 stable shared tables, painful for
   every app's fast-moving domain schema (blocks, messages, invoice lines).
4. **Quotas, indexes, bandwidth.** Per-deployment limits and usage attribution
   stay clean when high-volume app data (chat, editor ops, presence storms) is
   isolated from the shared identity/drive layer.
5. **What you actually want is *one shared graph*, not one bucket** — which is
   what core already gives: same user, same workspaces (same ids everywhere),
   same drive, same calendar/tasks/contacts/notifications, plus `links` +
   `intents` to connect app-owned entities across apps, live, like any Convex
   query.

Practical rule to grow it: the day a *second* app needs a table, promote it to
core (guide §6) instead of copying it. Anything duplicated in two app repos is a
bug. Anything only one app will ever read stays local and is linked.

## 6. Env matrix

| Var | Where | Value |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Vercel (web) | `https://veracious-reindeer-573.eu-west-1.convex.cloud` |
| `NEXT_PUBLIC_CONVEX_CORE_URL` | Vercel (web) | `https://superb-grasshopper-152.eu-west-1.convex.cloud` |
| `NEXT_PUBLIC_A2E_CORE_*`, `NEXT_PUBLIC_A2E_DRIVE` | Vercel (web) | `1` (default ON in code; `0` disables a module) |
| `WORKOS_CLIENT_ID` / `WORKOS_API_KEY` / `WORKOS_COOKIE_PASSWORD` / `WORKOS_REDIRECT_URI` | Vercel (web) | this app's own WorkOS application |
| `CONVEX_DEPLOY_KEY` | Vercel (web) | prod deploy key of `veracious-reindeer-573` |
| `A2E_SERVICE_SECRET`, `CONVEX_CORE_URL` | **this app's Convex deployment** (`npx convex env set`) | service bridge, never `NEXT_PUBLIC_` |
| `EXPO_PUBLIC_CONVEX_URL` / `EXPO_PUBLIC_CONVEX_CORE_URL` / `EXPO_PUBLIC_WORKOS_CLIENT_ID` | EAS / `apps/mobile/.env` | mobile |
| `A2E_CORE_TOKEN` | GitHub repo secret | lets the sync workflow read A2E-Core |

Core-side vars (`WORKOS_SUITE_CLIENT_IDS`, `B2_*`, `WORKOS_ISSUER_CLIENT_ID`) are
set on the core deployment only. Onboarding a new suite app = add its WorkOS
client id to `WORKOS_SUITE_CLIENT_IDS` on core; no code change anywhere.
