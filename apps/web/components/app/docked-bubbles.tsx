"use client";

// Floating dock, bottom-right: ONE clean bubble with three dots. On hover
// (or first tap on touch) it divides into two labeled pills - Chat and AI.
// Clicking opens the panel; both panels can be open together on desktop and
// the dock slides beside the chat drawer.
//
// Anti-jitter measures:
//  - hover-intent timers (small delay in, generous grace out)
//  - a click guard so a single interaction can't double-toggle
//  - everything stays mounted; only opacity/scale/position animate
//  - Escape closes the most recently opened panel (unless a dialog handled it)
//
// Cross-app links: other features (command palette, etc.) can open the panels
// by dispatching `bureau:open-chat` / `bureau:open-ai` window events.
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { ChatBubble } from "./chat-bubble";
import { AiPanel } from "./ai-panel";
import { BureauLogo } from "./bureau-logo";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { MessageSquare, X } from "lucide-react";

export const BUBBLE_SPRING = { type: "spring" as const, stiffness: 420, damping: 32 };
const EXPAND_DELAY = 60;
const COLLAPSE_GRACE = 260;
const CLICK_GUARD_MS = 240;

/** Theme-aware brand icon: light-theme asset + dark-theme asset. */
function BrandIcon({
  light,
  dark,
  size = 22,
  alt = "",
}: {
  light: string;
  dark: string;
  size?: number;
  alt?: string;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={light} alt={alt} draggable={false} style={{ width: size, height: size, maxWidth: "none", flexShrink: 0 }} className="select-none dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dark} alt={alt} draggable={false} style={{ width: size, height: size, maxWidth: "none", flexShrink: 0 }} className="hidden select-none dark:block" />
    </>
  );
}

