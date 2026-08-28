"use client";

// Widgets bar — right dock zone of the 3-zone workbench shell (§1.1, §3).
//
// M1.2 ships the structural skeleton: a Huly-style right dock with two
// variants —
//   • MINI     — a 3.5rem icon rail (calm default; mirrors Huly SidebarMini).
//   • EXPANDED — icon rail + an active-widget panel (~25rem total).
// Variant, active widget and expanded width are persisted via the
// use-sidebar-prefs keys `bureau-widgets-variant` / `bureau-widgets-active` /
// `bureau-widgets-width` (§1.1). `⌘.` cycles the variant (§3, §1.3); a
// `bureau:toggle-widgets` window event toggles it too, mirroring the
// sidebar's `bureau:toggle-sidebar` bridge.
//
// M1.3 adds snap-collapse / edge-hover / resize drag; M1.4 floats the bar
// below 1200px (FLOAT_ASIDE) and collapses it to a floating edge-tab below
// 768px (HIDE_NAVIGATOR) — the navigator already overlays below 768px via
// its existing mobile sheet, so only the widgets bar needs new responsive
// behavior here; M1.6 migrates the docked-bubbles content in; M1.7 plugs
// the seven real widgets (Inbox, Comments, AI, My Tasks, Activity, Pomodoro,
// Presence) into the panel slot rendered below.
//
// Design-system note: uses sidebar tokens (warm paper) — never raw hex. The
// rail width mirrors Huly's `calc(3.5rem + 1px)` SidebarMini.

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePersistedState } from "@/hooks/use-sidebar-prefs";
import { cn } from "@/lib/utils";
import {
  Notification,
  MessageText1,
  Flash,
  TaskSquare,
  Activity,
  Timer1,
  Profile2User,
  Musicnote,
  Paperclip2,
} from "iconsax-reactjs";
import { PanelRightClose, PanelRightOpen, ExternalLink, Link2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InboxWidget } from "./inbox-widget";
import { CommentsWidget } from "./comments-widget";
import { AiWidget } from "./ai-widget";
import { MyTasksWidget } from "./my-tasks-widget";
import { ActivityWidget } from "./activity-widget";
import { PomodoroWidget } from "./pomodoro-widget";
import { PresenceWidget } from "./presence-widget";
import { MusicWidget } from "./music-widget";
import { FilesWidget } from "./files-widget";

type WidgetKey =
  | "inbox"
  | "comments"
  | "ai"
  | "myTasks"
  | "activity"
  | "pomodoro"
  | "presence"
  | "music"
  | "files";

type Variant = "MINI" | "EXPANDED";

// Registry of dockable widgets (§3). M1.7 attaches a real component per entry
// via `renderWidget` below; each reuses an existing component or data layer.
const WIDGETS: { key: WidgetKey; labelKey: WidgetKey; Icon: React.ElementType }[] = [
  { key: "inbox", labelKey: "inbox", Icon: Notification },
  { key: "comments", labelKey: "comments", Icon: MessageText1 },
  { key: "ai", labelKey: "ai", Icon: Flash },
  { key: "myTasks", labelKey: "myTasks", Icon: TaskSquare },
  { key: "activity", labelKey: "activity", Icon: Activity },
  { key: "pomodoro", labelKey: "pomodoro", Icon: Timer1 },
  { key: "presence", labelKey: "presence", Icon: Profile2User },
  { key: "music", labelKey: "music", Icon: Musicnote },
  { key: "files", labelKey: "files", Icon: Paperclip2 },
];

const WIDGET_KEYS = WIDGETS.map((w) => w.key);

// M1.7 — render the real widget component for a key. Each widget reuses an
// existing component or data layer (§3) and is sized for the narrow panel.
function renderWidget(key: WidgetKey) {
  switch (key) {
    case "inbox":
      return <InboxWidget />;
    case "comments":
      return <CommentsWidget />;
    case "ai":
      return <AiWidget />;
    case "myTasks":
      return <MyTasksWidget />;
    case "activity":
      return <ActivityWidget />;
    case "pomodoro":
      return <PomodoroWidget />;
    case "presence":
      return <PresenceWidget />;
    case "music":
      return <MusicWidget />;
    case "files":
      return <FilesWidget />;
  }
}

// Width = total EXPANDED aside width (rail + panel). 25rem default (§1.1).
// Clamp guards against bad persisted values / negative widths (§12.10).
const MIN_W = 320;
const MAX_W = 560;
const DEFAULT_W = 400;
const RAIL_REM = 3.5; // 56px — Huly SidebarMini width
// §1.1 panelstore snap: a resize ending within 12px of MIN_W collapses the
// panel back to the MINI icon rail instead of leaving a useless sliver.
const SNAP_THRESHOLD = 12;
// §1.1 device-adaptive breakpoints (Huly Workbench.svelte constants).
//   HIDE_NAVIGATOR = 768 — navigator floats as overlay sheet (already wired
//     on the sidebar); widgets bar collapses to a floating edge-tab.
//   FLOAT_ASIDE    = 1200 — widgets bar stops docking and floats as an
//     absolutely positioned overlay so it never squeezes the content zone.
const HIDE_NAVIGATOR = 768;
const FLOAT_ASIDE = 1200;

