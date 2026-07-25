"use client";

import { useSearchParams } from "next/navigation";
import { ChatPanel } from "@/components/app/chat-panel";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { useTranslations } from "next-intl";

export default function DiscussionsPage() {
  const searchParams = useSearchParams();
  const channelId = searchParams.get("channel");
  const { activeWorkspaceId } = useWorkspace();
  const t = useTranslations("chat");

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
        <h1 className="text-lg font-semibold">{t("discussions")}</h1>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatPanel channelId={channelId ?? undefined} className="h-full" />
      </div>
    </div>
  );
}
