"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNotifications, useNotificationMutations } from "@a2e/core";
import { coreFlags } from "@/lib/core-flags";
import { timeAgo } from "@/components/app/common";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  Notification,
  TickCircle,
  Trash,
  TaskSquare,
  Profile2User,
  DocumentText,
  Messages2,
  Clock,
} from "iconsax-reactjs";

const ICON: Record<string, any> = {
  task_created: TaskSquare,
  task_assigned: TaskSquare,
  task_comment: Messages2,
  task_completed: TickCircle,
  mention: Messages2,
  chat_mention: Messages2,
  chat_reply: Messages2,
  member_joined: Profile2User,
  member_left: Profile2User,
  project_invitation: Profile2User,
  team_invitation: Profile2User,
  deadline_alert: Clock,
  task_due_soon: Clock,
  reminder: Clock,
};

interface NotifItem {
  _id: string;
  source: "core" | "local";
  type: string;
  title: string;
  message?: string;
  read: boolean;
  link?: string;
  createdAt: number;
}

/**
 * Inbox widget (§3): compact triage list reusing the same notification
 * queries as the full `/app/inbox` page (local `api.notifications.listMine`
 * + core `useNotifications`). Selecting an item marks it read and navigates
 * to its link; a footer links to the full two-pane inbox (M5).
 */
export function InboxWidget() {
  const router = useRouter();
  const t = useTranslations("inbox");

  const localNotifications = useQuery(api.notifications.listMine, { limit: 50 });
  const localMarkRead = useMutation(api.notifications.markRead);
  const localRemove = useMutation(api.notifications.remove);
  const coreNotifications = useNotifications({ limit: 50 });
  const coreMutations = useNotificationMutations();
  const useCore = coreFlags.notifications;

  const coreItems: NotifItem[] = (coreNotifications ?? []).map((n) => ({
    _id: n._id,
    source: "core" as const,
    type: n.type,
    title: n.title,
    message: n.message,
    read: n.read,
    link: n.link,
    createdAt: n.createdAt,
  }));
  const localItems: NotifItem[] = (localNotifications ?? []).map((n: any) => ({
    _id: n._id,
    source: "local" as const,
    type: n.type,
    title: n.title,
    message: n.message ?? n.body,
    read: n.read,
    link: n.link,
    createdAt: n.createdAt,
  }));

  const notifications: NotifItem[] | undefined = useCore
    ? [...coreItems, ...localItems].sort((a, b) => b.createdAt - a.createdAt)
    : localItems;
  const loading = useCore
    ? coreNotifications === undefined || localNotifications === undefined
    : localNotifications === undefined;

  const markRead = (item: NotifItem) => {
    if (item.source === "core") return coreMutations.markRead({ notificationId: item._id as any });
    return localMarkRead({ id: item._id as any });
  };
  const remove = (item: NotifItem) => {
    if (item.source === "core") return coreMutations.remove({ notificationId: item._id as any });
    return localRemove({ id: item._id as any });
  };

  const open = (item: NotifItem) => {
    markRead(item);
    if (item.link) router.push(item.link.startsWith("/app") ? item.link : `/app${item.link}`);
    else router.push("/app/inbox");
  };

  if (loading) {
    return (
      <div data-testid="widget-inbox" className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (!notifications || notifications.length === 0) {
    return (
      <div
        data-testid="widget-inbox-empty"
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center"
      >
        <Notification variant="Bulk" size={32} className="opacity-40 text-muted-foreground" />
        <p className="text-sm font-medium">{t("allCaughtUp")}</p>
        <p className="text-xs text-muted-foreground">{t("empty.description")}</p>
      </div>
    );
  }

  return (
    <div data-testid="widget-inbox" className="min-h-0 flex-1 overflow-y-auto">
      {notifications.map((n) => {
        const Icon = ICON[n.type] ?? DocumentText;
        return (
          <div
            key={n._id}
            data-testid="widget-inbox-item"
            className={cn(
              "group flex items-start gap-2.5 border-b border-sidebar-border px-3 py-2.5 last:border-0",
              !n.read && "bg-primary/6",
            )}
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Icon variant="Bulk" size={16} />
            </span>
            <button onClick={() => open(n)} className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium">
                {n.title}
                {!n.read && (
                  <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />
                )}
              </p>
              {n.message && (
                <p className="truncate text-xs text-muted-foreground">{n.message}</p>
              )}
              <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
            </button>
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              {!n.read && (
                <button
                  onClick={() => markRead(n)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                  title={t("notifTypes.markRead")}
                  data-testid="widget-inbox-mark-read"
                >
                  <TickCircle variant="Bulk" size={14} />
                </button>
              )}
              <button
                onClick={() => remove(n)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                title={t("notifTypes.remove")}
                data-testid="widget-inbox-remove"
              >
                <Trash variant="Bulk" size={14} />
              </button>
            </div>
          </div>
        );
      })}
      <button
        onClick={() => router.push("/app/inbox")}
        data-testid="widget-inbox-open-all"
        className="flex w-full items-center justify-center gap-1.5 border-t border-sidebar-border py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
      >
        {t("title")}
      </button>
    </div>
  );
}