export function WidgetsBar() {
  const t = useTranslations("widgets");

  const [rawVariant, setVariant] = usePersistedState<Variant>(
    "bureau-widgets-variant",
    "MINI",
  );
  const [rawActive, setActive] = usePersistedState<WidgetKey | null>(
    "bureau-widgets-active",
    null,
  );
  const [rawWidth, setWidth] = usePersistedState<number>(
    "bureau-widgets-width",
    DEFAULT_W,
  );

  // M1.6 — per-widget float state: when floated, a widget pops out of the
  // dock as a floating bubble (recreating the docked-bubbles pattern §3).
  // Stored as a map so multiple widgets can float simultaneously.
  const [floatMap, setFloatMap] = usePersistedState<Record<string, boolean>>(
    "bureau-widgets-float",
    {},
  );

  // Normalize persisted values (defensive against corrupt / legacy data).
  const variant: Variant = rawVariant === "EXPANDED" ? "EXPANDED" : "MINI";
  const active: WidgetKey | null =
    rawActive && WIDGET_KEYS.includes(rawActive) ? rawActive : null;
  const width = Math.min(MAX_W, Math.max(MIN_W, Number.isFinite(rawWidth) ? rawWidth : DEFAULT_W));

  // M1.6 — float helpers. A floated widget is rendered as a separate
  // floating panel (below the aside) instead of in the dock. Docking back
  // re-opens the widget in the EXPANDED dock.
  const isFloated = (key: WidgetKey) => !!floatMap[key];
  const floatedWidgets = WIDGETS.filter((w) => isFloated(w.key));
  const toggleFloat = (key: WidgetKey) => {
    setFloatMap((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  };
  const dockWidget = (key: WidgetKey) => {
    setFloatMap((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setVariant("EXPANDED");
    setActive(key);
  };
  const closeFloat = (key: WidgetKey) => {
    setFloatMap((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // A widget is "expanded" in the dock only if it's EXPANDED, has an active
  // widget, and that widget is NOT floated (floated widgets render outside).
  const expanded = variant === "EXPANDED" && active !== null && !isFloated(active);
  const activeWidget = WIDGETS.find((w) => w.key === active) ?? null;

  // Open a widget: from MINI -> EXPANDED + active; toggling the active icon
  // in EXPANDED collapses back to MINI (Huly SidebarMini <-> Expanded feel).
  // If the widget is currently floated, clicking its rail icon docks it back.
  const openWidget = (key: WidgetKey) => {
    if (isFloated(key)) {
      dockWidget(key);
      return;
    }
    if (variant === "MINI") {
      setVariant("EXPANDED");
      setActive(key);
      return;
    }
    if (active === key) {
      setVariant("MINI");
      return;
    }
    setActive(key);
  };

  // Cycle MINI <-> EXPANDED (⌘., §3). Expanding reuses the last active widget
  // or defaults to the first one so the panel is never empty.
  const cycle = () => {
    if (variant === "MINI") {
      setVariant("EXPANDED");
      if (active === null) setActive(WIDGETS[0].key);
    } else {
      setVariant("MINI");
    }
  };

  // ⌘. cycles; `bureau:toggle-widgets` event toggles from anywhere (mirrors
  // the sidebar's `bureau:toggle-sidebar` bridge used by the topbar).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        cycle();
      }
    };
    const onEvt = () => cycle();
    // M1.7.1b — `bureau:open-widget:<key>` opens a specific widget docked
    // (EXPANDED + active, docking it back if it was floated). Mirrors the
    // command-palette / mini-player "Open widget" pattern (§3.1 #4).
    const onOpenWidget = (key: WidgetKey) => {
      if (!WIDGET_KEYS.includes(key)) return;
      if (isFloated(key)) dockWidget(key);
      else {
        setVariant("EXPANDED");
        setActive(key);
      }
      setMobileOpen(true); // no-op on desktop (overlay only shows <768px)
    };
    const openHandlers = WIDGET_KEYS.map((key) => {
      const name = `bureau:open-widget:${key}`;
      const handler = () => onOpenWidget(key);
      window.addEventListener(name, handler);
      return { name, handler };
    });
    window.addEventListener("keydown", onKey);
    window.addEventListener("bureau:toggle-widgets", onEvt);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("bureau:toggle-widgets", onEvt);
      openHandlers.forEach(({ name, handler }) => window.removeEventListener(name, handler));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, active, floatMap]);

  // Keep the persisted width clamped after hydration so reads stay sane.
  useEffect(() => {
    if (rawWidth !== width) setWidth(width);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  // ── Resize drag (§1.1 panelstore) ── left-edge handle, only when EXPANDED.
  // Dragging left grows the panel, dragging right shrinks it. Ending within
  // 12px of MIN_W snaps back to the MINI rail (preserving the last good
  // expanded width for the next expand).
  const [resizing, setResizing] = useState(false);

  // ── Mobile float (§1.1, M1.4) ── below HIDE_NAVIGATOR (768px) the bar is
  // hidden and replaced by a floating edge-tab; tapping the tab opens the
  // whole dock as a fixed overlay (mirrors the navigator's mobile sheet).
  const [mobileOpen, setMobileOpen] = useState(false);
  const startResize = (e: React.MouseEvent) => {
    if (!expanded) return;
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    let currentW = startW;
    setResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      currentW = Math.min(MAX_W, Math.max(MIN_W, startW - (ev.clientX - startX)));
      setWidth(currentW);
    };
    const onUp = () => {
      setResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (currentW <= MIN_W + SNAP_THRESHOLD) {
        setVariant("MINI");
        setWidth(startW);
      }
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const asideWidth = expanded ? `${width}px` : `${RAIL_REM}rem`;

  return (
    <TooltipProvider delayDuration={300}>
      {/* §1.1 / M1.4 — below HIDE_NAVIGATOR (768px) the dock is hidden and a
          floating edge-tab on the right opens it as a fixed overlay. */}
      {!mobileOpen && (
        <button
          type="button"
          data-testid="widgets-mobile-edge-tab"
          aria-label={t("expand")}
          title={t("expand")}
          onClick={() => setMobileOpen(true)}
          className="fixed top-1/2 right-0 z-30 flex h-16 w-7 -translate-y-1/2 items-center justify-center rounded-l-xl bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        >
          <PanelRightOpen size={16} />
        </button>
      )}
      {/* Mobile overlay backdrop — tap to close (mirrors sidebar mobile sheet). */}
      {mobileOpen && (
        <div
          data-testid="widgets-mobile-backdrop"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}
      <aside
        data-testid="widgets-bar"
        data-variant={expanded ? "expanded" : "mini"}
        data-active-widget={active ?? undefined}
        data-mobile-open={mobileOpen || undefined}
        aria-label={t("label")}
        style={{ "--wb-w": asideWidth } as React.CSSProperties}
        className={cn(
          "flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground",
          // <768: hidden unless the mobile edge-tab opened it (fixed overlay).
          mobileOpen
            ? "fixed inset-y-0 right-0 z-50 flex shadow-2xl"
            : "hidden",
          // 768–1200 (HIDE_NAVIGATOR → FLOAT_ASIDE): floating overlay that
          // does not squeeze content. Sits below the topbar (h-16 at md).
          "md:flex md:fixed md:top-16 md:bottom-0 md:right-0 md:z-30 md:shadow-xl",
          // ≥1200 (FLOAT_ASIDE): docked column back in flow (M1.2 behavior).
          "min-[1200px]:static min-[1200px]:inset-auto min-[1200px]:z-auto min-[1200px]:shadow-none min-[1200px]:h-full min-[1200px]:shrink-0",
          "w-[var(--wb-w)] transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
          resizing && "transition-none",
        )}
      >
        {/* §1.1 panelstore: left-edge resize handle (EXPANDED) + edge-hover
            reveal strip (MINI). The handle drags the panel width; ending
            within 12px of MIN_W snaps to MINI. The reveal strip mirrors the
            navigator's: an 8px transparent zone at the left edge that
            highlights on hover and expands on click. */}
        {expanded ? (
          <div
            onMouseDown={startResize}
            data-testid="widgets-resize-handle"
            className={cn(
              "absolute inset-y-0 left-0 z-10 hidden w-1 cursor-col-resize bg-transparent transition-colors hover:bg-primary/30 active:bg-primary/50 md:block",
              resizing && "bg-primary/40",
            )}
          />
        ) : (
          <button
            type="button"
            data-testid="widgets-edge-reveal"
            aria-label={t("expand")}
            title={t("expand")}
            onClick={cycle}
            className="absolute inset-y-0 left-0 z-10 hidden w-2 cursor-pointer bg-transparent transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:block"
          />
        )}
        <div className="flex min-h-0 flex-1">
          {/* Icon rail — always 3.5rem (Huly SidebarMini) */}
          <div
            data-testid="widgets-rail"
            className="flex w-14 shrink-0 flex-col items-center gap-1 py-2"
          >
            {/* Mobile-only close (§1.1 / M1.4): dismisses the floating overlay
                back to the edge-tab. Desktop uses the bottom toggle instead. */}
            <button
              type="button"
              data-testid="widgets-mobile-close"
              aria-label={t("collapse")}
              title={t("collapse")}
              onClick={() => setMobileOpen(false)}
              className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
            >
              <PanelRightClose size={20} className="shrink-0" />
            </button>
            {WIDGETS.map(({ key, labelKey, Icon }) => {
              const isActive = active === key && expanded;
              const floated = isFloated(key);
              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      data-testid={`widgets-nav-${key}`}
                      data-floated={floated || undefined}
                      aria-label={t(labelKey)}
                      aria-pressed={isActive}
                      onClick={() => openWidget(key)}
                      className={cn(
                        "relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                        "hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        isActive
                          ? "bg-sidebar-accent text-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      {isActive && (
                        <span className="absolute inset-y-1.5 right-0 w-[3px] rounded-full bg-primary" />
                      )}
                      <Icon variant="Bulk" size={20} className="shrink-0" />
                      {/* M1.6 — floated indicator dot (coral, top-right) */}
                      {floated && (
                        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" sideOffset={8}>
                    {t(labelKey)}
                  </TooltipContent>
                </Tooltip>
              );
            })}

            {/* Collapse / expand toggle — pinned to the rail bottom */}
            <div className="mt-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-testid="widgets-toggle"
                    aria-label={expanded ? t("collapse") : t("expand")}
                    aria-expanded={expanded}
                    onClick={cycle}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors",
                      "hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    )}
                  >
                    {expanded ? (
                      <PanelRightClose size={20} className="shrink-0" />
                    ) : (
                      <PanelRightOpen size={20} className="shrink-0" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" sideOffset={8}>
                  {expanded ? t("collapse") : t("expand")}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Active-widget panel — rendered only when EXPANDED (§3).
              M1.7 swaps this empty state for the real widget components.
              M1.6 adds the float toggle (pop-out-to-bubble, §3). */}
          {expanded && activeWidget && !isFloated(activeWidget.key) && (
            <div
              data-testid="widgets-panel"
              className="flex min-w-0 flex-1 flex-col border-l border-sidebar-border"
            >
              <div className="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border px-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <activeWidget.Icon variant="Bulk" size={16} />
                </span>
                <span className="truncate text-sm font-semibold text-sidebar-foreground">
                  {t(activeWidget.labelKey)}
                </span>
                <button
                  type="button"
                  data-testid="widgets-panel-float"
                  aria-label={t("float")}
                  title={t("float")}
                  onClick={() => toggleFloat(activeWidget.key)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <ExternalLink size={15} />
                </button>
                <button
                  type="button"
                  data-testid="widgets-panel-close"
                  aria-label={t("collapse")}
                  onClick={cycle}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <PanelRightClose size={16} />
                </button>
              </div>

              {/* M1.7 — real widget content (§3). Each widget reuses an
                  existing component/data layer and fills the panel slot. */}
              <div className="flex min-h-0 flex-1 flex-col">
                {renderWidget(activeWidget.key)}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* M1.6 — Floated widget panels (§3 pop-out-to-bubble). Each floated
          widget renders as a fixed-position floating panel at the bottom-right
          of the viewport, recreating the docked-bubbles pattern. The panel has
          a dock-back button (Link2 icon) and a close button. M1.7 renders the
          same real widget component as the docked panel into both contexts. */}
      <AnimatePresence>
        {floatedWidgets.map((widget, index) => {
          // Stack floated panels: each one sits 12px above the previous.
          const bottomOffset = 20 + index * 12;
          return (
            <motion.div
              key={widget.key}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.9 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              data-testid={`widgets-float-${widget.key}`}
              data-float-index={index}
              style={{ bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))` }}
              className="fixed right-5 z-40 flex w-[var(--wb-w)] max-h-[70dvh] flex-col overflow-hidden rounded-2xl border border-border bg-sidebar text-sidebar-foreground shadow-xl"
            >
              <div className="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border px-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <widget.Icon variant="Bulk" size={16} />
                </span>
                <span className="truncate text-sm font-semibold text-sidebar-foreground">
                  {t(widget.labelKey)}
                </span>
                <button
                  type="button"
                  data-testid={`widgets-float-${widget.key}-dock`}
                  aria-label={t("dock")}
                  title={t("dock")}
                  onClick={() => dockWidget(widget.key)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Link2 size={15} />
                </button>
                <button
                  type="button"
                  data-testid={`widgets-float-${widget.key}-close`}
                  aria-label={t("collapse")}
                  onClick={() => closeFloat(widget.key)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <PanelRightClose size={16} />
                </button>
              </div>
              <div
                data-testid={`widgets-float-${widget.key}-content`}
                className="flex min-h-60 flex-1 flex-col"
              >
                {renderWidget(widget.key)}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </TooltipProvider>
  );
}
