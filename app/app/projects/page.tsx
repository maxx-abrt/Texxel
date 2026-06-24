"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { PageContainer, PageHeader, EmptyState, btnPrimary, btnOutline, inputBase } from "@/components/app/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Briefcase, Add, More } from "iconsax-reactjs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const STATUS: Record<string, { label: string; color: string }> = {
  planning: { label: "Planning", color: "#2f7ea6" },
  active: { label: "Active", color: "var(--accent-mint)" },
  on_hold: { label: "On hold", color: "#d98324" },
  completed: { label: "Completed", color: "var(--muted-foreground)" },
};

export default function ProjectsPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const projects = useQuery(api.projects.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const create = useMutation(api.projects.create);
  const remove = useMutation(api.projects.remove);
  const [open, setOpen] = useState(false);

  useEffect(() => { if (search.get("new") === "1") setOpen(true); }, [search]);

  const currency = activeWorkspace?.currency ?? "EUR";

  return (
    <PageContainer>
      <PageHeader title="Projects" subtitle="Organize work into projects" icon={Briefcase} testId="projects-header"
        actions={<button onClick={() => setOpen(true)} className={btnPrimary} data-testid="new-project-btn"><Add variant="Bulk" size={18} /> New project</button>} />

      {projects === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : projects.length === 0 ? (
        <EmptyState icon={Briefcase} title="No projects yet" description="Create a project to group tasks, budgets and documents." testId="projects-empty"
          action={<button onClick={() => setOpen(true)} className={btnPrimary}><Add variant="Bulk" size={18} /> New project</button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="projects-grid">
          {projects.map((p: any) => {
            const st = STATUS[p.status] ?? STATUS.planning;
            const pct = p.budget > 0 ? Math.min(100, Math.round((p.spent / p.budget) * 100)) : 0;
            const taskPct = p.taskTotal > 0 ? Math.round((p.taskDone / p.taskTotal) * 100) : 0;
            return (
              <div key={p._id} data-testid="project-card" onClick={() => router.push(`/app/projects/${p._id}`)} className="group flex cursor-pointer flex-col rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between">
                  <span className="h-9 w-9 rounded-xl" style={{ backgroundColor: p.color ?? "var(--flux-coral)" }} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><button onClick={(e) => e.stopPropagation()} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><More variant="Bulk" size={16} /></button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}><DropdownMenuItem onClick={() => remove({ projectId: p._id }).then(() => toast.success("Project deleted")).catch(() => toast.error("Only admins can delete"))} className="text-destructive">Delete</DropdownMenuItem></DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="mt-3 font-semibold group-hover:text-primary">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.client}</p>
                <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `color-mix(in oklch, ${st.color} 16%, transparent)`, color: st.color }}>{st.label}</span>
                {/* Task progression */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground"><span>{p.taskDone}/{p.taskTotal} tasks</span><span>{taskPct}%</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[var(--accent-mint)] transition-all" style={{ width: `${taskPct}%` }} /></div>
                </div>
                {p.budget > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-muted-foreground"><span>{p.spent?.toLocaleString()} {currency}</span><span>{p.budget?.toLocaleString()} {currency}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ProjectDialog open={open} onOpenChange={setOpen} onCreate={async (data: any) => { if (!activeWorkspaceId) return; await create({ workspaceId: activeWorkspaceId, ...data }); toast.success("Project created"); setOpen(false); }} />
    </PageContainer>
  );
}

function ProjectDialog({ open, onOpenChange, onCreate }: any) {
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [status, setStatus] = useState("planning");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setName(""); setClient(""); setStatus("planning"); setBudget(""); } }, [open]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Add a project name");
    setBusy(true);
    try {
      await onCreate({ name: name.trim(), client: client.trim() || "Internal", status, budget: budget ? Number(budget) : undefined });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="project-create-dialog">
        <DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" className={inputBase} data-testid="project-name-input" />
          <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client / owner" className={inputBase} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Budget</label>
              <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0" className={inputBase} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className={btnOutline}>Cancel</button>
          <button onClick={submit} disabled={busy} className={btnPrimary} data-testid="project-create-submit">{busy ? "Creating\u2026" : "Create project"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
