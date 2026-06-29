"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { PageContainer, PageHeader, EmptyState, btnPrimary, btnOutline, inputBase } from "@/components/app/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Briefcase, Add, More, Calendar } from "iconsax-reactjs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const STATUS_COLORS: Record<string, string> = {
  planning: "#2f7ea6",
  active: "var(--accent-mint)",
  on_hold: "#d98324",
  completed: "var(--muted-foreground)",
};

export default function ProjectsPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const projects = useQuery(api.projects.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const create = useMutation(api.projects.create);
  const remove = useMutation(api.projects.remove);
  const [open, setOpen] = useState(false);
  const t = useTranslations("projects");
  const tc = useTranslations("common");

  useEffect(() => { if (search.get("new") === "1") setOpen(true); }, [search]);

    return (
    <PageContainer>
      <PageHeader title={t("title")} subtitle={t("subtitle")} icon={Briefcase} testId="projects-header"
        actions={<button onClick={() => setOpen(true)} className={btnPrimary} data-testid="new-project-btn"><Add variant="Bulk" size={18} /> {t("newProject")}</button>} />

      {projects === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : projects.length === 0 ? (
        <EmptyState icon={Briefcase} title={t("empty.title")} description={t("emptyDescriptionShort")} testId="projects-empty"
          action={<button onClick={() => setOpen(true)} className={btnPrimary}><Add variant="Bulk" size={18} /> {t("newProject")}</button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="projects-grid">
          {projects.map((p: any) => {
            const statusColor = STATUS_COLORS[p.status] ?? STATUS_COLORS.planning;
            const taskPct = p.taskTotal > 0 ? Math.round((p.taskDone / p.taskTotal) * 100) : 0;
            const deadlineStr = p.endDate ? new Date(p.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null;
            const daysLeft = p.endDate ? Math.max(0, Math.ceil((p.endDate - Date.now()) / 86_400_000)) : null;
            return (
              <div key={p._id} data-testid="project-card" onClick={() => router.push(`/app/projects/${p._id}`)} className="group flex cursor-pointer flex-col rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between">
                  <span className="h-9 w-9 rounded-xl" style={{ backgroundColor: p.color ?? "var(--flux-coral)" }} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><button onClick={(e) => e.stopPropagation()} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><More variant="Bulk" size={16} /></button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}><DropdownMenuItem onClick={() => remove({ projectId: p._id }).then(() => toast.success(t("deleted"))).catch(() => toast.error(t("deleteDenied")))} className="text-destructive">{tc("delete")}</DropdownMenuItem></DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="mt-3 font-semibold group-hover:text-primary">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.client}</p>
                <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `color-mix(in oklch, ${statusColor} 16%, transparent)`, color: statusColor }}>{t(`statuses.${p.status}`)}</span>
                {/* Task progression */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground"><span>{t("tasksCount", { done: p.taskDone, total: p.taskTotal })}</span><span>{taskPct}%</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-(--accent-mint) transition-all" style={{ width: `${taskPct}%` }} /></div>
                </div>
                {deadlineStr && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar variant="Bulk" size={14} className={cn(daysLeft !== null && daysLeft <= 7 && "text-destructive")} />
                    <span className={cn(daysLeft !== null && daysLeft <= 7 && "text-destructive font-medium")}>{t("deadline", { date: deadlineStr })}</span>
                    {daysLeft !== null && <span className="ml-auto">{t("daysLeft", { count: daysLeft })}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ProjectDialog open={open} onOpenChange={setOpen} onCreate={async (data: any) => { if (!activeWorkspaceId) return; await create({ workspaceId: activeWorkspaceId, ...data }); toast.success(t("created")); setOpen(false); }} />
    </PageContainer>
  );
}

function ProjectDialog({ open, onOpenChange, onCreate }: any) {
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [status, setStatus] = useState("planning");
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  useEffect(() => { if (open) { setName(""); setClient(""); setStatus("planning"); setDeadline(undefined); } }, [open]);

  const submit = async () => {
    if (!name.trim()) return toast.error(t("nameRequired"));
    setBusy(true);
    try {
      await onCreate({ name: name.trim(), client: client.trim() || t("internalClient"), status, endDate: deadline ? deadline.getTime() : undefined });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="project-create-dialog">
        <DialogHeader><DialogTitle>{t("newProject")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("projectName")} className={inputBase} data-testid="project-name-input" />
          <input value={client} onChange={(e) => setClient(e.target.value)} placeholder={t("clientPlaceholder")} className={inputBase} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("status")}</label>
              <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.keys(STATUS_COLORS).map((k) => <SelectItem key={k} value={k}>{t(`statuses.${k}`)}</SelectItem>)}</SelectContent></Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("dueDate")}</label>
              <DatePicker
                date={deadline}
                onChange={setDeadline}
                placeholder={t("datePlaceholder")}
                className="h-9"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className={btnOutline}>{tc("cancel")}</button>
          <button onClick={submit} disabled={busy} className={btnPrimary} data-testid="project-create-submit">{busy ? t("creating") : t("newProject")}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
