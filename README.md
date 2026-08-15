# Bureau

A connected workspace for notes, tasks, projects and team collaboration — web + native mobile,
sharing one real-time Convex backend and one WorkOS identity.

```
bureau/
├── apps/
│   ├── web/          Next.js 16 app (App Router) + Convex functions  → bureau.a2esuite.com
│   └── mobile/       Expo SDK 54 app (Expo Router)                   → Bureau (iOS / Android)
├── packages/
│   ├── a2e-core/     `@a2e/core` — shared A2E suite client (vendored, see VENDORED.md)
│   ├── api/          tRPC router shared by web + mobile (WorkOS session bridge, runtime config)
│   ├── ui/           Design tokens — the "Warm Paper" palette, spacing, radii, colour helpers
│   └── config/       Shared TypeScript base config
├── turbo.json        Task pipeline
└── pnpm-workspace.yaml
```

## Shared data layer (A2E suite)

Identity, workspaces, members/roles, drive, calendar, tasks, contacts,
notifications, activities, comments, presence, prefs and federated search live in
the **shared A2E Core Convex deployment**, consumed through `@a2e/core`
(`packages/a2e-core`). Everything Bureau-specific (documents, chat, projects,
databases, accounting) stays in this app's own Convex deployment.

Read **[`docs/A2E-CORE.md`](./docs/A2E-CORE.md)** before touching anything shared:
what lives where, how to evolve the shared DB once for every suite app, the env
matrix, and `pnpm sync:core`.

## Getting started

```bash
corepack enable
pnpm install

# web (Next.js on :3000) + Convex dev
pnpm dev:web
cd apps/web && npx convex dev

# mobile (Metro)
pnpm dev:mobile
```

## Stack

| Layer         | Web                              | Mobile                                  |
| ------------- | -------------------------------- | --------------------------------------- |
| Framework     | Next.js 16 (App Router)          | Expo SDK 54 + Expo Router               |
| Data          | Convex (real-time)               | Convex (real-time, same deployment)     |
| Auth          | WorkOS AuthKit (cookie session)  | WorkOS AuthKit (sealed keychain session)|
| Typed RPC     | tRPC (`@bureau/api`)             | tRPC client (`@bureau/api` types)       |
| Editor        | BlockNote                        | Native block editor (BlockNote-compatible JSON) |
| Icons         | iconsax-reactjs (Bulk)           | iconsax-react-native (Bulk)             |
| Design tokens | `@bureau/ui`                     | `@bureau/ui`                            |

## Mobile authentication

The Expo app never sees the WorkOS API key or a raw refresh token:

1. the app opens `<API>/api/mobile/auth/start?redirect=bureau://auth` in a system auth session;
2. WorkOS AuthKit signs the user in and returns to the app's **existing** `/callback` route;
3. `/api/mobile/auth/handoff` re-seals `{ accessToken, refreshToken, user }` with
   `WORKOS_COOKIE_PASSWORD` and deep-links `bureau://auth?session=<sealed>`;
4. the app stores that opaque blob in the device keychain and swaps it for a short-lived
   access token through `trpc.session.exchange` whenever Convex asks for one.

No additional WorkOS redirect URI is required for production.

See [`SETUP.md`](./SETUP.md) for the deployment checklist (Vercel, Convex, WorkOS, EAS).
