/**
 * Feature flags controlling how much of Bureau mobile reads & writes through the
 * shared A2E Core deployment instead of the app's local Convex tables.
 *
 * Policy (July 2026): **core-first** — same as the web app. Every flag defaults
 * to ON; set `EXPO_PUBLIC_A2E_CORE_<MODULE>=0` to fall back to the legacy
 * local-only path for one module (escape hatch for incidents / debugging).
 *
 * Each var is referenced literally so Metro can inline it at build time.
 */
const on = (value: string | undefined) => value !== "0";

export const coreFlags = {
  notifications: on(process.env.EXPO_PUBLIC_A2E_CORE_NOTIFICATIONS),
  events: on(process.env.EXPO_PUBLIC_A2E_CORE_EVENTS),
  tasks: on(process.env.EXPO_PUBLIC_A2E_CORE_TASKS),
  presence: on(process.env.EXPO_PUBLIC_A2E_CORE_PRESENCE),
  prefs: on(process.env.EXPO_PUBLIC_A2E_CORE_PREFS),
  search: on(process.env.EXPO_PUBLIC_A2E_CORE_SEARCH),
  quotas: on(process.env.EXPO_PUBLIC_A2E_CORE_QUOTAS),
  roles: on(process.env.EXPO_PUBLIC_A2E_CORE_ROLES),
  activities: on(process.env.EXPO_PUBLIC_A2E_CORE_ACTIVITIES),
  contacts: on(process.env.EXPO_PUBLIC_A2E_CORE_CONTACTS),
  drive: on(process.env.EXPO_PUBLIC_A2E_DRIVE),
} as const;

export type CoreFlag = keyof typeof coreFlags;
