"use client";

import { useState, useMemo, useId, useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Calendar,
  Flag,
  Plus,
  Trash2,
  X,
  LayoutTemplate,
  AlertCircle,
  Clock,
  Pencil,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { SynaIcon } from "./app/syna-icon";

interface Milestone {
  id: string;
  name: string;
  daysBefore: number;
  durationDays: number;
}

interface RetroplanningProps {
  projectId: Id<"projects">;
  projectDueDate?: number;
  workspaceId: Id<"workspaces">;
  onClose?: () => void;
}

const DAY_MS = 86_400_000;

const PALETTE = [
  { bar: "bg-violet-500", ring: "ring-violet-500/30", text: "text-violet-600 dark:text-violet-400", dot: "bg-violet-500", light: "bg-violet-500/15" },
  { bar: "bg-blue-500", ring: "ring-blue-500/30", text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500", light: "bg-blue-500/15" },
  { bar: "bg-cyan-500", ring: "ring-cyan-500/30", text: "text-cyan-600 dark:text-cyan-400", dot: "bg-cyan-500", light: "bg-cyan-500/15" },
  { bar: "bg-emerald-500", ring: "ring-emerald-500/30", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500", light: "bg-emerald-500/15" },
  { bar: "bg-amber-500", ring: "ring-amber-500/30", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500", light: "bg-amber-500/15" },
  { bar: "bg-orange-500", ring: "ring-orange-500/30", text: "text-orange-600 dark:text-orange-400", dot: "bg-orange-500", light: "bg-orange-500/15" },
  { bar: "bg-rose-500", ring: "ring-rose-500/30", text: "text-rose-600 dark:text-rose-400", dot: "bg-rose-500", light: "bg-rose-500/15" },
];

const PRIORITY_STYLES = {
  urgent: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-orange-500/20",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  low: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
};

const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"] as const;

const PRESETS: { key: string; milestones: Omit<Milestone, "id">[] }[] = [
  {
    key: "productLaunch",
    milestones: [
      { name: "Scope & kick-off", daysBefore: 60, durationDays: 7 },
      { name: "Design & UX", daysBefore: 45, durationDays: 14 },
      { name: "Development", daysBefore: 28, durationDays: 14 },
      { name: "QA & bugfix", daysBefore: 10, durationDays: 5 },
      { name: "Launch", daysBefore: 2, durationDays: 1 },
    ],
  },
  {
    key: "clientDelivery",
    milestones: [
      { name: "Kick-off & discovery", daysBefore: 45, durationDays: 7 },
      { name: "Design review", daysBefore: 30, durationDays: 7 },
      { name: "Build", daysBefore: 18, durationDays: 10 },
      { name: "Client review", daysBefore: 6, durationDays: 3 },
      { name: "Final delivery", daysBefore: 1, durationDays: 1 },
    ],
  },
  {
    key: "marketingLaunch",
    milestones: [
      { name: "Strategy & messaging", daysBefore: 30, durationDays: 5 },
      { name: "Creative assets", daysBefore: 20, durationDays: 8 },
      { name: "Review & approval", daysBefore: 10, durationDays: 4 },
      { name: "Go-live", daysBefore: 2, durationDays: 1 },
    ],
  },
  {
    key: "contentCampaign",
    milestones: [
      { name: "Brief & outline", daysBefore: 21, durationDays: 3 },
      { name: "Create content", daysBefore: 14, durationDays: 7 },
      { name: "Review & edits", daysBefore: 6, durationDays: 3 },
      { name: "Publish", daysBefore: 1, durationDays: 1 },
    ],
  },
  {
    key: "eventPlanning",
    milestones: [
      { name: "Venue & date", daysBefore: 60, durationDays: 7 },
      { name: "Invitations", daysBefore: 35, durationDays: 7 },
      { name: "Logistics", daysBefore: 14, durationDays: 5 },
      { name: "Event day", daysBefore: 1, durationDays: 1 },
    ],
  },
];

function getPriority(daysBefore: number): "urgent" | "high" | "medium" | "low" {
  if (daysBefore <= 3) return "urgent";
  if (daysBefore <= 7) return "high";
  if (daysBefore <= 14) return "medium";
  return "low";
}

export function RetroPlanningPanel({
  projectId,
  projectDueDate,
  workspaceId,
  onClose,
}: RetroplanningProps) {
  const t = useTranslations("projects.retroPlanning");
  const locale = useLocale();
  const router = useRouter();
  const uid = useId();
  const createTask = useMutation(api.flux_tasks.create);
  const updateTask = useMutation(api.flux_tasks.update);
  const removeTask = useMutation(api.flux_tasks.remove);
  const projectTasks = useQuery(api.flux_tasks.list, { workspaceId, projectId });

  const [milestones, setMilestones] = useState<Milestone[]>([
    { id: `${uid}-1`, name: "", daysBefore: 28, durationDays: 7 },
    { id: `${uid}-2`, name: "", daysBefore: 14, durationDays: 5 },
    { id: `${uid}-3`, name: "", daysBefore: 5, durationDays: 3 },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTaskIds, setGeneratedTaskIds] = useState<Id<"tasks">[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<Id<"tasks"> | null>(null);
  const [templateKey, setTemplateKey] = useState<string>("");
  const [replaceMode, setReplaceMode] = useState<"replace" | "append">("replace");
  const timelineRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(
    () => [...milestones].sort((a, b) => b.daysBefore - a.daysBefore),
    [milestones],
  );

  const totalSpan = useMemo(
    () => Math.max(...milestones.map((m) => m.daysBefore + m.durationDays), 1),
    [milestones],
  );

  const validCount = useMemo(
    () => milestones.filter((m) => m.name.trim()).length,
    [milestones],
  );

  const overlaps = useMemo(() => {
    if (!projectDueDate) return [];
    const items = sorted
      .filter((m) => m.name.trim())
      .map((m) => ({
        id: m.id,
        start: projectDueDate - (m.daysBefore + m.durationDays) * DAY_MS,
        end: projectDueDate - m.daysBefore * DAY_MS,
      }));
    const overlapIds = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        if (a.start < b.end && b.start < a.end) {
          overlapIds.add(a.id);
          overlapIds.add(b.id);
        }
      }
    }
    return Array.from(overlapIds);
  }, [sorted, projectDueDate]);

  const addMilestone = useCallback(() => {
    const maxDays = Math.max(...milestones.map((m) => m.daysBefore), 7);
    setMilestones((prev) => [
      ...prev,
      { id: `${uid}-${Date.now()}`, name: "", daysBefore: Math.min(maxDays + 7, 365), durationDays: 5 },
    ]);
  }, [milestones, uid]);

  const removeMilestone = useCallback((id: string) => {
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const updateMilestone = useCallback((id: string, patch: Partial<Milestone>) => {
    setMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  }, []);

  const clearAll = useCallback(() => setMilestones([]), []);

  const loadTemplate = useCallback(
    (key: string) => {
      const preset = PRESETS.find((p) => p.key === key);
      if (!preset || !projectDueDate) return;
      const maxSpan = preset.milestones.reduce((max, m) => Math.max(max, m.daysBefore + m.durationDays), 0);
      const shift = maxSpan > 0 ? Math.max(0, maxSpan - Math.ceil((projectDueDate - Date.now()) / DAY_MS)) : 0;
      const next = preset.milestones.map((m, idx) => ({
        id: `${uid}-${preset.key}-${idx}-${Date.now()}`,
        name: t(`presets.${preset.key}.name`) + " — " + m.name,
        daysBefore: Math.max(1, m.daysBefore + shift),
        durationDays: Math.max(1, m.durationDays),
      }));
      setMilestones((prev) => (replaceMode === "replace" ? next : [...prev, ...next]));
      setTemplateKey(key);
      toast.success(t("loadTemplate"));
    },
    [projectDueDate, replaceMode, t, uid],
  );

  const getDate = useCallback(
    (daysBefore: number) => (projectDueDate ? new Date(projectDueDate - daysBefore * DAY_MS) : null),
    [projectDueDate],
  );

  const fmt = useCallback(
    (d: Date | null, opts?: Intl.DateTimeFormatOptions) => {
      if (!d) return "—";
      return d.toLocaleDateString(locale, opts ?? { month: "short", day: "numeric" });
    },
    [locale],
  );

  const handleGenerate = async () => {
    if (!projectDueDate) {
      toast.error(t("noDeadline"));
      return;
    }
    if (validCount === 0) return;
    setIsGenerating(true);
    const created: Id<"tasks">[] = [];
    try {
      for (const ms of milestones.filter((m) => m.name.trim())) {
        const id = await createTask({
          title: ms.name.trim(),
          workspaceId,
          projectId,
          priority: getPriority(ms.daysBefore),
          dueDate: projectDueDate - ms.daysBefore * DAY_MS,
          startDate: projectDueDate - (ms.daysBefore + ms.durationDays) * DAY_MS,
          status: "todo",
        });
        created.push(id);
      }
      setGeneratedTaskIds((prev) => [...prev, ...created]);
      toast.success(t("tasksCreated", { count: created.length }));
    } catch {
      toast.error(t("generateFailed"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteGenerated = async (taskId: Id<"tasks">) => {
    try {
      await removeTask({ taskId });
      setGeneratedTaskIds((prev) => prev.filter((id) => id !== taskId));
      toast.success(t("removeTask"));
    } catch {
      toast.error(t("generateFailed"));
    }
  };

  const handleUpdateGenerated = async (
    taskId: Id<"tasks">,
    patch: { title?: string; dueDate?: number; priority?: any },
  ) => {
    try {
      await updateTask({ taskId, ...patch });
    } catch {
      toast.error(t("generateFailed"));
    }
  };

  const handleDrag = useCallback(
    (id: string, mode: "start" | "end" | "move") => {
      if (!timelineRef.current || !projectDueDate) return;
      const track = timelineRef.current;
      const rect = track.getBoundingClientRect();
      const ms = milestones.find((m) => m.id === id);
      if (!ms) return;

      const onPointerMove = (e: PointerEvent) => {
        const x = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        const daysFromStart = Math.round((1 - pct) * totalSpan);
        if (mode === "move") {
          const span = ms.durationDays;
          const newStartDays = Math.max(span, Math.min(totalSpan, daysFromStart + span / 2));
          const newEndDays = Math.max(1, newStartDays - span);
          updateMilestone(id, { daysBefore: newEndDays, durationDays: span });
        } else if (mode === "start") {
          const newStartDays = Math.max(1, Math.min(totalSpan - 1, daysFromStart));
          const newEndDays = Math.max(1, Math.min(ms.daysBefore, totalSpan - newStartDays));
          const newDuration = Math.max(1, newStartDays - newEndDays);
          updateMilestone(id, { daysBefore: newEndDays, durationDays: newDuration });
        } else if (mode === "end") {
          const newEndDays = Math.max(1, Math.min(totalSpan - 1, daysFromStart));
          const startDay = ms.daysBefore + ms.durationDays;
          const newDuration = Math.max(1, startDay - newEndDays);
          updateMilestone(id, { daysBefore: newEndDays, durationDays: newDuration });
        }
      };

      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [milestones, projectDueDate, totalSpan, updateMilestone],
  );

  if (!projectDueDate) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-muted text-muted-foreground">
          <Calendar className="h-7 w-7" />
        </div>
        <h3 className="text-base font-semibold">{t("noDeadline")}</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{t("setDeadlineHint")}</p>
      </div>
    );
  }

  const deadlineDate = new Date(projectDueDate);
  const daysUntilDeadline = Math.max(0, Math.ceil((projectDueDate - Date.now()) / DAY_MS));
  const deadlinePassed = daysUntilDeadline === 0;
  const urgencyColor = deadlinePassed
    ? "text-destructive"
    : daysUntilDeadline <= 7
      ? "text-red-500"
      : daysUntilDeadline <= 14
        ? "text-amber-500"
        : "text-foreground";

  const generatedTasks = useMemo(() => {
    const set = new Set(generatedTaskIds);
    return (projectTasks ?? []).filter((task: any) => set.has(task._id));
  }, [projectTasks, generatedTaskIds]);

  const todayCol = projectDueDate
    ? Math.max(0, Math.min(1, 1 - (Date.now() - (projectDueDate - totalSpan * DAY_MS)) / (totalSpan * DAY_MS)))
    : null;

  // Adaptive time ruler: weekly ticks for short spans, bi-weekly / monthly for longer ones.
  const tickStep = totalSpan > 120 ? 30 : totalSpan > 45 ? 14 : 7;
  const ticks: { pct: number; label: string }[] = [];
  for (let d = tickStep; d < totalSpan; d += tickStep) {
    ticks.push({ pct: ((totalSpan - d) / totalSpan) * 100, label: fmt(getDate(d)) });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{t("title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t("description")}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Deadline banner */}
      <div className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
          <Flag className="h-4 w-4 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-0.5">
            {t("deadline")}
          </p>
          <p className="text-sm font-semibold truncate">
            {fmt(deadlineDate, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("text-2xl font-bold tabular-nums leading-none", urgencyColor)}>
            {daysUntilDeadline}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{t("daysLeft")}</p>
        </div>
      </div>

      {/* Templates */}
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">{t("templates")}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={templateKey} onValueChange={(v) => loadTemplate(v)}>
            <SelectTrigger className="h-9 flex-1 text-xs">
              <SelectValue placeholder={t("loadTemplate")} />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((preset) => (
                <SelectItem key={preset.key} value={preset.key} className="text-xs">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{t(`presets.${preset.key}.name`)}</span>
                    <span className="text-[10px] text-muted-foreground">{t(`presets.${preset.key}.description`)}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 rounded-lg border p-0.5">
            {(["replace", "append"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setReplaceMode(m)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                  replaceMode === m ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(m)}
              </button>
            ))}
          </div>
        </div>
        {replaceMode === "replace" && milestones.length > 0 && (
          <p className="mt-2 text-[10px] text-muted-foreground">{t("loadTemplateConfirm")}</p>
        )}
      </div>

      {/* Overlap warning */}
      {overlaps.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {t("overlapWarning")}
        </div>
      )}

      {/* Interactive timeline */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3 pb-1.5 border-b border-border/50">
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">{fmt(getDate(totalSpan))}</span>
          <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider">{t("timeline")}</span>
          <span className="text-[10px] text-destructive tabular-nums font-medium">{fmt(deadlineDate)}</span>
        </div>
        <div ref={timelineRef} className="relative px-3 py-3 space-y-2">
          {/* Time ruler gridlines */}
          <div className="pointer-events-none absolute inset-0 z-0">
            {ticks.map((tk) => (
              <div key={tk.pct} className="absolute bottom-0 top-0 flex flex-col items-center" style={{ left: `${tk.pct}%` }}>
                <div className="w-px flex-1 bg-border/60" />
                <span className="pb-0.5 text-[8px] tabular-nums text-muted-foreground/50">{tk.label}</span>
              </div>
            ))}
          </div>
          {todayCol !== null && todayCol > 0 && todayCol < 1 && (
            <div
              className="absolute top-0 bottom-0 z-10 flex flex-col items-center"
              style={{ left: `${todayCol * 100}%` }}
            >
              <span className="-mt-px whitespace-nowrap rounded-full bg-primary px-1.5 py-px text-[8px] font-semibold leading-tight text-primary-foreground shadow-sm">
                {t("today")}
              </span>
              <div className="w-px flex-1 bg-primary/40" />
            </div>
          )}
          {/* Deadline marker */}
          <div className="absolute top-0 right-3 bottom-0 z-10 flex flex-col items-center">
            <Flag className="h-3 w-3 -mt-0.5 shrink-0 text-destructive" />
            <div className="w-px flex-1 bg-destructive/40" />
          </div>

          {sorted.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">{t("addMilestone")}</div>
          ) : (
            sorted.map((ms, i) => {
              const p = PALETTE[i % PALETTE.length];
              const leftPct = ((totalSpan - ms.daysBefore - ms.durationDays) / totalSpan) * 100;
              const widthPct = Math.max(3, (ms.durationDays / totalSpan) * 100);
              const label = ms.name.trim() || `${t("milestoneName")} ${i + 1}`;
              const isOverlap = overlaps.includes(ms.id);
              return (
                <div key={ms.id} className="relative h-8 rounded-md bg-muted/50 group/bar">
                  <div
                    className={cn(
                      "absolute inset-y-0 rounded-md flex items-center px-2 overflow-hidden cursor-grab active:cursor-grabbing",
                      p.bar,
                      "opacity-85 hover:opacity-100 transition-opacity",
                      isOverlap && "ring-2 ring-amber-500/50",
                    )}
                    style={{ left: `${Math.max(0, leftPct)}%`, width: `${widthPct}%`, minWidth: "10px" }}
                    onPointerDown={() => handleDrag(ms.id, "move")}
                    title={t("dragHint")}
                  >
                    <span className="text-[10px] text-white font-semibold truncate leading-none select-none">{label}</span>
                  </div>
                  {/* Start handle */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 z-20 h-5 w-3 -ml-1.5 cursor-ew-resize rounded bg-white/90 shadow opacity-0 group-hover/bar:opacity-100 transition-opacity"
                    style={{ left: `${Math.max(0, leftPct)}%` }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handleDrag(ms.id, "start");
                    }}
                  />
                  {/* End handle */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 z-20 h-5 w-3 -ml-1.5 cursor-ew-resize rounded bg-white/90 shadow opacity-0 group-hover/bar:opacity-100 transition-opacity"
                    style={{ left: `${Math.max(0, leftPct) + widthPct}%` }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handleDrag(ms.id, "end");
                    }}
                  />
                </div>
              );
            })
          )}
        </div>
        <div className="px-4 py-1.5 border-t border-border/50 bg-muted/20">
          <p className="text-[10px] text-muted-foreground">{t("dragHint")}</p>
        </div>
      </div>

      {/* Milestones editor */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
            {t("milestones")} <span className="text-foreground/60">({sorted.length})</span>
          </p>
          <div className="flex items-center gap-2">
            {milestones.length > 0 && (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {validCount}/{milestones.length} {t("named")}
              </span>
            )}
            {milestones.length > 0 && (
              <button
                onClick={clearAll}
                className="text-[10px] text-destructive hover:text-destructive/80 transition-colors"
              >
                {t("clearAll")}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {sorted.map((ms, i) => {
            const p = PALETTE[i % PALETTE.length];
            const priority = getPriority(ms.daysBefore);
            const startDate = getDate(ms.daysBefore + ms.durationDays);
            const endDate = getDate(ms.daysBefore);
            const isOverlap = overlaps.includes(ms.id);

            return (
              <div
                key={ms.id}
                className={cn(
                  "group/ms rounded-2xl border bg-card hover:bg-accent/15 transition-colors",
                  isOverlap && "border-amber-500/40 bg-amber-500/5",
                )}
              >
                <div className="flex items-center gap-2.5 px-3 pt-3 pb-1.5">
                  <div className={cn("h-2.5 w-2.5 rounded-full shrink-0 ring-2", p.dot, p.ring)} />
                  <Input
                    value={ms.name}
                    onChange={(e) => updateMilestone(ms.id, { name: e.target.value })}
                    placeholder={t("milestoneName")}
                    className="h-7 flex-1 text-sm font-medium border-0 px-0 shadow-none focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/40"
                  />
                  <button
                    onClick={() => removeMilestone(ms.id)}
                    className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/40 opacity-0 group-hover/ms:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 pb-3 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <DatePicker
                      date={startDate ?? undefined}
                      onChange={(d) => {
                        if (!d || !projectDueDate) return;
                        const newStartDays = Math.max(1, Math.round((projectDueDate - d.getTime()) / DAY_MS));
                        const endDays = ms.daysBefore;
                        const newDuration = Math.max(1, newStartDays - endDays);
                        updateMilestone(ms.id, { daysBefore: endDays, durationDays: newDuration });
                      }}
                      className="h-7 w-32 text-[11px]"
                    />
                    <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                    <DatePicker
                      date={endDate ?? undefined}
                      onChange={(d) => {
                        if (!d || !projectDueDate) return;
                        const newEndDays = Math.max(1, Math.round((projectDueDate - d.getTime()) / DAY_MS));
                        const startDays = ms.daysBefore + ms.durationDays;
                        const newDuration = Math.max(1, startDays - newEndDays);
                        updateMilestone(ms.id, { daysBefore: newEndDays, durationDays: newDuration });
                      }}
                      className="h-7 w-32 text-[11px]"
                    />
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", PRIORITY_STYLES[priority])}>
                    {t(`priority.${priority}`)}
                  </span>
                  <div className="ml-auto flex items-center gap-2 text-muted-foreground/60 tabular-nums">
                    <Clock className="h-3 w-3" />
                    <span>
                      {ms.durationDays}j · {t("daysBefore")} {ms.daysBefore}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={addMilestone}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed px-4 py-2.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-accent/30 transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("addMilestone")}
        </button>
      </div>

      {/* Generated tasks manager */}
      {generatedTasks.length > 0 && (
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">{t("generatedTasks")}</p>
            <span className="text-[10px] text-muted-foreground">{generatedTasks.length}</span>
          </div>
          <div className="space-y-1.5">
            {generatedTasks.map((task: any) => {
              const isEditing = editingTaskId === task._id;
              return (
                <div
                  key={task._id}
                  className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 group/task"
                >
                  {isEditing ? (
                    <>
                      <Input
                        defaultValue={task.title}
                        onBlur={(e) => {
                          handleUpdateGenerated(task._id, { title: e.target.value.trim() });
                          setEditingTaskId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleUpdateGenerated(task._id, { title: (e.target as HTMLInputElement).value.trim() });
                            setEditingTaskId(null);
                          }
                        }}
                        autoFocus
                        className="h-7 flex-1 text-xs"
                      />
                      <Select
                        value={task.priority}
                        onValueChange={(v) => handleUpdateGenerated(task._id, { priority: v as any })}
                      >
                        <SelectTrigger className="h-7 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITY_OPTIONS.map((prio) => (
                            <SelectItem key={prio} value={prio} className="text-xs">
                              {t(`priority.${prio}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button
                        onClick={() => setEditingTaskId(null)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className={cn("h-2 w-2 rounded-full", PALETTE[0].dot)} />
                      <span className="flex-1 truncate text-sm">{task.title}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", PRIORITY_STYLES[task.priority as keyof typeof PRIORITY_STYLES] ?? PRIORITY_STYLES.low)}>
                        {t(`priority.${task.priority}`)}
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{fmt(task.dueDate ? new Date(task.dueDate) : null)}</span>
                      <button
                        onClick={() => setEditingTaskId(task._id)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover/task:opacity-100 hover:bg-accent"
                        aria-label={t("editTask")}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => router.push(`/tasks/${task._id}`)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover/task:opacity-100 hover:bg-accent"
                        aria-label={t("openTask")}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteGenerated(task._id)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover/task:opacity-100 hover:text-destructive hover:bg-destructive/10"
                        aria-label={t("removeTask")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Generate CTA */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || validCount === 0}
        className="w-full gap-2 rounded-2xl h-11"
      >
        <SynaIcon size={16} />
        {isGenerating ? t("generating") : t("generateTasks")}
        {validCount > 0 && !isGenerating && (
          <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
            {validCount}
          </span>
        )}
      </Button>
    </div>
  );
}

