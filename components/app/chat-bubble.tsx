"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { ChatPanel } from "./chat-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { MessageSquare, X, MessageCircleMore } from "lucide-react";

const BUBBLE_SIZE = 56;
const DROP_SIZE = 90;
const STORAGE_KEY = "chat-bubble-hidden";
const POS_KEY = "chat-bubble-pos";

interface BubblePos {
  x: number;
  y: number;
}

export function ChatBubble() {
  const { activeWorkspaceId } = useWorkspace();
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [draggingOverTrash, setDraggingOverTrash] = useState(false);
  const [pos, setPos] = useState<BubblePos>({ x: 24, y: 24 });
  const startRef = useRef<{ x: number; y: number; bx: number; by: number } | null>(null);
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

  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;

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
    setDragging(true);
    setOpen(false);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    const next = {
      x: Math.max(0, Math.min(vw - BUBBLE_SIZE, startRef.current.bx + dx)),
      y: Math.max(0, Math.min(vh - BUBBLE_SIZE, startRef.current.by + dy)),
    };
    setPos(next);
    const nearTrash =
      next.x >= vw - DROP_SIZE - 16 && next.y >= vh - DROP_SIZE - 16;
    setDraggingOverTrash(nearTrash);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    startRef.current = null;
    setDragging(false);
    if (draggingOverTrash) {
      setDraggingOverTrash(false);
      setOpen(false);
      saveHidden(true);
    } else {
      savePos(pos);
    }
  };

  const onClick = () => {
    if (!dragging) setOpen((o) => !o);
  };

  if (hidden) return null;

  return (
    <>
      {/* Trash drop zone */}
      {dragging && (
        <div
          className={cn(
            "fixed bottom-4 right-4 z-40 flex items-center justify-center rounded-full border-2 transition-all",
            draggingOverTrash
              ? "border-destructive bg-destructive/20 text-destructive scale-110"
              : "border-muted bg-background/80 text-muted-foreground",
          )}
          style={{ width: DROP_SIZE, height: DROP_SIZE }}
        >
          <X size={32} />
        </div>
      )}

      {/* Floating bubble */}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onClick}
        className={cn(
          "fixed z-50 flex items-center justify-center rounded-full shadow-2xl transition-transform",
          dragging ? "cursor-grabbing scale-110" : "cursor-grab hover:scale-105",
          open ? "bg-primary text-primary-foreground" : "bg-primary text-primary-foreground",
        )}
        style={{
          left: pos.x,
          top: pos.y,
          width: BUBBLE_SIZE,
          height: BUBBLE_SIZE,
        }}
        aria-label="Open discussions"
      >
        {open ? <MessageCircleMore size={24} /> : <MessageSquare size={24} />}
        {!open && (unread ?? 0) > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
            {unread! > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Expanded panel */}
      {open && (
        <div
          className="fixed z-40 flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
          style={{
            width: 360,
            height: 520,
            bottom: 24,
            right: 24,
          }}
        >
          <ChatPanel
            className="h-full w-full"
            onClose={() => setOpen(false)}
          />
        </div>
      )}
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
