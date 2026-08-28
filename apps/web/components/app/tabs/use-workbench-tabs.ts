"use client";

/**
 * Workbench tabs hook (§4) — reads/writes `flux_userPrefs.tabs`.
 *
 * Exposes the persisted tab list plus `openTab` / `closeTab` / `reorderTabs` /
 * `findTab`. M4.2 wires middle-click / ⌘-click / ⌘W / ⌘1..9 / dnd reorder to
 * these; M4.3 wires internal link resolution to `findTab`. This hook is the
 * single client surface over the persisted tab list so callers don't drift.
 */

import { useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TabKind, WorkbenchTab, tabId } from "./tab-href";

export function useWorkbenchTabs() {
  const prefs = useQuery(api.flux_userPrefs.get, {});
  const update = useMutation(api.flux_userPrefs.update);

  const tabs: WorkbenchTab[] = useMemo(
    () => (prefs as any)?.tabs ?? [],
    [prefs],
  );

  const writeTabs = useCallback(
    (next: WorkbenchTab[]) => {
      void update({ tabs: next }).catch(() => {});
    },
    [update],
  );

  /** Open (or focus) a tab. Dedup by `tabId(kind, refId)`. */
  const openTab = useCallback(
    (kind: TabKind, refId: string | undefined, title: string, icon?: string) => {
      const id = tabId(kind, refId);
      const tab: WorkbenchTab = { id, kind, refId, title, icon };
      writeTabs(
        tabs.some((t) => t.id === id)
          ? tabs.map((t) => (t.id === id ? { ...t, title, icon } : t))
          : [...tabs, tab],
      );
    },
    [tabs, writeTabs],
  );

  /** Close a tab by id. Returns whether it was active (caller may navigate). */
  const closeTab = useCallback(
    (id: string): boolean => {
      const idx = tabs.findIndex((t) => t.id === id);
      if (idx < 0) return false;
      writeTabs(tabs.filter((t) => t.id !== id));
      return true;
    },
    [tabs, writeTabs],
  );

  /** Reorder tabs (M4.2 horizontal dnd). `next` is the full new order. */
  const reorderTabs = useCallback(
    (next: WorkbenchTab[]) => {
      // Only persist when the id sequence actually changed.
      if (next.length === tabs.length && next.every((t, i) => t.id === tabs[i]?.id)) return;
      writeTabs(next);
    },
    [tabs, writeTabs],
  );

  /**
   * Update a single tab's title in place (M4.2.1). No-ops when the tab is
   * missing or the title is already correct, so callers can fire it on every
   * query result without triggering spurious `flux_userPrefs.update` writes.
   */
  const setTabTitle = useCallback(
    (id: string, title: string) => {
      const idx = tabs.findIndex((t) => t.id === id);
      if (idx < 0) return;
      if (tabs[idx].title === title) return;
      writeTabs(tabs.map((t) => (t.id === id ? { ...t, title } : t)));
    },
    [tabs, writeTabs],
  );

  /** Find an existing tab matching (kind, refId) — used by M4.3 link resolution. */
  const findTab = useCallback(
    (kind: TabKind, refId?: string): WorkbenchTab | undefined =>
      tabs.find((t) => t.kind === kind && t.refId === refId),
    [tabs],
  );

  return { tabs, openTab, closeTab, reorderTabs, setTabTitle, findTab };
}
