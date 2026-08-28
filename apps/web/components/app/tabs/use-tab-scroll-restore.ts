"use client";

/**
 * Per-tab scroll restoration (§4 / §12.8).
 *
 * The main content scroll container remembers its `scrollTop` per workbench
 * tab and restores it when the user switches tabs. Scroll positions are kept
 * in an in-memory `Map` (keyed by tab id, falling back to the pathname when
 * the current route has no pinned tab) — they are intentionally NOT persisted
 * to Convex, because writing `scrollTop` to `flux_userPrefs.tabs` on every
 * scroll would thrash the backend and roam a value that is only meaningful
 * for the current viewport/session. Next.js' own history scroll restoration
 * covers cross-session reloads; this hook covers in-session tab switching.
 *
 * Restore fires only when the active tab id actually changes, so sub-route
 * navigations within the same tab scope (e.g. `/app/tasks` → `/app/tasks/trash`
 * — both match the same tab via `isTabActive`) leave scrolling to the router.
 */
import { useEffect, useRef, type RefObject } from "react";
import { usePathname } from "next/navigation";
import { useWorkbenchTabs } from "./use-workbench-tabs";
import { isTabActive } from "./tab-href";

export function useTabScrollRestore(scrollRef: RefObject<HTMLElement | null>) {
  const pathname = usePathname();
  const { tabs } = useWorkbenchTabs();

  // Active tab id for the current pathname (null when the route has no tab).
  const activeId =
    tabs.find((tb) => isTabActive(tb, pathname))?.id ?? null;
  // Key under which the current view's scroll is stored. Routes without a
  // pinned tab still get per-route memory via the pathname.
  const activeKey = activeId ?? pathname;

  const scrollMap = useRef<Map<string, number>>(new Map());
  // Mirror the active key into a ref so the (once-attached) scroll listener
  // always records under the latest key without re-binding on every change.
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;

  // Save scrollTop (rAF-throttled) while the user scrolls the main container.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        scrollMap.current.set(activeKeyRef.current, el.scrollTop);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
    };
  }, [scrollRef]);

  // Restore on tab switch: save the outgoing key's position (in case a
  // programmatic navigation bypassed the scroll listener) then scroll the
  // incoming key's container to its remembered position. Runs after paint so
  // the routed content has its new height before we set scrollTop.
  const prevKeyRef = useRef<string | null>(activeKey);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prevKey = prevKeyRef.current;
    if (prevKey !== null && prevKey !== activeKey) {
      scrollMap.current.set(prevKey, el.scrollTop);
    }
    prevKeyRef.current = activeKey;
    const saved = scrollMap.current.get(activeKey);
    const raf = requestAnimationFrame(() => {
      el.scrollTo({ top: saved ?? 0, behavior: "instant" as ScrollBehavior });
    });
    return () => cancelAnimationFrame(raf);
  }, [activeKey, scrollRef]);
}
