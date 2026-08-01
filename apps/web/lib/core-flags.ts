/**
 * Feature flags controlling how much of Texxel/Bureau reads & writes through the
 * shared A2E Core deployment instead of this app's local Convex tables.
 *
 * Policy (July 2026): **core-first**. Every flag defaults to ON; set the env var
 * to `"0"` to fall back to the legacy local-only path for one module (escape
 * hatch for incidents / local debugging).
 *
 *   NEXT_PUBLIC_A2E_CORE_TASKS=0   → tasks read/write locally again
 *
 * NOTE: each var must be referenced *literally* (`process.env.NEXT_PUBLIC_…`)
 * so Next can inline it at build time — never read them dynamically.
 */
const on = (value: string | undefined) => value !== "0";

export const coreFlags = {
  notifications: on(process.env.NEXT_PUBLIC_A2E_CORE_NOTIFICATIONS),
  events: on(process.env.NEXT_PUBLIC_A2E_CORE_EVENTS),
  tasks: on(process.env.NEXT_PUBLIC_A2E_CORE_TASKS),
  presence: on(process.env.NEXT_PUBLIC_A2E_CORE_PRESENCE),
  prefs: on(process.env.NEXT_PUBLIC_A2E_CORE_PREFS),
  search: on(process.env.NEXT_PUBLIC_A2E_CORE_SEARCH),
  quotas: on(process.env.NEXT_PUBLIC_A2E_CORE_QUOTAS),
  roles: on(process.env.NEXT_PUBLIC_A2E_CORE_ROLES),
  activities: on(process.env.NEXT_PUBLIC_A2E_CORE_ACTIVITIES),
  contacts: on(process.env.NEXT_PUBLIC_A2E_CORE_CONTACTS),
  drive: on(process.env.NEXT_PUBLIC_A2E_DRIVE),
} as const;

export type CoreFlag = keyof typeof coreFlags;
