"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AlertCircle, ArrowUpDown, CalendarClock, CheckCircle2, ChevronRight, Plus, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskCard } from "@/components/tasks/TaskCard";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { useTranslations } from "next-intl";

const STATUS_GROUP_KEYS = [
  { key: "todo", color: "text-slate-500", dot: "bg-slate-400" },
  { key: "in_progress", color: "text-blue-500", dot: "bg-blue-500" },
  { key: "in_review", color: "text-amber-500", dot: "bg-amber-500" },
  { key: "done", color: "text-emerald-500", dot: "bg-emerald-500" },
  { key: "cancelled", color: "text-red-400", dot: "bg-red-400" },
];

type SmartFilter = "all" | "todo" | "in_progress" | "in_review" | "done" | "cancelled" | "overdue" | "today";
type SortKey = "default" | "priority" | "dueDate" | "title";

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

function InlineTaskAdd({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
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
    <div className="flex items-center gap-2 px-1 py-1">
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

export default function TasksPage() {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const router = useRouter();
  const tasks = useQuery(api.tasks.getMyTasks, {});
  const updateTask = useMutation(api.tasks.update);
  const createTask = useMutation(api.tasks.create);
  const [showNewTask, setShowNewTask] = useState(false);
  const [filter, setFilter] = useState<SmartFilter>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("default");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

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

  const handleInlineAdd = async (title: string) => {
    await createTask({ title, priority: "none" });
    toast.success(t("created"));
  };

  const allTasks = tasks ?? [];
  const openCount = allTasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length;
  const overdueCount = allTasks.filter((t) => t.dueDate && t.dueDate < now && t.status !== "done" && t.status !== "cancelled").length;
  const todayCount = allTasks.filter((t) => t.dueDate && t.dueDate >= todayStart && t.dueDate < todayEnd && t.status !== "done").length;
  const doneCount = allTasks.filter((t) => t.status === "done").length;

  const smartFilters: { key: SmartFilter; label: string; icon: React.ElementType; count?: number; accent?: string }[] = [
    { key: "all", label: t("filters.all"), icon: CheckCircle2, count: allTasks.length },
    { key: "overdue", label: t("overdue_filter"), icon: AlertCircle, count: overdueCount, accent: "text-red-500" },
    { key: "today", label: t("dueToday"), icon: CalendarClock, count: todayCount, accent: "text-amber-500" },
    { key: "todo", label: t("statuses.todo"), icon: ChevronRight },
    { key: "in_progress", label: t("statuses.in_progress"), icon: ChevronRight },
    { key: "in_review", label: t("statuses.in_review"), icon: ChevronRight },
    { key: "done", label: t("statuses.done"), icon: CheckCircle2 },
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

  const isGroupedView = filter === "all";

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-8 md:px-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
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
          <Button onClick={() => setShowNewTask(true)} size="sm" className="gap-1.5 h-8">
            <Plus className="h-3.5 w-3.5" /> {t("newTask")}
          </Button>
        </div>

        {/* Smart filter pills */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
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

          {/* Spacer + sort */}
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
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
              {sortBy === "default" ? t("sort") : sortBy === "priority" ? t("sortPriority") : sortBy === "dueDate" ? t("sortDueDate") : t("sortName")}
            </button>
          </div>
        </div>

        {/* Tasks */}
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
                        <InlineTaskAdd onAdd={handleInlineAdd} />
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

      <NewTaskDialog open={showNewTask} onClose={() => setShowNewTask(false)} />
    </div>
  );
}
