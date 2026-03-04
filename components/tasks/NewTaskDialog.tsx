"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Calendar, Flag, FolderKanban, UserCircle, Users } from "lucide-react";
import { useTranslations } from "next-intl";

const priorityColors: Record<string, string> = {
  none: "text-muted-foreground",
  low: "text-sky-500",
  medium: "text-amber-500",
  high: "text-orange-500",
  urgent: "text-red-500",
};

interface NewTaskDialogProps {
  open: boolean;
  onClose: () => void;
  projectId?: Id<"projects">;
  teamId?: Id<"teams">;
  initialStatus?: "todo" | "in_progress" | "in_review" | "done" | "cancelled";
}

export function NewTaskDialog({
  open,
  onClose,
  projectId: initialProjectId,
  teamId: initialTeamId,
  initialStatus,
}: NewTaskDialogProps) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");

  const create = useMutation(api.tasks.create);
  const myTeams = useQuery(api.teams.getMyTeams);
  const myProjects = useQuery(api.projects.getMyProjects, {});

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"none" | "low" | "medium" | "high" | "urgent">("none");
  const [dueDate, setDueDate] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>(initialTeamId ?? "");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId ?? "");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openSelect, setOpenSelect] = useState<string | null>(null);

  const selectProps = (key: string) => ({
    open: openSelect === key,
    onOpenChange: (open: boolean) => setOpenSelect(open ? key : null),
  });

  const teamMembers = useQuery(
    api.teams.getMembers,
    selectedTeamId ? { teamId: selectedTeamId as Id<"teams"> } : "skip",
  );

  const filteredProjects = (myProjects ?? []).filter((p) =>
    !selectedTeamId ? true : p?.teamId === selectedTeamId,
  );

  const reset = () => {
    setTitle("");
    setDescription("");
    setPriority("none");
    setDueDate("");
    if (!initialTeamId) setSelectedTeamId("");
    if (!initialProjectId) setSelectedProjectId("");
    setSelectedAssigneeId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      await create({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status: initialStatus ?? "todo",
        projectId: selectedProjectId ? (selectedProjectId as Id<"projects">) : undefined,
        teamId: selectedTeamId ? (selectedTeamId as Id<"teams">) : undefined,
        assigneeId: selectedAssigneeId || undefined,
        dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
      });
      toast.success(t("created"));
      reset();
      onClose();
    } catch {
      toast.error(t("createFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => { reset(); onClose(); };

  const priorityOptions = [
    { value: "none", label: t("priorities.none") },
    { value: "low", label: t("priorities.low") },
    { value: "medium", label: t("priorities.medium") },
    { value: "high", label: t("priorities.high") },
    { value: "urgent", label: t("priorities.urgent") },
  ];

  const showTeamSelect = !initialTeamId && (myTeams ?? []).length > 0;
  const showProjectSelect = !initialProjectId && filteredProjects.length > 0;
  const showAssigneeSelect = !!selectedTeamId && (teamMembers ?? []).length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-base font-semibold">{t("newTask")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {/* Title + description */}
          <div className="px-6 pt-5 pb-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("taskTitle")}
              </label>
              <Input
                placeholder={t("taskTitle")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                required
                className="h-10 text-sm font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("addDescription")}
              </label>
              <Textarea
                placeholder={t("addDescription")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="resize-none text-sm"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Properties */}
          <div className="px-6 py-4 space-y-3">
            {/* Priority */}
            <div className="grid grid-cols-[1fr_2fr] items-center gap-3">
              <div className="flex items-center gap-2">
                <Flag className={cn("h-3.5 w-3.5 shrink-0", priorityColors[priority])} />
                <span className="text-xs font-medium text-muted-foreground">{t("priority")}</span>
              </div>
              <Select value={priority} onValueChange={(v) => setPriority(v as any)} {...selectProps("priority")}>
                <SelectTrigger className="h-9 text-xs border bg-muted/30 hover:bg-muted/50 transition-colors focus:ring-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className={cn("flex items-center gap-1.5", priorityColors[p.value])}>
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due date */}
            <div className="grid grid-cols-[1fr_2fr] items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">{t("dueDate")}</span>
              </div>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-9 text-xs border bg-muted/30 hover:bg-muted/50 transition-colors"
              />
            </div>

            {/* Team */}
            {showTeamSelect && (
              <div className="grid grid-cols-[1fr_2fr] items-center gap-3">
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">{t("team")}</span>
                </div>
                <Select
                  value={selectedTeamId || "none"}
                  onValueChange={(v) => {
                    setSelectedTeamId(v === "none" ? "" : v);
                    setSelectedAssigneeId("");
                  }}
                  {...selectProps("team")}
                >
                  <SelectTrigger className="h-9 text-xs border bg-muted/30 hover:bg-muted/50 transition-colors focus:ring-1">
                    <SelectValue placeholder={t("noTeam")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("noTeam")}</SelectItem>
                    {(myTeams ?? []).filter(Boolean).map((team: any) => (
                      <SelectItem key={team._id} value={team._id}>{team.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Project */}
            {showProjectSelect && (
              <div className="grid grid-cols-[1fr_2fr] items-center gap-3">
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">{t("project")}</span>
                </div>
                <Select
                  value={selectedProjectId || "none"}
                  onValueChange={(v) => setSelectedProjectId(v === "none" ? "" : v)}
                  {...selectProps("project")}
                >
                  <SelectTrigger className="h-9 text-xs border bg-muted/30 hover:bg-muted/50 transition-colors focus:ring-1">
                    <SelectValue placeholder={t("noProject")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("noProject")}</SelectItem>
                    {filteredProjects.filter(Boolean).map((project) => (
                      <SelectItem key={project!._id} value={project!._id}>{project!.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Assignee */}
            {showAssigneeSelect && (
              <div className="grid grid-cols-[1fr_2fr] items-center gap-3">
                <div className="flex items-center gap-2">
                  <UserCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">{t("assignee")}</span>
                </div>
                <Select
                  value={selectedAssigneeId || "none"}
                  onValueChange={(v) => setSelectedAssigneeId(v === "none" ? "" : v)}
                  {...selectProps("assignee")}
                >
                  <SelectTrigger className="h-9 text-xs border bg-muted/30 hover:bg-muted/50 transition-colors focus:ring-1">
                    <SelectValue placeholder={t("unassigned")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("unassigned")}</SelectItem>
                    {(teamMembers ?? []).map((member) => (
                      <SelectItem key={member._id} value={member.userId}>
                        {member.userName || member.userEmail}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-muted/20">
            <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
              {tc("cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? t("creating") : t("newTask")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
