"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Zap, ChevronRight, Power } from "lucide-react";

const TRIGGERS = ["task_created", "task_status_changed", "task_due_soon", "task_assigned"] as const;
const ACTIONS = ["set_status", "set_priority", "assign_to", "send_notification", "add_label"] as const;

const STATUS_VALUES = ["todo", "in_progress", "in_review", "done", "cancelled"];
const PRIORITY_VALUES = ["none", "low", "medium", "high", "urgent"];

const TRIGGER_COLORS: Record<string, string> = {
  task_created: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  task_status_changed: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  task_due_soon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  task_assigned: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

export default function AutomationsPage() {
  const t = useTranslations("automations");
  const tt = useTranslations("tasks");
  const automations = useQuery(api.automations.getMyAutomations);
  const createAuto = useMutation(api.automations.create);
  const removeAuto = useMutation(api.automations.remove);
  const toggleAuto = useMutation(api.automations.toggle);
  const myProjects = useQuery(api.projects.getMyProjects, {});

  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<typeof TRIGGERS[number]>("task_created");
  const [action, setAction] = useState<typeof ACTIONS[number]>("set_priority");
  const [triggerValue, setTriggerValue] = useState("");
  const [actionValue, setActionValue] = useState("");
  const [projectId, setProjectId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setTrigger("task_created");
    setAction("set_priority");
    setTriggerValue("");
    setActionValue("");
    setProjectId("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await createAuto({
        name: name.trim(),
        trigger,
        action,
        triggerValue: triggerValue || undefined,
        actionValue: actionValue || undefined,
        projectId: projectId ? (projectId as Id<"projects">) : undefined,
      });
      toast.success(t("created"));
      reset();
      setShowNew(false);
    } catch {
      toast.error(t("createFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: Id<"automations">) => {
    try {
      await removeAuto({ id });
      toast.success(t("deleted"));
    } catch {}
  };

  const handleToggle = async (id: Id<"automations">) => {
    try {
      await toggleAuto({ id });
      toast.success(t("toggled"));
    } catch {}
  };

  const needsActionValue = action === "set_status" || action === "set_priority" || action === "add_label" || action === "send_notification";

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8 md:px-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{t("subtitle")}</p>
          </div>
          <Button onClick={() => setShowNew(true)} size="sm" className="gap-1.5 h-8">
            <Plus className="h-3.5 w-3.5" /> {t("new")}
          </Button>
        </div>

        {/* Automations list */}
        {(automations ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
              <Zap className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold">{t("empty")}</h3>
            <p className="text-muted-foreground mt-1 text-sm max-w-xs">{t("emptyDesc")}</p>
            <Button onClick={() => setShowNew(true)} size="sm" className="mt-4 gap-1.5 h-8">
              <Plus className="h-3.5 w-3.5" /> {t("new")}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {(automations ?? []).map((auto) => (
              <div
                key={auto._id}
                className={cn(
                  "rounded-xl border p-4 transition-all",
                  auto.enabled ? "border-border" : "border-border/50 opacity-60",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    auto.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}>
                    <Zap className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold truncate">{auto.name}</h3>
                      {!auto.enabled && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">OFF</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", TRIGGER_COLORS[auto.trigger] ?? "bg-muted")}>
                        {t(`triggers.${auto.trigger}` as any)}
                      </span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                      <span className="text-[10px] font-medium">
                        {t(`actions.${auto.action}` as any)}
                        {auto.actionValue && ` "${auto.actionValue}"`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggle(auto._id)}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                        auto.enabled
                          ? "text-primary hover:bg-primary/10"
                          : "text-muted-foreground hover:bg-accent",
                      )}
                      title={auto.enabled ? "Disable" : "Enable"}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(auto._id)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Automation Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-base font-semibold">{t("new")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="px-6 pt-5 pb-4 space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("name")}</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  autoFocus
                  required
                  className="h-10 text-sm"
                />
              </div>

              {/* Trigger */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("when")}</label>
                <Select value={trigger} onValueChange={(v: any) => setTrigger(v)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map((tr) => (
                      <SelectItem key={tr} value={tr}>{t(`triggers.${tr}` as any)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("then")}</label>
                <Select value={action} onValueChange={(v: any) => setAction(v)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((ac) => (
                      <SelectItem key={ac} value={ac}>{t(`actions.${ac}` as any)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action value */}
              {needsActionValue && (
                <div className="space-y-1.5">
                  {action === "set_status" ? (
                    <Select value={actionValue} onValueChange={setActionValue}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Status…" /></SelectTrigger>
                      <SelectContent>
                        {STATUS_VALUES.map((s) => (
                          <SelectItem key={s} value={s}>{tt(`statuses.${s}` as any)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : action === "set_priority" ? (
                    <Select value={actionValue} onValueChange={setActionValue}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Priority…" /></SelectTrigger>
                      <SelectContent>
                        {PRIORITY_VALUES.map((p) => (
                          <SelectItem key={p} value={p}>{tt(`priorities.${p}` as any)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={actionValue}
                      onChange={(e) => setActionValue(e.target.value)}
                      placeholder={action === "add_label" ? "Label name…" : "Value…"}
                      className="h-9 text-xs"
                    />
                  )}
                </div>
              )}

              {/* Scope — project */}
              {(myProjects ?? []).length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("scope")}</label>
                  <Select value={projectId || "all"} onValueChange={(v) => setProjectId(v === "all" ? "" : v)}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allTasks")}</SelectItem>
                      {(myProjects ?? []).filter(Boolean).map((p: any) => (
                        <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-muted/20">
              <Button type="button" variant="ghost" size="sm" onClick={() => { reset(); setShowNew(false); }}>
                {t("name") === "Rule name" ? "Cancel" : "Annuler"}
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting || !name.trim()}>
                {isSubmitting ? "..." : t("new")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
