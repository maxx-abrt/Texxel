"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEvents, useTasks } from "@a2e/core";
import { coreFlags } from "@/lib/core-flags";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { useLocale, useTranslations } from "next-intl";
import { PageContainer, timeAgo, btnPrimary } from "@/components/app/common";
import { ContributionGrid } from "@/components/app/contribution-grid";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DocumentText,
  TaskSquare,
  CalendarAdd,
  Data2,
  Add,
  ArrowRight2,
  Notification,
  Clock,
  TickCircle,
  Briefcase,
  Calendar,
  MessageText1,
} from "iconsax-reactjs";

export default function HomePage() {
  const router = useRouter();
  const locale = useLocale();
  const { activeWorkspaceId, activeWorkspace, me } = useWorkspace();
  const t = useTranslations("dashboard");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const te = useTranslations("editor");
  const tp = useTranslations("projects");
  const ti = useTranslations("inbox");
  const docs = useQuery(
    api.flux_documents.list,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );
  const localTasks = useQuery(
    api.flux_tasks.list,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );
  const coreTasks = useTasks(coreFlags.tasks ? activeWorkspaceId : null);
  const tasks = coreFlags.tasks ? coreTasks : localTasks;
  const notifications = useQuery(api.notifications.listMine, { limit: 20 });
  const projects = useQuery(
    api.projects.list,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );
  // Stable 5-minute bucket — raw Date.now() changes every render, which would
  // re-subscribe the events query in a loop ("Too many re-renders").
  const now = Math.floor(Date.now() / 300_000) * 300_000;
  const weekEnd = now + 7 * 24 * 60 * 60 * 1000;
  const localEvents = useQuery(
    api.flux_events.list,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId, start: now, end: weekEnd } : "skip",
  );
  const coreEvents = useEvents(coreFlags.events ? activeWorkspaceId : null, { start: now, end: weekEnd });
  const events = coreFlags.events ? [...(coreEvents ?? []), ...(localEvents ?? [])] : localEvents;
  const createDoc = useMutation(api.flux_documents.create);

  const recent = (docs ?? [])
    .slice()
    .sort((a: any, b: any) => b.updatedAt - a.updatedAt)
    .slice(0, 6);
  const openTasks = (tasks ?? []).filter((t: any) => t.status !== "done");
  const upcomingEvents = (events ?? []).slice(0, 5);
  const projectHealthData = (() => {
    const ps = projects ?? [];
    const counts: Record<string, number> = {};
    for (const p of ps) counts[p.status ?? "planning"] = (counts[p.status ?? "planning"] ?? 0) + 1;
    return { total: ps.length, counts };
  })();
  const recentMentions = (notifications ?? []).filter((n: any) => n.type === "mention").slice(0, 5);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t("greeting.morning");
    if (h < 18) return t("greeting.afternoon");
    return t("greeting.evening");
  })();
  const firstName = (me?.name ?? me?.email ?? t("there")).split(" ")[0].split("@")[0];

  const onNewDoc = async () => {
    if (!activeWorkspaceId) return;
    try {
      const id = await createDoc({ workspaceId: activeWorkspaceId, title: tc("untitled") });
      router.push(`/app/documents/${id}`);
    } catch {
      toast.error(te("createFailed"));
    }
  };

  const QUICK = [
    { label: t("newDocument"), desc: t("writeOrganize"), Icon: DocumentText, onClick: onNewDoc, color: "var(--flux-coral)", testId: "document" },
    { label: t("newTask"), desc: t("trackWork"), Icon: TaskSquare, onClick: () => router.push("/app/tasks?new=1"), color: "var(--accent-ocean)", testId: "task" },
    { label: t("newEvent"), desc: t("planWeek"), Icon: CalendarAdd, onClick: () => router.push("/app/calendar?new=1"), color: "var(--accent-mint)", testId: "event" },
    { label: t("newDatabase"), desc: t("structureData"), Icon: Data2, onClick: () => router.push("/app/databases?new=1"), color: "#d98324", testId: "database" },
  ];

  return (
    <PageContainer>
      <div className="mb-8">
        <p className="text-sm font-medium text-primary">{activeWorkspace?.name}</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight md:text-4xl" data-testid="home-greeting">
          {greeting}, {firstName}
        </h1>
        <p className="mt-1.5 text-muted-foreground">{t("secondBrain")}</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {QUICK.map((q) => (
          <button
            key={q.label}
            onClick={q.onClick}
            data-testid={`quick-${q.testId}`}
            className="group flex flex-col items-start rounded-2xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-sm"
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: `color-mix(in oklch, ${q.color} 16%, transparent)`, color: q.color }}
            >
              <q.Icon variant="Bulk" size={22} />
            </span>
            <span className="mt-3 text-sm font-semibold">{q.label}</span>
            <span className="text-xs text-muted-foreground">{q.desc}</span>
          </button>
        ))}
      </div>

      {/* Contribution grid */}
      {activeWorkspaceId && (
        <div className="mt-6">
          <ContributionGrid workspaceId={activeWorkspaceId} />
        </div>
      )}

      {/* Dashboard widgets */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="dashboard-widgets">
        {/* Upcoming Events */}
        <div className="rounded-2xl border border-border bg-card p-4" data-testid="widget-events">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Calendar variant="Bulk" size={16} className="text-[var(--accent-ocean)]" /> {t("upcoming")}
            </h2>
            <Link href="/app/calendar" className="text-xs font-medium text-primary hover:underline">{tn("calendar")}</Link>
          </div>
          {events === undefined ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 animate-pulse rounded-lg bg-muted" />)}</div>
          ) : upcomingEvents.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">{t("noEventsThisWeek")}</p>
          ) : (
            <ul className="space-y-2">
              {upcomingEvents.map((e: any) => (
                <li key={e._id} className="flex items-start gap-2">
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: e.color ?? "var(--accent-ocean)" }} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(e.start).toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" })}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Project Health */}
        <div className="rounded-2xl border border-border bg-card p-4" data-testid="widget-project-health">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Briefcase variant="Bulk" size={16} className="text-[var(--flux-coral)]" /> {tp("title")}
            </h2>
            <Link href="/app/projects" className="text-xs font-medium text-primary hover:underline">{t("viewAll")}</Link>
          </div>
          {projects === undefined ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 animate-pulse rounded-lg bg-muted" />)}</div>
          ) : projectHealthData.total === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">{tp("empty.title")}</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(projectHealthData.counts).map(([status, count]) => (
                <div key={status} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs capitalize text-muted-foreground">{tp(`statuses.${status}`)}</span>
                  <div className="flex-1 overflow-hidden rounded-full bg-muted" style={{ height: 6 }}>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((count / projectHealthData.total) * 100)}%` }} />
                  </div>
                  <span className="w-5 shrink-0 text-right text-xs font-medium">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Mentions */}
        <div className="rounded-2xl border border-border bg-card p-4" data-testid="widget-mentions">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <MessageText1 variant="Bulk" size={16} className="text-primary" /> {t("mentions")}
            </h2>
            <Link href="/app/inbox" className="text-xs font-medium text-primary hover:underline">{tn("inbox")}</Link>
          </div>
          {notifications === undefined ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 animate-pulse rounded-lg bg-muted" />)}</div>
          ) : recentMentions.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">{t("noRecentMentions")}</p>
          ) : (
            <ul className="space-y-2">
              {recentMentions.map((n: any) => (
                <li key={n._id} className="flex items-start gap-2">
                  <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", n.read ? "bg-border" : "bg-primary")} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{n.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Recent documents */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("recentDocuments")}</h2>
            <Link href="/app/documents" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              {t("viewAll")} <ArrowRight2 variant="Bulk" size={15} />
            </Link>
          </div>
          {docs === undefined ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
              <DocumentText variant="Bulk" size={30} className="text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">{te("noDocuments")}</p>
              <button onClick={onNewDoc} className={cn(btnPrimary, "mt-4")} data-testid="home-create-doc">
                <Add variant="Bulk" size={16} /> {t("createFirstDocument")}
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {recent.map((d: any) => (
                <Link
                  key={d._id}
                  href={`/app/documents/${d._id}`}
                  data-testid="home-doc-card"
                  className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
                >
                  <span className="text-2xl leading-none">{d.icon ?? "\ud83d\udcc4"}</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium group-hover:text-primary">{d.title || tc("untitled")}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock variant="Bulk" size={12} /> {timeAgo(d.updatedAt)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t("openTasks")}</h2>
              <Link href="/app/tasks" className="text-xs font-medium text-primary hover:underline">{t("viewAll")}</Link>
            </div>
            {openTasks.length === 0 ? (
              <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <TickCircle variant="Bulk" size={18} className="text-[var(--accent-mint)]" /> {t("allCaughtUp")}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {openTasks.slice(0, 5).map((t: any) => (
                  <li key={t._id}>
                    <Link href="/app/tasks" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <span className="truncate">{t.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{tn("inbox")}</h2>
              <Link href="/app/inbox" className="text-xs font-medium text-primary hover:underline">{tc("open")}</Link>
            </div>
            {!notifications || notifications.length === 0 ? (
              <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Notification variant="Bulk" size={18} /> {ti("empty.title")}
              </p>
            ) : (
              <ul className="space-y-2">
                {notifications.slice(0, 5).map((n: any) => (
                  <li key={n._id} className="flex items-start gap-2">
                    <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", n.read ? "bg-border" : "bg-primary")} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{n.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
