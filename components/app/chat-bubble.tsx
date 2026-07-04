"use client";

import { ChatPanel } from "./chat-panel";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

export function ChatBubble({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("chat");

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30 bg-black/20 sm:hidden"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed right-0 top-0 z-40 flex h-dvh w-full flex-col overflow-hidden border-l border-border bg-background shadow-2xl sm:w-[420px] lg:w-[520px]"
          >
            <ChatPanel className="h-full w-full" onClose={() => onOpenChange(false)} />
            <button
              onClick={() => onOpenChange(false)}
              className="absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-muted px-4 py-2 text-xs font-medium text-muted-foreground shadow-sm hover:bg-muted/80"
            >
              <ChevronDown size={14} />
              {t("closeChat")}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
