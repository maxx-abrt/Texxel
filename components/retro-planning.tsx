"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  Calendar,
  Flag,
  Milestone,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

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

export function RetroPlanningPanel({
  projectId,
  projectDueDate,
  teamId,
  onClose,
}: RetroplanningProps) {
  const t = useTranslations("retroPlanning");
  const locale = useLocale();
  const createTask = useMutation(api.tasks.create);

  const [milestones, setMilestones] = useState<Milestone[]>([
    { id: "1", name: "", daysBefore: 30, durationDays: 7 },
    { id: "2", name: "", daysBefore: 14, durationDays: 7 },
    { id: "3", name: "", daysBefore: 3, durationDays: 3 },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  const addMilestone = () => {
    const maxDaysBefore = Math.max(...milestones.map((m) => m.daysBefore), 0);
    setMilestones((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: "",
        daysBefore: maxDaysBefore + 7,
        durationDays: 5,
      },
    ]);
  };

  const removeMilestone = (id: string) => {
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  };

  const updateMilestone = (id: string, patch: Partial<Milestone>) => {
    setMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  };

  const sorted = [...milestones].sort(
    (a, b) => b.daysBefore - a.daysBefore,
  );

  const getDate = (daysBefore: number) => {
    if (!projectDueDate) return null;
    return new Date(projectDueDate - daysBefore * DAY_MS);
  };

  const formatDate = (d: Date | null) => {
    if (!d) return "—";
    return d.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleGenerate = async () => {
    if (!projectDueDate) {
      toast.error(t("noDeadline"));
      return;
    }
    const validMilestones = milestones.filter((m) => m.name.trim());
    if (validMilestones.length === 0) return;

    setIsGenerating(true);
    try {
      for (const ms of validMilestones) {
        const dueDate = projectDueDate - ms.daysBefore * DAY_MS;
        await createTask({
          title: ms.name.trim(),
          projectId,
          teamId: teamId ?? undefined,
          priority: ms.daysBefore <= 7 ? "high" : ms.daysBefore <= 14 ? "medium" : "low",
          dueDate,
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
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Calendar className="h-10 w-10 text-muted-foreground/20 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          {t("noDeadline")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">{t("title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("description")}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Deadline display */}
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <Flag className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            {t("deadline")}
          </p>
          <p className="text-sm font-semibold">
            {formatDate(new Date(projectDueDate))}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">
          {t("milestones")} ({sorted.length})
        </p>

        {sorted.map((ms, i) => {
          const startDate = getDate(ms.daysBefore);
          const endDate = getDate(ms.daysBefore - ms.durationDays);
          return (
            <div key={ms.id} className="relative">
              {/* Connector line */}
              {i > 0 && (
                <div className="absolute left-[15px] -top-3 h-3 w-px bg-border" />
              )}
              <div className="flex items-start gap-3 group">
                {/* Timeline dot */}
                <div className="mt-2.5 flex flex-col items-center">
                  <div
                    className={cn(
                      "h-[10px] w-[10px] rounded-full border-2 shrink-0",
                      ms.name.trim()
                        ? "border-primary bg-primary/20"
                        : "border-muted-foreground/30 bg-background",
                    )}
                  />
                  {i < sorted.length - 1 && (
                    <div className="w-px flex-1 bg-border min-h-[20px]" />
                  )}
                </div>

                {/* Milestone card */}
                <div className="flex-1 rounded-lg border bg-card p-3 mb-2 transition-all hover:border-primary/20">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                      <Input
                        value={ms.name}
                        onChange={(e) =>
                          updateMilestone(ms.id, { name: e.target.value })
                        }
                        placeholder={t("milestoneName")}
                        className="h-8 text-sm font-medium border-0 px-0 shadow-none focus-visible:ring-0"
                      />
                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{t("daysBefore")}:</span>
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={ms.daysBefore}
                            onChange={(e) =>
                              updateMilestone(ms.id, {
                                daysBefore: Math.max(1, parseInt(e.target.value) || 1),
                              })
                            }
                            className="w-12 rounded border bg-transparent px-1.5 py-0.5 text-center text-[11px] outline-none focus:border-primary"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{t("durationDays")}:</span>
                          <input
                            type="number"
                            min={1}
                            max={90}
                            value={ms.durationDays}
                            onChange={(e) =>
                              updateMilestone(ms.id, {
                                durationDays: Math.max(1, parseInt(e.target.value) || 1),
                              })
                            }
                            className="w-12 rounded border bg-transparent px-1.5 py-0.5 text-center text-[11px] outline-none focus:border-primary"
                          />
                        </div>
                      </div>
                      {startDate && endDate && (
                        <p className="text-[10px] text-muted-foreground/50">
                          {formatDate(startDate)} → {formatDate(endDate)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removeMilestone(ms.id)}
                      className="shrink-0 mt-1 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add milestone */}
        <button
          onClick={addMilestone}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" />
          {t("addMilestone")}
        </button>
      </div>

      {/* Deadline marker */}
      <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <div className="flex h-[10px] w-[10px] shrink-0 rounded-full bg-primary" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-primary">{t("deadline")}</p>
          <p className="text-[10px] text-muted-foreground">
            {formatDate(new Date(projectDueDate))}
          </p>
        </div>
      </div>

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={
          isGenerating || milestones.filter((m) => m.name.trim()).length === 0
        }
        className="w-full gap-2"
      >
        <Sparkles className="h-4 w-4" />
        {isGenerating ? "..." : t("generate")}
      </Button>
    </div>
  );
}
