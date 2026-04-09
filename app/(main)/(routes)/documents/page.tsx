"use client";

import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  BookOpen,
  CheckSquare,
  FolderKanban,
  FileText,
  Target,
  Users,
  Plus,
  ArrowRight,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  Trophy,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { AiAssistantPanel } from "@/components/ai-assistant";
import { useTranslations } from "next-intl";
import { useExtensions } from "@/hooks/useExtensions";
import { useWorkspace } from "@/hooks/useWorkspace";

function useTimeAgo() {
  const tc = useTranslations("common");
  return (ts: number): string => {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return tc("justNow");
    if (m < 60) return `${m}${tc("minAgo")}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}${tc("hAgo")}`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}${tc("dAgo")}`;
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
}

const priorityDot: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-sky-500",
  none: "bg-slate-300 dark:bg-slate-600",
};

const DocumentsPage = () => {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const router = useRouter();
  const td = useTranslations("dashboard");
  const tc = useTranslations("common");
  const timeAgo = useTimeAgo();
  const { isEnabled: extEnabled } = useExtensions();
  const { activeWorkspaceId } = useWorkspace();
  const wsId = activeWorkspaceId as any;
  const create = useMutation(api.documents.create);
  const recentDocs = useQuery(api.documents.getSidebar, { parentDocument: undefined, workspaceId: wsId });
  const myTasks = useQuery(api.tasks.getMyTasks, { workspaceId: wsId });
  const myTeams = useQuery(api.teams.getMyTeams, { workspaceId: wsId });
  const myProjects = useQuery(api.projects.getMyProjects, { workspaceId: wsId });
  const notifications = useQuery(api.notifications.getMyNotifications);
  const unreadCount = useQuery(api.notifications.getUnreadCount) ?? 0;
  const [showNewTask, setShowNewTask] = useState(false);
  const [showAi, setShowAi] = useState(false);

  const firstName = user?.name?.split(" ")[0] ?? "there";

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return td("greeting.morning");
    if (h < 17) return td("greeting.afternoon");
    return td("greeting.evening");
  };

  const onCreateDoc = () => {
    toast.promise(
      create({ title: tc("untitled"), workspaceId: wsId }).then((id) => router.push(`/documents/${id}`)),
      { loading: td("creating"), success: td("created"), error: td("createFailed") },
    );
  };

  const now = Date.now();
  const todayStart = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
  const todayEnd = todayStart + 86_400_000;

  const activeTasks = (myTasks ?? []).filter((t) => t.status !== "done" && t.status !== "cancelled");
  const overdueTasks = activeTasks.filter((t) => t.dueDate && t.dueDate < now);
  const overdueTaskCount = overdueTasks.length;
  const todayTasks = activeTasks.filter((t) => t.dueDate && t.dueDate >= todayStart && t.dueDate < todayEnd);
  const doneTodayCount = (myTasks ?? []).filter((t) => {
    if (t.status !== "done" || !t.completedAt) return false;
    return t.completedAt >= todayStart;
  }).length;
  const totalTasksToday = todayTasks.length + doneTodayCount;
  const todayProgress = totalTasksToday > 0 ? Math.round((doneTodayCount / totalTasksToday) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-muted-foreground/70 mt-1">
            {td("overview")}
          </p>
        </div>

        {/* ── Overdue spotlight ─────────────────────────────────────── */}
        {overdueTaskCount > 0 && myTasks !== undefined && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                {overdueTaskCount} overdue {overdueTaskCount === 1 ? "task" : "tasks"}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {overdueTasks.slice(0, 3).map((t) => (
                  <button
                    key={t._id}
                    onClick={() => router.push(`/tasks/${t._id}`)}
                    className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2.5 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  >
                    {t.title.length > 28 ? t.title.slice(0, 28) + "…" : t.title}
                  </button>
                ))}
                {overdueTaskCount > 3 && (
                  <button onClick={() => router.push("/tasks")} className="text-[11px] text-red-500 hover:underline">
                    +{overdueTaskCount - 3} more
                  </button>
                )}
              </div>
            </div>
            <button onClick={() => router.push("/tasks")} className="shrink-0 text-[11px] text-red-500 hover:underline font-medium">
              View all →
            </button>
          </div>
        )}

        {/* ── Today's Focus ─────────────────────────────────────────── */}
        {(todayTasks.length > 0 || doneTodayCount > 0) && myTasks !== undefined && (
          <div className="mb-8 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10 px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold">{td("todayFocus") ?? "Today's Focus"}</h2>
                <span className="text-[10px] text-muted-foreground bg-background border rounded-full px-2 py-0.5">
                  {doneTodayCount}/{totalTasksToday} done
                </span>
              </div>
              {/* Progress bar */}
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 rounded-full bg-amber-200 dark:bg-amber-800/60 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${todayProgress}%` }}
                  />
                </div>
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">{todayProgress}%</span>
              </div>
            </div>
            <div className="space-y-1">
              {todayTasks.slice(0, 4).map((task) => (
                <div
                  key={task._id}
                  onClick={() => router.push(`/tasks/${task._id}`)}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-amber-100 dark:hover:bg-amber-900/20 cursor-pointer transition-colors group"
                >
                  <Circle className="h-3.5 w-3.5 shrink-0 text-amber-400 group-hover:text-amber-600 transition-colors" />
                  <span className="flex-1 text-[13px] truncate">{task.title}</span>
                  <span className="text-[10px] text-amber-500/70 shrink-0 flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" /> Today
                  </span>
                </div>
              ))}
              {todayTasks.length > 4 && (
                <button onClick={() => router.push("/tasks")} className="text-[11px] text-amber-500 hover:underline pl-2 mt-1">
                  +{todayTasks.length - 4} more today
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stats row */}
        {myTasks === undefined ? (
          <div className="grid grid-cols-2 gap-3 mb-10 sm:grid-cols-5">
            {[1,2,3,4,5].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-10 sm:grid-cols-5">
            {[
              { label: td("stats.openTasks"), value: activeTasks.length, icon: CheckSquare, gradient: "from-blue-500/10 to-blue-500/5", iconColor: "text-blue-500", href: "/tasks" },
              { label: td("stats.overdue"), value: overdueTaskCount, icon: AlertCircle, gradient: overdueTaskCount > 0 ? "from-red-500/10 to-red-500/5" : "from-emerald-500/10 to-emerald-500/5", iconColor: overdueTaskCount > 0 ? "text-red-500" : "text-emerald-500", href: "/tasks" },
              { label: td("stats.doneToday"), value: doneTodayCount, icon: Trophy, gradient: doneTodayCount > 0 ? "from-emerald-500/10 to-emerald-500/5" : "from-slate-500/10 to-slate-500/5", iconColor: doneTodayCount > 0 ? "text-emerald-500" : "text-slate-400", href: "/tasks" },
              { label: td("stats.projects"), value: (myProjects ?? []).length, icon: FolderKanban, gradient: "from-violet-500/10 to-violet-500/5", iconColor: "text-violet-500", href: "/projects" },
              { label: td("stats.teams"), value: (myTeams ?? []).length, icon: Users, gradient: "from-amber-500/10 to-amber-500/5", iconColor: "text-amber-500", href: "/teams" },
            ].map((stat) => (
              <Link
                key={stat.label}
                href={stat.href}
                prefetch
                className="group relative overflow-hidden rounded-xl border border-border/60 p-4 text-left transition-all duration-200 hover:shadow-sm hover:border-border"
              >
                <div className="flex items-center justify-between mb-3">
                  <stat.icon className={cn("h-4 w-4", stat.iconColor)} />
                  <ArrowRight className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-2xl font-semibold tracking-tight">{stat.value}</p>
                <p className="text-[11px] font-medium text-muted-foreground/60 mt-0.5">{stat.label}</p>
              </Link>
            ))}
          </div>
        )}

        {/* Quick actions row */}
        <div className="flex flex-wrap gap-1.5 mb-10">
          {[
            { label: td("newNote"), icon: FileText, action: onCreateDoc },
            { label: td("newTask"), icon: CheckSquare, action: () => setShowNewTask(true) },
            { label: td("myProjects"), icon: FolderKanban, action: () => router.push("/projects") },
            { label: td("myTeams"), icon: Users, action: () => router.push("/teams") },
            { label: td("templates") ?? "Templates", icon: BookOpen, action: () => router.push("/templates") },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-150 hover:text-foreground hover:border-border hover:shadow-sm"
            >
              <item.icon className="h-3.5 w-3.5" /> {item.label}
            </button>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-5">
          {/* Left column - Tasks & Activity */}
          <div className="lg:col-span-3 space-y-8">
            {/* Active tasks */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[13px] font-medium text-foreground/80">{td("myTasks")}</h2>
                <button
                  onClick={() => router.push("/tasks")}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-foreground/70 transition-colors duration-200"
                >
                  {td("viewAll")} <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              {myTasks === undefined ? (
                <div className="rounded-xl border divide-y">
                  {[1,2,3].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <Skeleton className="h-3.5 w-3.5 rounded-full shrink-0" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  ))}
                </div>
              ) : activeTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground font-medium">{td("allCaughtUp")}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{td("noTasksDesc")}</p>
                  <Button size="sm" variant="outline" onClick={() => setShowNewTask(true)} className="mt-3 gap-1.5 h-7 text-xs">
                    <Plus className="h-3 w-3" /> {td("addTask")}
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-border/40 divide-y divide-border/40">
                  {activeTasks.slice(0, 6).map((task) => (
                    <Link
                      key={task._id}
                      href={`/tasks/${task._id}`}
                      prefetch
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 transition-all duration-200 group first:rounded-t-xl last:rounded-b-xl"
                    >
                      <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/25 group-hover:text-foreground/50 transition-colors duration-200" />
                      <span className={cn("flex-1 text-[13px] truncate", task.dueDate && task.dueDate < Date.now() && "text-red-500/80")}>{task.title}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {task.priority !== "none" && (
                          <div className={cn("h-1.5 w-1.5 rounded-full", priorityDot[task.priority])} />
                        )}
                        {task.dueDate && task.dueDate < Date.now() ? (
                          <span className="text-[10px] font-medium text-red-500 flex items-center gap-0.5">
                            <AlertCircle className="h-2.5 w-2.5" /> {td("overdue")}
                          </span>
                        ) : task.dueDate ? (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                  {activeTasks.length > 6 && (
                    <Link
                      href="/tasks"
                      prefetch
                      className="block w-full text-center text-[11px] text-muted-foreground/50 hover:text-foreground/70 py-2.5 transition-colors duration-200 rounded-b-xl hover:bg-accent/30"
                    >
                      +{activeTasks.length - 6} {td("more")}
                    </Link>
                  )}
                </div>
              )}
            </section>

            {/* Inbox preview */}
            {unreadCount > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[13px] font-medium text-foreground/80">{td("inbox")}</h2>
                    <div className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background">
                      {unreadCount}
                    </div>
                  </div>
                  <button
                    onClick={() => router.push("/inbox")}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-foreground/70 transition-colors duration-200"
                  >
                    {td("viewAll")} <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="rounded-xl border border-border/40 divide-y divide-border/40">
                  {(notifications ?? []).filter((n) => !n.read).slice(0, 3).map((n) => (
                    <div
                      key={n._id}
                      onClick={() => router.push("/inbox")}
                      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-accent/30 transition-all duration-200 first:rounded-t-xl last:rounded-b-xl"
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-foreground shrink-0" />
                      <p className="flex-1 text-sm truncate font-medium">{n.title}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(n.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right column - Notes & Projects */}
          <div className="lg:col-span-2 space-y-8">
            {/* Recent notes */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[13px] font-medium text-foreground/80">{td("recentNotes")}</h2>
                <button
                  onClick={onCreateDoc}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-foreground/70 transition-colors duration-200"
                >
                  <Plus className="h-3 w-3" /> {tc("add")}
                </button>
              </div>
              {recentDocs === undefined ? (
                <div className="rounded-xl border divide-y">
                  {[1,2,3].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <Skeleton className="h-4 w-4 rounded shrink-0" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  ))}
                </div>
              ) : (recentDocs ?? []).length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground font-medium">{td("noNotes")}</p>
                  <Button size="sm" variant="outline" onClick={onCreateDoc} className="mt-3 gap-1.5 h-7 text-xs">
                    <Plus className="h-3 w-3" /> {td("createNote")}
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-border/40 divide-y divide-border/40">
                  {(recentDocs ?? []).slice(0, 6).map((doc) => (
                    <Link
                      key={doc._id}
                      href={`/documents/${doc._id}`}
                      prefetch
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 transition-all duration-200 group first:rounded-t-xl last:rounded-b-xl"
                    >
                      <span className="shrink-0 text-sm leading-none">
                        {doc.icon ?? "📄"}
                      </span>
                      <span className="flex-1 text-[13px] truncate group-hover:text-foreground transition-colors duration-200">
                        {doc.title || tc("untitled")}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Projects */}
            {(myProjects ?? []).length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[13px] font-medium text-foreground/80">{td("myProjects")}</h2>
                  <button
                    onClick={() => router.push("/projects")}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-foreground/70 transition-colors duration-200"
                  >
                    {td("viewAll")} <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {(myProjects ?? []).filter(Boolean).slice(0, 4).map((project) => {
                    const statusColor = project!.status === "completed" ? "bg-emerald-500" : project!.status === "archived" ? "bg-slate-400" : "bg-primary";
                    return (
                    <div
                      key={project!._id}
                      onClick={() => router.push(`/projects/${project!._id}`)}
                      className="flex items-center gap-3 rounded-xl border border-border/40 px-3.5 py-3 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all duration-200 group"
                    >
                      <div
                        className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm"
                        style={{ backgroundColor: project!.color ?? "#6366f1" }}
                      >
                        {project!.icon ?? project!.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate group-hover:text-primary transition-colors duration-200">
                          {project!.name}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all", statusColor)} style={{ width: project!.status === "completed" ? "100%" : "30%" }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground/60 capitalize shrink-0">{project!.status}</span>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Teams */}
            {(myTeams ?? []).length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[13px] font-medium text-foreground/80">{td("myTeams")}</h2>
                  <button
                    onClick={() => router.push("/teams")}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-foreground/70 transition-colors duration-200"
                  >
                    {td("viewAll")} <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {(myTeams ?? []).filter(Boolean).slice(0, 3).map((team: any) => (
                    <div
                      key={team._id}
                      onClick={() => router.push(`/teams/${team._id}`)}
                      className="flex items-center gap-3 rounded-lg border border-border/40 px-3.5 py-2.5 cursor-pointer hover:border-border hover:bg-accent/30 transition-all duration-200 group"
                    >
                      <div className="h-6 w-6 shrink-0 rounded-md bg-foreground/5 flex items-center justify-center text-[10px] font-semibold text-foreground/60">
                        {team.icon ?? team.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate group-hover:text-foreground transition-colors duration-200">
                          {team.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground/50 capitalize">{team.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      <NewTaskDialog open={showNewTask} onClose={() => setShowNewTask(false)} />

      {/* AI Assistant floating panel */}
      {extEnabled("aiAssistant") && showAi && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[520px] rounded-2xl border bg-background shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          <AiAssistantPanel onClose={() => setShowAi(false)} />
        </div>
      )}

      {/* AI Assistant floating toggle */}
      {extEnabled("aiAssistant") && !showAi && (
        <button
          onClick={() => setShowAi(true)}
          className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-md transition-all duration-200 hover:scale-[1.04] active:scale-[0.97]"
          title="A2E AI"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};
export default DocumentsPage;
