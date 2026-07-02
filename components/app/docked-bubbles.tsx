"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { ChatBubble } from "./chat-bubble";
import { AiPanel } from "./ai-panel";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Sparkles } from "lucide-react";

const BUBBLE_SIZE = 56;

interface DockedBubbleProps {
  icon: React.ElementType;
  label: string;
  badge?: number;
  color: "primary" | "secondary";
  expanded: boolean;
  offset: { x: number; y: number };
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function DockedBubble({
  icon: Icon,
  label,
  badge,
  color,
  expanded,
  offset,
  onClick,
  onDragStart,
  onDragEnd,
}: DockedBubbleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const primary = color === "primary";

  return (
    <motion.button
      layout
      drag
      dragMomentum={false}
      dragElastic={0.1}
      dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
      dragSnapToOrigin
      whileHover={!isDragging ? { scale: 1.05 } : undefined}
      whileTap={!isDragging ? { scale: 0.95 } : undefined}
      whileDrag={{ scale: 1.08, zIndex: 100, cursor: "grabbing" }}
      onDragStart={() => {
        setIsDragging(true);
        onDragStart();
      }}
      onDragEnd={() => {
        setIsDragging(false);
        onDragEnd();
      }}
      onClick={() => {
        if (!isDragging) onClick();
      }}
      animate={{
        x: expanded ? 0 : offset.x,
        y: expanded ? 0 : offset.y,
        width: expanded ? "auto" : BUBBLE_SIZE,
        height: BUBBLE_SIZE,
        paddingLeft: expanded ? 18 : 0,
        paddingRight: expanded ? 18 : 0,
      }}
      transition={{
        type: "spring",
        stiffness: 320,
        damping: 26,
      }}
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-full shadow-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
        primary
          ? "bg-primary text-primary-foreground shadow-primary/30"
          : "bg-secondary text-secondary-foreground shadow-secondary/30",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
      aria-label={label}
    >
      <Icon size={22} />
      <AnimatePresence>
        {expanded && (
          <motion.span
            initial={{ opacity: 0, width: 0, marginLeft: 0 }}
            animate={{ opacity: 1, width: "auto", marginLeft: 10 }}
            exit={{ opacity: 0, width: 0, marginLeft: 0 }}
            transition={{ duration: 0.18 }}
            className="whitespace-nowrap text-sm font-semibold"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      {typeof badge === "number" && badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
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
  const [dragging, setDragging] = useState(false);
  const [mounted, setMounted] = useState(false);

  const unread = useQuery(
    api.flux_chat.totalUnread,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const anyOpen = chatOpen || aiOpen;
  if (!mounted || anyOpen) {
    return (
      <>
        {chatOpen && <ChatBubble open={chatOpen} onOpenChange={setChatOpen} />}
        {aiOpen && <AiPanel open={aiOpen} onOpenChange={setAiOpen} />}
      </>
    );
  }

  return (
    <>
      <motion.div
        className="fixed bottom-5 right-5 z-50 flex flex-col items-end"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => {
          if (!dragging) setExpanded(false);
        }}
      >
        <motion.div
          layout
          className={cn("flex flex-col items-end transition-all", expanded ? "gap-3" : "gap-0")}
          animate={{ gap: expanded ? 12 : 0 }}
        >
          <DockedBubble
            icon={MessageSquare}
            label={tChat("openChat")}
            badge={unread ?? 0}
            color="primary"
            expanded={expanded}
            offset={{ x: -10, y: -10 }}
            onClick={() => setChatOpen(true)}
            onDragStart={() => setDragging(true)}
            onDragEnd={() => setDragging(false)}
          />
          <DockedBubble
            icon={Sparkles}
            label={tAi("askAi")}
            color="secondary"
            expanded={expanded}
            offset={{ x: 10, y: 10 }}
            onClick={() => setAiOpen(true)}
            onDragStart={() => setDragging(true)}
            onDragEnd={() => setDragging(false)}
          />
        </motion.div>
      </motion.div>
      <ChatBubble open={chatOpen} onOpenChange={setChatOpen} />
      <AiPanel open={aiOpen} onOpenChange={setAiOpen} />
    </>
  );
}
