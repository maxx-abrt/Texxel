/**
 * Feature flags controlling how much of Bureau reads & writes through the
 * shared A2E Core deployment instead of this app's local Convex tables.
 *
 * Policy (July 2026): **core-first**. Every flag defaults to ON; set the env var
 * to `"0"` to fall back to the legacy local-only path for one module (escape
 * hatch for incidents / local debugging).
 *
 *   NEXT_PUBLIC_A2E_CORE_TASKS=0   → tasks read/write locally again
 *
 * On top of the env config, flags can be switched off **at runtime for the
 * current tab** when a core call fails (see `disableCoreModules`, called by
 * <CoreErrorBoundary>): a shared-backend hiccup must never take a page down, it
 * degrades to this app's local data instead. That is why `coreFlags` exposes
 * getters — every read is evaluated live, so existing `coreFlags.x` call sites
 * pick the change up on the next render without any refactor.
 *
 * NOTE: each var must be referenced *literally* (`process.env.NEXT_PUBLIC_…`)
 * so Next can inline it at build time — never read them dynamically.
 */
const on = (value: string | undefined) => value !== "0";

const SESSION_KEY = "a2e_core_disabled";

const disabled = new Set<string>();

function hydrateDisabled() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (raw) for (const key of JSON.parse(raw) as string[]) disabled.add(key);
  } catch {
    /* private mode — runtime disabling stays in memory */
  }
}
hydrateDisabled();

function persistDisabled() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify([...disabled]));
  } catch {
    /* ignore */
  }
}

/** Live check used by every getter below. */
const enabled = (module: CoreFlag, envOn: boolean) => envOn && !disabled.has("all") && !disabled.has(module);

/**
 * Turns core off for the rest of this tab's session (all modules by default).
 * Called when a core query/mutation fails so the app keeps working on local data.
 */
export function disableCoreModules(modules: CoreFlag[] | "all" = "all") {
  if (modules === "all") disabled.add("all");
  else for (const m of modules) disabled.add(m);
  persistDisabled();
}

/** Re-enables core (used by the "retry" action of the degraded banner). */
export function resetCoreModules() {
  disabled.clear();
  persistDisabled();
}

/** True when core was switched off at runtime after a failure. */
export function isCoreDegraded() {
  return disabled.size > 0;
}

export const coreFlags = {
  get notifications() {
    return enabled("notifications", on(process.env.NEXT_PUBLIC_A2E_CORE_NOTIFICATIONS));
  },
  get events() {
    return enabled("events", on(process.env.NEXT_PUBLIC_A2E_CORE_EVENTS));
  },
  get tasks() {
    return enabled("tasks", on(process.env.NEXT_PUBLIC_A2E_CORE_TASKS));
  },
  get presence() {
    return enabled("presence", on(process.env.NEXT_PUBLIC_A2E_CORE_PRESENCE));
  },
  get prefs() {
    return enabled("prefs", on(process.env.NEXT_PUBLIC_A2E_CORE_PREFS));
  },
  get search() {
    return enabled("search", on(process.env.NEXT_PUBLIC_A2E_CORE_SEARCH));
  },
  get quotas() {
    return enabled("quotas", on(process.env.NEXT_PUBLIC_A2E_CORE_QUOTAS));
  },
  get roles() {
    return enabled("roles", on(process.env.NEXT_PUBLIC_A2E_CORE_ROLES));
  },
  get activities() {
    return enabled("activities", on(process.env.NEXT_PUBLIC_A2E_CORE_ACTIVITIES));
  },
  get contacts() {
    return enabled("contacts", on(process.env.NEXT_PUBLIC_A2E_CORE_CONTACTS));
  },
  get drive() {
    return enabled("drive", on(process.env.NEXT_PUBLIC_A2E_DRIVE));
  },
};

export type CoreFlag =
  | "notifications"
  | "events"
  | "tasks"
  | "presence"
  | "prefs"
  | "search"
  | "quotas"
  | "roles"
  | "activities"
  | "contacts"
  | "drive";
