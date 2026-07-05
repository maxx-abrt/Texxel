"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTranslations } from "next-intl";
import { Activity } from "iconsax-reactjs";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

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

export function ActivityFeed({ limit = 100 }: { limit?: number }) {
  const { activeWorkspaceId } = useWorkspace();
  const t = useTranslations("activity");
  const activities = useQuery(
    api.activities.list,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId, limit } : "skip",
  );

  const ACTION_MAP: Record<string, string> = {
    "task.created": t("actions.task.created" as any),
    "task.deleted": t("actions.task.deleted" as any),
    "task.updated": t("actions.task.updated" as any),
    "event.created": t("actions.event.created" as any),
    "document.created": t("actions.document.created" as any),
    "document.updated": t("actions.document.updated" as any),
    "project.created": t("actions.project.created" as any),
    "member.joined": t("actions.member.joined" as any),
  };

  const actionLabel = (action: string, meta?: any): string => {
    const base = ACTION_MAP[action] ?? action.replace(".", " ");
    const title = meta?.title ?? meta?.name ?? "";
    return title ? `${base} "${title}"` : base;
  };

  if (!activities || activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Activity variant="Bulk" size={32} className="mb-3 opacity-40" />
        <p className="text-sm">{t("empty")}</p>
      </div>
    );
  }

  return (
    <ol className="relative ml-3 border-l border-border">
      {activities.map((item: any) => (
        <li key={item._id} className="mb-6 ml-6">
          <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-sm">
            {ACTION_ICONS[item.action] ?? "•"}
          </span>
          <div className="flex items-start gap-2.5">
            <Avatar className="mt-0.5 h-7 w-7 shrink-0 border border-border">
              <AvatarImage src={item.actor?.image} />
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {(item.actor?.name ?? item.actor?.email ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-semibold">{item.actor?.name ?? item.actor?.email ?? "Someone"}</span>{" "}
                <span className="text-muted-foreground">{actionLabel(item.action, item.metadata)}</span>
              </p>
              <time className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</time>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
