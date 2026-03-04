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
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "next-intl";

const typeConfig: Record<string, { icon: any; color: string }> = {
  team_invitation:       { icon: UserPlus,      color: "text-blue-500 bg-blue-500/10" },
  task_assigned:         { icon: CheckCircle2,  color: "text-violet-500 bg-violet-500/10" },
  task_comment:          { icon: MessageCircle, color: "text-amber-500 bg-amber-500/10" },
  task_completed:        { icon: CheckCircle2,  color: "text-emerald-500 bg-emerald-500/10" },
  project_invitation:    { icon: FolderKanban,  color: "text-pink-500 bg-pink-500/10" },
  mention:               { icon: AtSign,        color: "text-sky-500 bg-sky-500/10" },
  task_due_soon:         { icon: CalendarClock, color: "text-orange-500 bg-orange-500/10" },
  task_created_in_team:  { icon: Users,         color: "text-indigo-500 bg-indigo-500/10" },
  reminder:              { icon: Bell,          color: "text-teal-500 bg-teal-500/10" },
};

export default function InboxPage() {
  const t = useTranslations("inbox");
  const tc = useTranslations("common");
  const locale = useLocale();
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

  function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return tc("justNow");
    if (m < 60) return `${m}${tc("minAgo")}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}${tc("hAgo")}`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}${tc("dAgo")}`;
    const w = Math.floor(d / 7);
    if (w < 5) return `${w}${tc("wAgo")}`;
    return new Date(ts).toLocaleDateString(locale, { month: "short", day: "numeric" });
  }

  function getTitle(notif: any): string {
    const name = notif.fromUserName ?? t("notifTypes.someone");
    switch (notif.type) {
      case "task_assigned":        return t("notifTypes.task_assigned");
      case "task_comment":         return t("notifTypes.task_comment", { name });
      case "task_completed":       return t("notifTypes.task_completed");
      case "project_invitation":   return t("notifTypes.project_invitation");
      case "mention":              return t("notifTypes.mention", { name });
      case "team_invitation":      return t("notifTypes.team_invitation");
      case "task_due_soon":        return t("notifTypes.task_due_soon");
      case "task_created_in_team": return t("notifTypes.task_created_in_team", { team: notif.fromUserName ?? "…" });
      case "reminder":             return t("notifTypes.reminder");
      default:                     return notif.title ?? notif.type;
    }
  }

  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;

  const handleClick = async (notif: any) => {
    if (!notif.read) await markRead({ id: notif._id });
    if (notif.link) router.push(notif.link);
  };

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayTs = now.getTime();
  const todayList  = (notifications ?? []).filter((n) => n.createdAt >= todayTs);
  const earlierList = (notifications ?? []).filter((n) => n.createdAt < todayTs);

  const renderNotification = (notif: any) => {
    const cfg = typeConfig[notif.type] ?? typeConfig.mention;
    const IconComp = cfg.icon;
    const displayTitle = getTitle(notif);

    return (
      <div
        key={notif._id}
        onClick={() => handleClick(notif)}
        className={cn(
          "group flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-all",
          !notif.read ? "bg-primary/3 hover:bg-primary/6" : "hover:bg-accent/40",
        )}
      >
        {notif.fromUserImage ? (
          <img src={notif.fromUserImage} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover mt-0.5" />
        ) : (
          <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", cfg.color)}>
            <IconComp className="h-3.5 w-3.5" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn("text-sm leading-snug truncate", !notif.read ? "font-semibold" : "font-medium")}>
              {displayTitle}
            </p>
            {!notif.read && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
          </div>
          {notif.body && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{notif.body}</p>
          )}
          <p className="text-[10px] text-muted-foreground/50 mt-1.5 font-medium">{timeAgo(notif.createdAt)}</p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); remove({ id: notif._id }); }}
          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0 mt-0.5 transition-opacity"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  };

  const renderSection = (items: any[], label: string) =>
    items.length > 0 ? (
      <section>
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 px-1">{label}</h2>
        <div className="rounded-xl border bg-card divide-y overflow-hidden shadow-sm">
          {items.map(renderNotification)}
        </div>
      </section>
    ) : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-5 py-8 md:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {unreadCount > 0 ? t("unread", { count: unreadCount }) : t("allCaughtUp")}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
                className="text-muted-foreground h-8 w-8 p-0 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {(notifications ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary/15 to-primary/5">
              <Inbox className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold">{t("empty.title")}</h3>
            <p className="text-muted-foreground mt-1.5 text-sm max-w-xs leading-relaxed">{t("empty.description")}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {renderSection(todayList, t("today"))}
            {renderSection(earlierList, t("earlier"))}
          </div>
        )}
      </div>
    </div>
  );
}
