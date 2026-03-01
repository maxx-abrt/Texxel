"use client";

import { useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  AtSign,
  Bell,
  CalendarClock,
  CheckCircle2,
  CheckCheck,
  FolderKanban,
  Inbox,
  MessageCircle,
  Trash2,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const typeConfig: Record<string, { icon: any; color: string }> = {
  team_invitation: { icon: UserPlus, color: "text-blue-500 bg-blue-500/10" },
  task_assigned: { icon: CheckCircle2, color: "text-violet-500 bg-violet-500/10" },
  task_comment: { icon: MessageCircle, color: "text-amber-500 bg-amber-500/10" },
  task_completed: { icon: CheckCircle2, color: "text-emerald-500 bg-emerald-500/10" },
  project_invitation: { icon: FolderKanban, color: "text-pink-500 bg-pink-500/10" },
  mention: { icon: AtSign, color: "text-sky-500 bg-sky-500/10" },
  task_due_soon: { icon: CalendarClock, color: "text-orange-500 bg-orange-500/10" },
};

export default function InboxPage() {
  const t = useTranslations("inbox");
  const tc = useTranslations("common");
  const router = useRouter();
  const notifications = useQuery(api.notifications.getMyNotifications);
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const remove = useMutation(api.notifications.remove);
  const clearAll = useMutation(api.notifications.clearAll);

  const checkDueDates = useMutation(api.notifications.checkDueDates);

  useEffect(() => {
    checkDueDates().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;

  const handleClick = async (notif: any) => {
    if (!notif.read) {
      await markRead({ id: notif._id });
    }
    if (notif.link) {
      router.push(notif.link);
    }
  };

  // Group by today / earlier
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayTs = now.getTime();
  const today = (notifications ?? []).filter((n) => n.createdAt >= todayTs);
  const earlier = (notifications ?? []).filter((n) => n.createdAt < todayTs);

  const renderNotification = (notif: any) => {
    const cfg = typeConfig[notif.type] ?? typeConfig.mention;
    const IconComp = cfg.icon;
    return (
      <div
        key={notif._id}
        onClick={() => handleClick(notif)}
        className={cn(
          "group flex items-start gap-3 rounded-lg px-4 py-3 cursor-pointer transition-all",
          !notif.read
            ? "bg-primary/3 hover:bg-primary/6"
            : "hover:bg-accent/50",
        )}
      >
        {/* Avatar or icon */}
        {notif.fromUserImage ? (
          <img
            src={notif.fromUserImage}
            alt=""
            className="h-8 w-8 shrink-0 rounded-full object-cover mt-0.5"
          />
        ) : (
          <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", cfg.color)}>
            <IconComp className="h-3.5 w-3.5" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn("text-sm truncate", !notif.read ? "font-semibold" : "font-medium")}>
              {notif.title}
            </p>
            {!notif.read && (
              <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{notif.body}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(notif.createdAt)}</p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            remove({ id: notif._id });
          }}
          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0 mt-1"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8 md:px-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {unreadCount > 0 ? t("unread", { count: unreadCount }) : t("allCaughtUp")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { markAllRead(); toast.success(t("markedAllRead")); }}
                className="gap-1.5 h-8 text-xs"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t("markAllRead")}
              </Button>
            )}
            {(notifications ?? []).length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { clearAll(); toast.success(t("cleared")); }}
                className="text-muted-foreground h-8 w-8 p-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {(notifications ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500/15 to-blue-500/5">
              <Inbox className="h-7 w-7 text-blue-500" />
            </div>
            <h3 className="text-base font-semibold">{t("empty.title")}</h3>
            <p className="text-muted-foreground mt-1 text-sm max-w-xs">{t("empty.description")}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {today.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">{t("today")}</h2>
                <div className="rounded-xl border divide-y">
                  {today.map(renderNotification)}
                </div>
              </section>
            )}
            {earlier.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">{t("earlier")}</h2>
                <div className="rounded-xl border divide-y">
                  {earlier.map(renderNotification)}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
