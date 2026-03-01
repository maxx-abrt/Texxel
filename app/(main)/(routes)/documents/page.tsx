"use client";

import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CheckSquare,
  FolderKanban,
  FileText,
  Users,
  Plus,
  ArrowRight,
  AlertCircle,
  Circle,
  TrendingUp,
  Inbox,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  const create = useMutation(api.documents.create);
  const recentDocs = useQuery(api.documents.getSidebar, { parentDocument: undefined });
  const myTasks = useQuery(api.tasks.getMyTasks, {});
  const myTeams = useQuery(api.teams.getMyTeams);
  const myProjects = useQuery(api.projects.getMyProjects, {});
  const notifications = useQuery(api.notifications.getMyNotifications);
  const unreadCount = useQuery(api.notifications.getUnreadCount) ?? 0;
  const [showNewTask, setShowNewTask] = useState(false);

  const firstName = user?.name?.split(" ")[0] ?? "there";

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const onCreateDoc = () => {
    toast.promise(
      create({ title: "Untitled" }).then((id) => router.push(`/documents/${id}`)),
      { loading: "Creating note...", success: "Note created!", error: "Failed" },
    );
  };

  const activeTasks = (myTasks ?? []).filter((t) => t.status !== "done" && t.status !== "cancelled");
  const overdueTaskCount = activeTasks.filter((t) => t.dueDate && t.dueDate < Date.now()).length;
  const doneTodayCount = (myTasks ?? []).filter((t) => {
    if (t.status !== "done" || !t.completedAt) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return t.completedAt >= today.getTime();
  }).length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-muted-foreground mt-1.5">
            Here&apos;s an overview of your workspace.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 mb-10 sm:grid-cols-4">
          {[
            { label: "Open Tasks", value: activeTasks.length, icon: CheckSquare, gradient: "from-blue-500/10 to-blue-500/5", iconColor: "text-blue-500", href: "/tasks" },
            { label: "Overdue", value: overdueTaskCount, icon: AlertCircle, gradient: overdueTaskCount > 0 ? "from-red-500/10 to-red-500/5" : "from-emerald-500/10 to-emerald-500/5", iconColor: overdueTaskCount > 0 ? "text-red-500" : "text-emerald-500", href: "/tasks" },
            { label: "Projects", value: (myProjects ?? []).length, icon: FolderKanban, gradient: "from-violet-500/10 to-violet-500/5", iconColor: "text-violet-500", href: "/projects" },
            { label: "Teams", value: (myTeams ?? []).length, icon: Users, gradient: "from-amber-500/10 to-amber-500/5", iconColor: "text-amber-500", href: "/teams" },
          ].map((stat) => (
            <button
              key={stat.label}
              onClick={() => router.push(stat.href)}
              className={cn(
                "group relative overflow-hidden rounded-xl border p-4 text-left transition-all hover:shadow-md hover:border-primary/20",
                "bg-gradient-to-br",
                stat.gradient,
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <stat.icon className={cn("h-4 w-4", stat.iconColor)} />
                <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
              <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{stat.label}</p>
            </button>
          ))}
        </div>

        {/* Quick actions row */}
        <div className="flex flex-wrap gap-2 mb-10">
          <Button onClick={onCreateDoc} size="sm" variant="outline" className="gap-2 rounded-lg h-8">
            <FileText className="h-3.5 w-3.5" /> New Note
          </Button>
          <Button onClick={() => setShowNewTask(true)} size="sm" variant="outline" className="gap-2 rounded-lg h-8">
            <CheckSquare className="h-3.5 w-3.5" /> New Task
          </Button>
          <Button onClick={() => router.push("/projects")} size="sm" variant="outline" className="gap-2 rounded-lg h-8">
            <FolderKanban className="h-3.5 w-3.5" /> Projects
          </Button>
          <Button onClick={() => router.push("/teams")} size="sm" variant="outline" className="gap-2 rounded-lg h-8">
            <Users className="h-3.5 w-3.5" /> Teams
          </Button>
        </div>

        <div className="grid gap-8 lg:grid-cols-5">
          {/* Left column - Tasks & Activity */}
          <div className="lg:col-span-3 space-y-8">
            {/* Active tasks */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">My Tasks</h2>
                <button
                  onClick={() => router.push("/tasks")}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              {activeTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground font-medium">All caught up!</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">No open tasks. Create one to get started.</p>
                  <Button size="sm" variant="outline" onClick={() => setShowNewTask(true)} className="mt-3 gap-1.5 h-7 text-xs">
                    <Plus className="h-3 w-3" /> Add task
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border divide-y">
                  {activeTasks.slice(0, 6).map((task) => (
                    <div
                      key={task._id}
                      onClick={() => router.push(`/tasks/${task._id}`)}
                      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors group first:rounded-t-xl last:rounded-b-xl"
                    >
                      <Circle className="h-[14px] w-[14px] shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      <span className={cn("flex-1 text-sm truncate", task.dueDate && task.dueDate < Date.now() && "text-red-500/90")}>{task.title}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {task.priority !== "none" && (
                          <div className={cn("h-1.5 w-1.5 rounded-full", priorityDot[task.priority])} />
                        )}
                        {task.dueDate && task.dueDate < Date.now() ? (
                          <span className="text-[10px] font-medium text-red-500 flex items-center gap-0.5">
                            <AlertCircle className="h-2.5 w-2.5" /> overdue
                          </span>
                        ) : task.dueDate ? (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {activeTasks.length > 6 && (
                    <button
                      onClick={() => router.push("/tasks")}
                      className="w-full text-center text-xs text-muted-foreground hover:text-primary py-2.5 transition-colors rounded-b-xl hover:bg-accent/50"
                    >
                      +{activeTasks.length - 6} more
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Inbox preview */}
            {unreadCount > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">Inbox</h2>
                    <div className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold text-white">
                      {unreadCount}
                    </div>
                  </div>
                  <button
                    onClick={() => router.push("/inbox")}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    View all <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="rounded-xl border divide-y">
                  {(notifications ?? []).filter((n) => !n.read).slice(0, 3).map((n) => (
                    <div
                      key={n._id}
                      onClick={() => router.push("/inbox")}
                      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors first:rounded-t-xl last:rounded-b-xl"
                    >
                      <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
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
                <h2 className="text-sm font-semibold">Recent Notes</h2>
                <button
                  onClick={onCreateDoc}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <Plus className="h-3 w-3" /> New
                </button>
              </div>
              {(recentDocs ?? []).length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground font-medium">No notes yet</p>
                  <Button size="sm" variant="outline" onClick={onCreateDoc} className="mt-3 gap-1.5 h-7 text-xs">
                    <Plus className="h-3 w-3" /> Create note
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border divide-y">
                  {(recentDocs ?? []).slice(0, 6).map((doc) => (
                    <div
                      key={doc._id}
                      onClick={() => router.push(`/documents/${doc._id}`)}
                      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors group first:rounded-t-xl last:rounded-b-xl"
                    >
                      <span className="shrink-0 text-sm leading-none">
                        {doc.icon ?? "📄"}
                      </span>
                      <span className="flex-1 text-sm truncate group-hover:text-primary transition-colors">
                        {doc.title || "Untitled"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Projects */}
            {(myProjects ?? []).length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold">Projects</h2>
                  <button
                    onClick={() => router.push("/projects")}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    View all <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="space-y-2">
                  {(myProjects ?? []).filter(Boolean).slice(0, 4).map((project) => (
                    <div
                      key={project!._id}
                      onClick={() => router.push(`/projects/${project!._id}`)}
                      className="flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer hover:border-primary/20 hover:shadow-sm transition-all group"
                    >
                      <div
                        className="h-7 w-7 shrink-0 rounded-md flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: project!.color ?? "#6366f1" }}
                      >
                        {project!.icon ?? project!.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {project!.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground capitalize">{project!.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Teams */}
            {(myTeams ?? []).length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold">Teams</h2>
                  <button
                    onClick={() => router.push("/teams")}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    View all <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="space-y-2">
                  {(myTeams ?? []).filter(Boolean).slice(0, 3).map((team: any) => (
                    <div
                      key={team._id}
                      onClick={() => router.push(`/teams/${team._id}`)}
                      className="flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer hover:border-primary/20 hover:shadow-sm transition-all group"
                    >
                      <div className="h-7 w-7 shrink-0 rounded-md bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xs font-bold text-primary">
                        {team.icon ?? team.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {team.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground capitalize">{team.role}</p>
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
    </div>
  );
};
export default DocumentsPage;
