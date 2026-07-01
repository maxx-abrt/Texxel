"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { timeAgo } from "@/components/app/common";
import { Activity } from "iconsax-reactjs";

const ACTION_ICONS: Record<string, string> = {
  "task.created": "✅",
  "task.deleted": "🗑️",
  "task.updated": "✏️",
  "event.created": "📅",
  "document.created": "📄",
  "document.updated": "📝",
  "project.created": "📁",
  "member.joined": "👋",
};

function actionLabel(action: string, meta?: any): string {
  const base = action.split(".").join(" ");
  const title = meta?.title ?? meta?.name ?? "";
  return title ? `${base} "${title}"` : base;
}

interface ActivityPanelProps {
  targetType: string;
  targetId: string;
}

export function ActivityPanel({ targetType, targetId }: ActivityPanelProps) {
  const { activeWorkspaceId } = useWorkspace();
  const items = useQuery(
    api.activities.listByTarget,
    activeWorkspaceId
      ? { workspaceId: activeWorkspaceId, targetType, targetId }
      : "skip",
  );

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <Activity variant="Bulk" size={28} className="mb-2 opacity-40" />
        <p className="text-xs">No history yet.</p>
      </div>
    );
  }

  return (
    <ol className="relative ml-3 border-l border-border">
      {items.map((item: any) => (
        <li key={item._id} className="mb-5 ml-5">
          <span className="absolute -left-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-[11px]">
            {ACTION_ICONS[item.action] ?? "•"}
          </span>
          <div className="flex items-start gap-2">
            <Avatar className="mt-0.5 h-6 w-6 shrink-0 border border-border">
              <AvatarImage src={item.actor?.image} />
              <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                {(item.actor?.name ?? item.actor?.email ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs">
                <span className="font-semibold">{item.actor?.name ?? item.actor?.email ?? "Someone"}</span>{" "}
                <span className="text-muted-foreground">{actionLabel(item.action, item.metadata)}</span>
              </p>
              <time className="text-[11px] text-muted-foreground">{timeAgo(item.createdAt)}</time>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
