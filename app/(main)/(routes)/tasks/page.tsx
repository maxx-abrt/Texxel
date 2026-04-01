"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  AlertCircle, ArrowUpDown, CalendarClock, CheckCircle2, ChevronRight,
  GripVertical, LayoutGrid, List, Plus, Search, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskCard } from "@/components/tasks/TaskCard";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { useTranslations } from "next-intl";
import {
  DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCenter, useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useExtensions } from "@/hooks/useExtensions";

const STATUS_GROUP_KEYS = [
  { key: "todo", color: "text-slate-500", dot: "bg-slate-400" },
  { key: "in_progress", color: "text-blue-500", dot: "bg-blue-500" },
  { key: "in_review", color: "text-amber-500", dot: "bg-amber-500" },
  { key: "done", color: "text-emerald-500", dot: "bg-emerald-500" },
  { key: "cancelled", color: "text-red-400", dot: "bg-red-400" },
];

const BOARD_COLS = [
  { key: "todo", color: "text-slate-500", dot: "bg-slate-400" },
  { key: "in_progress", color: "text-blue-500", dot: "bg-blue-500" },
  { key: "in_review", color: "text-amber-500", dot: "bg-amber-500" },
  { key: "done", color: "text-emerald-500", dot: "bg-emerald-500" },
];

type SmartFilter = "all" | "todo" | "in_progress" | "in_review" | "done" | "cancelled" | "overdue" | "today";
type SortKey = "default" | "priority" | "dueDate" | "title";
type ViewMode = "list" | "board";

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

/* ── Inline task add ─────────────────────────────────────────────────── */
function InlineTaskAdd({ onAdd, className }: { onAdd: (title: string) => Promise<void>; className?: string }) {
  const t = useTranslations("tasks");
  const [value, setValue] = useState("");
  const submittingRef = useRef(false);

  const submit = async (e?: React.KeyboardEvent | React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!value.trim() || submittingRef.current) return;
    submittingRef.current = true;
    const title = value.trim();
    setValue("");
    try { await onAdd(title); }
    finally { submittingRef.current = false; }
  };

  return (
    <div className={cn("flex items-center gap-2 px-1 py-1", className)}>
      <Plus className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit(e);
          if (e.key === "Escape") { e.stopPropagation(); setValue(""); }
        }}
        placeholder={t("inlinePlaceholder")}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/30"
      />
      {value.trim() && (
        <button
          onMouseDown={submit}
          className="text-[10px] text-primary hover:underline font-medium"
        >
          {t("add")}
        </button>
      )}
    </div>
  );
}

