"use client";

/**
 * Workbench tab strip (§4, M4.1 + M4.2).
 *
 * Renders between the topbar and the routed content. Reads the persisted
 * tab list from `flux_userPrefs.tabs` (via `useWorkbenchTabs`), highlights
 * the active tab from the current pathname, and lets the user:
 *   - click a tab → navigate to its href
 *   - middle-click a tab → close it (browser convention)
 *   - close a tab (hover ×) → removed from persistence; if it was active,
 *     focus the neighbour (or fall back to /app)
 *   - drag a tab horizontally → reorder (dnd-kit sortable)
 *   - press the trailing `+` → pin the current route as a `view` tab
 *
 * M4.2 also wires app-wide behaviors from this component (it is always
 * mounted in the shell):
 *   - ⌘W → close the active tab
 *   - ⌘1..9 → jump to tab N
 *   - middle-click / ⌘-click any `/app/...` link outside the tab strip and
 *     the document tree → open that target as a new workbench tab (the tree
 *     keeps its own ⌘-click multi-select from M3.5 via stopPropagation).
 *
 * M4.3 wires internal-link resolution into an existing tab.
 *
 * Design: warm-paper tokens only (bg-background/border-border/bg-muted/
 * bg-primary/text-muted-foreground), 28px row height matching the tree,
 * active marker = 2px bottom `bg-primary` line (mirrors the tree's
 * `bg-primary` insertion indicator). No raw hex.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { Add, CloseCircle } from "iconsax-reactjs";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useUnreadEntityRefs } from "@/hooks/use-unread-entity-refs";
import { useWorkbenchTabs } from "./use-workbench-tabs";
import { WorkbenchTab, isTabActive, tabFromHref, tabHref, viewTabFromPath } from "./tab-href";

/** Known top-level routes → nav i18n key for a friendly view-tab title. */
const VIEW_TITLE_KEYS: Record<string, string> = {
  "/app": "home",
  "/app/tasks": "tasks",
  "/app/projects": "projects",
  "/app/discussions": "discussions",
  "/app/calendar": "calendar",
  "/app/analytics": "analytics",
  "/app/databases": "databases",
  "/app/inbox": "inbox",
  "/app/members": "members",
  "/app/documents": "documents",
  "/app/trash": "trash",
  "/app/settings": "settings",
};