function Pill({
  icon: Icon,
  iconNode,
  label,
  badge,
  active,
  variant,
  onClick,
  testId,
}: {
  icon?: React.ElementType;
  iconNode?: React.ReactNode;
  label: string;
  badge?: number;
  active: boolean;
  variant: "chat" | "ai";
  onClick: () => void;
  testId: string;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={BUBBLE_SPRING}
      onClick={onClick}
      data-testid={testId}
      aria-label={label}
      className={cn(
        "pointer-events-auto relative flex h-12 items-center gap-2 rounded-full px-4 shadow-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variant === "chat"
          ? "bg-primary text-primary-foreground shadow-primary/30"
          : "border border-border bg-background text-foreground shadow-black/10",
        active && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
    >
      <motion.span
        key={active ? "x" : "icon"}
        initial={{ rotate: -60, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.14 }}
        className="flex items-center justify-center"
      >
        {active ? <X size={18} /> : iconNode ?? (Icon ? <Icon size={18} /> : null)}
      </motion.span>
      <span className="whitespace-nowrap text-sm font-semibold">{label}</span>
      {typeof badge === "number" && badge > 0 && (
        <span className="absolute -right-1 -top-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white shadow-sm">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </motion.button>
  );
}

export function DockedBubbles() {
  const { activeWorkspaceId } = useWorkspace();
  const tChat = useTranslations("chat");
  const tAi = useTranslations("ai");

  const [chatOpen, setChatOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true); // >= 640px
  const [isLarge, setIsLarge] = useState(false); // >= 1024px

  const isTouchRef = useRef(false);
  const isDesktopRef = useRef(true);
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClick = useRef(0);
  const openOrder = useRef<("chat" | "ai")[]>([]);
  const stackRef = useRef<HTMLDivElement>(null);

  const unread = useQuery(
    api.flux_chat.totalUnread,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );

  useEffect(() => {
    setMounted(true);
    isTouchRef.current = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    const sm = window.matchMedia("(min-width: 640px)");
    const lg = window.matchMedia("(min-width: 1024px)");
    const apply = () => {
      setIsDesktop(sm.matches);
      isDesktopRef.current = sm.matches;
      setIsLarge(lg.matches);
    };
    apply();
    sm.addEventListener("change", apply);
    lg.addEventListener("change", apply);
    return () => {
      sm.removeEventListener("change", apply);
      lg.removeEventListener("change", apply);
    };
  }, []);

  const clearTimers = () => {
    if (expandTimer.current) clearTimeout(expandTimer.current);
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    expandTimer.current = collapseTimer.current = null;
  };

  const scheduleExpand = useCallback(() => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = null;
    if (expandTimer.current) return;
    expandTimer.current = setTimeout(() => {
      expandTimer.current = null;
      setExpanded(true);
    }, EXPAND_DELAY);
  }, []);

  const scheduleCollapse = useCallback(() => {
    if (expandTimer.current) clearTimeout(expandTimer.current);
    expandTimer.current = null;
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => {
      collapseTimer.current = null;
      setExpanded(false);
    }, COLLAPSE_GRACE);
  }, []);

  useEffect(() => () => clearTimers(), []);

  // Tapping anywhere outside the dock collapses it again (touch).
  useEffect(() => {
    if (!expanded) return;
    const onDown = (e: PointerEvent) => {
      if (stackRef.current && !stackRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [expanded]);

  const track = (panel: "chat" | "ai", open: boolean) => {
    openOrder.current = openOrder.current.filter((p) => p !== panel);
    if (open) openOrder.current.push(panel);
  };

  const toggleChat = useCallback(() => {
    setChatOpen((prev) => {
      const next = !prev;
      track("chat", next);
      return next;
    });
    if (!isDesktopRef.current) {
      setAiOpen(false);
      track("ai", false);
    }
    setExpanded(false);
    clearTimers();
  }, []);

  const toggleAi = useCallback(() => {
    setAiOpen((prev) => {
      const next = !prev;
      track("ai", next);
      return next;
    });
    if (!isDesktopRef.current) {
      setChatOpen(false);
      track("chat", false);
    }
    setExpanded(false);
    clearTimers();
  }, []);

  // Global open events - lets the command palette (and any feature) deep-link
  // into chat / AI without prop drilling.
  useEffect(() => {
    const openChat = () => {
      setChatOpen(true);
      track("chat", true);
      if (!isDesktopRef.current) {
        setAiOpen(false);
        track("ai", false);
      }
      setExpanded(false);
    };
    const openAi = () => {
      setAiOpen(true);
      track("ai", true);
      if (!isDesktopRef.current) {
        setChatOpen(false);
        track("chat", false);
      }
      setExpanded(false);
    };
    window.addEventListener("bureau:open-chat", openChat);
    window.addEventListener("bureau:open-ai", openAi);
    return () => {
      window.removeEventListener("bureau:open-chat", openChat);
      window.removeEventListener("bureau:open-ai", openAi);
    };
  }, []);

  const guarded = (fn: () => void) => () => {
    const now = Date.now();
    if (now - lastClick.current < CLICK_GUARD_MS) return;
    lastClick.current = now;
    fn();
  };

  // Escape closes the most recently opened panel (skip if a dialog already
  // consumed the event, e.g. Radix modals call preventDefault).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const top = openOrder.current[openOrder.current.length - 1];
      if (top === "ai") {
        setAiOpen(false);
        track("ai", false);
      } else if (top === "chat") {
        setChatOpen(false);
        track("chat", false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const setChat = useCallback((open: boolean) => {
    setChatOpen(open);
    track("chat", open);
  }, []);
  const setAi = useCallback((open: boolean) => {
    setAiOpen(open);
    track("ai", open);
  }, []);

  if (!mounted) return null;

  const anyOpen = chatOpen || aiOpen;
  // Mobile: panels are full-screen, hide the dock. Desktop: hide only when
  // both panels are open (each has its own close button).
  const dockHidden = (!isDesktop && anyOpen) || (isDesktop && chatOpen && aiOpen);
  const drawerW = isLarge ? 520 : 420;
  const dockRight = isDesktop && chatOpen ? drawerW + 16 : 20;
  // Divided (two pills) while hovered or while a panel is open (so the active
  // pill shows its X). Otherwise: the single three-dots bubble.
  const divided = expanded || anyOpen;

  const onDotActivate = guarded(() => setExpanded(true));

  return (
    <>
      <motion.div
        ref={stackRef}
        initial={false}
        animate={{
          opacity: dockHidden ? 0 : 1,
          y: dockHidden ? 20 : 0,
          right: dockRight,
        }}
        transition={BUBBLE_SPRING}
        style={{
          bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))",
          pointerEvents: dockHidden ? "none" : undefined,
        }}
        className="pointer-events-none fixed z-40 flex w-14 flex-col items-end"
        onMouseEnter={scheduleExpand}
        onMouseLeave={scheduleCollapse}
        data-testid="bubble-stack"
        data-expanded={divided}
        data-hidden={dockHidden}
      >
        {/* AI pill - appears above */}
        <motion.div
          initial={false}
          animate={
            divided
              ? { opacity: 1, y: 0, scale: 1, height: 48, marginBottom: 10 }
              : { opacity: 0, y: 26, scale: 0.5, height: 0, marginBottom: 0 }
          }
          transition={{ ...BUBBLE_SPRING, delay: divided ? 0.05 : 0 }}
          style={{ pointerEvents: divided && !dockHidden ? "auto" : "none", transformOrigin: "bottom right" }}
          className="flex justify-end"
        >
          <Pill
            iconNode={<BrandIcon light="/brand/syna-light.png" dark="/brand/syna-dark.png" size={20} />}
            label={tAi("askAi")}
            active={aiOpen}
            variant="ai"
            onClick={guarded(toggleAi)}
            testId="bubble-ai"
          />
        </motion.div>

        {/* Chat pill - takes the bubble's place */}
        <motion.div
          initial={false}
          animate={
            divided
              ? { opacity: 1, y: 0, scale: 1, height: 48 }
              : { opacity: 0, y: 10, scale: 0.5, height: 0 }
          }
          transition={BUBBLE_SPRING}
          style={{ pointerEvents: divided && !dockHidden ? "auto" : "none", transformOrigin: "bottom right" }}
          className="flex justify-end"
        >
          <Pill
            icon={MessageSquare}
            label={tChat("openChat")}
            badge={unread ?? 0}
            active={chatOpen}
            variant="chat"
            onClick={guarded(toggleChat)}
            testId="bubble-chat"
          />
        </motion.div>

        {/* The single three-dots bubble (collapsed state) */}
        <motion.button
          initial={false}
          animate={
            divided
              ? { opacity: 0, scale: 0.4, rotate: 90, height: 0, marginTop: 0 }
              : { opacity: 1, scale: 1, rotate: 0, height: 56, marginTop: 0 }
          }
          transition={BUBBLE_SPRING}
          style={{ pointerEvents: divided || dockHidden ? "none" : "auto", transformOrigin: "center" }}
          onClick={onDotActivate}
          onFocus={scheduleExpand}
          aria-label={tChat("openChat")}
          data-testid="bubble-dot"
          className="relative flex h-14 w-14 items-center justify-center overflow-visible rounded-full border border-border bg-background shadow-xl shadow-black/15 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BureauLogo size={32} />
          {(unread ?? 0) > 0 && (
            <span className="absolute -right-1 -top-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white shadow-sm">
              {(unread ?? 0) > 99 ? "99+" : unread}
            </span>
          )}
        </motion.button>
      </motion.div>

      <ChatBubble open={chatOpen} onOpenChange={setChat} />
      <AiPanel open={aiOpen} onOpenChange={setAi} shifted={isDesktop && chatOpen} drawerWidth={drawerW} />
    </>
  );
}
