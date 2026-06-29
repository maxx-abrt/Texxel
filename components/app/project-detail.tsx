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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { GanttChart } from "@/components/gantt-chart";
import { RetroPlanningPanel } from "@/components/retro-planning";
import {
  ArrowLeft2, Briefcase, TaskSquare, Calendar, Chart, People, Clock, Activity,
  Add, TickCircle, Flag, Timer1, CloseCircle,
} from "iconsax-reactjs";

const STATUS: Record<string, { label: string; color: string }> = {
  planning: { label: "Planning", color: "#2f7ea6" },
  active: { label: "Active", color: "#2fbf9b" },
  on_hold: { label: "On hold", color: "#d98324" },
  completed: { label: "Completed", color: "#8b8f9a" },
};

const PRIORITY_COLOR: Record<string, string> = {
  none: "var(--muted-foreground)", low: "#2f7ea6", medium: "#d98324", high: "#e5484d", urgent: "#fb5648",
};

function fmtMinutes(m: number) {
  if (!m) return "0h";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h ? h + "h" : ""}${mm ? " " + mm + "m" : h ? "" : "0h"}`.trim();
}
function fmtDate(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function ProgressRing({ pct, size = 96, stroke = 9, color = "var(--flux-coral)" }: any) {
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
        <span className="text-[10px] text-muted-foreground">done</span>
      </div>
    </div>
  );
}

const TABS = [
  { key: "overview", label: "Overview", icon: Chart },
  { key: "tasks", label: "Tasks", icon: TaskSquare },
  { key: "timeline", label: "Timeline", icon: Calendar },
  { key: "retro", label: "Retro Planning", icon: Activity },
  { key: "time", label: "Time", icon: Clock },
  { key: "activity", label: "History", icon: Activity },
];

export function ProjectDetail({ projectId }: { projectId: Id<"projects"> }) {
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace();
  const detail = useQuery(api.flux_projects.detail, { projectId });
  const timeSummary = useQuery(api.flux_time.projectSummary, { projectId });
  const tasks = useQuery(api.flux_tasks.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId, projectId } : "skip");
  const wsMembers = useQuery(api.workspaces.listMembers, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const statuses = useQuery(api.flux_taskStatuses.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");

  const updateProject = useMutation(api.projects.update);
  const addMember = useMutation(api.flux_projects.addMember);
  const removeMember = useMutation(api.flux_projects.removeMember);
  const createTask = useMutation(api.flux_tasks.create);
  const setStatus = useMutation(api.flux_tasks.setStatus);

  const [tab, setTab] = useState("overview");
  const [newTask, setNewTask] = useState("");

  if (detail === undefined) {
    return <PageContainer><div className="flex h-64 items-center justify-center"><Spinner /></div></PageContainer>;
  }
  if (detail === null) {
    return <PageContainer><div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground"><Briefcase variant="Bulk" size={40} /><p>Project not found</p><button onClick={() => router.push("/app/projects")} className={btnOutline}>Back to projects</button></div></PageContainer>;
  }

  const p = detail.project;
  const st = STATUS[p.status] ?? STATUS.planning;
  const cols = (statuses ?? []) as any[];
  const memberIds = new Set(detail.members.map((m: any) => m.userId));

  const ganttTasks = (tasks ?? []).map((t: any) => ({
    _id: t._id, title: t.title, status: t.status, priority: t.priority,
    dueDate: t.dueDate, createdAt: t.createdAt, assigneeName: t.assignee?.name ?? t.assignee?.email,
  }));

  const deadlineStr = p.endDate ? new Date(p.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;
  const daysRemaining = p.endDate ? Math.ceil((p.endDate - Date.now()) / 86_400_000) : null;
  const daysLeft = daysRemaining !== null ? Math.max(0, daysRemaining) : null;

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-5">
        <button onClick={() => router.push("/app/projects")} className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" data-testid="project-back">
          <ArrowLeft2 variant="Bulk" size={16} /> Projects
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-primary" style={{ backgroundColor: `color-mix(in oklch, ${p.color ?? "var(--flux-coral)"} 20%, transparent)` }}>
              <Briefcase variant="Bulk" size={26} style={{ color: p.color ?? "var(--flux-coral)" }} />
            </span>
            <div>
              <input
                defaultValue={p.name}
                onBlur={(e) => e.target.value.trim() && e.target.value !== p.name && updateProject({ projectId, name: e.target.value.trim() }).then(() => toast.success("Renamed"))}
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
                <span className={cn(daysLeft !== null && daysLeft <= 7 && "font-medium")}>Deadline {deadlineStr}</span>
                {daysLeft !== null && <span className="ml-1 tabular-nums">· {daysLeft}d left</span>}
              </div>
            )}
            <Select value={p.status} onValueChange={(v) => updateProject({ projectId, status: v as any }).then(() => toast.success("Status updated"))}>
              <SelectTrigger className="h-9 w-36" data-testid="project-status-select"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} data-testid={`project-tab-${t.key}`}
            className={cn("flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition", tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <t.icon variant="Bulk" size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3" data-testid="project-overview">
          <div className="flex items-center gap-5 rounded-2xl border border-border bg-card p-5">
            <ProgressRing pct={detail.progress.pct} color={p.color ?? "var(--flux-coral)"} />
            <div>
              <p className="text-sm font-semibold">Progress</p>
              <p className="text-2xl font-bold">{detail.progress.done}<span className="text-base font-normal text-muted-foreground">/{detail.progress.total}</span></p>
              <p className="text-xs text-muted-foreground">tasks completed</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Calendar variant="Bulk" size={16} /> Deadline</p>
            {p.endDate ? (
              <>
                <div className="flex items-end justify-between">
                  <span className={cn("text-2xl font-bold", daysLeft !== null && daysLeft <= 7 && "text-destructive")}>{deadlineStr}</span>
                  <span className="text-xs text-muted-foreground">{daysLeft !== null ? `${daysLeft} days left` : "Set a deadline"}</span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{daysRemaining !== null && daysRemaining <= 0 ? "Overdue — update tasks or move the deadline." : "All retroplanning is calculated from this date."}</p>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">No deadline set.</p>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    onChange={(e) => { const d = e.target.value ? new Date(e.target.value).getTime() : undefined; if (d) updateProject({ projectId, endDate: d }).then(() => toast.success("Deadline set")); }}
                    className={cn(inputBase, "h-9 text-xs")}
                    data-testid="project-deadline-input"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Timer1 variant="Bulk" size={16} /> Time tracking</p>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold">{fmtMinutes(timeSummary?.totalTracked ?? 0)}</span>
              <span className="text-xs text-muted-foreground">tracked</span>
            </div>
            {(timeSummary?.totalEstimate ?? 0) > 0 ? (
              <>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-(--accent-mint) transition-all" style={{ width: `${Math.min(100, Math.round(((timeSummary?.totalTracked ?? 0) / (timeSummary!.totalEstimate)) * 100))}%` }} /></div>
                <p className="mt-1.5 text-xs text-muted-foreground">Est. {fmtMinutes(timeSummary!.totalEstimate)} · {fmtMinutes(timeSummary!.remaining)} left</p>
              </>
            ) : <p className="mt-1.5 text-xs text-muted-foreground">Add task estimates to track remaining time.</p>}
          </div>

          {/* Status breakdown */}
          <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
            <p className="mb-3 text-sm font-semibold">Status breakdown</p>
            {detail.progress.total === 0 ? <p className="text-sm text-muted-foreground">No tasks yet.</p> : (
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
              <p className="flex items-center gap-1.5 text-sm font-semibold"><People variant="Bulk" size={16} /> Team</p>
              <Popover>
                <PopoverTrigger asChild><button className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-primary hover:bg-primary/10" data-testid="project-add-member"><Add variant="Bulk" size={14} /> Assign</button></PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-1.5">
                  <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Add to project</p>
                  {(wsMembers ?? []).filter((m: any) => !memberIds.has(m.userId)).map((m: any) => (
                    <button key={m.userId} onClick={() => addMember({ projectId, userId: m.userId }).then(() => toast.success("Member assigned"))} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted">
                      <Avatar className="h-6 w-6"><AvatarImage src={m.image} /><AvatarFallback className="bg-primary text-[10px] text-primary-foreground">{(m.name ?? m.email ?? "U").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                      <span className="truncate">{m.name ?? m.email}</span>
                    </button>
                  ))}
                  {(wsMembers ?? []).filter((m: any) => !memberIds.has(m.userId)).length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">Everyone is assigned.</p>}
                </PopoverContent>
              </Popover>
            </div>
            {detail.members.length === 0 ? <p className="text-sm text-muted-foreground">No one assigned yet.</p> : (
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
              <p className="mb-2 text-sm font-semibold">Description</p>
              <p className="text-sm text-muted-foreground">{p.description}</p>
            </div>
          )}
        </div>
      )}

      {/* TASKS */}
      {tab === "tasks" && (
        <div data-testid="project-tasks">
          <div className="mb-3 flex gap-2">
            <input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={async (e) => { if (e.key === "Enter" && newTask.trim() && activeWorkspaceId) { await createTask({ workspaceId: activeWorkspaceId, title: newTask.trim(), projectId, status: cols[0]?.key ?? "todo" }); setNewTask(""); } }} placeholder="Add a task to this project…" className={inputBase} data-testid="project-new-task-input" />
            <button onClick={async () => { if (newTask.trim() && activeWorkspaceId) { await createTask({ workspaceId: activeWorkspaceId, title: newTask.trim(), projectId, status: cols[0]?.key ?? "todo" }); setNewTask(""); toast.success("Task added"); } }} className={btnPrimary}><Add variant="Bulk" size={18} /> Add</button>
          </div>
          {(tasks ?? []).length === 0 ? <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No tasks in this project yet.</p> : (
            <div className="space-y-4">
              {cols.map((s: any) => {
                const ts = (tasks ?? []).filter((t: any) => t.status === s.key);
                if (ts.length === 0) return null;
                return (
                  <div key={s.key}>
                    <div className="mb-1.5 flex items-center gap-2 px-1 text-sm font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} /> {s.label} <span className="text-muted-foreground">{ts.length}</span></div>
                    <div className="overflow-hidden rounded-2xl border border-border bg-card">
                      {ts.map((t: any) => (
                        <div key={t._id} className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0 hover:bg-muted/40" data-testid="project-task-row">
                          <button onClick={() => { const doneKey = cols.find((c: any) => c.isDone)?.key ?? "done"; const todoKey = cols.find((c: any) => !c.isDone)?.key ?? "todo"; setStatus({ taskId: t._id, status: t.status === doneKey ? todoKey : doneKey }); }} className={cn(s.isDone ? "text-(--accent-mint)" : "text-muted-foreground hover:text-foreground")}><TickCircle variant="Bulk" size={20} /></button>
                          <span className={cn("flex-1 truncate text-sm", s.isDone && "text-muted-foreground line-through")}>{t.title}</span>
                          {t.estimateMinutes ? <span className="text-xs text-muted-foreground">{fmtMinutes(t.estimateMinutes)}</span> : null}
                          {t.priority !== "none" && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `color-mix(in oklch, ${PRIORITY_COLOR[t.priority]} 16%, transparent)`, color: PRIORITY_COLOR[t.priority] }}><Flag variant="Bulk" size={11} /> {t.priority}</span>}
                          {t.assignee && <Avatar className="h-6 w-6"><AvatarImage src={t.assignee.image} /><AvatarFallback className="bg-primary text-[10px] text-primary-foreground">{(t.assignee.name ?? t.assignee.email ?? "U").charAt(0).toUpperCase()}</AvatarFallback></Avatar>}
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
              { label: "Tracked", value: fmtMinutes(timeSummary?.totalTracked ?? 0), icon: Timer1 },
              { label: "Estimated", value: fmtMinutes(timeSummary?.totalEstimate ?? 0), icon: Clock },
              { label: "Remaining", value: fmtMinutes(timeSummary?.remaining ?? 0), icon: TickCircle },
              { label: "Entries", value: String(timeSummary?.entryCount ?? 0), icon: Activity },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><c.icon variant="Bulk" size={14} /> {c.label}</p>
                <p className="mt-1 text-xl font-bold">{c.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 text-sm font-semibold">By member</p>
            {(timeSummary?.perMember ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No time logged yet. Log time on individual tasks (Tasks page → open a task → Time tracking).</p> : (
              <div className="space-y-2">
                {timeSummary!.perMember.map((m: any, i: number) => {
                  const max = timeSummary!.perMember[0].minutes || 1;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <Avatar className="h-7 w-7"><AvatarImage src={m.user?.image} /><AvatarFallback className="bg-primary text-[10px] text-primary-foreground">{(m.user?.name ?? m.user?.email ?? "U").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                      <span className="w-32 truncate text-sm">{m.user?.name ?? m.user?.email}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((m.minutes / max) * 100)}%` }} /></div>
                      <span className="w-16 text-right text-xs text-muted-foreground">{fmtMinutes(m.minutes)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ACTIVITY */}
      {tab === "activity" && (
        <div className="rounded-2xl border border-border bg-card p-5" data-testid="project-activity">
          <p className="mb-3 text-sm font-semibold">Recent activity</p>
          {detail.recent.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : (
            <div className="space-y-3">
              {detail.recent.map((a: any) => (
                <div key={a._id} className="flex items-start gap-3">
                  <Avatar className="mt-0.5 h-7 w-7"><AvatarImage src={a.actor?.image} /><AvatarFallback className="bg-primary text-[10px] text-primary-foreground">{(a.actor?.name ?? "U").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                  <div className="text-sm"><span className="font-medium">{a.actor?.name ?? "Someone"}</span> <span className="text-muted-foreground">{a.action.replace(/[._]/g, " ")}</span><p className="text-xs text-muted-foreground">{timeAgo(a.createdAt)}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
