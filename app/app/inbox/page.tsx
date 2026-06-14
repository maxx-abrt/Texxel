"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageContainer, PageHeader, EmptyState, btnOutline, timeAgo } from "@/components/app/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Notification, TickCircle, Trash, TaskSquare, Profile2User, DocumentText } from "iconsax-reactjs";

const ICON: Record<string, any> = {
  task_created: TaskSquare,
  task_assigned: TaskSquare,
  member_joined: Profile2User,
  member_left: Profile2User,
};

export default function InboxPage() {
  const router = useRouter();
  const notifications = useQuery(api.notifications.listMine, { limit: 100 });
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const remove = useMutation(api.notifications.remove);
  const clearAll = useMutation(api.notifications.clearAll);

  return (
    <PageContainer className="max-w-[760px]">
      <PageHeader title="Inbox" subtitle="Notifications across your workspace" icon={Notification} testId="inbox-header"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => markAllRead({}).then(() => toast.success("All marked read"))} className={btnOutline} data-testid="inbox-mark-all"><TickCircle variant="Bulk" size={16} /> Mark all read</button>
            <button onClick={() => clearAll({}).then(() => toast.success("Inbox cleared"))} className={btnOutline} data-testid="inbox-clear-all"><Trash variant="Bulk" size={16} /> Clear</button>
          </div>
        } />

      {notifications === undefined ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : notifications.length === 0 ? (
        <EmptyState icon={Notification} title="You are all caught up" description="New notifications will show up here." testId="inbox-empty" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card" data-testid="inbox-list">
          {notifications.map((n: any) => {
            const Icon = ICON[n.type] ?? DocumentText;
            return (
              <div key={n._id} data-testid="inbox-item" className={cn("group flex items-start gap-3 border-b border-border px-4 py-3 last:border-0", !n.read && "bg-[var(--flux-coral-soft)]/40")}>
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon variant="Bulk" size={18} /></span>
                <button onClick={() => { markRead({ id: n._id }); if (n.link) router.push(`/app${n.link}`); }} className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-medium">{n.title}{!n.read && <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />}</p>
                  <p className="truncate text-sm text-muted-foreground">{n.message}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                </button>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {!n.read && <button onClick={() => markRead({ id: n._id })} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" title="Mark read"><TickCircle variant="Bulk" size={16} /></button>}
                  <button onClick={() => remove({ id: n._id })} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" title="Remove"><Trash variant="Bulk" size={16} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
