"use client";

import { useSearchParams } from "next/navigation";
import { ChatPanel } from "@/components/app/chat-panel";
import { ShowChatBubbleButton } from "@/components/app/chat-bubble";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { useEffect } from "react";

export default function DiscussionsPage() {
  const searchParams = useSearchParams();
  const channelId = searchParams.get("channel");
  const { activeWorkspaceId } = useWorkspace();

  useEffect(() => {
    // Reveal the floating bubble when visiting the discussions page.
    if (typeof window !== "undefined") {
      localStorage.setItem("chat-bubble-hidden", "false");
      window.dispatchEvent(new StorageEvent("storage", { key: "chat-bubble-hidden" }));
    }
  }, []);

  if (!activeWorkspaceId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading workspace...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <h1 className="text-lg font-semibold">Discussions</h1>
        <ShowChatBubbleButton />
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatPanel channelId={channelId ?? undefined} className="h-full" />
      </div>
    </div>
  );
}
