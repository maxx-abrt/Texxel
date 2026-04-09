"use client";

import { use, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Calendar, Clock, FileText, GanttChart as GanttIcon, GripVertical, LayoutGrid, List, Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TaskCard } from "@/components/tasks/TaskCard";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { GanttChart } from "@/components/gantt-chart";
import { RetroPlanningPanel } from "@/components/retro-planning";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useExtensions } from "@/hooks/useExtensions";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const PROJECT_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#ef4444","#f97316",
  "#eab308","#22c55e","#06b6d4","#3b82f6","#64748b",
];

const statusCols = [
  { key: "todo", label: "To Do", color: "text-slate-500", dot: "bg-slate-400" },
  { key: "in_progress", label: "In Progress", color: "text-blue-500", dot: "bg-blue-500" },
  { key: "in_review", label: "In Review", color: "text-amber-500", dot: "bg-amber-500" },
  { key: "done", label: "Done", color: "text-emerald-500", dot: "bg-emerald-500" },
];

function SortableTaskCard({
  task,
  onToggleDone,
  compact,
}: {
  task: any;
  onToggleDone: (id: Id<"tasks">, current: string) => void;
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task._id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group/drag relative cursor-grab active:cursor-grabbing touch-none"
    >
      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 text-muted-foreground/20 opacity-0 group-hover/drag:opacity-100 transition-opacity pointer-events-none">
        <GripVertical className="h-3 w-3" />
      </div>
      <div className="pl-5">
        <TaskCard task={task} onToggleDone={onToggleDone} compact={compact} />
      </div>
    </div>
  );
}

function DroppableColumn({
  col,
  children,
  isOver,
  taskCount,
  onAddTask,
}: {
  col: (typeof statusCols)[number];
  children: React.ReactNode;
  isOver: boolean;
  taskCount: number;
  onAddTask: () => void;
}) {
  const tp = useTranslations("projects");
  const tt = useTranslations("tasks");
  const { setNodeRef } = useDroppable({ id: col.key });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border transition-all duration-150",
        isOver
          ? "border-primary/50 bg-primary/5 shadow-sm shadow-primary/10"
          : "border-border/60 bg-muted/15",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className={cn("h-2 w-2 rounded-full", col.dot)} />
        <span className={cn("text-xs font-semibold uppercase tracking-wider", col.color)}>
          {tt(`statuses.${col.key}` as any)}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground font-medium bg-muted rounded-full px-1.5 py-0.5">
          {taskCount}
        </span>
      </div>
      <div className="flex-1 space-y-1.5 overflow-y-auto px-2 pb-2 min-h-20">
        {children}
        {taskCount === 0 && (
          <div
            className={cn(
              "flex items-center justify-center rounded-lg border-2 border-dashed py-8 text-[11px] text-muted-foreground/40 transition-colors",
              isOver ? "border-primary/30 text-primary/50" : "border-muted-foreground/10",
            )}
          >
            {isOver ? tp("dropTasks") : tp("noTasks")}
          </div>
        )}
      </div>
      <button
        onClick={onAddTask}
        className="mx-2 mb-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
      >
        <Plus className="h-3 w-3" />
        {tp("addTask")}
      </button>
    </div>
  );
}