/* ── Sortable task card for board ────────────────────────────────────── */
function SortableTaskCard({ task, onToggleDone }: { task: any; onToggleDone: (id: Id<"tasks">, current: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task._id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="group/drag relative">
      <div
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1/2 -translate-y-1/2 z-10 cursor-grab active:cursor-grabbing p-1 rounded text-muted-foreground/30 opacity-0 group-hover/drag:opacity-100 transition-opacity touch-none"
      >
        <GripVertical className="h-3 w-3" />
      </div>
      <div className="pl-5">
        <TaskCard task={task} onToggleDone={onToggleDone} compact />
      </div>
    </div>
  );
}

/* ── Droppable kanban column ─────────────────────────────────────────── */
function DroppableColumn({ col, children, isOver, taskCount, onAddTask }: {
  col: (typeof BOARD_COLS)[number]; children: React.ReactNode; isOver: boolean; taskCount: number; onAddTask: () => void;
}) {
  const t = useTranslations("tasks");
  const { setNodeRef } = useDroppable({ id: col.key });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border transition-all duration-150",
        isOver ? "border-primary/50 bg-primary/5 shadow-sm shadow-primary/10" : "border-border/60 bg-muted/15",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className={cn("h-2 w-2 rounded-full", col.dot)} />
        <span className={cn("text-xs font-semibold uppercase tracking-wider", col.color)}>
          {t(`statuses.${col.key}` as any)}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground font-medium bg-muted rounded-full px-1.5 py-0.5">
          {taskCount}
        </span>
      </div>
      <div className="flex-1 space-y-1.5 overflow-y-auto px-2 pb-2 min-h-20">
        {children}
        {taskCount === 0 && (
          <div className={cn(
            "flex items-center justify-center rounded-lg border-2 border-dashed py-8 text-[11px] text-muted-foreground/40 transition-colors",
            isOver ? "border-primary/30 text-primary/50" : "border-muted-foreground/10",
          )}>
            {isOver ? t("dropHere") : t("empty.title")}
          </div>
        )}
      </div>
      <button
        onClick={onAddTask}
        className="mx-2 mb-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
      >
        <Plus className="h-3 w-3" />
        {t("addTask")}
      </button>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────── */
export default function TasksPage() {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const router = useRouter();
  const tasks = useQuery(api.tasks.getMyTasks, {});
  const updateTask = useMutation(api.tasks.update);
  const createTask = useMutation(api.tasks.create);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState<"todo" | "in_progress" | "in_review" | "done" | "cancelled">("todo");
  const [filter, setFilter] = useState<SmartFilter>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("default");
  const { isEnabled, getUIConfig } = useExtensions();
  const uiCfg = getUIConfig();
  const kanbanEnabled = isEnabled("kanban");
  const [viewMode, setViewMode] = useState<ViewMode>(kanbanEnabled ? uiCfg.defaultTaskView : "list");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [activeTask, setActiveTask] = useState<any>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const now = Date.now();
  const todayStart = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
  const todayEnd = todayStart + 86_400_000;

  const toggleGroup = (key: string) =>
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleToggleDone = async (id: Id<"tasks">, current: string) => {
    const newStatus = current === "done" ? "todo" : "done";
    toast.promise(updateTask({ id, status: newStatus as any }), {
      loading: t("creating"), success: t("updated"), error: t("updateFailed"),
    });
  };

  const handleInlineAdd = async (title: string, status?: string) => {
    await createTask({ title, priority: "none", status: (status as any) ?? "todo" });
    toast.success(t("created"));
  };

  const allTasks = tasks ?? [];
  const openCount = allTasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length;
  const overdueCount = allTasks.filter((t) => t.dueDate && t.dueDate < now && t.status !== "done" && t.status !== "cancelled").length;
  const todayCount = allTasks.filter((t) => t.dueDate && t.dueDate >= todayStart && t.dueDate < todayEnd && t.status !== "done").length;
  const doneCount = allTasks.filter((t) => t.status === "done").length;

  const smartFilters: { key: SmartFilter; label: string; count?: number; accent?: string }[] = [
    { key: "all", label: t("filters.all"), count: allTasks.length },
    { key: "overdue", label: t("overdue_filter"), count: overdueCount, accent: "text-red-500" },
    { key: "today", label: t("dueToday"), count: todayCount, accent: "text-amber-500" },
    { key: "todo", label: t("statuses.todo") },
    { key: "in_progress", label: t("statuses.in_progress") },
    { key: "in_review", label: t("statuses.in_review") },
    { key: "done", label: t("statuses.done") },
  ];

  const applySmartFilter = (task: typeof allTasks[number]) => {
    if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false;
    switch (filter) {
      case "overdue": return task.dueDate != null && task.dueDate < now && task.status !== "done" && task.status !== "cancelled";
      case "today": return task.dueDate != null && task.dueDate >= todayStart && task.dueDate < todayEnd && task.status !== "done";
      case "all": return true;
      default: return task.status === filter;
    }
  };

  const applySort = (arr: typeof allTasks) => {
    const copy = [...arr];
    switch (sortBy) {
      case "priority": return copy.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4));
      case "dueDate": return copy.sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity));
      case "title": return copy.sort((a, b) => a.title.localeCompare(b.title));
      default: return copy;
    }
  };

  const filtered = applySort(allTasks.filter(applySmartFilter));

  const grouped = STATUS_GROUP_KEYS.map((g) => ({
    ...g,
    label: t(`statuses.${g.key}` as any),
    tasks: filtered.filter((t) => t.status === g.key),
  }));

  const boardGrouped = BOARD_COLS.map((col) => ({
    ...col,
    tasks: filtered.filter((t) => t.status === col.key),
  }));

  const isGroupedView = filter === "all";

  /* ── Board DnD handlers ─────────────────────────────────────────── */
  const handleDragStart = (event: DragStartEvent) => {
    const task = allTasks.find((t) => t._id === event.active.id);
    setActiveTask(task ?? null);
  };
  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id as string | null;
    if (!overId) { setOverCol(null); return; }
    const colKey = BOARD_COLS.find((c) => c.key === overId)?.key;
    if (colKey) { setOverCol(colKey); return; }
    const overTask = allTasks.find((t) => t._id === overId);
    if (overTask) { setOverCol(overTask.status); return; }
    setOverCol(null);
  };
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    setOverCol(null);
    const { active, over } = event;
    if (!over || !active) return;
    const draggedTask = allTasks.find((t) => t._id === active.id);
    if (!draggedTask) return;
    const colKey = BOARD_COLS.find((c) => c.key === over.id)?.key;
    const overTask = allTasks.find((t) => t._id === over.id);
    const targetStatus = colKey ?? overTask?.status;
    if (targetStatus && targetStatus !== draggedTask.status) {
      try { await updateTask({ id: draggedTask._id, status: targetStatus as any }); }
      catch { toast.error(t("updateFailed")); }
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 pt-6 pb-4 sm:px-6 md:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>{openCount} {t("open")}</span>
                {overdueCount > 0 && (
                  <span className="flex items-center gap-1 text-red-500 font-medium">
                    <AlertCircle className="h-3 w-3" /> {overdueCount} {t("overdue_count")}
                  </span>
                )}
                {doneCount > 0 && <span className="text-emerald-600">{doneCount} {t("done_count")}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* View toggle — only show board if kanban extension enabled */}
              {kanbanEnabled && (
                <div className="hidden sm:flex gap-0.5 rounded-lg border p-0.5">
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn("rounded-md p-1.5 transition-all", viewMode === "list" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode("board")}
                    className={cn("rounded-md p-1.5 transition-all", viewMode === "board" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <Button onClick={() => { setNewTaskStatus("todo"); setShowNewTask(true); }} size="sm" className="gap-1.5 h-8">
                <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t("newTask")}</span>
              </Button>
            </div>
          </div>

          {/* Smart filter pills + search + sort */}
          <div className="flex flex-wrap items-center gap-1.5">
            {smartFilters.map(({ key, label, count, accent }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all border",
                  filter === key
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/30",
                  filter !== key && accent,
                )}
              >
                {label}
                {count !== undefined && count > 0 && (
                  <span className={cn(
                    "inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                    filter === key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
                  )}>
                    {count}
                  </span>
                )}
              </button>
            ))}

            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden sm:block">
                <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tc("search")}
                  className="h-7 pl-8 pr-3 text-xs w-36"
                />
              </div>
              <button
                onClick={() => setSortBy(s => {
                  const order: SortKey[] = ["default", "priority", "dueDate", "title"];
                  return order[(order.indexOf(s) + 1) % order.length];
                })}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
                  sortBy !== "default" ? "border-primary/40 text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ArrowUpDown className="h-3 w-3" />
                <span className="hidden sm:inline">
                  {sortBy === "default" ? t("sort") : sortBy === "priority" ? t("sortPriority") : sortBy === "dueDate" ? t("sortDueDate") : t("sortName")}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Board view ──────────────────────────────────────────────── */}
      {viewMode === "board" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 pb-4 sm:px-6 md:px-10">
            <div className="flex h-full gap-4 min-w-max">
              {boardGrouped.map((col) => (
                <SortableContext
                  key={col.key}
                  items={col.tasks.map((t) => t._id)}
                  strategy={verticalListSortingStrategy}
                >
                  <DroppableColumn
                    col={col}
                    isOver={overCol === col.key}
                    taskCount={col.tasks.length}
                    onAddTask={() => { setNewTaskStatus(col.key as any); setShowNewTask(true); }}
                  >
                    {col.tasks.map((task) => (
                      <SortableTaskCard key={task._id} task={task} onToggleDone={handleToggleDone} />
                    ))}
                  </DroppableColumn>
                </SortableContext>
              ))}
            </div>
          </div>
          <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
            {activeTask ? (
              <div className="opacity-95 shadow-2xl rotate-1 scale-[1.03] pointer-events-none">
                <TaskCard task={activeTask} onToggleDone={() => {}} compact />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* ── List view ──────────────────────────────────────────────── */
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-10 pb-8">
          <div className="mx-auto max-w-4xl">
            {isGroupedView ? (
              <div className="space-y-0.5">
                {grouped.map((g) => (
                  g.tasks.length > 0 ? (
                    <div key={g.key} className="mb-2">
                      <button
                        onClick={() => toggleGroup(g.key)}
                        className="flex items-center gap-2 w-full py-1.5 px-1 hover:bg-accent/50 rounded-md transition-colors"
                      >
                        <ChevronRight className={cn(
                          "h-3.5 w-3.5 text-muted-foreground transition-transform",
                          !collapsedGroups[g.key] && "rotate-90",
                        )} />
                        <div className={cn("h-2 w-2 rounded-full shrink-0", g.dot)} />
                        <span className={cn("text-xs font-semibold uppercase tracking-wider", g.color)}>
                          {g.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium ml-1 bg-muted rounded-full px-1.5 py-0.5">
                          {g.tasks.length}
                        </span>
                      </button>
                      {!collapsedGroups[g.key] && (
                        <div className="space-y-0.5 pb-2 pl-1">
                          {g.tasks.map((task) => (
                            <TaskCard key={task._id} task={task} onToggleDone={handleToggleDone} />
                          ))}
                          {g.key !== "done" && g.key !== "cancelled" && (
                            <InlineTaskAdd onAdd={(title) => handleInlineAdd(title, g.key)} />
                          )}
                        </div>
                      )}
                    </div>
                  ) : null
                ))}
                {filtered.length === 0 && (
                  <div className="text-center py-16">
                    <Sparkles className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">
                      {search ? tc("noResults") : t("empty.title")}
                    </p>
                    {!search && (
                      <>
                        <p className="text-xs text-muted-foreground/60 mt-1">{t("empty.description")}</p>
                        <Button size="sm" variant="outline" onClick={() => setShowNewTask(true)} className="mt-4 gap-1.5 h-7 text-xs">
                          <Plus className="h-3 w-3" /> {t("newTask")}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-0.5">
                {filtered.map((task) => (
                  <TaskCard key={task._id} task={task} onToggleDone={handleToggleDone} />
                ))}
                {filtered.length === 0 && (
                  <div className="text-center py-16">
                    <p className="text-sm text-muted-foreground">
                      {filter === "overdue" ? t("noOverdue") : filter === "today" ? t("noDueToday") : t("empty.title")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <NewTaskDialog
        open={showNewTask}
        onClose={() => setShowNewTask(false)}
        initialStatus={newTaskStatus}
      />
    </div>
  );
}
