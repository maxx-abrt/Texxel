"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { FolderKanban } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { useBulkSelect } from "@/hooks/useBulkSelect";
import { PageContainer, PageHeader, EmptyState, btnPrimary, btnOutline, inputBase } from "@/components/app/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TaskBulkImportDialog } from "@/components/app/task-bulk-import-dialog";
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors,
  closestCorners, useDroppable, type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  TaskSquare, Add, Kanban, RowVertical, More, Trash, Flag, Calendar, TickCircle,
  Send2, Tag, Setting4, CloseCircle, TickSquare, Profile, Clock, DocumentDownload,
  ArrowDown2,
} from "iconsax-reactjs";

const PRIORITIES: Record<string, { label: string; color: string }> = {
  none: { label: "None", color: "var(--muted-foreground)" },
  low: { label: "Low", color: "#2f7ea6" },
  medium: { label: "Medium", color: "#d98324" },
  high: { label: "High", color: "#e5484d" },
  urgent: { label: "Urgent", color: "#e65a41" },
};

const STATUS_PALETTE = ["#2f7ea6", "#d98324", "#2fbf9b", "#8b5cf6", "#ec4899", "#e5484d", "#0ea5e9", "#f59e0b"];

function fmtDate(ts?: number) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function exportTasksCSV(tasks: any[], statuses: any[]) {
  const header = ["Title", "Status", "Priority", "Assignee", "Due Date", "Labels", "Estimate (min)"];
  const rows = tasks.map((t) => {
    const statusLabel = statuses.find((s) => s.key === t.status)?.label ?? t.status;
    return [
      `"${(t.title ?? "").replace(/"/g, '""')}"`,
      statusLabel,
      t.priority ?? "none",
      t.assignee?.name ?? t.assignee?.email ?? "",
      t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "",
      `"${(t.labels ?? []).join(", ")}"`,
      t.estimateMinutes ?? "",
    ].join(",");
  });
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tasks-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
function toDateInput(ts?: number) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Status = { _id: Id<"flux_taskStatuses"> | null; key: string; label: string; color: string; order: number; isDone?: boolean };

export function TasksView() {
  const t = useTranslations("tasks");
  const search = useSearchParams();
  const { activeWorkspaceId, me } = useWorkspace();
  const tasks = useQuery(api.flux_tasks.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const statuses = useQuery(api.flux_taskStatuses.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip") as Status[] | undefined;
  const members = useQuery(api.workspaces.listMembers, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const projects = useQuery(api.projects.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const labels = useQuery(api.flux_labels.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");

  const create = useMutation(api.flux_tasks.create);
  const update = useMutation(api.flux_tasks.update);
  const setStatus = useMutation(api.flux_tasks.setStatus);
  const remove = useMutation(api.flux_tasks.remove);
  const ensureDefaults = useMutation(api.flux_taskStatuses.ensureDefaults);

  const [view, setView] = useState<"board" | "list" | "assignee">("board");
  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<string>("todo");
  const [selected, setSelected] = useState<any>(null);
  const [statusMgrOpen, setStatusMgrOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);

  const bulkCreate = useMutation(api.flux_tasks.bulkCreate);

  useEffect(() => { if (search.get("new") === "1") setCreateOpen(true); }, [search]);
  useEffect(() => { if (activeWorkspaceId) ensureDefaults({ workspaceId: activeWorkspaceId }).catch(() => {}); }, [activeWorkspaceId, ensureDefaults]);

  const cols: Status[] = useMemo(() => {
    const s = (statuses ?? []).slice().sort((a, b) => a.order - b.order);
    return s.length ? s : [];
  }, [statuses]);

  const filteredTasks = useMemo(() => {
    let list = (tasks ?? []).filter((t: any) => !t.parentId);
    if (labelFilter) list = list.filter((t: any) => (t.labels ?? []).includes(labelFilter));
    if (assigneeFilter) list = list.filter((t: any) => t.assigneeId === assigneeFilter);
    if (projectFilter) list = list.filter((t: any) => t.projectId === projectFilter);
    return list;
  }, [tasks, labelFilter, assigneeFilter, projectFilter]);

  const labelColor = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of labels ?? []) m[l.name] = l.color;
    return m;
  }, [labels]);

  const showAssigneeFilter = (members?.length ?? 0) > 0 || !!me?._id;
  const otherMembers = useMemo(() => (members ?? []).filter((m: any) => m.userId !== me?._id), [members, me]);

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle") ?? "Plan, assign and track your work"}
        icon={TaskSquare}
        testId="tasks-header"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-full border border-border bg-card p-0.5">
              <button onClick={() => setView("board")} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-sm", view === "board" ? "bg-muted font-medium" : "text-muted-foreground")} data-testid="tasks-view-board">
                <Kanban variant="Bulk" size={16} /> {t("views.board")}
              </button>
              <button onClick={() => setView("list")} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-sm", view === "list" ? "bg-muted font-medium" : "text-muted-foreground")} data-testid="tasks-view-list">
                <RowVertical variant="Bulk" size={16} /> {t("views.list")}
              </button>
              <button onClick={() => setView("assignee")} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-sm", view === "assignee" ? "bg-muted font-medium" : "text-muted-foreground")} data-testid="tasks-view-assignee">
                <Profile variant="Bulk" size={16} /> {t("views.assignee")}
              </button>
            </div>
            <button
              onClick={() => exportTasksCSV(filteredTasks, cols)}
              className={cn(btnOutline, "h-9")}
              data-testid="tasks-export-csv"
              title={t("export") ?? "Export to CSV"}
            >
              <DocumentDownload variant="Bulk" size={16} /> {t("export") ?? "Export"}
            </button>
            <Link href="/app/tasks/trash" className={cn(btnOutline, "h-9")} data-testid="tasks-trash-link" title={t("trash") ?? "Trash"}>
              <Trash variant="Bulk" size={16} /> {t("trash") ?? "Trash"}
            </Link>
            <button onClick={() => setStatusMgrOpen(true)} className={cn(btnOutline, "h-9")} data-testid="manage-statuses-btn" title={t("manageStatuses") ?? "Manage statuses"}>
              <Setting4 variant="Bulk" size={16} /> {t("statusesLabel") ?? "Statuses"}
            </button>
            <button onClick={() => setBulkImportOpen(true)} className={cn(btnOutline, "h-9")} data-testid="bulk-import-btn" title={t("bulkImportTitle") ?? "Bulk add tasks"}>
              <DocumentDownload variant="Bulk" size={16} /> {t("bulkImport") ?? "Bulk add"}
            </button>
            <button onClick={() => { setCreateStatus(cols[0]?.key ?? "todo"); setCreateOpen(true); }} className={btnPrimary} data-testid="new-task-btn">
              <Add variant="Bulk" size={18} /> {t("newTask")}
            </button>
          </div>
        }
      />

      {/* Filter bars */}
      <div className="mb-4 flex flex-wrap gap-3">
        {/* Assignee filter */}
        {showAssigneeFilter ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("filterByAssignee")}:</span>
            <button onClick={() => setAssigneeFilter(null)} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", !assigneeFilter ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70")}>{t("allAssignees")}</button>
            {me?._id && (
              <button
                onClick={() => setAssigneeFilter(assigneeFilter === me._id ? null : me._id)}
                className={cn(
                  "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition",
                  assigneeFilter === me._id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}
                data-testid="tasks-filter-me"
              >
                <Avatar className="h-4 w-4">
                  <AvatarImage src={me.image} />
                  <AvatarFallback className="text-[9px]">{(me.name ?? me.email ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                {t("me")}
              </button>
            )}
            {otherMembers.map((m: any) => (
              <button key={m.userId} onClick={() => setAssigneeFilter(assigneeFilter === m.userId ? null : m.userId)}
                className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition", assigneeFilter === m.userId ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")}>
                <Avatar className="h-4 w-4">
                  <AvatarImage src={m.image} />
                  <AvatarFallback className="text-[9px]">{(m.name ?? m.email ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                {m.name ?? m.email}
              </button>
            ))}
          </div>
        ) : null}
        {/* Project filter */}
        {projects && projects.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("filterByProject")}:</span>
            <button onClick={() => setProjectFilter(null)} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", !projectFilter ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70")}>{t("allProjects")}</button>
            {projects.map((p: any) => (
              <button key={p._id} onClick={() => setProjectFilter(projectFilter === p._id ? null : p._id)}
                className={cn("rounded-full px-2.5 py-1 text-xs font-medium transition", projectFilter === p._id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")}>
                {p.name}
              </button>
            ))}
          </div>
        )}
        {/* Label filter */}
        {labels && labels.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" data-testid="label-filter-bar">
            <span className="text-xs font-medium text-muted-foreground"><Tag variant="Bulk" size={14} className="mr-1 inline" />{t("labels")}:</span>
            <button onClick={() => setLabelFilter(null)} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", !labelFilter ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70")}>{t("filters.all")}</button>
            {labels.map((l: any) => (
              <button key={l._id} onClick={() => setLabelFilter(labelFilter === l.name ? null : l.name)} data-testid="label-filter-chip"
                className={cn("rounded-full px-2.5 py-1 text-xs font-medium transition", labelFilter === l.name ? "ring-2 ring-offset-1" : "opacity-90 hover:opacity-100")}
                style={{ backgroundColor: `color-mix(in oklch, ${l.color} 18%, transparent)`, color: l.color }}>
                {l.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {tasks === undefined || statuses === undefined ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : view === "board" ? (
        <KanbanBoard
          cols={cols}
          tasks={filteredTasks}
          labelColor={labelColor}
          onOpen={(t: any) => setSelected(t)}
          onAdd={(statusKey: string) => { setCreateStatus(statusKey); setCreateOpen(true); }}
          onMove={async (taskId: string, statusKey: string, order: number) => { await setStatus({ taskId: taskId as Id<"tasks">, status: statusKey, order }); }}
        />
      ) : view === "assignee" ? (
        <AssigneeLanesView
          tasks={filteredTasks}
          members={members ?? []}
          cols={cols}
          labelColor={labelColor}
          onOpen={(t: any) => setSelected(t)}
        />
      ) : (
        <ListView
          cols={cols}
          tasks={filteredTasks}
          labelColor={labelColor}
          members={members ?? []}
          projects={projects ?? []}
          labels={labels ?? []}
          onOpen={(t: any) => setSelected(t)}
          onToggleDone={(t: any) => {
            const doneKey = cols.find((c) => c.isDone)?.key ?? "done";
            const todoKey = cols.find((c) => !c.isDone)?.key ?? "todo";
            setStatus({ taskId: t._id, status: t.status === doneKey ? todoKey : doneKey });
          }}
          onDelete={(t: any) => remove({ taskId: t._id })}
        />
      )}

      <TaskCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        members={members ?? []}
        projects={projects ?? []}
        labels={labels ?? []}
        statuses={cols}
        defaultStatus={createStatus}
        workspaceId={activeWorkspaceId}
        onCreate={async (data: any) => {
          if (!activeWorkspaceId) return;
          await create({ workspaceId: activeWorkspaceId, ...data });
          toast.success(t("created"));
          setCreateOpen(false);
        }}
      />

      <TaskDetailSheet
        task={selected}
        onClose={() => setSelected(null)}
        members={members ?? []}
        statuses={cols}
        labels={labels ?? []}
        labelColor={labelColor}
        workspaceId={activeWorkspaceId}
        onUpdate={async (patch: any) => { if (selected) await update({ taskId: selected._id, ...patch }); }}
        onDelete={async () => { if (selected) { await remove({ taskId: selected._id }); setSelected(null); toast.success(t("deleted")); } }}
      />

      <TaskBulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        workspaceId={activeWorkspaceId}
        members={members ?? []}
        projects={projects ?? []}
        statuses={cols}
        labels={labels ?? []}
        onCreate={async (tasks) => {
          if (!activeWorkspaceId) return;
          await bulkCreate({ workspaceId: activeWorkspaceId, tasks });
          setBulkImportOpen(false);
        }}
      />

      <StatusManagerDialog open={statusMgrOpen} onOpenChange={setStatusMgrOpen} statuses={cols} workspaceId={activeWorkspaceId} />
    </PageContainer>
  );
}

/* ───────────────────────── Kanban board (dnd-kit) ───────────────────────── */

function KanbanBoard({ cols, tasks, labelColor, onOpen, onAdd, onMove }: any) {
  // Local board state for instant, smooth drag feedback. Synced from props when
  // not actively dragging.
  const [board, setBoard] = useState<Record<string, any[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (draggingRef.current) return;
    const map: Record<string, any[]> = {};
    for (const c of cols) map[c.key] = [];
    for (const t of tasks) (map[t.status] ?? (map[t.status] = [])).push(t);
    for (const k of Object.keys(map)) map[k].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    setBoard(map);
  }, [tasks, cols]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findContainer = (id: string): string | undefined => {
    if (cols.some((c: any) => c.key === id)) return id;
    return Object.keys(board).find((k) => board[k].some((t) => t._id === id));
  };

  const activeTask = activeId
    ? Object.values(board).flat().find((t: any) => t._id === activeId)
    : null;

  const onDragStart = (e: DragStartEvent) => {
    draggingRef.current = true;
    setActiveId(String(e.active.id));
  };

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeC = findContainer(String(active.id));
    const overC = findContainer(String(over.id));
    if (!activeC || !overC || activeC === overC) return;
    setBoard((prev) => {
      const next = { ...prev };
      const activeItems = [...(next[activeC] ?? [])];
      const overItems = [...(next[overC] ?? [])];
      const idx = activeItems.findIndex((t) => t._id === active.id);
      if (idx < 0) return prev;
      const [moved] = activeItems.splice(idx, 1);
      const overIdx = overItems.findIndex((t) => t._id === over.id);
      const insertAt = overIdx >= 0 ? overIdx : overItems.length;
      overItems.splice(insertAt, 0, { ...moved, status: overC });
      next[activeC] = activeItems;
      next[overC] = overItems;
      return next;
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    draggingRef.current = false;
    if (!over) return;
    const activeC = findContainer(String(active.id));
    let overC = findContainer(String(over.id));
    if (!activeC || !overC) return;

    setBoard((prev) => {
      const next = { ...prev };
      const items = [...(next[overC!] ?? [])];
      const oldIndex = items.findIndex((t) => t._id === active.id);
      const newIndex = items.findIndex((t) => t._id === over.id);
      let ordered = items;
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        ordered = arrayMove(items, oldIndex, newIndex);
        next[overC!] = ordered;
      }
      // Persist: status + order for the moved task.
      const finalIndex = ordered.findIndex((t) => t._id === active.id);
      const order = (finalIndex >= 0 ? finalIndex : ordered.length) * 1000;
      onMove(String(active.id), overC!, order);
      return next;
    });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-2" data-testid="tasks-kanban-board">
        {cols.map((s: Status) => (
          <Column key={s.key} status={s} items={board[s.key] ?? []} labelColor={labelColor} onOpen={onOpen} onAdd={onAdd} />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCardInner task={activeTask} labelColor={labelColor} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ status, items, labelColor, onOpen, onAdd }: any) {
  const t = useTranslations("tasks");
  const { setNodeRef, isOver } = useSortableColumn(status.key);
  return (
    <div className="flex w-[300px] shrink-0 flex-col rounded-2xl border border-border bg-muted/40 p-3" data-testid="kanban-column" data-status={status.key}>
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
          {status.label}
          <span className="text-muted-foreground">{items.length}</span>
        </div>
        <button onClick={() => onAdd(status.key)} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-background">
          <Add variant="Bulk" size={16} />
        </button>
      </div>
      <SortableContext items={items.map((t: any) => t._id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={cn("flex-1 space-y-2 rounded-xl p-0.5 transition-colors", isOver && "bg-primary/5 ring-2 ring-primary/30")} style={{ minHeight: 80 }}>
          {items.map((t: any) => (
            <SortableTaskCard key={t._id} task={t} labelColor={labelColor} onOpen={onOpen} />
          ))}
          {items.length === 0 && (
            <button onClick={() => onAdd(status.key)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 text-xs text-muted-foreground hover:bg-background">
              <Add variant="Bulk" size={14} /> {t("addTask")}
            </button>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// Make a column body itself a droppable target (so dropping on empty space works).
function useSortableColumn(id: string) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return { setNodeRef, isOver };
}

function SortableTaskCard({ task, labelColor, onOpen }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task._id });
  const didDragRef = useRef(false);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms cubic-bezier(0.25,1,0.5,1)",
    opacity: isDragging ? 0.4 : 1,
  };
  useEffect(() => { if (isDragging) didDragRef.current = true; }, [isDragging]);
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      onClick={() => { if (didDragRef.current) { didDragRef.current = false; return; } onOpen(task); }}
      data-testid="tasks-kanban-card"
      className="cursor-grab touch-none rounded-xl border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing">
      <TaskCardInner task={task} labelColor={labelColor} />
    </div>
  );
}

function priorityStyle(priority: string) {
  const color = PRIORITIES[priority].color;
  return { backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)`, color };
}

function TaskCardInner({ task, labelColor, dragging }: any) {
  const t = useTranslations("tasks");
  return (
    <div className={cn(dragging && "rotate-2 shadow-xl ring-2 ring-primary/40 rounded-xl bg-card p-3 w-[280px]")}>
      <span className="block text-left text-sm font-medium leading-snug">{task.title}</span>
      {(task.labels ?? []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.map((l: string) => (
            <span key={l} className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `color-mix(in oklch, ${labelColor[l] ?? "#888"} 18%, transparent)`, color: labelColor[l] ?? "#888" }}>{l}</span>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {task.priority !== "none" && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={priorityStyle(task.priority)}>
            <Flag variant="Bulk" size={11} /> {t("priorities." + task.priority)}
          </span>
        )}
        {task.dueDate && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Calendar variant="Bulk" size={12} /> {fmtDate(task.dueDate)}</span>}
        {task.assignee && <Avatar className="ml-auto h-5 w-5"><AvatarImage src={task.assignee.image} /><AvatarFallback className="bg-primary text-[9px] text-primary-foreground">{(task.assignee.name ?? task.assignee.email ?? "U").charAt(0).toUpperCase()}</AvatarFallback></Avatar>}
      </div>
    </div>
  );
}

/* ───────────────────────── List view + bulk ops ───────────────────────── */

function ListView({ cols, tasks, labelColor, members, projects, labels, onOpen, onToggleDone, onDelete }: any) {
  const t = useTranslations("tasks");
  const { isSelecting, toggleSelecting, exitSelecting, selectedIds, toggle, isSelected, selectAll, deselectAll, lastSelectedId, toggleIds, selectRange } = useBulkSelect();
  const bulkUpdate = useMutation(api.flux_tasks.bulkUpdate);
  const bulkRemove = useMutation(api.flux_tasks.bulkRemove);

  useEffect(() => () => exitSelecting(), [exitSelecting]);

  const byStatus = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const c of cols) map[c.key] = [];
    for (const t of tasks) (map[t.status] ?? (map[t.status] = [])).push(t);
    return map;
  }, [tasks, cols]);

  const idsByStatus = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const c of cols) map[c.key] = [];
    for (const t of tasks) (map[t.status] ?? (map[t.status] = [])).push(t._id);
    return map;
  }, [tasks, cols]);

  const allIds = useMemo(() => tasks.map((t: any) => t._id), [tasks]);
  const selectedArr = useMemo(() => Array.from(selectedIds) as Id<"tasks">[], [selectedIds]);
  const allSelected = selectedIds.size === allIds.length && allIds.length > 0;

  const runBulk = async (patch: any) => {
    if (selectedArr.length === 0) return;
    await bulkUpdate({ taskIds: selectedArr, ...patch });
    toast.success(t("bulkUpdated", { count: selectedArr.length }));
  };

  const toggleLabel = (label: string) => {
    const selectedTasks = tasks.filter((t: any) => selectedIds.has(t._id));
    const add = selectedTasks.some((t: any) => !(t.labels ?? []).includes(label));
    runBulk(add ? { addLabels: [label] } : { removeLabels: [label] });
  };

  const markDone = () => {
    const doneKey = cols.find((c: any) => c.isDone)?.key ?? "done";
    runBulk({ status: doneKey });
  };

  const items = useMemo(() => {
    const out: ({ type: "header"; status: Status } | { type: "task"; task: any })[] = [];
    for (const s of cols) {
      const list = byStatus[s.key] ?? [];
      if (list.length === 0) continue;
      out.push({ type: "header", status: s });
      for (const t of list) out.push({ type: "task", task: t });
    }
    return out;
  }, [byStatus, cols]);

  const orderedTaskIds = useMemo(() => items.filter((i) => i.type === "task").map((i) => i.task._id), [items]);

  if (tasks.length === 0) {
    return <EmptyState icon={TaskSquare} title={t("empty.title")} description={t("empty.description")} testId="tasks-empty" />;
  }

  return (
    <div className="space-y-5" data-testid="tasks-list">
      <div className="flex items-center gap-2">
        <button onClick={toggleSelecting} className={cn(btnOutline, "h-8 text-xs")} data-testid="bulk-select-toggle">
          <TickSquare variant="Bulk" size={15} /> {isSelecting ? t("bulkCancel") : t("select")}
        </button>
        {isSelecting && (
          <>
            <button onClick={() => (allSelected ? deselectAll() : selectAll(allIds))} className="text-xs font-medium text-primary hover:underline">
              {allSelected ? t("deselectAll") : t("selectAll")}
            </button>
            <span className="text-xs text-muted-foreground">{t("bulkSelected", { count: selectedIds.size })}</span>
          </>
        )}
      </div>

      <div className="h-[70vh] overflow-hidden rounded-2xl border border-border bg-card">
        <Virtuoso
          data={items}
          itemContent={(index, item) => {
            if (item.type === "header") {
              const s = item.status;
              const statusIds = idsByStatus[s.key] ?? [];
              const statusSelectedCount = statusIds.filter((id) => selectedIds.has(id)).length;
              const statusAllSelected = statusIds.length > 0 && statusSelectedCount === statusIds.length;
              const statusSomeSelected = statusSelectedCount > 0 && !statusAllSelected;
              return (
                <div className="flex items-center gap-2 px-3 py-2 text-sm font-semibold" data-testid="tasks-list-header">
                  {isSelecting && (
                    <button
                      onClick={() => toggleIds(statusIds)}
                      className="shrink-0"
                      data-testid="tasks-list-header-checkbox"
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-md border",
                          statusAllSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : statusSomeSelected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border"
                        )}
                      >
                        {statusAllSelected && <TickCircle variant="Bold" size={14} />}
                        {!statusAllSelected && statusSomeSelected && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                      </span>
                    </button>
                  )}
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} /> {s.label}
                  <span className="text-muted-foreground">{byStatus[s.key]?.length ?? 0}</span>
                </div>
              );
            }
            const task = item.task;
            const s = cols.find((c: any) => c.key === task.status);
            return (
              <div className={cn("flex items-center gap-3 border-b border-border px-3 py-2.5 hover:bg-muted/50", isSelected(task._id) && "bg-primary/5")} data-testid="tasks-list-row">
                {isSelecting ? (
                  <button
                    onClick={(e) => {
                      if (e.shiftKey) {
                        e.preventDefault();
                        selectRange(lastSelectedId ?? task._id, task._id, orderedTaskIds);
                      } else {
                        toggle(task._id);
                      }
                    }}
                    onMouseDown={(e) => e.shiftKey && e.preventDefault()}
                    className="shrink-0"
                    data-testid="bulk-row-checkbox"
                  >
                    <span className={cn("flex h-5 w-5 items-center justify-center rounded-md border", isSelected(task._id) ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                      {isSelected(task._id) && <TickCircle variant="Bold" size={14} />}
                    </span>
                  </button>
                ) : (
                  <button onClick={() => onToggleDone(task)} className={cn("shrink-0", s?.isDone ? "text-[var(--accent-mint)]" : "text-muted-foreground hover:text-foreground")}>
                    <TickCircle variant="Bulk" size={20} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    if (isSelecting && e.shiftKey) {
                      e.preventDefault();
                      selectRange(lastSelectedId ?? task._id, task._id, orderedTaskIds);
                    } else if (isSelecting) {
                      toggle(task._id);
                    } else {
                      onOpen(task);
                    }
                  }}
                  onMouseDown={(e) => isSelecting && e.shiftKey && e.preventDefault()}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className={cn("truncate text-sm", s?.isDone && "text-muted-foreground line-through")}>{task.title}</span>
                </button>
                {(task.labels ?? []).slice(0, 3).map((l: string) => (
                  <span key={l} className="hidden rounded-full px-1.5 py-0.5 text-[10px] font-medium sm:inline" style={{ backgroundColor: `color-mix(in oklch, ${labelColor[l] ?? "#888"} 18%, transparent)`, color: labelColor[l] ?? "#888" }}>{l}</span>
                ))}
                {task.priority !== "none" && (
                  <span className="hidden items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium sm:inline-flex" style={{ backgroundColor: "color-mix(in oklch, " + PRIORITIES[task.priority].color + " 16%, transparent)", color: PRIORITIES[task.priority].color }}>
                    <Flag variant="Bulk" size={12} /> {t(`priorities.${task.priority}`)}
                  </span>
                )}
                {task.dueDate && <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex"><Calendar variant="Bulk" size={13} /> {fmtDate(task.dueDate)}</span>}
                {task.assignee && (
                  <Avatar className="h-6 w-6"><AvatarImage src={task.assignee.image} /><AvatarFallback className="bg-primary text-[10px] text-primary-foreground">{(task.assignee.name ?? task.assignee.email ?? "U").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                )}
                {!isSelecting && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><More variant="Bulk" size={16} /></button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onOpen(task)}>{t("edit") ?? "Edit"}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDelete(task)} className="text-destructive">{t("delete") ?? "Delete"}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          }}
        />
      </div>

      {/* Bulk action bar */}
      {isSelecting && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex max-w-[95vw] -translate-x-1/2 flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-xl" data-testid="bulk-action-bar">
          <span className="px-1 text-sm font-medium">{t("bulkSelected", { count: selectedIds.size })}</span>
          <Select onValueChange={(v) => runBulk({ status: v })}>
            <SelectTrigger className="h-8 w-32" data-testid="bulk-status"><SelectValue placeholder={t("status")} /></SelectTrigger>
            <SelectContent>{cols.map((s: Status) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select onValueChange={(v) => runBulk({ priority: v })}>
            <SelectTrigger className="h-8 w-28" data-testid="bulk-priority"><SelectValue placeholder={t("priority")} /></SelectTrigger>
            <SelectContent>{Object.entries(PRIORITIES).map(([k, v]) => <SelectItem key={k} value={k}>{t(`priorities.${k}`)}</SelectItem>)}</SelectContent>
          </Select>
          <Select onValueChange={(v) => runBulk({ assigneeId: v === "none" ? null : v })}>
            <SelectTrigger className="h-8 w-32" data-testid="bulk-assignee"><SelectValue placeholder={t("assignee")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("unassigned")}</SelectItem>
              {members.map((m: any) => <SelectItem key={m.userId} value={m.userId}>{m.name ?? m.email}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => runBulk({ projectId: v === "none" ? null : v })}>
            <SelectTrigger className="h-8 w-32" data-testid="bulk-project"><SelectValue placeholder={t("project")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("noProject")}</SelectItem>
              {projects.map((p: any) => <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <input type="date" onChange={(e) => runBulk({ dueDate: e.target.value ? new Date(e.target.value).getTime() : null })} className={cn(inputBase, "h-8 w-36 text-xs")} data-testid="bulk-due-date" />
          <div className="hidden items-center gap-1 sm:flex">
            {labels.map((l: any) => (
              <button
                key={l.name}
                onClick={() => toggleLabel(l.name)}
                className="rounded-full px-2 py-0.5 text-[10px] font-medium opacity-80 hover:opacity-100"
                style={{ backgroundColor: `color-mix(in oklch, ${l.color} 18%, transparent)`, color: l.color }}
                title={l.name}
              >
                {l.name}
              </button>
            ))}
          </div>
          <button onClick={markDone} className="flex h-8 items-center gap-1 rounded-lg bg-primary/10 px-2 text-xs font-medium text-primary hover:bg-primary/20" data-testid="bulk-mark-done">
            <TickCircle variant="Bulk" size={14} /> {t("bulkMarkDone")}
          </button>
          <button onClick={async () => { await bulkRemove({ taskIds: selectedArr }); toast.success(t("deleted")); deselectAll(); }} className="flex h-8 items-center gap-1 rounded-lg px-2 text-sm font-medium text-destructive hover:bg-destructive/10" data-testid="bulk-delete">
            <Trash variant="Bulk" size={15} /> {t("delete") ?? "Delete"}
          </button>
          <button onClick={exitSelecting} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><CloseCircle variant="Bulk" size={16} /></button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Labels editor ───────────────────────── */

function LabelEditor({ workspaceId, labels, selected, onChange, t }: any) {
  const createLabel = useMutation(api.flux_labels.create);
  const [input, setInput] = useState("");
  const toggle = (name: string) => {
    onChange(selected.includes(name) ? selected.filter((s: string) => s !== name) : [...selected, name]);
  };
  const addNew = async () => {
    const name = input.trim();
    if (!name || !workspaceId) return;
    await createLabel({ workspaceId, name });
    if (!selected.includes(name)) onChange([...selected, name]);
    setInput("");
  };
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("labels")}</label>
      <div className="flex flex-wrap gap-1.5">
        {(labels ?? []).map((l: any) => (
          <button key={l._id} type="button" onClick={() => toggle(l.name)} data-testid="task-label-option"
            className={cn("rounded-full px-2.5 py-1 text-xs font-medium transition", selected.includes(l.name) ? "ring-2 ring-offset-1" : "opacity-70 hover:opacity-100")}
            style={{ backgroundColor: `color-mix(in oklch, ${l.color} 18%, transparent)`, color: l.color }}>
            {l.name}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNew(); } }} placeholder={t("newLabel") ?? "New label…"} className={cn(inputBase, "h-8 text-sm")} data-testid="task-new-label-input" />
        <button type="button" onClick={addNew} className={cn(btnOutline, "h-8 text-xs")}>{t("add") ?? "Add"}</button>
      </div>
    </div>
  );
}

/* ───────────────────────── Create dialog ───────────────────────── */

export function TaskCreateDialog({ open, onOpenChange, onCreate, members, projects, labels, statuses, defaultStatus, workspaceId, defaultProjectId }: any) {
  const t = useTranslations("tasks");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("none");
  const [assigneeId, setAssigneeId] = useState("none");
  const [due, setDue] = useState("");
  const [status, setStatusVal] = useState(defaultStatus);
  const [projectId, setProjectId] = useState(defaultProjectId ?? "none");
  const [selLabels, setSelLabels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setTitle(""); setDescription(""); setPriority("none"); setAssigneeId("none"); setDue(""); setStatusVal(defaultStatus); setProjectId(defaultProjectId ?? "none"); setSelLabels([]); } }, [open, defaultStatus, defaultProjectId]);

  const submit = async () => {
    if (!title.trim()) return toast.error(t("taskTitleRequired") ?? "Add a task title");
    setBusy(true);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        assigneeId: assigneeId === "none" ? undefined : assigneeId,
        projectId: projectId === "none" ? undefined : projectId,
        dueDate: due ? new Date(due).getTime() : undefined,
        labels: selLabels,
      });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="task-create-dialog">
        <DialogHeader><DialogTitle>{t("newTask")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()} placeholder={t("taskTitle")} className={inputBase} data-testid="task-title-input" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("addDescription")} rows={2} className={cn(inputBase, "resize-none")} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("status")}</label>
              <Select value={status} onValueChange={setStatusVal}>
                <SelectTrigger data-testid="task-status-select"><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map((s: Status) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("priority")}</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger data-testid="task-priority-select"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PRIORITIES).map(([k, v]) => <SelectItem key={k} value={k}>{t(`priorities.${k}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("dueDate")}</label>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputBase} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("assignee")}</label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger><SelectValue placeholder={t("unassigned")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("unassigned")}</SelectItem>
                  {members.map((m: any) => <SelectItem key={m.userId} value={m.userId}>{m.name ?? m.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {!defaultProjectId && projects.length > 0 && (
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("project")}</label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger><SelectValue placeholder={t("noProject")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("noProject")}</SelectItem>
                    {projects.map((p: any) => <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <LabelEditor workspaceId={workspaceId} labels={labels} selected={selLabels} onChange={setSelLabels} t={t} />
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className={btnOutline}>{t("cancel") ?? "Cancel"}</button>
          <button onClick={submit} disabled={busy} className={btnPrimary} data-testid="task-create-submit">{busy ? t("creating") : t("create")}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Task time tracking ───────────────────────── */

function fmtMin(m: number) {
  if (!m) return "0h";
  const h = Math.floor(m / 60), mm = m % 60;
  return `${h ? h + "h" : ""}${mm ? " " + mm + "m" : h ? "" : "0h"}`.trim();
}

function TaskTimeTracking({ task, workspaceId, onUpdate }: any) {
  const t = useTranslations("tasks");
  const data = useQuery(api.flux_time.listByTask, task ? { taskId: task._id } : "skip");
  const addEntry = useMutation(api.flux_time.add);
  const removeEntry = useMutation(api.flux_time.remove);
  const [mins, setMins] = useState("");
  const [note, setNote] = useState("");
  const [estimate, setEstimate] = useState<string>(task?.estimateMinutes ? String(task.estimateMinutes) : "");

  useEffect(() => { setEstimate(task?.estimateMinutes ? String(task.estimateMinutes) : ""); }, [task?._id, task?.estimateMinutes]);

  const tracked = data?.totalMinutes ?? 0;
  const est = task?.estimateMinutes ?? 0;
  const pct = est > 0 ? Math.min(100, Math.round((tracked / est) * 100)) : 0;

  const log = async (m: number) => {
    if (!workspaceId || m <= 0) return;
    await addEntry({ taskId: task._id, workspaceId, minutes: m, note: note.trim() || undefined });
    setMins(""); setNote("");
    toast.success(t("logged", { duration: fmtMin(m) }));
  };

  return (
    <div className="rounded-xl border border-border p-3" data-testid="task-time-tracking">
      <div className="mb-2 flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Clock variant="Bulk" size={14} /> {t("timeTracking")}</label>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">{t("estimate")}</span>
          <input type="number" value={estimate} onChange={(e) => setEstimate(e.target.value)} onBlur={() => onUpdate({ estimateMinutes: estimate ? Number(estimate) : undefined })} placeholder="min" className="h-7 w-16 rounded-md border border-border bg-transparent px-1.5 text-right" data-testid="task-estimate-input" />
          <span className="text-muted-foreground">{t("minutes")}</span>
        </div>
      </div>
      {est > 0 && (
        <div className="mb-2">
          <div className="flex justify-between text-xs text-muted-foreground"><span>{t("trackedDuration", { duration: fmtMin(tracked) })}</span><span>{t("estimateProgress", { estimate: fmtMin(est), pct })}</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", pct >= 100 ? "bg-destructive" : "bg-[var(--accent-mint)]")} style={{ width: `${pct}%` }} /></div>
        </div>
      )}
      {est === 0 && tracked > 0 && <p className="mb-2 text-xs text-muted-foreground">{t("trackedDuration", { duration: fmtMin(tracked) })}</p>}
      <div className="flex items-center gap-1.5">
        <input type="number" value={mins} onChange={(e) => setMins(e.target.value)} placeholder={t("minutes")} className={cn(inputBase, "h-8 text-sm")} data-testid="task-log-minutes" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("noteOptional")} className={cn(inputBase, "h-8 text-sm")} />
        <button onClick={() => log(Number(mins))} disabled={!mins} className={cn(btnPrimary, "h-8 shrink-0 text-xs")} data-testid="task-log-time">{t("log")}</button>
      </div>
      <div className="mt-1.5 flex gap-1">
        {[15, 30, 60].map((m) => <button key={m} onClick={() => log(m)} className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/70">+{m}{t("minutes")}</button>)}
      </div>
      {(data?.entries ?? []).length > 0 && (
        <div className="mt-2 space-y-1">
          {data!.entries.slice(0, 5).map((e: any) => (
            <div key={e._id} className="group flex items-center gap-2 text-xs">
              <span className="font-medium">{fmtMin(e.minutes)}</span>
              <span className="flex-1 truncate text-muted-foreground">{e.note || (e.user?.name ?? e.user?.email ?? "")}</span>
              <button onClick={() => removeEntry({ entryId: e._id })} className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"><CloseCircle variant="Bulk" size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Detail sheet ───────────────────────── */

function TaskDetailSheet({ task, onClose, members, statuses, labels, labelColor, workspaceId, onUpdate, onDelete }: any) {
  const t = useTranslations("tasks");
  const comments = useQuery(api.flux_tasks.listComments, task ? { taskId: task._id } : "skip");
  const subtasks = useQuery(api.flux_tasks.listChildren, task ? { parentId: task._id } : "skip");
  const addComment = useMutation(api.flux_tasks.addComment);
  const createTask = useMutation(api.flux_tasks.create);
  const setStatus = useMutation(api.flux_tasks.setStatus);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [subtaskInput, setSubtaskInput] = useState("");
  const [showSubtasks, setShowSubtasks] = useState(true);

  useEffect(() => { setTitle(task?.title ?? ""); }, [task]);

  if (!task) return null;

  return (
    <Sheet open={!!task} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md" data-testid="task-detail-sheet">
        <SheetHeader className="border-b border-border p-4"><SheetTitle>{t("taskDetails") ?? "Task details"}</SheetTitle></SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== task.title && onUpdate({ title: title.trim() })} className="w-full rounded-xl border border-transparent bg-transparent text-lg font-semibold outline-none hover:border-border focus:border-border focus:px-3 focus:py-2" data-testid="task-detail-title" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("status")}</label>
              <Select value={task.status} onValueChange={(v) => onUpdate({ status: v })}>
                <SelectTrigger data-testid="task-detail-status"><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map((s: Status) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("priority")}</label>
              <Select value={task.priority} onValueChange={(v) => onUpdate({ priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PRIORITIES).map(([k, v]) => <SelectItem key={k} value={k}>{t(`priorities.${k}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("assignee")}</label>
              <Select value={task.assigneeId ?? "none"} onValueChange={(v) => onUpdate({ assigneeId: v === "none" ? undefined : v })}>
                <SelectTrigger><SelectValue placeholder={t("unassigned")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("unassigned")}</SelectItem>
                  {members.map((m: any) => <SelectItem key={m.userId} value={m.userId}>{m.name ?? m.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("dueDate")}</label>
              <input type="date" defaultValue={toDateInput(task.dueDate)} onChange={(e) => onUpdate({ dueDate: e.target.value ? new Date(e.target.value).getTime() : undefined })} className={inputBase} />
            </div>
          </div>

          <LabelEditor workspaceId={workspaceId} labels={labels} selected={task.labels ?? []} onChange={(next: string[]) => onUpdate({ labels: next })} t={t} />

          {/* Subtasks */}
          <div>
            <button
              onClick={() => setShowSubtasks(!showSubtasks)}
              className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowDown2 variant="Bulk" size={13} className={cn("transition-transform", !showSubtasks && "-rotate-90")} />
              {t("subtasks")}
              {subtasks && subtasks.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{subtasks.filter((s: any) => s.status !== "done").length}/{subtasks.length}</span>
              )}
            </button>
            {showSubtasks && (
              <div className="space-y-1 pl-2">
                {(subtasks ?? []).map((st: any) => (
                  <div key={st._id} className="flex items-center gap-2">
                    <button
                      onClick={() => setStatus({ taskId: st._id, status: st.status === "done" ? "todo" : "done" })}
                      className={cn("h-4 w-4 shrink-0 rounded border border-border transition-colors", st.status === "done" ? "bg-primary border-primary" : "hover:border-primary")}
                    >
                      {st.status === "done" && <TickCircle variant="Bulk" size={14} className="text-primary-foreground" />}
                    </button>
                    <span className={cn("flex-1 text-sm", st.status === "done" && "line-through text-muted-foreground")}>{st.title}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    value={subtaskInput}
                    onChange={(e) => setSubtaskInput(e.target.value)}
                    placeholder={t("subtaskPlaceholder")}
                    className={cn(inputBase, "h-8 text-sm")}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && subtaskInput.trim() && workspaceId) {
                        await createTask({ workspaceId, title: subtaskInput.trim(), parentId: task._id, status: "todo" });
                        setSubtaskInput("");
                      }
                    }}
                  />
                  <button
                    onClick={async () => {
                      if (subtaskInput.trim() && workspaceId) {
                        await createTask({ workspaceId, title: subtaskInput.trim(), parentId: task._id, status: "todo" });
                        setSubtaskInput("");
                      }
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
                  >
                    <Add variant="Bulk" size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <TaskTimeTracking task={task} workspaceId={workspaceId} onUpdate={onUpdate} />

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("comments")}</label>
            <div className="space-y-2">
              {(comments ?? []).map((c: any) => (
                <div key={c._id} className="rounded-xl bg-muted/60 p-2.5">
                  <p className="text-xs font-medium">{c.user?.name ?? c.user?.email ?? t("someone") ?? "User"}</p>
                  <p className="text-sm">{c.content}</p>
                </div>
              ))}
              {comments && comments.length === 0 && <p className="text-sm text-muted-foreground">{t("noComments")}</p>}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={async (e) => { if (e.key === "Enter" && comment.trim()) { await addComment({ taskId: task._id, content: comment.trim() }); setComment(""); } }} placeholder={t("writeComment")} className={inputBase} />
              <button onClick={async () => { if (comment.trim()) { await addComment({ taskId: task._id, content: comment.trim() }); setComment(""); } }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Send2 variant="Bulk" size={16} /></button>
            </div>
          </div>
        </div>
        <div className="border-t border-border p-4">
          <button onClick={onDelete} className="flex items-center gap-2 text-sm font-medium text-destructive hover:underline" data-testid="task-delete"><Trash variant="Bulk" size={16} /> {t("deleteTask")}</button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ───────────────────────── Assignee swim lanes ───────────────────── */

function AssigneeLanesView({ tasks, members, cols, labelColor, onOpen }: any) {
  const t = useTranslations("tasks");
  const lanes: { member: any; tasks: any[] }[] = useMemo(() => {
    const assignedMemberIds = new Set(tasks.map((task: any) => task.assigneeId).filter(Boolean));
    const result: { member: any; tasks: any[] }[] = [];
    for (const m of members) {
      if (assignedMemberIds.has(m.userId)) {
        result.push({ member: m, tasks: tasks.filter((task: any) => task.assigneeId === m.userId) });
      }
    }
    const unassigned = tasks.filter((task: any) => !task.assigneeId);
    if (unassigned.length) result.push({ member: null, tasks: unassigned });
    return result;
  }, [tasks, members]);

  if (lanes.length === 0) {
    return <EmptyState icon={Profile} title={t("empty.title")} description={t("empty.description")} />;
  }

  return (
    <div className="space-y-6">
      {lanes.map(({ member, tasks: laneTasks }) => (
        <div key={member?.userId ?? "unassigned"}>
          <div className="mb-2 flex items-center gap-2">
            <Avatar className="h-7 w-7 border border-border">
              <AvatarImage src={member?.image} />
              <AvatarFallback className="text-xs font-semibold">
                {member ? (member.name ?? member.email ?? "?").charAt(0).toUpperCase() : "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-semibold">{member ? (member.name ?? member.email) : t("unassigned")}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{laneTasks.length}</span>
          </div>
          <div className="space-y-1.5">
            {laneTasks.map((task: any) => {
              const col = cols.find((c: any) => c.key === task.status);
              return (
                <button key={task._id} onClick={() => onOpen(task)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-left hover:bg-muted/50 transition-colors">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: col?.color ?? "#888" }} />
                  <span className="flex-1 truncate text-sm">{task.title}</span>
                  {task.dueDate && (
                    <span className={cn("text-xs", task.dueDate < Date.now() ? "text-destructive" : "text-muted-foreground")}>
                      {fmtDate(task.dueDate)}
                    </span>
                  )}
                  {task.labels?.map((lb: string) => (
                    <span key={lb} className="hidden rounded-full px-1.5 py-0.5 text-xs sm:inline" style={{ background: `color-mix(in oklch, ${labelColor[lb] ?? "#888"} 18%, transparent)`, color: labelColor[lb] ?? "#888" }}>{lb}</span>
                  ))}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── Status manager ───────────────────────── */

function StatusManagerDialog({ open, onOpenChange, statuses, workspaceId }: any) {
  const t = useTranslations("tasks");
  const createStatus = useMutation(api.flux_taskStatuses.create);
  const updateStatus = useMutation(api.flux_taskStatuses.update);
  const removeStatus = useMutation(api.flux_taskStatuses.remove);
  const ensureDefaults = useMutation(api.flux_taskStatuses.ensureDefaults);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(STATUS_PALETTE[0]);

  const add = async () => {
    if (!newLabel.trim() || !workspaceId) return;
    if ((statuses ?? []).every((s: Status) => s._id == null)) {
      await ensureDefaults({ workspaceId });
    }
    await createStatus({ workspaceId, label: newLabel.trim(), color: newColor });
    setNewLabel("");
    setNewColor(STATUS_PALETTE[Math.floor(Math.random() * STATUS_PALETTE.length)]);
    toast.success(t("statusAdded"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="status-manager-dialog">
        <DialogHeader><DialogTitle>{t("taskStatuses")}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{t("customizeStatuses")}</p>
        <div className="space-y-2">
          {(statuses ?? []).map((s: Status) => (
            <div key={s.key} className="flex items-center gap-2 rounded-xl border border-border p-2" data-testid="status-row">
              <input type="color" value={s.color} disabled={s._id == null} onChange={(e) => s._id && updateStatus({ statusId: s._id, color: e.target.value })} className="h-7 w-7 cursor-pointer rounded-md border border-border bg-transparent" />
              <input defaultValue={s.label} disabled={s._id == null} onBlur={(e) => s._id && e.target.value.trim() && e.target.value !== s.label && updateStatus({ statusId: s._id, label: e.target.value.trim() })} className="flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm hover:border-border focus:border-border" />
              <label className="flex items-center gap-1 text-xs text-muted-foreground" title={t("countsAsCompleted")}>
                <input type="checkbox" checked={!!s.isDone} disabled={s._id == null} onChange={(e) => s._id && updateStatus({ statusId: s._id, isDone: e.target.checked })} /> {t("done")}
              </label>
              {s._id && (statuses ?? []).length > 1 && (
                <button onClick={() => removeStatus({ statusId: s._id! }).then(() => toast.success(t("statusRemoved"))).catch((err) => toast.error(err.message))} className="text-muted-foreground hover:text-destructive"><Trash variant="Bulk" size={16} /></button>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t border-border pt-3">
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-8 w-8 cursor-pointer rounded-md border border-border bg-transparent" />
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={t("newStatusName")} className={cn(inputBase, "h-9")} data-testid="new-status-input" />
          <button onClick={add} className={btnPrimary} data-testid="add-status-btn"><Add variant="Bulk" size={16} /> {t("add")}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