export default function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const tp = useTranslations("projects");
  const tc = useTranslations("common");
  const tt = useTranslations("tasks");
  const { projectId } = use(params);
  const router = useRouter();
  const project = useQuery(api.projects.getById, { id: projectId as Id<"projects"> });
  const tasks = useQuery(api.tasks.getByProject, { projectId: projectId as Id<"projects"> });
  const projectDocs = useQuery(api.documents.getByProject, { projectId: projectId as Id<"projects"> });
  const myTeams = useQuery(api.teams.getMyTeams);
  const updateTask = useMutation(api.tasks.update);
  const updateProject = useMutation(api.projects.update);
  const removeProject = useMutation(api.projects.remove);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState<"todo" | "in_progress" | "in_review" | "done" | "cancelled">("todo");
  const { isEnabled, getUIConfig } = useExtensions();
  const uiCfg = getUIConfig();
  const ganttEnabled = isEnabled("gantt");
  const retroEnabled = isEnabled("retroPlanning");
  const [viewMode, setViewMode] = useState<"board" | "list" | "gantt" | "notes">(uiCfg.defaultProjectView);
  const [activeTask, setActiveTask] = useState<any>(null);
  const [isOver, setIsOver] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editColor, setEditColor] = useState("#6366f1");
  const [editDueDate, setEditDueDate] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [editTeamId, setEditTeamId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showRetroPlanning, setShowRetroPlanning] = useState(false);

  const openEdit = () => {
    if (!project) return;
    setEditName(project.name);
    setEditDesc(project.description ?? "");
    setEditColor(project.color ?? "#6366f1");
    setEditDueDate(project.dueDate ? new Date(project.dueDate).toISOString().split("T")[0] : "");
    setEditStatus(project.status ?? "active");
    setEditTeamId(project.teamId ?? "");
    setShowEdit(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !project) return;
    setIsSaving(true);
    try {
      await updateProject({
        id: project._id,
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        color: editColor,
        dueDate: editDueDate ? new Date(editDueDate).getTime() : undefined,
        status: editStatus as any,
        teamId: editTeamId ? (editTeamId as Id<"teams">) : undefined,
      });
      toast.success(tp("updated"));
      setShowEdit(false);
    } catch {
      toast.error(tp("updateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    try {
      await removeProject({ id: project._id });
      toast.success(tp("deleted"));
      router.push("/projects");
    } catch {
      toast.error(tp("deleteFailed"));
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  if (project === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-sm text-muted-foreground">{tp("notFound")}</p>
        <Button variant="ghost" size="sm" onClick={() => router.push("/projects")} className="mt-2 gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" /> {tp("backToProjects")}
        </Button>
      </div>
    );
  }

  const handleToggleDone = async (id: Id<"tasks">, current: string) => {
    const newStatus = current === "done" ? "todo" : "done";
    toast.promise(updateTask({ id, status: newStatus as any }), {
      loading: tp("saving"),
      success: tp("updated"),
      error: tp("updateFailed"),
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = (tasks ?? []).find((t) => t._id === event.active.id);
    setActiveTask(task ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id as string | null;
    if (!overId) { setIsOver(null); return; }
    const colKey = statusCols.find((c) => c.key === overId)?.key;
    if (colKey) { setIsOver(colKey); return; }
    const overTask = (tasks ?? []).find((t) => t._id === overId);
    if (overTask) { setIsOver(overTask.status); return; }
    setIsOver(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    setIsOver(null);
    const { active, over } = event;
    if (!over || !active) return;

    const draggedTask = (tasks ?? []).find((t) => t._id === active.id);
    if (!draggedTask) return;

    // Determine target status
    const colKey = statusCols.find((c) => c.key === over.id)?.key;
    const overTask = (tasks ?? []).find((t) => t._id === over.id);
    const targetStatus = colKey ?? overTask?.status;

    if (targetStatus && targetStatus !== draggedTask.status) {
      try {
        await updateTask({ id: draggedTask._id, status: targetStatus as any });
      } catch {
        toast.error(tt("updateFailed"));
      }
    }
  };

  const grouped = statusCols.map((col) => ({
    ...col,
    tasks: (tasks ?? []).filter((t) => t.status === col.key),
  }));

  const totalDone = (tasks ?? []).filter((t) => t.status === "done").length;
  const totalTasks = (tasks ?? []).length;
  const progress = totalTasks ? Math.round((totalDone / totalTasks) * 100) : 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b px-6 py-4 md:px-8">
        <button
          onClick={() => router.push("/projects")}
          className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {tp("backToProjects")}
        </button>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white text-sm font-bold"
              style={{ backgroundColor: project.color ?? "#6366f1" }}
            >
              {project.icon ?? project.name[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate">{project.name}</h1>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {project.description && <span className="truncate">{project.description}</span>}
                {project.dueDate && (
                  <span className="flex items-center gap-1 shrink-0">
                    <Calendar className="h-3 w-3" />
                    {new Date(project.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {totalTasks > 0 && (
              <div className="hidden sm:flex items-center gap-2 mr-2">
                <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">{progress}%</span>
              </div>
            )}
            <div className="flex gap-0.5 rounded-lg border p-0.5">
              <button
                onClick={() => setViewMode("board")}
                className={cn("rounded-md p-1.5 transition-all", viewMode === "board" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn("rounded-md p-1.5 transition-all", viewMode === "list" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <List className="h-3.5 w-3.5" />
              </button>
              {ganttEnabled && (
                <button
                  onClick={() => setViewMode("gantt")}
                  className={cn("rounded-md p-1.5 transition-all", viewMode === "gantt" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  <GanttIcon className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setViewMode("notes")}
                className={cn("rounded-md p-1.5 transition-all", viewMode === "notes" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                title={tp("notes")}
              >
                <FileText className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={openEdit} className="gap-1.5 h-8">
              <Pencil className="h-3.5 w-3.5" />
              {tc("edit")}
            </Button>
            {retroEnabled && project.dueDate && (
              <Button variant="outline" size="sm" onClick={() => setShowRetroPlanning(true)} className="gap-1.5 h-8 hidden sm:flex">
                <Clock className="h-3.5 w-3.5" />
                {tp("retroPlanning.title")}
              </Button>
            )}
            <Button onClick={() => setShowNewTask(true)} size="sm" className="gap-1.5 h-8">
              <Plus className="h-3.5 w-3.5" />
              {tp("addTask")}
            </Button>
          </div>
        </div>
      </div>

      {/* Retro-planning sheet */}
      <Sheet open={showRetroPlanning} onOpenChange={setShowRetroPlanning}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>{tp("retroPlanning.title")}</SheetTitle>
          </SheetHeader>
          <div className="pt-2">
            <RetroPlanningPanel
              projectId={projectId as any}
              projectDueDate={project.dueDate}
              teamId={project.teamId as any}
              onClose={() => setShowRetroPlanning(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Content */}
      {viewMode === "notes" ? (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-3xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">{tp("notes")}</h2>
                {(projectDocs ?? []).length > 0 && (
                  <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 tabular-nums">
                    {(projectDocs ?? []).length}
                  </span>
                )}
              </div>
            </div>
            {(projectDocs ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed">
                <FileText className="h-9 w-9 text-muted-foreground/20 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">{tp("noNotes")}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{tp("noNotesDesc")}</p>
              </div>
            ) : (
              <div className="rounded-xl border bg-card divide-y overflow-hidden">
                {(projectDocs ?? []).map((doc: any) => {
                  const relDate = (() => {
                    const ms = Date.now() - doc._creationTime;
                    const mins = Math.floor(ms / 60000);
                    const hours = Math.floor(ms / 3600000);
                    const days = Math.floor(ms / 86400000);
                    if (mins < 1) return "just now";
                    if (mins < 60) return `${mins}m ago`;
                    if (hours < 24) return `${hours}h ago`;
                    if (days < 7) return `${days}d ago`;
                    return new Date(doc._creationTime).toLocaleDateString(undefined, { month: "short", day: "numeric" });
                  })();
                  return (
                    <div
                      key={doc._id}
                      onClick={() => router.push(`/documents/${doc._id}`)}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors group"
                    >
                      <span className="text-base shrink-0">{doc.icon ?? "📄"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {doc.title || tc("untitled")}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground/50 shrink-0 tabular-nums">{relDate}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : viewMode === "gantt" ? (
        <div className="flex-1 overflow-hidden">
          <GanttChart
            tasks={(tasks ?? []) as any}
            projectDueDate={project.dueDate}
            projectColor={project.color ?? "#6366f1"}
          />
        </div>
      ) : viewMode === "board" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-x-auto p-4 md:p-6">
            <div className="flex h-full gap-4 min-w-max">
              {grouped.map((col) => (
                <SortableContext
                  key={col.key}
                  items={col.tasks.map((t) => t._id)}
                  strategy={verticalListSortingStrategy}
                >
                  <DroppableColumn
                    col={col}
                    isOver={isOver === col.key}
                    taskCount={col.tasks.length}
                    onAddTask={() => { setNewTaskStatus(col.key as any); setShowNewTask(true); }}
                  >
                    {col.tasks.map((task) => (
                      <SortableTaskCard key={task._id} task={task} onToggleDone={handleToggleDone} compact />
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
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-3xl space-y-1">
            {grouped.map((g) =>
              g.tasks.length > 0 ? (
                <div key={g.key} className="mb-4">
                  <div className="flex items-center gap-2 py-2 px-1">
                    <div className={cn("h-2 w-2 rounded-full", g.dot)} />
                    <span className={cn("text-xs font-semibold uppercase tracking-wider", g.color)}>
                      {tt(`statuses.${g.key}` as any)}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">{g.tasks.length}</span>
                  </div>
                  <div className="space-y-1">
                    {g.tasks.map((task) => (
                      <TaskCard key={task._id} task={task} onToggleDone={handleToggleDone} />
                    ))}
                  </div>
                </div>
              ) : null,
            )}
            {totalTasks === 0 && (
              <div className="text-center py-16">
                <p className="text-sm text-muted-foreground">{tp("noTasks")}</p>
                <Button size="sm" variant="outline" onClick={() => setShowNewTask(true)} className="mt-4 gap-1.5 h-7 text-xs">
                  <Plus className="h-3 w-3" /> {tp("addTask")}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <NewTaskDialog
        open={showNewTask}
        onClose={() => setShowNewTask(false)}
        projectId={projectId as Id<"projects">}
        teamId={project.teamId as Id<"teams"> | undefined}
        initialStatus={newTaskStatus}
      />

      {/* Edit Project Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="text-sm font-semibold">{tp("edit")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit}>
            <div className="px-5 pt-4 pb-3 space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{tp("projectName")}</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} required className="h-9" autoFocus />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{tp("addDescription")}</label>
                <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} className="resize-none text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{tp("editColor")}</label>
                <div className="flex flex-wrap gap-2">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c} type="button"
                      onClick={() => setEditColor(c)}
                      className={cn("h-7 w-7 rounded-lg border-2 transition-all", editColor === c ? "border-foreground scale-110" : "border-transparent hover:scale-105")}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{tt("dueDate")}</label>
                  <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{tp("editStatus")}</label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{tp("sections.active")}</SelectItem>
                      <SelectItem value="completed">{tp("sections.completed")}</SelectItem>
                      <SelectItem value="archived">{tp("sections.archived")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(myTeams ?? []).length > 0 && (
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{tp("editTeam")}</label>
                  <Select value={editTeamId || "none"} onValueChange={(v) => setEditTeamId(v === "none" ? "" : v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={tp("noTeam")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tp("noTeam")}</SelectItem>
                      {(myTeams ?? []).map((team: any) => (
                        <SelectItem key={team._id} value={team._id}>{team.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 px-5 py-3 border-t bg-muted/20">
              <ConfirmModal onConfirm={handleDelete}>
                <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive gap-1.5">
                  <Trash2 className="h-3 w-3" /> {tc("delete")}
                </Button>
              </ConfirmModal>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowEdit(false)} className="h-8 text-xs">{tc("cancel")}</Button>
                <Button type="submit" size="sm" disabled={isSaving || !editName.trim()} className="h-8 text-xs">
                  {isSaving ? tp("saving") : tp("saveChanges")}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
