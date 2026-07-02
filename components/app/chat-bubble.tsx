"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { ChatPanel } from "./chat-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, MessageCircleMore, ChevronDown } from "lucide-react";

const BUBBLE_SIZE = 56;
const DROP_WIDTH = 140;
const DROP_HEIGHT = 64;
const STORAGE_KEY = "chat-bubble-hidden";
const POS_KEY = "chat-bubble-pos";

interface BubblePos {
  x: number;
  y: number;
}

export function ChatBubble() {
  const { activeWorkspaceId } = useWorkspace();
  const t = useTranslations("chat");
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [draggingOverClose, setDraggingOverClose] = useState(false);
  const [pos, setPos] = useState<BubblePos>({ x: 24, y: 24 });
  const startRef = useRef<{ x: number; y: number; bx: number; by: number } | null>(null);
  const movedRef = useRef(false);
  const unread = useQuery(
    api.flux_chat.totalUnread,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );

  useEffect(() => {
    try {
      const h = localStorage.getItem(STORAGE_KEY);
      if (h === "true") setHidden(true);
      const p = localStorage.getItem(POS_KEY);
      if (p) setPos(JSON.parse(p));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setHidden(localStorage.getItem(STORAGE_KEY) === "true");
      }
      if (e.key === POS_KEY) {
        const p = localStorage.getItem(POS_KEY);
        if (p) setPos(JSON.parse(p));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const savePos = (p: BubblePos) => {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(p));
      window.dispatchEvent(new StorageEvent("storage", { key: POS_KEY }));
    } catch {
      /* ignore */
    }
  };

  const saveHidden = (h: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(h));
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
      setHidden(h);
    } catch {
      /* ignore */
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY, bx: pos.x, by: pos.y };
    movedRef.current = false;
    setDragging(true);
    setOpen(false);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (!movedRef.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      movedRef.current = true;
    }
    const next = {
      x: Math.max(0, Math.min(vw - BUBBLE_SIZE, startRef.current.bx + dx)),
      y: Math.max(0, Math.min(vh - BUBBLE_SIZE, startRef.current.by + dy)),
    };
    setPos(next);
    const cx = vw / 2;
    const cy = vh - DROP_HEIGHT / 2 - 24;
    const nearClose =
      Math.abs(next.x + BUBBLE_SIZE / 2 - cx) < DROP_WIDTH / 2 + BUBBLE_SIZE / 2 &&
      Math.abs(next.y + BUBBLE_SIZE / 2 - cy) < DROP_HEIGHT / 2 + BUBBLE_SIZE / 2;
    setDraggingOverClose(nearClose);
  };

  const onPointerUp = () => {
    startRef.current = null;
    setDragging(false);
    if (draggingOverClose) {
      setDraggingOverClose(false);
      setOpen(false);
      saveHidden(true);
      movedRef.current = true;
    } else {
      savePos(pos);
    }
  };

  const onClick = () => {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    setOpen((o) => !o);
  };

  if (hidden) return null;

  return (
    <>
      {/* Bottom-center drop zone */}
      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center justify-center gap-2 rounded-full border-2 px-6 py-3 shadow-xl transition-colors",
              draggingOverClose
                ? "border-destructive bg-destructive/20 text-destructive"
                : "border-muted bg-background/90 text-muted-foreground backdrop-blur",
            )}
            style={{ minWidth: DROP_WIDTH }}
          >
            <X size={20} />
            <span className="text-xs font-medium">{t("hideBubble")}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating bubble */}
      <motion.button
        layout
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "fixed z-50 flex items-center justify-center rounded-full shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragging ? "cursor-grabbing" : "cursor-grab",
          open ? "bg-primary text-primary-foreground" : "bg-primary text-primary-foreground",
        )}
        style={{
          left: pos.x,
          top: pos.y,
          width: BUBBLE_SIZE,
          height: BUBBLE_SIZE,
        }}
        aria-label={open ? t("closeChat") : t("openChat")}
      >
        {open ? <MessageCircleMore size={24} /> : <MessageSquare size={24} />}
        {!open && (unread ?? 0) > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
            {unread! > 99 ? "99+" : unread}
          </span>
        )}
      </motion.button>

      {/* Dockable sidebar */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-30 bg-black/20"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed right-0 top-0 z-40 flex h-dvh w-full flex-col overflow-hidden border-l border-border bg-background shadow-2xl sm:w-[420px] lg:w-[520px]"
            >
              <ChatPanel className="h-full w-full" onClose={() => setOpen(false)} />
              {/* Bottom-center close handle */}
              <button
                onClick={() => setOpen(false)}
                className="absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-muted px-4 py-2 text-xs font-medium text-muted-foreground shadow-sm hover:bg-muted/80"
              >
                <ChevronDown size={14} />
                {t("closeChat")}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export function ShowChatBubbleButton() {
  const t = useTranslations("chat");
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    const check = () => setHidden(localStorage.getItem(STORAGE_KEY) === "true");
    check();
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, []);
  if (!hidden) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        localStorage.setItem(STORAGE_KEY, "false");
        window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
      }}
      className="gap-2"
    >
      <MessageSquare size={14} /> {t("showBubble")}
    </Button>
  );
}
