"use client";

import { useState, useMemo, useId } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowRight, Calendar, Flag, Plus, Sparkles, Trash2, X } from "lucide-react";

interface Milestone {
  id: string;
  name: string;
  daysBefore: number;
  durationDays: number;
}

interface RetroplanningProps {
  projectId: Id<"projects">;
  projectDueDate?: number;
  teamId?: Id<"teams">;
  onClose?: () => void;
}

const DAY_MS = 86_400_000;

const PALETTE = [
  { bar: "bg-violet-500", ring: "ring-violet-500/30", text: "text-violet-600 dark:text-violet-400", dot: "bg-violet-500" },
  { bar: "bg-blue-500",   ring: "ring-blue-500/30",   text: "text-blue-600 dark:text-blue-400",     dot: "bg-blue-500"   },
  { bar: "bg-cyan-500",   ring: "ring-cyan-500/30",   text: "text-cyan-600 dark:text-cyan-400",     dot: "bg-cyan-500"   },
  { bar: "bg-emerald-500",ring: "ring-emerald-500/30",text: "text-emerald-600 dark:text-emerald-400",dot:"bg-emerald-500"},
  { bar: "bg-amber-500",  ring: "ring-amber-500/30",  text: "text-amber-600 dark:text-amber-400",   dot: "bg-amber-500"  },
  { bar: "bg-orange-500", ring: "ring-orange-500/30", text: "text-orange-600 dark:text-orange-400", dot: "bg-orange-500" },
  { bar: "bg-rose-500",   ring: "ring-rose-500/30",   text: "text-rose-600 dark:text-rose-400",     dot: "bg-rose-500"   },
];

