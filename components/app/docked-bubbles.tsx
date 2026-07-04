"use client";

// Stacked floating bubbles (Chat + AI), bottom-right.
//
// Collapsed: a tidy deck (AI tucked behind Chat). Hovering (or first tap on
// touch) fans the deck out into labeled pills. Clicking opens the panel.
// Both panels can be open together on desktop; the stack slides beside the
// chat drawer so nothing overlaps. The stack stays mounted at all times and
// only animates opacity/position, which kills the remount flicker.
//
// Anti-jitter measures:
//  - hover-intent timers (small delay in, generous grace out)
//  - a click guard so a single interaction can't double-toggle
//  - stack collapses right after opening a panel
//  - Escape closes the most recently opened panel (unless a dialog handled it)
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { ChatBubble } from "./chat-bubble";
import { AiPanel } from "./ai-panel";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { MessageSquare, Sparkles, X } from "lucide-react";

export const BUBBLE_SPRING = { type: "spring" as const, stiffness: 420, damping: 32 };
const EXPAND_DELAY = 60;
const COLLAPSE_GRACE = 240;
const CLICK_GUARD_MS = 240;

function Bubble({
  icon: Icon,
  label,
  badge,
  expanded,
  active,
  variant,
  onClick,
  testId,
}: {
  icon: React.ElementType;
  label: string;
  badge?: number;
  expanded: boolean;
  active: boolean;
  variant: "chat" | "ai";
  onClick: () => void;
  testId: string;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.94 }}
      transition={BUBBLE_SPRING}
      onClick={onClick}
      data-testid={testId}
      aria-label={label}
      className={cn(
        "pointer-events-auto relative flex h-14 items-center justify-center overflow-visible rounded-full shadow-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
        expanded ? "px-4" : "w-14",
        variant === "chat"
          ? "bg-primary text-primary-foreground shadow-primary/30"
          : "bg-foreground text-background shadow-black/20",
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
        {active ? <X size={21} /> : <Icon size={21} />}
      </motion.span>
      <motion.span
        initial={false}
        animate={
          expanded
            ? { opacity: 1, width: "auto", marginLeft: 9 }
            : { opacity: 0, width: 0, marginLeft: 0 }
        }
        transition={{ duration: 0.16, ease: "easeOut" }}
        className="overflow-hidden whitespace-nowrap text-sm font-semibold"
      >
        {label}
      </motion.span>
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

  // Touch: tapping anywhere outside the stack collapses it again.
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
    if (!isDesktop) {
      setAiOpen(false);
      track("ai", false);
    }
    setExpanded(false);
    clearTimers();
  }, [isDesktop]);

  const toggleAi = useCallback(() => {
    setAiOpen((prev) => {
      const next = !prev;
      track("ai", next);
      return next;
    });
    if (!isDesktop) {
      setChatOpen(false);
      track("chat", false);
    }
    setExpanded(false);
    clearTimers();
  }, [isDesktop]);

  const guarded = (fn: () => void) => () => {
    const now = Date.now();
    if (now - lastClick.current < CLICK_GUARD_MS) return;
    lastClick.current = now;
    // Touch devices: the first tap on a collapsed deck reveals the options.
    if (isTouchRef.current && !expanded && !chatOpen && !aiOpen) {
      setExpanded(true);
      return;
    }
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
  // Mobile: panels are full-screen, hide the stack. Desktop: hide only when
  // both panels are open (each has its own close button).
  const stackHidden = (!isDesktop && anyOpen) || (isDesktop && chatOpen && aiOpen);
  const drawerW = isLarge ? 520 : 420;
  const stackRight = isDesktop && chatOpen ? drawerW + 16 : 20;
  const fanned = expanded || anyOpen;

  return (
    <>
      <motion.div
        ref={stackRef}
        initial={false}
        animate={{
          opacity: stackHidden ? 0 : 1,
          y: stackHidden ? 20 : 0,
          right: stackRight,
        }}
        transition={BUBBLE_SPRING}
        style={{
          bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))",
          pointerEvents: stackHidden ? "none" : undefined,
        }}
        className="pointer-events-none fixed z-40 flex flex-col items-end"
        onMouseEnter={scheduleExpand}
        onMouseLeave={scheduleCollapse}
        data-testid="bubble-stack"
        data-expanded={fanned}
        data-hidden={stackHidden}
      >
        {/* AI bubble, tucked behind the chat bubble when collapsed */}
        <motion.div
          initial={false}
          animate={{
            marginBottom: fanned ? 10 : -44,
            scale: fanned ? 1 : 0.86,
          }}
          transition={BUBBLE_SPRING}
          className="pointer-events-auto"
          style={{ zIndex: 1 }}
        >
          <Bubble
            icon={Sparkles}
            label={tAi("askAi")}
            expanded={expanded}
            active={aiOpen}
            variant="ai"
            onClick={guarded(toggleAi)}
            testId="bubble-ai"
          />
        </motion.div>
        {/* Chat bubble, front of the deck */}
        <motion.div className="pointer-events-auto" style={{ zIndex: 2 }}>
          <Bubble
            icon={MessageSquare}
            label={tChat("openChat")}
            badge={unread ?? 0}
            expanded={expanded}
            active={chatOpen}
            variant="chat"
            onClick={guarded(toggleChat)}
            testId="bubble-chat"
          />
        </motion.div>
      </motion.div>

      <ChatBubble open={chatOpen} onOpenChange={setChat} />
      <AiPanel open={aiOpen} onOpenChange={setAi} shifted={isDesktop && chatOpen} drawerWidth={drawerW} />
    </>
  );
}
