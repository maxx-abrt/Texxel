"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { PageContainer, PageHeader, EmptyState, btnPrimary, btnOutline, inputBase } from "@/components/app/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  TaskSquare, Add, Kanban, RowVertical, More, Trash, Flag, Calendar, TickCircle, Send2,
} from "iconsax-reactjs";

const STATUSES = [
  { id: "todo", label: "To do", color: "var(--accent-ocean)" },
  { id: "in_progress", label: "In progress", color: "#d98324" },
  { id: "done", label: "Done", color: "var(--accent-mint)" },
] as const;

const PRIORITIES: Record<string, { label: string; color: string }> = {
  none: { label: "None", color: "var(--muted-foreground)" },
  low: { label: "Low", color: "#2f7ea6" },
  medium: { label: "Medium", color: "#d98324" },
  high: { label: "High", color: "#e5484d" },
  urgent: { label: "Urgent", color: "#fb5648" },
};

function fmtDate(ts?: number) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function toDateInput(ts?: number) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TasksView() {
  const search = useSearchParams();
  const { activeWorkspaceId } = useWorkspace();
  const tasks = useQuery(api.flux_tasks.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const members = useQuery(api.workspaces.listMembers, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const projects = useQuery(api.projects.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");

  const create = useMutation(api.flux_tasks.create);
  const update = useMutation(api.flux_tasks.update);
  const setStatus = useMutation(api.flux_tasks.setStatus);
  const remove = useMutation(api.flux_tasks.remove);

  const [view, setView] = useState<"board" | "list">("board");
  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<"todo" | "in_progress" | "done">("todo");
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    if (search.get("new") === "1") setCreateOpen(true);
  }, [search]);

  const byStatus = useMemo(() => {
    const map: Record<string, any[]> = { todo: [], in_progress: [], done: [] };
    for (const t of tasks ?? []) map[t.status]?.push(t);
    return map;
  }, [tasks]);

  return (
    <PageContainer>
      <PageHeader
        title="Tasks"
        subtitle="Plan, assign and track your work"
        icon={TaskSquare}
        testId="tasks-header"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-full border border-border bg-card p-0.5">
              <button onClick={() => setView("board")} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-sm", view === "board" ? "bg-muted font-medium" : "text-muted-foreground")} data-testid="tasks-view-board">
                <Kanban variant="Bulk" size={16} /> Board
              </button>
              <button onClick={() => setView("list")} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-sm", view === "list" ? "bg-muted font-medium" : "text-muted-foreground")} data-testid="tasks-view-list">
                <RowVertical variant="Bulk" size={16} /> List
              </button>
            </div>
            <button onClick={() => { setCreateStatus("todo"); setCreateOpen(true); }} className={btnPrimary} data-testid="new-task-btn">
              <Add variant="Bulk" size={18} /> New task
            </button>
          </div>
        }
      />

      {tasks === undefined ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : (tasks.length === 0 && view === "list") ? (
        <EmptyState icon={TaskSquare} title="No tasks yet" description="Create a task to start tracking your work." testId="tasks-empty"
          action={<button onClick={() => setCreateOpen(true)} className={btnPrimary}><Add variant="Bulk" size={18} /> New task</button>} />
      ) : view === "board" ? (
        <div className="grid gap-4 md:grid-cols-3" data-testid="tasks-kanban-board">
          {STATUSES.map((s) => (
            <div key={s.id} className="flex flex-col rounded-2xl border border-border bg-muted/40 p-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                  <span className="text-muted-foreground">{byStatus[s.id].length}</span>
                </div>
                <button onClick={() => { setCreateStatus(s.id); setCreateOpen(true); }} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-background">
                  <Add variant="Bulk" size={16} />
                </button>
              </div>
              <div className="flex-1 space-y-2">
                {byStatus[s.id].map((t: any) => (
                  <TaskCard key={t._id} task={t} onClick={() => setSelected(t)} onMove={(st) => setStatus({ taskId: t._id, status: st })} />
                ))}
                {byStatus[s.id].length === 0 && (
                  <button onClick={() => { setCreateStatus(s.id); setCreateOpen(true); }} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 text-xs text-muted-foreground hover:bg-background">
                    <Add variant="Bulk" size={14} /> Add task
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5" data-testid="tasks-list">
          {STATUSES.map((s) => byStatus[s.id].length > 0 && (
            <div key={s.id}>
              <div className="mb-1.5 flex items-center gap-2 px-1 text-sm font-semibold">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} /> {s.label}
                <span className="text-muted-foreground">{byStatus[s.id].length}</span>
              </div>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                {byStatus[s.id].map((t: any) => (
                  <div key={t._id} data-testid="tasks-list-row" className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0 hover:bg-muted/50">
                    <button onClick={() => setStatus({ taskId: t._id, status: t.status === "done" ? "todo" : "done" })} className={cn("shrink-0", t.status === "done" ? "text-[var(--accent-mint)]" : "text-muted-foreground hover:text-foreground")}>
                      <TickCircle variant="Bulk" size={20} />
                    </button>
                    <button onClick={() => setSelected(t)} className="min-w-0 flex-1 text-left">
                      <span className={cn("truncate text-sm", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</span>
                    </button>
                    {t.priority !== "none" && (
                      <span className="hidden items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium sm:inline-flex" style={{ backgroundColor: `color-mix(in oklch, ${PRIORITIES[t.priority].color} 16%, transparent)`, color: PRIORITIES[t.priority].color }}>
                        <Flag variant="Bulk" size={12} /> {PRIORITIES[t.priority].label}
                      </span>
                    )}
                    {t.dueDate && <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex"><Calendar variant="Bulk" size={13} /> {fmtDate(t.dueDate)}</span>}
                    {t.assignee && (
                      <Avatar className="h-6 w-6"><AvatarImage src={t.assignee.image} /><AvatarFallback className="bg-primary text-[10px] text-primary-foreground">{(t.assignee.name ?? t.assignee.email ?? "U").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><More variant="Bulk" size={16} /></button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelected(t)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => remove({ taskId: t._id })} className="text-destructive">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <TaskCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        members={members ?? []}
        projects={projects ?? []}
        defaultStatus={createStatus}
        onCreate={async (data) => {
          if (!activeWorkspaceId) return;
          await create({ workspaceId: activeWorkspaceId, ...data });
          toast.success("Task created");
          setCreateOpen(false);
        }}
      />

      <TaskDetailSheet
        task={selected}
        onClose={() => setSelected(null)}
        members={members ?? []}
        onUpdate={async (patch) => { if (selected) await update({ taskId: selected._id, ...patch }); }}
        onDelete={async () => { if (selected) { await remove({ taskId: selected._id }); setSelected(null); toast.success("Task deleted"); } }}
      />
    </PageContainer>
  );
}

function TaskCard({ task, onClick, onMove }: any) {
  return (
    <div onClick={onClick} data-testid="tasks-kanban-card" className="group cursor-pointer rounded-xl border border-border bg-card p-3 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 flex-1 text-left text-sm font-medium">{task.title}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button onClick={(e) => e.stopPropagation()} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100"><More variant="Bulk" size={15} /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {STATUSES.map((s) => <DropdownMenuItem key={s.id} onClick={() => onMove(s.id)}>Move to {s.label}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {task.priority !== "none" && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `color-mix(in oklch, ${PRIORITIES[task.priority].color} 16%, transparent)`, color: PRIORITIES[task.priority].color }}>
            <Flag variant="Bulk" size={11} /> {PRIORITIES[task.priority].label}
          </span>
        )}
        {task.dueDate && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Calendar variant="Bulk" size={12} /> {fmtDate(task.dueDate)}</span>}
        {task.assignee && <Avatar className="ml-auto h-5 w-5"><AvatarImage src={task.assignee.image} /><AvatarFallback className="bg-primary text-[9px] text-primary-foreground">{(task.assignee.name ?? task.assignee.email ?? "U").charAt(0).toUpperCase()}</AvatarFallback></Avatar>}
      </div>
    </div>
  );
}

function TaskCreateDialog({ open, onOpenChange, onCreate, members, projects, defaultStatus }: any) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("none");
  const [assigneeId, setAssigneeId] = useState("none");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setTitle(""); setDescription(""); setPriority("none"); setAssigneeId("none"); setDue(""); } }, [open]);

  const submit = async () => {
    if (!title.trim()) return toast.error("Add a task title");
    setBusy(true);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        status: defaultStatus,
        priority,
        assigneeId: assigneeId === "none" ? undefined : assigneeId,
        dueDate: due ? new Date(due).getTime() : undefined,
      });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="task-create-dialog">
        <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()} placeholder="Task title" className={inputBase} data-testid="task-title-input" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} className={cn(inputBase, "resize-none")} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger data-testid="task-priority-select"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PRIORITIES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Due date</label>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputBase} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Assignee</label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {members.map((m: any) => <SelectItem key={m.userId} value={m.userId}>{m.name ?? m.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className={btnOutline}>Cancel</button>
          <button onClick={submit} disabled={busy} className={btnPrimary} data-testid="task-create-submit">{busy ? "Creating\u2026" : "Create task"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskDetailSheet({ task, onClose, members, onUpdate, onDelete }: any) {
  const comments = useQuery(api.flux_tasks.listComments, task ? { taskId: task._id } : "skip");
  const addComment = useMutation(api.flux_tasks.addComment);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => { setTitle(task?.title ?? ""); }, [task]);

  if (!task) return null;

  return (
    <Sheet open={!!task} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md" data-testid="task-detail-sheet">
        <SheetHeader className="border-b border-border p-4"><SheetTitle>Task details</SheetTitle></SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== task.title && onUpdate({ title: title.trim() })} className="w-full rounded-xl border border-transparent bg-transparent text-lg font-semibold outline-none hover:border-border focus:border-border focus:px-3 focus:py-2" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <Select value={task.status} onValueChange={(v) => onUpdate({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
              <Select value={task.priority} onValueChange={(v) => onUpdate({ priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PRIORITIES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Assignee</label>
              <Select value={task.assigneeId ?? "none"} onValueChange={(v) => onUpdate({ assigneeId: v === "none" ? undefined : v })}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {members.map((m: any) => <SelectItem key={m.userId} value={m.userId}>{m.name ?? m.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Due date</label>
              <input type="date" defaultValue={toDateInput(task.dueDate)} onChange={(e) => onUpdate({ dueDate: e.target.value ? new Date(e.target.value).getTime() : undefined })} className={inputBase} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Comments</label>
            <div className="space-y-2">
              {(comments ?? []).map((c: any) => (
                <div key={c._id} className="rounded-xl bg-muted/60 p-2.5">
                  <p className="text-xs font-medium">{c.user?.name ?? c.user?.email ?? "User"}</p>
                  <p className="text-sm">{c.content}</p>
                </div>
              ))}
              {comments && comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={async (e) => { if (e.key === "Enter" && comment.trim()) { await addComment({ taskId: task._id, content: comment.trim() }); setComment(""); } }} placeholder="Add a comment…" className={inputBase} />
              <button onClick={async () => { if (comment.trim()) { await addComment({ taskId: task._id, content: comment.trim() }); setComment(""); } }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Send2 variant="Bulk" size={16} /></button>
            </div>
          </div>
        </div>
        <div className="border-t border-border p-4">
          <button onClick={onDelete} className="flex items-center gap-2 text-sm font-medium text-destructive hover:underline" data-testid="task-delete"><Trash variant="Bulk" size={16} /> Delete task</button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