const PRIORITY_STYLES = {
  urgent: "bg-red-500/10 text-red-600 dark:text-red-400",
  high:   "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low:    "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

function getPriority(daysBefore: number): "urgent" | "high" | "medium" | "low" {
  if (daysBefore <= 3)  return "urgent";
  if (daysBefore <= 7)  return "high";
  if (daysBefore <= 14) return "medium";
  return "low";
}

export function RetroPlanningPanel({
  projectId,
  projectDueDate,
  teamId,
  onClose,
}: RetroplanningProps) {
  const t = useTranslations("retroPlanning");
  const locale = useLocale();
  const createTask = useMutation(api.tasks.create);
  const uid = useId();

  const [milestones, setMilestones] = useState<Milestone[]>([
    { id: `${uid}-1`, name: "", daysBefore: 28, durationDays: 7 },
    { id: `${uid}-2`, name: "", daysBefore: 14, durationDays: 5 },
    { id: `${uid}-3`, name: "", daysBefore: 5,  durationDays: 3 },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  const sorted = useMemo(
    () => [...milestones].sort((a, b) => b.daysBefore - a.daysBefore),
    [milestones],
  );

  const totalSpan = useMemo(
    () => Math.max(...milestones.map((m) => m.daysBefore + m.durationDays), 1),
    [milestones],
  );

  const validCount = milestones.filter((m) => m.name.trim()).length;

  const addMilestone = () => {
    const maxDays = Math.max(...milestones.map((m) => m.daysBefore), 7);
    setMilestones((prev) => [
      ...prev,
      { id: `${uid}-${Date.now()}`, name: "", daysBefore: maxDays + 7, durationDays: 5 },
    ]);
  };

  const removeMilestone = (id: string) =>
    setMilestones((prev) => prev.filter((m) => m.id !== id));

  const update = (id: string, patch: Partial<Milestone>) =>
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const getDate = (daysBefore: number) =>
    projectDueDate ? new Date(projectDueDate - daysBefore * DAY_MS) : null;

  const fmt = (d: Date | null, opts?: Intl.DateTimeFormatOptions) => {
    if (!d) return "—";
    return d.toLocaleDateString(locale, opts ?? { month: "short", day: "numeric" });
  };

  const handleGenerate = async () => {
    if (!projectDueDate) { toast.error(t("noDeadline")); return; }
    if (validCount === 0) return;
    setIsGenerating(true);
    try {
      for (const ms of milestones.filter((m) => m.name.trim())) {
        await createTask({
          title: ms.name.trim(),
          projectId,
          teamId: teamId ?? undefined,
          priority: getPriority(ms.daysBefore),
          dueDate: projectDueDate - ms.daysBefore * DAY_MS,
          status: "todo",
        });
      }
      toast.success(t("generated"));
      onClose?.();
    } catch {
      toast.error(t("generateFailed"));
    } finally {
      setIsGenerating(false);
    }
  };

  if (!projectDueDate) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
          <Calendar className="h-5 w-5 text-muted-foreground/40" />
        </div>
        <div>
          <p className="text-sm font-medium">{t("noDeadline")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("setDeadlineHint")}</p>
        </div>
      </div>
    );
  }

  const deadlineDate = new Date(projectDueDate);
  const daysUntilDeadline = Math.max(0, Math.ceil((projectDueDate - Date.now()) / DAY_MS));
  const urgencyColor =
    daysUntilDeadline <= 7  ? "text-red-500" :
    daysUntilDeadline <= 14 ? "text-amber-500" :
                              "text-foreground";

  return (
    <div className="flex flex-col gap-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{t("title")}</h3>
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

      {/* ── Deadline banner ── */}
      <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
          <Flag className="h-3.5 w-3.5 text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-0.5">{t("deadline")}</p>
          <p className="text-sm font-semibold truncate">
            {fmt(deadlineDate, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("text-xl font-bold tabular-nums leading-none", urgencyColor)}>{daysUntilDeadline}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{t("daysLeft")}</p>
        </div>
      </div>

      {/* ── Timeline Gantt ── */}
      {sorted.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          {/* Date axis */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1.5 border-b border-border/50">
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">{fmt(getDate(totalSpan))}</span>
            <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider">{t("timeline")}</span>
            <span className="text-[10px] text-red-400 tabular-nums font-medium">{fmt(deadlineDate)}</span>
          </div>
          {/* Bars */}
          <div className="px-3 py-2.5 space-y-1.5">
            {sorted.map((ms, i) => {
              const p = PALETTE[i % PALETTE.length];
              const leftPct  = ((totalSpan - ms.daysBefore - ms.durationDays) / totalSpan) * 100;
              const widthPct = Math.max(3, (ms.durationDays / totalSpan) * 100);
              const label = ms.name.trim() || `Phase ${i + 1}`;
              return (
                <div key={ms.id} className="relative h-6 rounded-md bg-muted/50">
                  <div
                    className={cn("absolute inset-y-0 rounded-md flex items-center px-2 overflow-hidden", p.bar, "opacity-85")}
                    style={{ left: `${Math.max(0, leftPct)}%`, width: `${widthPct}%`, minWidth: "10px" }}
                  >
                    <span className="text-[9px] text-white font-semibold truncate leading-none">{label}</span>
                  </div>
                </div>
              );
            })}
            {/* Deadline tick */}
            <div className="absolute inset-y-0 right-3 w-px bg-red-400/50 pointer-events-none" />
          </div>
        </div>
      )}

      {/* ── Phases ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            {t("milestones")} <span className="text-foreground/60">({sorted.length})</span>
          </p>
          {milestones.length > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {validCount}/{milestones.length} {t("named")}
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          {sorted.map((ms, i) => {
            const p = PALETTE[i % PALETTE.length];
            const priority = getPriority(ms.daysBefore);
            const startDate = getDate(ms.daysBefore);
            const endDate   = getDate(Math.max(0, ms.daysBefore - ms.durationDays));

            return (
              <div key={ms.id} className="group/ms rounded-xl border bg-card hover:bg-accent/20 transition-colors">
                {/* Top row: color dot + name input + delete */}
                <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-1.5">
                  <div className={cn("h-2.5 w-2.5 rounded-full shrink-0 ring-2", p.dot, p.ring)} />
                  <Input
                    value={ms.name}
                    onChange={(e) => update(ms.id, { name: e.target.value })}
                    placeholder={t("milestoneName")}
                    className="h-6 flex-1 text-sm font-medium border-0 px-0 shadow-none focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/40"
                  />
                  <button
                    onClick={() => removeMilestone(ms.id)}
                    className="shrink-0 flex h-5 w-5 items-center justify-center rounded text-muted-foreground/20 opacity-0 group-hover/ms:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                {/* Bottom row: controls + date range */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pb-2.5 text-[11px]">
                  {/* days before */}
                  <label className="flex items-center gap-1 text-muted-foreground">
                    <span className="shrink-0">{t("daysBefore")}:</span>
                    <input
                      type="number" min={1} max={730}
                      value={ms.daysBefore}
                      onChange={(e) => update(ms.id, { daysBefore: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-12 rounded-md border bg-muted/50 px-1.5 py-0.5 text-center text-[11px] outline-none focus:border-primary/60 focus:bg-background transition-colors"
                    />
                  </label>
                  {/* duration */}
                  <label className="flex items-center gap-1 text-muted-foreground">
                    <span className="shrink-0">{t("durationDays")}:</span>
                    <input
                      type="number" min={1} max={90}
                      value={ms.durationDays}
                      onChange={(e) => update(ms.id, { durationDays: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-12 rounded-md border bg-muted/50 px-1.5 py-0.5 text-center text-[11px] outline-none focus:border-primary/60 focus:bg-background transition-colors"
                    />
                  </label>
                  {/* priority badge */}
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", PRIORITY_STYLES[priority])}>
                    {t(`priority.${priority}`)}
                  </span>
                  {/* date range */}
                  {startDate && endDate && (
                    <span className="flex items-center gap-1 text-muted-foreground/50 tabular-nums ml-auto">
                      {fmt(startDate)}
                      <ArrowRight className="h-2.5 w-2.5" />
                      {fmt(endDate)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add phase */}
        <button
          onClick={addMilestone}
          className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-accent/30 transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("addMilestone")}
        </button>
      </div>

      {/* ── Summary + Generate ── */}
      {validCount > 0 && (
        <div className="rounded-xl border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">{t("summaryTitle", { count: validCount })}</p>
          <ul className="space-y-0.5">
            {sorted.filter((m) => m.name.trim()).map((ms, i) => {
              const p = PALETTE[sorted.indexOf(ms) % PALETTE.length];
              return (
                <li key={ms.id} className="flex items-center gap-2">
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", p.dot)} />
                  <span className="truncate">{ms.name.trim()}</span>
                  <span className="ml-auto shrink-0 tabular-nums text-muted-foreground/50">{fmt(getDate(ms.daysBefore))}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Button
        onClick={handleGenerate}
        disabled={isGenerating || validCount === 0}
        className="w-full gap-2"
      >
        <Sparkles className="h-4 w-4" />
        {isGenerating ? t("generating") : t("generate")}
        {validCount > 0 && !isGenerating && (
          <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">{validCount}</span>
        )}
      </Button>
    </div>
  );
}