function viewTitle(pathname: string, tNav: (k: string) => string, tTabs: (k: string) => string): string {
  const key = VIEW_TITLE_KEYS[pathname];
  if (key) {
    try {
      return tNav(key);
    } catch {
      /* fall through */
    }
  }
  // Sub-routes: best-effort label from the last segment, capitalized.
  const seg = pathname.replace(/^\/app\/?/, "").split("/")[0] ?? "";
  if (!seg) return tTabs("home");
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

/** Find the closest anchor with an app href, walking up from the target. */
function appAnchorFromTarget(target: EventTarget | null): HTMLAnchorElement | null {
  const el = target as HTMLElement | null;
  if (!el) return null;
  const a = el.closest("a") as HTMLAnchorElement | null;
  if (!a) return null;
  const href = a.getAttribute("href");
  if (!href || !href.startsWith("/app")) return null;
  return a;
}

export function WorkbenchTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("tabs");
  const tNav = useTranslations("nav");
  const { tabs, openTab, closeTab, reorderTabs, setTabTitle, findTab } = useWorkbenchTabs();

  // §6 / M5.4: unread-activity refs for NotifyMarker dots on entity tabs.
  const { keys: unreadKeys } = useUnreadEntityRefs();

  const activeId = useMemo(
    () => tabs.find((tb) => isTabActive(tb, pathname))?.id ?? null,
    [tabs, pathname],
  );

  const handleClose = useCallback(
    (tab: WorkbenchTab) => {
      const idx = tabs.findIndex((t) => t.id === tab.id);
      const wasActive = tab.id === activeId;
      closeTab(tab.id);
      if (wasActive) {
        const neighbour = tabs[idx - 1] ?? tabs[idx + 1] ?? null;
        const href = neighbour ? tabHref(neighbour) : null;
        router.push(href ?? "/app");
      }
    },
    [tabs, activeId, closeTab, router],
  );

  const handlePinCurrent = useCallback(() => {
    const view = viewTabFromPath(pathname);
    if (!view) return;
    openTab("view", view.refId, viewTitle(pathname, tNav, t));
  }, [pathname, openTab, tNav, t]);

  const currentPinned = useMemo(
    () => tabs.some((t) => t.id === tabIdView(pathname)),
    [tabs, pathname],
  );

  // --- M4.2: ⌘W close active tab + ⌘1..9 jump to tab N (app-wide) ----------
  // Keep a ref of the latest tabs/activeId/closeTab so the single keydown
  // listener never goes stale across re-renders.
  const stateRef = useRef({ tabs, activeId, handleClose });
  stateRef.current = { tabs, activeId, handleClose };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘W / ctrl+W → close the active tab. preventDefault so the browser
      // doesn't close the window/tab when the page is allowed to handle it.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "w") {
        const { activeId, handleClose, tabs } = stateRef.current;
        if (activeId) {
          e.preventDefault();
          const tab = tabs.find((t) => t.id === activeId);
          if (tab) handleClose(tab);
        }
        return;
      }
      // ⌘1..9 → jump to tab N (1-indexed).
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        const n = Number(e.key) - 1;
        const { tabs } = stateRef.current;
        const tab = tabs[n];
        if (tab) {
          const href = tabHref(tab);
          if (href) {
            e.preventDefault();
            router.push(href);
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  // --- M4.2/M4.3: middle-click / ⌘-click an app link → open or focus a tab -
  // Bubble-phase window listeners: the document tree (M3.5) calls
  // stopPropagation on its own ⌘-click handler, so those never reach here and
  // tree multi-select stays intact. The tab strip is excluded explicitly so
  // middle-clicking a tab closes it (handled per-row) rather than re-opening.
  //
  // M4.3 (§4 "resolve into an already-open tab"): if the target entity is
  // already pinned as a tab, middle/⌘-click focuses it (navigates to its href)
  // instead of calling `openTab`, which would dedup-no-op and leave the user
  // on the current page. Only entities without an existing tab get a new
  // background tab opened (browser "open in new tab" convention — no navigate).
  const openRef = useRef(openTab);
  openRef.current = openTab;
  const findRef = useRef(findTab);
  findRef.current = findTab;
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    // Resolve a middle/⌘-click target: focus an existing tab when present,
    // otherwise open a new background tab. Returns true if handled.
    const resolveTarget = (href: string): boolean => {
      const tab = tabFromHref(href);
      if (!tab) return false;
      const existing = findRef.current(tab.kind, tab.refId);
      if (existing) {
        const h = tabHref(existing);
        if (h) routerRef.current.push(h);
      } else {
        openRef.current(tab.kind, tab.refId, tab.title);
      }
      return true;
    };
    // Middle-click (auxclick, button 1) on an app anchor → focus/open tab.
    const onAuxClick = (e: MouseEvent) => {
      if (e.button !== 1) return;
      if (e.target instanceof HTMLElement && e.target.closest('[data-testid="workbench-tabs"]')) return;
      const a = appAnchorFromTarget(e.target);
      if (!a) return;
      e.preventDefault();
      resolveTarget(a.getAttribute("href") ?? "");
    };
    // ⌘/ctrl-click an app anchor → focus/open tab (tree rows excluded via
    // their own stopPropagation in bubble phase; tab strip excluded explicitly).
    const onClick = (e: MouseEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;
      if (e.target instanceof HTMLElement && e.target.closest('[data-testid="workbench-tabs"]')) return;
      const a = appAnchorFromTarget(e.target);
      if (!a) return;
      e.preventDefault();
      resolveTarget(a.getAttribute("href") ?? "");
    };
    window.addEventListener("auxclick", onAuxClick);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("auxclick", onAuxClick);
      window.removeEventListener("click", onClick);
    };
  }, []);

  // --- M4.2: horizontal dnd reorder --------------------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const from = tabs.findIndex((t) => t.id === active.id);
      const to = tabs.findIndex((t) => t.id === over.id);
      if (from < 0 || to < 0) return;
      reorderTabs(arrayMove(tabs, from, to));
    },
    [tabs, reorderTabs],
  );

  // --- M4.2: overflow fade masks -----------------------------------------
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const updateEdge = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdge({ left: el.scrollLeft > 1, right: el.scrollLeft < max - 1 });
  }, []);
  useEffect(() => {
    updateEdge();
  }, [tabs.length, updateEdge]);

  return (
    <div
      className="flex h-9 items-stretch gap-0.5 border-b border-border bg-background px-2"
      data-testid="workbench-tabs"
    >
      {/* M4.2.1: sync real entity titles into doc/project tabs whose title is
          still the placeholder returned by `tabFromHref`. One headless
          observer per entity tab; each no-ops once the title matches. */}
      {tabs.map((tab) =>
        tab.kind === "doc" || tab.kind === "project" ? (
          <TabTitleSync key={`sync-${tab.id}`} tab={tab} onTitle={setTabTitle} />
        ) : null,
      )}
      <div className="relative flex min-w-0 flex-1 items-stretch">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={tabs.map((t) => t.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div
              ref={scrollRef}
              onScroll={updateEdge}
              className="flex min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto"
              data-testid="workbench-tabs-scroll"
            >
              {tabs.length === 0 ? (
                <div className="flex items-center px-2 text-xs text-muted-foreground" data-testid="workbench-tabs-empty">
                  {t("emptyHint")}
                </div>
              ) : (
                tabs.map((tab) => (
                  <SortableTab
                    key={tab.id}
                    tab={tab}
                    active={tab.id === activeId}
                    unread={
                      tab.kind !== "view" && tab.refId
                        ? unreadKeys.has(`${tab.kind}:${tab.refId}`)
                        : false
                    }
                    unreadLabel={t("unreadActivity")}
                    closeLabel={t("close", { title: tab.title })}
                    noRouteLabel={t("noRoute")}
                    onClose={handleClose}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </DndContext>
        {/* Edge fade masks (Huly Scroller) — only when that side can scroll. */}
        {edge.left && (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-background to-transparent"
            aria-hidden
            data-testid="workbench-tabs-mask-left"
          />
        )}
        {edge.right && (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-background to-transparent"
            aria-hidden
            data-testid="workbench-tabs-mask-right"
          />
        )}
      </div>
      <button
        type="button"
        onClick={handlePinCurrent}
        disabled={currentPinned || !pathname.startsWith("/app")}
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
          "hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent",
        )}
        aria-label={t("pinCurrent")}
        title={t("pinCurrent")}
        data-testid="workbench-tab-pin-current"
      >
        <Add size={16} />
      </button>
    </div>
  );
}

interface SortableTabProps {
  tab: WorkbenchTab;
  active: boolean;
  /** §6 / M5.4: show a coral NotifyMarker dot when the tab's entity has unread activity. */
  unread: boolean;
  unreadLabel: string;
  closeLabel: string;
  noRouteLabel: string;
  onClose: (tab: WorkbenchTab) => void;
}

function SortableTab({ tab, active, unread, unreadLabel, closeLabel, noRouteLabel, onClose }: SortableTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
  });
  const href = tabHref(tab);
  const disabled = !href;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onAuxClick={(e) => {
        // Middle-click on a tab closes it (browser convention).
        if (e.button === 1) {
          e.preventDefault();
          e.stopPropagation();
          onClose(tab);
        }
      }}
      className={cn(
        "group relative flex h-7 cursor-grab touch-none select-none items-center rounded-md px-2 transition-colors active:cursor-grabbing",
        active
          ? "bg-muted text-foreground"
          : disabled
            ? "text-muted-foreground/60"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        isDragging && "z-10 opacity-80 shadow-[var(--elev-2)]",
      )}
      data-testid="workbench-tab"
      data-tab-id={tab.id}
      data-active={active ? "true" : "false"}
      data-dragging={isDragging || undefined}
    >
      {href ? (
        <Link
          href={href}
          className="min-w-0 flex-1"
          aria-current={active ? "page" : undefined}
          onClick={(e) => {
            // Let normal left-click navigate; the global listener handles
            // ⌘/ctrl-click (open new tab) and we stopPropagation so the dnd
            // listeners on the row don't treat a plain click as a drag start
            // artifact. Middle-click is handled by onAuxClick above.
            if (e.metaKey || e.ctrlKey) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {tab.icon && <span className="text-sm leading-none" aria-hidden>{tab.icon}</span>}
            <span className="truncate text-xs font-medium">{tab.title}</span>
            {unread && (
              <span
                aria-label={unreadLabel}
                title={unreadLabel}
                data-testid="workbench-tab-notify-marker"
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              />
            )}
          </span>
        </Link>
      ) : (
        <span className="min-w-0 flex-1 cursor-default" title={noRouteLabel}>
          <span className="flex min-w-0 items-center gap-1.5">
            {tab.icon && <span className="text-sm leading-none" aria-hidden>{tab.icon}</span>}
            <span className="truncate text-xs font-medium">{tab.title}</span>
            {unread && (
              <span
                aria-label={unreadLabel}
                title={unreadLabel}
                data-testid="workbench-tab-notify-marker"
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              />
            )}
          </span>
        </span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose(tab);
        }}
        onAuxClick={(e) => {
          // Don't let a middle-click on the close button bubble to the row's
          // close handler (it would close twice / navigate).
          if (e.button === 1) {
            e.preventDefault();
            e.stopPropagation();
            onClose(tab);
          }
        }}
        className={cn(
          "ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground transition-opacity",
          "opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100",
        )}
        aria-label={closeLabel}
        data-testid="workbench-tab-close"
      >
        <CloseCircle variant="Bulk" size={14} />
      </button>
      {active && (
        <span
          className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-primary"
          data-testid="workbench-tab-active-marker"
          aria-hidden
        />
      )}
    </div>
  );
}

function tabIdView(pathname: string): string {
  const v = viewTabFromPath(pathname);
  return v?.id ?? "";
}

/**
 * Headless observer (M4.2.1) that resolves a doc/project tab's real entity
 * title from Convex and persists it via `setTabTitle`. Renders nothing — it
 * only fires the side-effect when the fetched title differs from the tab's
 * current title (the `setTabTitle` callback no-ops on a match, so there are
 * no spurious writes). Queries are skipped for tabs without a usable `refId`
 * or for kinds other than doc/project.
 */
function TabTitleSync({
  tab,
  onTitle,
}: {
  tab: WorkbenchTab;
  onTitle: (id: string, title: string) => void;
}) {
  const docId = tab.kind === "doc" && tab.refId ? (tab.refId as Id<"flux_documents">) : null;
  const projectId = tab.kind === "project" && tab.refId ? (tab.refId as Id<"projects">) : null;

  const doc = useQuery(api.flux_documents.get, docId ? { documentId: docId } : "skip");
  const project = useQuery(api.projects.get, projectId ? { projectId } : "skip");

  useEffect(() => {
    if (doc && typeof doc.title === "string" && doc.title !== tab.title) {
      onTitle(tab.id, doc.title);
    }
  }, [doc, tab.id, tab.title, onTitle]);

  useEffect(() => {
    if (project && typeof project.name === "string" && project.name !== tab.title) {
      onTitle(tab.id, project.name);
    }
  }, [project, tab.id, tab.title, onTitle]);

  return null;
}
