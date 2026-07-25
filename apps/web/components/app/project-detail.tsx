"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { PageContainer, btnPrimary, btnOutline, inputBase, Spinner, timeAgo } from "@/components/app/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { DatePicker } from "@/components/ui/date-picker";
import { GanttChart } from "@/components/gantt-chart";
import { RetroPlanningPanel } from "@/components/retro-planning";
import { TaskCreateDialog } from "@/components/app/tasks-view";
import { ActivityPanel } from "@/components/app/activity-panel";
import { ChatPanel } from "@/components/app/chat-panel";
import {
  ArrowLeft2, Briefcase, TaskSquare, Calendar, Chart, People, Clock, Activity,
  Add, TickCircle, Flag, Timer1, CloseCircle,
  Messages3,
} from "iconsax-reactjs";
import { Link2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  planning: "#2f7ea6",
  active: "#2fbf9b",
  on_hold: "#d98324",
  completed: "#8b8f9a",
};

const PRIORITY_COLOR: Record<string, string> = {
  none: "var(--muted-foreground)", low: "#2f7ea6", medium: "#d98324", high: "#e5484d", urgent: "#e65a41",
};

function fmtMinutes(m: number, t: any) {
  if (!m) return "0" + t("hour");
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const hStr = h ? h + t("hour") : "";
  const mStr = mm ? " " + mm + t("minute") : h ? "" : "0" + t("hour");
  return (hStr + mStr).trim();
}
function fmtDate(ts: number | undefined, locale: string, t: any) {
  if (!ts) return t("none");
  return new Date(ts).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}

function ProgressRing({ pct, size = 96, stroke = 9, color = "var(--flux-coral)", t }: any) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.25,1,0.5,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold">{pct}%</span>
        <span className="text-[10px] text-muted-foreground">{t("done")}</span>
      </div>
    </div>
  );
}

const TABS = [
  { key: "overview", labelKey: "overview", icon: Chart },
  { key: "tasks", labelKey: "tasks", icon: TaskSquare, count: (d: any) => d?.progress?.total ?? 0 },
  { key: "timeline", labelKey: "timeline", icon: Calendar },
  { key: "retro", labelKey: "retroPlanning", icon: Activity },
  { key: "discussion", labelKey: "discussion", icon: Messages3 },
  { key: "time", labelKey: "time", icon: Clock },
  { key: "activity", labelKey: "history", icon: Activity, count: (d: any) => d?.recent?.length ?? 0 },
];

