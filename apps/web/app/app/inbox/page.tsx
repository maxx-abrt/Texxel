"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNotifications, useNotificationMutations } from "@a2e/core";
import { coreFlags } from "@/lib/core-flags";
import { PageContainer, PageHeader, EmptyState, btnOutline, timeAgo } from "@/components/app/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Notification, TickCircle, Trash, TaskSquare, Profile2User, DocumentText, Messages2, Clock } from "iconsax-reactjs";

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

type FilterTab = "all" | "tasks" | "mentions" | "members";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tasks", label: "Tasks" },
  { key: "mentions", label: "Mentions" },
  { key: "members", label: "Members" },
];

function matchesTab(type: string, tab: FilterTab): boolean {
  if (tab === "all") return true;
  if (tab === "tasks") return type.startsWith("task") || type === "deadline_alert" || type === "reminder";
  if (tab === "mentions") return type === "mention" || type === "task_comment" || type === "chat_mention" || type === "chat_reply";
  if (tab === "members") return type.startsWith("member") || type.includes("invitation");
  return true;
}

/** Unified notification shape for the UI (normalizes local + core docs). */
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

export default function InboxPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const t = useTranslations("inbox");

  // Legacy local path
  const localNotifications = useQuery(api.notifications.listMine, { limit: 200 });
  const localMarkRead = useMutation(api.notifications.markRead);
  const localMarkAllRead = useMutation(api.notifications.markAllRead);
  const localRemove = useMutation(api.notifications.remove);
  const localClearAll = useMutation(api.notifications.clearAll);

  // Core path
  const coreNotifications = useNotifications({ limit: 200 });
  const coreMutations = useNotificationMutations();

  const useCore = coreFlags.notifications;

  // Normalize to unified shape. When the core flag is ON, we MERGE core +
  // local notifications: workspace-wide notifications are dual-written to
  // core, but targeted notifications (mentions, replies) remain local-only
  // until a per-user core notification endpoint exists.
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

  const handleMarkRead = (item: NotifItem) => {
    if (item.source === "core") return coreMutations.markRead({ notificationId: item._id as any });
    return localMarkRead({ id: item._id as any });
  };
  const handleMarkAllRead = () => {
    if (useCore) {
      return Promise.all([
        coreMutations.markAllRead({}),
        localMarkAllRead({}),
      ]).then(() => undefined);
    }
    return localMarkAllRead({});
  };
  const handleRemove = (item: NotifItem) => {
    if (item.source === "core") return coreMutations.remove({ notificationId: item._id as any });
    return localRemove({ id: item._id as any });
  };
  const handleClearAll = () => {
    if (useCore) {
      return Promise.all([
        coreMutations.clearAll({}),
        localClearAll({}),
      ]).then(() => undefined);
    }
    return localClearAll({});
  };

  const filtered = (notifications ?? []).filter((n) => matchesTab(n.type, activeTab));

  return (
    <PageContainer className="max-w-[760px]">
      <PageHeader title={t("title")} subtitle={t("notifTypes.subtitle")} icon={Notification} testId="inbox-header"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => handleMarkAllRead().then(() => toast.success(t("markedAllRead")))} className={btnOutline} data-testid="inbox-mark-all"><TickCircle variant="Bulk" size={16} /> {t("markAllRead")}</button>
            <button onClick={() => handleClearAll().then(() => toast.success(t("cleared")))} className={btnOutline} data-testid="inbox-clear-all"><Trash variant="Bulk" size={16} /> {t("notifTypes.clear")}</button>
          </div>
        } />

      {/* Type filter tabs */}
      <div className="mb-4 flex items-center gap-1 rounded-full border border-border bg-card p-0.5 w-fit">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "h-8 rounded-full px-3 text-sm transition-colors",
              activeTab === tab.key ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Notification} title={t("allCaughtUp")} description={t("empty.description")} testId="inbox-empty" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card" data-testid="inbox-list">
          {filtered.map((n) => {
            const Icon = ICON[n.type] ?? DocumentText;
            return (
              <div key={n._id} data-testid="inbox-item" className={cn("group flex items-start gap-3 border-b border-border px-4 py-3 last:border-0", !n.read && "bg-[var(--flux-coral-soft)]/40")}>
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon variant="Bulk" size={18} /></span>
                <button onClick={() => { handleMarkRead(n); if (n.link) router.push(n.link.startsWith("/app") ? n.link : `/app${n.link}`); }} className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-medium">{n.title}{!n.read && <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />}</p>
                  <p className="truncate text-sm text-muted-foreground">{n.message}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                </button>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {!n.read && <button onClick={() => handleMarkRead(n)} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" title={t("notifTypes.markRead")}><TickCircle variant="Bulk" size={16} /></button>}
                  <button onClick={() => handleRemove(n)} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" title={t("notifTypes.remove")}><Trash variant="Bulk" size={16} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
