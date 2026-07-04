"use client";

// Stacked floating bubbles (Chat + AI) bottom-right.
// Collapsed: a neat stacked deck. Hover / tap: the deck fans out with a spring
// and each bubble expands into a labeled pill. Click opens the panel; both
// panels can be open at the same time and the stack slides beside the chat
// drawer on desktop so everything stays reachable.
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { ChatBubble } from "./chat-bubble";
import { AiPanel } from "./ai-panel";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Sparkles, X } from "lucide-react";

const SPRING = { type: "spring" as const, stiffness: 380, damping: 28 };

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
      layout
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      transition={SPRING}
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
      {active ? <X size={21} /> : <Icon size={21} />}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.span
            initial={{ opacity: 0, width: 0, marginLeft: 0 }}
            animate={{ opacity: 1, width: "auto", marginLeft: 9 }}
            exit={{ opacity: 0, width: 0, marginLeft: 0 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden whitespace-nowrap text-sm font-semibold"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
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
  const [isDesktop, setIsDesktop] = useState(true);
  const [isTouch, setIsTouch] = useState(false);

  const unread = useQuery(
    api.flux_chat.totalUnread,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );

  useEffect(() => {
    setMounted(true);
    setIsTouch(typeof window !== "undefined" && "ontouchstart" in window);
    const mq = window.matchMedia("(min-width: 640px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (!mounted) return null;

  const anyOpen = chatOpen || aiOpen;
  // On mobile the open panel is full-screen — hide the stack.
  // On desktop, hide it only when both panels are open (each has its own close).
  const hideStack = (!isDesktop && anyOpen) || (isDesktop && chatOpen && aiOpen);
  // Desktop: slide the stack (and AI panel) left of the chat drawer.
  const drawerW = typeof window !== "undefined" && window.innerWidth >= 1024 ? 520 : 420;
  const rightPx = isDesktop && chatOpen ? drawerW + 16 : 20;

  const openChat = () => {
    if (!isDesktop && aiOpen) setAiOpen(false);
    setChatOpen((o) => !o);
  };
  const openAi = () => {
    if (!isDesktop && chatOpen) setChatOpen(false);
    setAiOpen((o) => !o);
  };

  const handleBubbleClick = (fn: () => void) => {
    // Touch devices: first tap reveals the stack, second tap picks.
    if (isTouch && !expanded && !anyOpen) {
      setExpanded(true);
      return;
    }
    fn();
  };

  return (
    <>
      <AnimatePresence>
        {!hideStack && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0, right: rightPx }}
            exit={{ opacity: 0, y: 16 }}
            transition={SPRING}
            style={{ right: rightPx, bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
            className="pointer-events-none fixed z-50 flex flex-col items-end"
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
            data-testid="bubble-stack"
            data-expanded={expanded}
          >
            {/* AI bubble — tucked behind the chat bubble when collapsed */}
            <motion.div
              layout
              animate={{
                marginBottom: expanded || anyOpen ? 10 : -44,
                scale: expanded || anyOpen ? 1 : 0.86,
                opacity: 1,
              }}
              transition={SPRING}
              className={cn("pointer-events-auto", !expanded && !anyOpen && "-translate-y-0")}
              style={{ zIndex: 1 }}
            >
              <Bubble
                icon={Sparkles}
                label={tAi("askAi")}
                expanded={expanded}
                active={aiOpen}
                variant="ai"
                onClick={() => handleBubbleClick(openAi)}
                testId="bubble-ai"
              />
            </motion.div>
            {/* Chat bubble — front of the deck */}
            <motion.div layout transition={SPRING} className="pointer-events-auto" style={{ zIndex: 2 }}>
              <Bubble
                icon={MessageSquare}
                label={tChat("openChat")}
                badge={unread ?? 0}
                expanded={expanded}
                active={chatOpen}
                variant="chat"
                onClick={() => handleBubbleClick(openChat)}
                testId="bubble-chat"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ChatBubble open={chatOpen} onOpenChange={setChatOpen} />
      <AiPanel open={aiOpen} onOpenChange={setAiOpen} shifted={isDesktop && chatOpen} />
    </>
  );
}