export function ProjectDetail({ projectId }: { projectId: Id<"projects"> }) {
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace();
  const t = useTranslations("projectDetail");
  const locale = useLocale();
  const detail = useQuery(api.flux_projects.detail, { projectId });
  const timeSummary = useQuery(api.flux_time.projectSummary, { projectId });
  const tasks = useQuery(api.flux_tasks.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId, projectId } : "skip");
  const wsMembers = useQuery(api.workspaces.listMembers, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const statuses = useQuery(api.flux_taskStatuses.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const labels = useQuery(api.flux_labels.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");

  const updateProject = useMutation(api.projects.update);
  const addMember = useMutation(api.flux_projects.addMember);
  const removeMember = useMutation(api.flux_projects.removeMember);
  const createTask = useMutation(api.flux_tasks.create);
  const setStatus = useMutation(api.flux_tasks.setStatus);

  const [tab, setTab] = useState("overview");
  const [newTask, setNewTask] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);

  if (detail === undefined) {
    return <PageContainer><div className="flex h-64 items-center justify-center"><Spinner /></div></PageContainer>;
  }
  if (detail === null) {
    return <PageContainer><div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground"><Briefcase variant="Bulk" size={40} /><p>{t("notFound")}</p><button onClick={() => router.push("/app/projects")} className={btnOutline}>{t("backToProjects")}</button></div></PageContainer>;
  }

  const p = detail.project;
  const cols = (statuses ?? []) as any[];
  const memberIds = new Set(detail.members.map((m: any) => m.userId));

  const ganttTasks = (tasks ?? []).map((task: any) => ({
    _id: task._id, title: task.title, status: task.status, priority: task.priority,
    dueDate: task.dueDate, createdAt: task.createdAt, assigneeName: task.assignee?.name ?? task.assignee?.email,
  }));

  const deadlineStr = p.endDate ? fmtDate(p.endDate, locale, t) : null;
  const daysRemaining = p.endDate ? Math.ceil((p.endDate - Date.now()) / 86_400_000) : null;
  const daysLeft = daysRemaining !== null ? Math.max(0, daysRemaining) : null;

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-5">
        <button onClick={() => router.push("/app/projects")} className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" data-testid="project-back">
          <ArrowLeft2 variant="Bulk" size={16} /> {t("backToProjects")}
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-primary" style={{ backgroundColor: `color-mix(in oklch, ${p.color ?? "var(--flux-coral)"} 20%, transparent)` }}>
              <Briefcase variant="Bulk" size={26} style={{ color: p.color ?? "var(--flux-coral)" }} />
            </span>
            <div>
              <input
                defaultValue={p.name}
                onBlur={(e) => e.target.value.trim() && e.target.value !== p.name && updateProject({ projectId, name: e.target.value.trim() }).then(() => toast.success(t("renamed")))}
                className="rounded-lg border border-transparent bg-transparent text-2xl font-bold tracking-tight outline-none hover:border-border focus:border-border focus:px-2"
                data-testid="project-title"
              />
              <p className="text-sm text-muted-foreground">{p.client}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {deadlineStr && (
              <div className={cn("flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs", daysLeft !== null && daysLeft <= 7 ? "text-destructive border-destructive/40 bg-destructive/5" : "text-muted-foreground")}>
                <Calendar variant="Bulk" size={14} className={cn(daysLeft !== null && daysLeft <= 7 && "text-destructive")} />
                <span className={cn(daysLeft !== null && daysLeft <= 7 && "font-medium")}>{t("deadline")} {deadlineStr}</span>
                {daysLeft !== null && <span className="ml-1 tabular-nums">· {t("daysLeft", { count: daysLeft })}</span>}
              </div>
            )}
            <button
              onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success(t("linkCopied") ?? "Link copied"); }}
              className={cn(btnOutline, "h-9 px-2.5 text-xs hidden sm:flex items-center gap-1.5")}
              aria-label={t("copyLink") ?? "Copy link"}
            >
              <Link2 size={14} /> {t("copyLink") ?? "Copy link"}
            </button>
            <Select value={p.status} onValueChange={(v) => updateProject({ projectId, status: v as any }).then(() => toast.success(t("statusUpdated")))}>
              <SelectTrigger className="h-9 w-36" data-testid="project-status-select"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS_COLORS).map(([k]) => <SelectItem key={k} value={k}>{t(`projectStatuses.${k}`)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-30 mb-5">
        <div className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1 no-scrollbar">
          {TABS.map((tabItem) => {
            const count = tabItem.count ? tabItem.count(detail) : undefined;
            const isActive = tab === tabItem.key;
            return (
              <button
                key={tabItem.key}
                onClick={() => setTab(tabItem.key)}
                data-testid={`project-tab-${tabItem.key}`}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition whitespace-nowrap",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <tabItem.icon variant="Bulk" size={15} />
                {t(tabItem.labelKey)}
                {count !== undefined && count > 0 && (
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums", isActive ? "bg-white/20 text-primary-foreground" : "bg-muted text-foreground")}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3" data-testid="project-overview">
          <div className="flex items-center gap-5 rounded-2xl border border-border bg-card p-5">
            <ProgressRing pct={detail.progress.pct} color={p.color ?? "var(--flux-coral)"} t={t} />
            <div>
              <p className="text-sm font-semibold">{t("progress")}</p>
              <p className="text-2xl font-bold">{detail.progress.done}<span className="text-base font-normal text-muted-foreground">/{detail.progress.total}</span></p>
              <p className="text-xs text-muted-foreground">{t("tasksCompleted")}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Calendar variant="Bulk" size={16} /> {t("deadline")}</p>
            {p.endDate ? (
              <>
                <div className="flex items-end justify-between">
                  <span className={cn("text-2xl font-bold", daysLeft !== null && daysLeft <= 7 && "text-destructive")}>{deadlineStr}</span>
                  <span className="text-xs text-muted-foreground">{daysLeft !== null ? t("daysLeft", { count: daysLeft }) : t("setDeadline")}</span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{daysRemaining !== null && daysRemaining <= 0 ? t("overdueMoveDeadline") : t("allRetroFromDate")}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noDeadlineSet")}</p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <DatePicker
                date={p.endDate ? new Date(p.endDate) : undefined}
                onChange={(d) => {
                  const ts = d ? d.getTime() : null;
                  updateProject({ projectId, endDate: ts })
                    .then(() => toast.success(ts ? t("deadlineUpdated") : t("deadlineCleared")))
                    .catch(() => toast.error(t("failedUpdateDeadline")));
                }}
                placeholder={t("pickDeadline")}
                className="h-9 flex-1"
              />
              {p.endDate && (
                <button
                  type="button"
                  onClick={() => updateProject({ projectId, endDate: null }).then(() => toast.success(t("deadlineCleared")))}
                  className={cn(btnOutline, "h-9 px-2.5 text-xs")}
                  aria-label={t("clearDeadline")}
                >
                  {t("clear")}
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Timer1 variant="Bulk" size={16} /> {t("timeTracking")}</p>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold">{fmtMinutes(timeSummary?.totalTracked ?? 0, t)}</span>
              <span className="text-xs text-muted-foreground">{t("tracked")}</span>
            </div>
            {(timeSummary?.totalEstimate ?? 0) > 0 ? (
              <>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-(--accent-mint) transition-all" style={{ width: `${Math.min(100, Math.round(((timeSummary?.totalTracked ?? 0) / (timeSummary!.totalEstimate)) * 100))}%` }} /></div>
                <p className="mt-1.5 text-xs text-muted-foreground">{t("est")} {fmtMinutes(timeSummary!.totalEstimate, t)} · {fmtMinutes(timeSummary!.remaining, t)} {t("remaining")}</p>
              </>
            ) : <p className="mt-1.5 text-xs text-muted-foreground">{t("addTaskEstimates")}</p>}
          </div>

          {/* Status breakdown */}
          <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
            <p className="mb-3 text-sm font-semibold">{t("statusBreakdown")}</p>
            {detail.progress.total === 0 ? <p className="text-sm text-muted-foreground">{t("noTasksYet")}</p> : (
              <div className="space-y-2.5">
                {cols.map((s: any) => {
                  const n = detail.progress.byStatus[s.key] ?? 0;
                  const pc = detail.progress.total ? Math.round((n / detail.progress.total) * 100) : 0;
                  return (
                    <div key={s.key} className="flex items-center gap-3">
                      <span className="flex w-28 shrink-0 items-center gap-1.5 text-sm"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />{s.label}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all" style={{ width: `${pc}%`, backgroundColor: s.color }} /></div>
                      <span className="w-8 text-right text-xs text-muted-foreground">{n}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Team */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-semibold"><People variant="Bulk" size={16} /> {t("team")}</p>
              <Popover>
                <PopoverTrigger asChild><button className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-primary hover:bg-primary/10" data-testid="project-add-member"><Add variant="Bulk" size={14} /> {t("assign")}</button></PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-1.5">
                  <p className="px-2 py-1 text-xs font-medium text-muted-foreground">{t("addToProject")}</p>
                  {(wsMembers ?? []).filter((m: any) => !memberIds.has(m.userId)).map((m: any) => (
                    <button key={m.userId} onClick={() => addMember({ projectId, userId: m.userId }).then(() => toast.success(t("memberAssigned")))} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted">
                      <Avatar className="h-6 w-6"><AvatarImage src={m.image} /><AvatarFallback className="bg-primary text-[10px] text-primary-foreground">{(m.name ?? m.email ?? "U").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                      <span className="truncate">{m.name ?? m.email}</span>
                    </button>
                  ))}
                  {(wsMembers ?? []).filter((m: any) => !memberIds.has(m.userId)).length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">{t("everyoneAssigned")}</p>}
                </PopoverContent>
              </Popover>
            </div>
            {detail.members.length === 0 ? <p className="text-sm text-muted-foreground">{t("noOneAssigned")}</p> : (
              <div className="space-y-1.5">
                {detail.members.map((m: any) => (
                  <div key={m.userId} className="group flex items-center gap-2" data-testid="project-member">
                    <Avatar className="h-7 w-7"><AvatarImage src={m.image} /><AvatarFallback className="bg-primary text-[10px] text-primary-foreground">{(m.name ?? m.email ?? "U").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                    <span className="flex-1 truncate text-sm">{m.name ?? m.email}</span>
                    <span className="text-xs capitalize text-muted-foreground">{m.role}</span>
                    <button onClick={() => removeMember({ projectId, userId: m.userId })} className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"><CloseCircle variant="Bulk" size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {p.description && (
            <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-3">
              <p className="mb-2 text-sm font-semibold">{t("description")}</p>
              <p className="text-sm text-muted-foreground">{p.description}</p>
            </div>
          )}
        </div>
      )}

      {/* TASKS */}
      {tab === "tasks" && (
        <div data-testid="project-tasks">
          <div className="mb-3 flex gap-2">
            <input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={async (e) => { if (e.key === "Enter" && newTask.trim() && activeWorkspaceId && !createBusy) { setCreateBusy(true); try { await createTask({ workspaceId: activeWorkspaceId, title: newTask.trim(), projectId, status: cols[0]?.key ?? "todo" }); setNewTask(""); toast.success(t("taskAdded")); } catch { toast.error(t("taskAddFailed") ?? "Failed to add task"); } finally { setCreateBusy(false); } } }} placeholder={t("addTaskToProject")} className={inputBase} data-testid="project-new-task-input" />
            <button disabled={createBusy || !newTask.trim() || !activeWorkspaceId} onClick={async () => { if (!newTask.trim() || !activeWorkspaceId) return; setCreateBusy(true); try { await createTask({ workspaceId: activeWorkspaceId, title: newTask.trim(), projectId, status: cols[0]?.key ?? "todo" }); setNewTask(""); toast.success(t("taskAdded")); } catch { toast.error(t("taskAddFailed") ?? "Failed to add task"); } finally { setCreateBusy(false); } }} className={cn(btnPrimary, createBusy && "opacity-70")} data-testid="project-add-task-btn"><Add variant="Bulk" size={18} /> {t("add")}</button>
            <button onClick={() => setCreateOpen(true)} className={cn(btnOutline, "ml-auto")} data-testid="project-new-task-dialog-btn">{t("newTask")}</button>
          </div>
          {(tasks ?? []).length === 0 ? <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{t("noTasksInProject")}</p> : (
            <div className="space-y-4">
              {cols.map((s: any) => {
                const ts = (tasks ?? []).filter((task: any) => task.status === s.key);
                if (ts.length === 0) return null;
                return (
                  <div key={s.key}>
                    <div className="mb-1.5 flex items-center gap-2 px-1 text-sm font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} /> {s.label} <span className="text-muted-foreground">{ts.length}</span></div>
                    <div className="overflow-hidden rounded-2xl border border-border bg-card">
                      {ts.map((task: any) => (
                        <div key={task._id} className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0 hover:bg-muted/40" data-testid="project-task-row">
                          <button onClick={() => { const doneKey = cols.find((c: any) => c.isDone)?.key ?? "done"; const todoKey = cols.find((c: any) => !c.isDone)?.key ?? "todo"; setStatus({ taskId: task._id, status: task.status === doneKey ? todoKey : doneKey }); }} className={cn(s.isDone ? "text-(--accent-mint)" : "text-muted-foreground hover:text-foreground")}><TickCircle variant="Bulk" size={20} /></button>
                          <span className={cn("flex-1 truncate text-sm", s.isDone && "text-muted-foreground line-through")}>{task.title}</span>
                          {task.estimateMinutes ? <span className="text-xs text-muted-foreground">{fmtMinutes(task.estimateMinutes, t)}</span> : null}
                          {task.priority !== "none" && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `color-mix(in oklch, ${PRIORITY_COLOR[task.priority]} 16%, transparent)`, color: PRIORITY_COLOR[task.priority] }}><Flag variant="Bulk" size={11} /> {task.priority}</span>}
                          {task.assignee && <Avatar className="h-6 w-6"><AvatarImage src={task.assignee.image} /><AvatarFallback className="bg-primary text-[10px] text-primary-foreground">{(task.assignee.name ?? task.assignee.email ?? "U").charAt(0).toUpperCase()}</AvatarFallback></Avatar>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <TaskCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        members={wsMembers ?? []}
        projects={[]}
        labels={labels ?? []}
        statuses={cols}
        defaultStatus={cols[0]?.key ?? "todo"}
        workspaceId={activeWorkspaceId}
        defaultProjectId={projectId}
        onCreate={async (data: any) => {
          if (!activeWorkspaceId) return;
          await createTask({ workspaceId: activeWorkspaceId, projectId, ...data });
          toast.success(t("taskAdded"));
          setCreateOpen(false);
        }}
      />

      {/* TIMELINE (Gantt) */}
      {tab === "timeline" && (
        <div className="rounded-2xl border border-border bg-card p-1" data-testid="project-timeline">
          <GanttChart tasks={ganttTasks} projectDueDate={p.endDate} projectColor={p.color ?? "#6366f1"} />
        </div>
      )}

      {/* RETRO PLANNING */}
      {tab === "retro" && activeWorkspaceId && (
        <div className="rounded-2xl border border-border bg-card p-4" data-testid="project-retro">
          <RetroPlanningPanel projectId={projectId} workspaceId={activeWorkspaceId} projectDueDate={p.endDate} />
        </div>
      )}

      {/* TIME */}
      {tab === "time" && (
        <div className="space-y-4" data-testid="project-time">
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: t("timeTracked"), value: fmtMinutes(timeSummary?.totalTracked ?? 0, t), icon: Timer1 },
              { label: t("timeEstimated"), value: fmtMinutes(timeSummary?.totalEstimate ?? 0, t), icon: Clock },
              { label: t("timeRemaining"), value: fmtMinutes(timeSummary?.remaining ?? 0, t), icon: TickCircle },
              { label: t("entries"), value: String(timeSummary?.entryCount ?? 0), icon: Activity },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><c.icon variant="Bulk" size={14} /> {c.label}</p>
                <p className="mt-1 text-xl font-bold">{c.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 text-sm font-semibold">{t("byMember")}</p>
            {(timeSummary?.perMember ?? []).length === 0 ? <p className="text-sm text-muted-foreground">{t("noTimeLogged")}</p> : (
              <div className="space-y-2">
                {timeSummary!.perMember.map((m: any, i: number) => {
                  const max = timeSummary!.perMember[0].minutes || 1;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <Avatar className="h-7 w-7"><AvatarImage src={m.user?.image} /><AvatarFallback className="bg-primary text-[10px] text-primary-foreground">{(m.user?.name ?? m.user?.email ?? "U").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                      <span className="w-32 truncate text-sm">{m.user?.name ?? m.user?.email}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((m.minutes / max) * 100)}%` }} /></div>
                      <span className="w-16 text-right text-xs text-muted-foreground">{fmtMinutes(m.minutes, t)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DISCUSSION */}
      {tab === "discussion" && (
        <div className="h-[calc(100vh-16rem)] overflow-hidden rounded-2xl border border-border bg-card" data-testid="project-discussion">
          <ChatPanel projectId={projectId} className="h-full" />
        </div>
      )}

      {/* ACTIVITY */}
      {tab === "activity" && (
        <div className="rounded-2xl border border-border bg-card p-5" data-testid="project-activity">
          <p className="mb-4 text-sm font-semibold">{t("recentActivity")}</p>
          <ActivityPanel targetType="project" targetId={projectId} />
        </div>
      )}
    </PageContainer>
  );
}
