"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { parseBulkTasks, type BulkTaskDraft } from "@/lib/ai";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { btnPrimary, btnOutline, inputBase, Spinner } from "@/components/app/common";
import { Add, Trash } from "iconsax-reactjs";

export interface TaskBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: Id<"workspaces"> | null;
  members: any[];
  projects: any[];
  statuses: { _id: Id<"flux_taskStatuses"> | null; key: string; label: string; color: string; order: number; isDone?: boolean }[];
  labels: any[];
  onCreate: (tasks: any[]) => Promise<void>;
}

export function TaskBulkImportDialog({ open, onOpenChange, workspaceId, members, projects, statuses, labels, onCreate }: TaskBulkImportDialogProps) {
  const t = useTranslations("tasks");
  const locale = useLocale() as "en" | "fr";
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<(BulkTaskDraft & { id: string })[]>([]);
  const createLabel = useMutation(api.flux_labels.create);

  const labelNames = useMemo(() => new Set(labels.map((l) => l.name)), [labels]);
  const statusOptions = useMemo(() => statuses, [statuses]);

  const reset = () => {
    setRaw("");
    setDrafts([]);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const parse = async () => {
    if (!raw.trim() || !workspaceId) return;
    setBusy(true);
    try {
      const result = await parseBulkTasks(raw, {
        locale,
        statuses: statusOptions.map((s) => ({ key: s.key, label: s.label })),
        members: members.map((m) => ({ userId: m.userId, name: m.name, email: m.email })),
        projects: projects.map((p) => ({ _id: p._id, name: p.name })),
        labels: labels.map((l) => l.name),
      });
      if (result.tasks.length === 0) {
        toast.error(t("bulkImportEmpty") ?? "No tasks could be parsed");
      } else {
        setDrafts(result.tasks.map((d, i) => ({ ...d, id: `${i}-${Date.now()}` })));
      }
    } catch (err: any) {
      toast.error(t("bulkImportParseFailed") ?? err.message);
    } finally {
      setBusy(false);
    }
  };

  const findMemberId = (nameOrEmail?: string) => {
    if (!nameOrEmail) return undefined;
    const q = nameOrEmail.trim().toLowerCase();
    const m = members.find((x) => (x.name ?? "").toLowerCase() === q || (x.email ?? "").toLowerCase() === q);
    return m?.userId;
  };

  const findProjectId = (name?: string) => {
    if (!name) return undefined;
    const q = name.trim().toLowerCase();
    const p = projects.find((x) => (x.name ?? "").toLowerCase() === q);
    return p?._id;
  };

  const findStatusKey = (status?: string) => {
    if (!status) return undefined;
    const q = status.trim().toLowerCase();
    const s = statusOptions.find((x) => x.key.toLowerCase() === q || x.label.toLowerCase() === q);
    return s?.key;
  };

  const parseDate = (iso?: string) => {
    if (!iso) return undefined;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? undefined : d.getTime();
  };

  const ensureLabels = async () => {
    if (!workspaceId) return;
    const needed = new Set<string>();
    for (const d of drafts) {
      for (const l of d.labels ?? []) {
        if (!labelNames.has(l)) needed.add(l);
      }
    }
    for (const l of needed) {
      await createLabel({ workspaceId, name: l }).catch(() => {});
      labelNames.add(l);
    }
  };

  const submit = async () => {
    if (!workspaceId || drafts.length === 0) return;
    setBusy(true);
    try {
      await ensureLabels();
      const tasks = drafts.map((d) => ({
        title: d.title.trim(),
        description: d.description?.trim() || undefined,
        status: findStatusKey(d.status) ?? statusOptions[0]?.key ?? "todo",
        priority: d.priority ?? "none",
        assigneeId: findMemberId(d.assignee),
        projectId: findProjectId(d.project),
        dueDate: parseDate(d.dueDate),
        labels: d.labels ?? [],
        estimateMinutes: d.estimateMinutes,
      }));
      await onCreate(tasks);
      toast.success(t("bulkImportCreated", { count: tasks.length }));
      handleClose();
    } catch (err: any) {
      toast.error(t("bulkImportCreateFailed") ?? err.message);
    } finally {
      setBusy(false);
    }
  };

  const updateDraft = (id: string, patch: Partial<BulkTaskDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const removeDraft = (id: string) => setDrafts((prev) => prev.filter((d) => d.id !== id));

  const isPreview = drafts.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-3xl" data-testid="bulk-import-dialog">
        <DialogHeader>
          <DialogTitle>{isPreview ? t("bulkImportPreview") : t("bulkImportTitle")}</DialogTitle>
        </DialogHeader>
        {!isPreview ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("bulkImportHint")}</p>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={t("bulkImportPlaceholder") ?? "Paste one task per line..."}
              rows={10}
              className={cn(inputBase, "resize-none font-mono text-sm")}
              data-testid="bulk-import-textarea"
            />
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <div className="mb-2 text-sm text-muted-foreground">
              {t("bulkImportCount", { count: drafts.length })}
            </div>
            <div className="space-y-2">
              {drafts.map((d) => (
                <div key={d.id} className="grid grid-cols-12 gap-2 rounded-xl border border-border bg-card p-2 text-sm">
                  <div className="col-span-12 sm:col-span-4">
                    <input
                      value={d.title}
                      onChange={(e) => updateDraft(d.id, { title: e.target.value })}
                      className={cn(inputBase, "h-8")}
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-2">
                    <Select value={d.status ?? statusOptions[0]?.key ?? "todo"} onValueChange={(v) => updateDraft(d.id, { status: v })}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((s) => (
                          <SelectItem key={s.key} value={s.key}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-6 sm:col-span-2">
                    <Select value={d.priority ?? "none"} onValueChange={(v) => updateDraft(d.id, { priority: v as any })}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["none", "low", "medium", "high", "urgent"].map((p) => (
                          <SelectItem key={p} value={p}>
                            {t(`priorities.${p}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-6 sm:col-span-2">
                    <input
                      type="date"
                      value={d.dueDate ?? ""}
                      onChange={(e) => updateDraft(d.id, { dueDate: e.target.value || undefined })}
                      className={cn(inputBase, "h-8 text-xs")}
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-2">
                    <Select value={d.assignee ? findMemberId(d.assignee) ?? "none" : "none"} onValueChange={(v) => updateDraft(d.id, { assignee: v === "none" ? undefined : (members.find((m) => m.userId === v)?.name ?? v) })}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={t("unassigned")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("unassigned")}</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.userId} value={m.userId}>
                            {m.name ?? m.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-6 sm:col-span-2">
                    <Select value={d.project ? findProjectId(d.project) ?? "none" : "none"} onValueChange={(v) => updateDraft(d.id, { project: v === "none" ? undefined : (projects.find((p) => p._id === v)?.name ?? v) })}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={t("noProject")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("noProject")}</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p._id} value={p._id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-10 sm:col-span-11">
                    <input
                      value={d.labels?.join(", ") ?? ""}
                      onChange={(e) => updateDraft(d.id, { labels: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      placeholder={t("labels")}
                      className={cn(inputBase, "h-8 text-xs")}
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex items-center justify-end">
                    <button onClick={() => removeDraft(d.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash variant="Bulk" size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <DialogFooter>
          <button onClick={handleClose} className={btnOutline} disabled={busy}>
            {t("cancel")}
          </button>
          {!isPreview ? (
            <button onClick={parse} disabled={busy || !raw.trim()} className={btnPrimary} data-testid="bulk-import-parse-btn">
              {busy ? <Spinner className="h-4 w-4" /> : <Add variant="Bulk" size={16} />}
              {busy ? t("parsing") : t("bulkImportParse")}
            </button>
          ) : (
            <button onClick={submit} disabled={busy || drafts.length === 0} className={btnPrimary} data-testid="bulk-import-create-btn">
              {busy ? <Spinner className="h-4 w-4" /> : <Add variant="Bulk" size={16} />}
              {busy ? t("creating") : t("bulkImportCreate", { count: drafts.length })}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
