"use client";

// Right-side chat drawer. Full-screen sheet on mobile, fixed-width drawer on
// desktop. Close lives in the ChatPanel header (plus Escape via the dock).
import { ChatPanel } from "./chat-panel";
import { motion, AnimatePresence } from "framer-motion";

const SPRING = { type: "spring" as const, stiffness: 380, damping: 34 };

export function ChatBubble({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-30 bg-black/25 backdrop-blur-[2px] sm:hidden"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={SPRING}
            className="fixed right-0 top-0 z-40 flex h-dvh w-full flex-col overflow-hidden border-l border-border bg-background shadow-2xl sm:w-[420px] lg:w-[520px]"
            data-testid="chat-drawer"
          >
            <ChatPanel className="h-full w-full" onClose={() => onOpenChange(false)} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
