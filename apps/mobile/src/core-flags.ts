/**
 * Feature flags controlling the gradual migration from Bureau's local Convex
 * tables to the shared A2E Core deployment. Each flag is env-driven
 * (EXPO_PUBLIC_A2E_CORE_<MODULE>=1) and defaults to OFF so legacy behavior
 * is preserved until a phase is explicitly enabled.
 */
export const coreFlags = {
  notifications: process.env.EXPO_PUBLIC_A2E_CORE_NOTIFICATIONS === "1",
  events: process.env.EXPO_PUBLIC_A2E_CORE_EVENTS === "1",
  tasks: process.env.EXPO_PUBLIC_A2E_CORE_TASKS === "1",
  presence: process.env.EXPO_PUBLIC_A2E_CORE_PRESENCE === "1",
  prefs: process.env.EXPO_PUBLIC_A2E_CORE_PREFS === "1",
  search: process.env.EXPO_PUBLIC_A2E_CORE_SEARCH === "1",
  quotas: process.env.EXPO_PUBLIC_A2E_CORE_QUOTAS === "1",
  roles: process.env.EXPO_PUBLIC_A2E_CORE_ROLES === "1",
  activities: process.env.EXPO_PUBLIC_A2E_CORE_ACTIVITIES === "1",
  contacts: process.env.EXPO_PUBLIC_A2E_CORE_CONTACTS === "1",
  drive: process.env.EXPO_PUBLIC_A2E_DRIVE === "1",
} as const;

export type CoreFlag = keyof typeof coreFlags;
