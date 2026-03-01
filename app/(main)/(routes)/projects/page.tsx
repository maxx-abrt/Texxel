"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Calendar, FolderKanban, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const PROJECT_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#06b6d4",
];

const statusStyles: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  completed: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  archived: "bg-slate-500/10 text-slate-500",
};

export default function ProjectsPage() {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const tt = useTranslations("teams");
  const projects = useQuery(api.projects.getMyProjects, {});
  const myTeams = useQuery(api.teams.getMyTeams);
  const taskStats = useQuery(api.tasks.getTaskStatsByProject, {});
  const createProject = useMutation(api.projects.create);
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      const id = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        teamId: selectedTeamId ? (selectedTeamId as Id<"teams">) : undefined,
        dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
      });
      toast.success(t("created"));
      setShowNew(false);
      setName("");
      setDescription("");
      setColor(PROJECT_COLORS[0]);
      setSelectedTeamId("");
      setDueDate("");
      router.push(`/projects/${id}`);
    } catch {
      toast.error(t("createFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeProjects = (projects ?? []).filter((p) => p?.status === "active");
  const completedProjects = (projects ?? []).filter((p) => p?.status === "completed");
  const archivedProjects = (projects ?? []).filter((p) => p?.status === "archived");

  const renderProjectCard = (project: NonNullable<(typeof projects extends (infer T)[] | undefined ? T : never)>) => {
    if (!project) return null;
    return (
      <div
        key={project._id}
        onClick={() => router.push(`/projects/${project._id}`)}
        className="group flex items-center gap-4 rounded-xl border p-4 cursor-pointer hover:border-primary/20 hover:shadow-sm transition-all"
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white text-sm font-bold"
          style={{ backgroundColor: project.color ?? "#6366f1" }}
        >
          {project.icon ?? project.name[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
            {project.name}
          </h3>
          {(() => {
            const s = taskStats?.[project._id];
            if (!s || s.total === 0) return project.description ? (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{project.description}</p>
            ) : null;
            const pct = Math.round((s.done / s.total) * 100);
            return (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: project.color ?? "#6366f1" }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium shrink-0">{s.done}/{s.total}</span>
              </div>
            );
          })()}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {project.dueDate && (
            <span className={cn(
              "flex items-center gap-1 text-[11px]",
              project.dueDate < Date.now() ? "text-red-500" : "text-muted-foreground",
            )}>
              <Calendar className="h-3 w-3" />
              {new Date(project.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
          <Badge className={cn("text-[10px] border-0 font-medium", statusStyles[project.status])}>
            {t(`statuses.${project.status}` as any)}
          </Badge>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-8 md:px-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {activeProjects.length} {t("statuses.active")} · {(projects ?? []).length} total
            </p>
          </div>
          <Button onClick={() => setShowNew(true)} size="sm" className="gap-1.5 h-8">
            <Plus className="h-3.5 w-3.5" />
            {t("newProject")}
          </Button>
        </div>

        {(projects ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-500/5">
              <FolderKanban className="h-7 w-7 text-violet-500" />
            </div>
            <h3 className="text-base font-semibold">{t("empty.title")}</h3>
            <p className="text-muted-foreground mt-1 text-sm max-w-xs">{t("empty.description")}</p>
            <Button onClick={() => setShowNew(true)} size="sm" className="mt-4 gap-1.5 h-8">
              <Plus className="h-3.5 w-3.5" /> {t("newProject")}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {activeProjects.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t("sections.active")}</h2>
                <div className="space-y-2">
                  {activeProjects.map((p) => renderProjectCard(p!))}
                </div>
              </section>
            )}
            {completedProjects.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t("sections.completed")}</h2>
                <div className="space-y-2">
                  {completedProjects.map((p) => renderProjectCard(p!))}
                </div>
              </section>
            )}
            {archivedProjects.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t("sections.archived")}</h2>
                <div className="space-y-2">
                  {archivedProjects.map((p) => renderProjectCard(p!))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="text-sm font-semibold">{t("newProject")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="px-5 pt-4 pb-2 space-y-2">
              <Input
                placeholder={t("projectName")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
                className="text-sm font-medium border-0 px-0 h-auto py-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
              />
              <Textarea
                placeholder={t("addDescription")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="resize-none text-sm border-0 px-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40 min-h-0"
              />
            </div>

            <div className="mx-5 border-t" />

            <div className="px-5 py-3 space-y-3">
              {/* Color */}
              <div className="flex items-center gap-3">
                <div
                  className="h-3.5 w-3.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-muted-foreground w-20 shrink-0">Couleur</span>
                <div className="flex items-center gap-1.5">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        "h-5 w-5 rounded-full transition-all hover:scale-110",
                        color === c && "ring-2 ring-offset-1 ring-primary scale-110",
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Team */}
              {(myTeams ?? []).length > 0 && (
                <div className="flex items-center gap-3 h-8">
                  <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground w-20 shrink-0">{tt("title")}</span>
                  <Select value={selectedTeamId || "none"} onValueChange={(v) => setSelectedTeamId(v === "none" ? "" : v)}>
                    <SelectTrigger className="h-7 flex-1 border-0 shadow-none px-0 text-xs focus:ring-0 hover:bg-accent/50 rounded-md transition-colors">
                      <SelectValue placeholder={tt("title")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tt("title")} —</SelectItem>
                      {(myTeams ?? []).filter(Boolean).map((team: any) => (
                        <SelectItem key={team._id} value={team._id}>{team.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Due date */}
              <div className="flex items-center gap-3 h-8">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground w-20 shrink-0">Échéance</span>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-7 flex-1 border-0 shadow-none px-0 text-xs focus-visible:ring-0 hover:bg-accent/50 rounded-md transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-muted/20">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowNew(false)} className="h-8 text-xs">
                {tc("cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting || !name.trim()} className="h-8 text-xs">
                {isSubmitting ? t("creating") : t("newProject")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
