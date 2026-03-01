"use client";

import { use, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth/client";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Circle,
  ExternalLink,
  Flag,
  FolderKanban,
  MessageCircle,
  Send,
  Trash2,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/modals/ConfirmModal";

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  todo: { label: "To Do", color: "text-slate-500", dot: "bg-slate-400" },
  in_progress: { label: "In Progress", color: "text-blue-500", dot: "bg-blue-500" },
  in_review: { label: "In Review", color: "text-amber-500", dot: "bg-amber-500" },
  done: { label: "Done", color: "text-emerald-500", dot: "bg-emerald-500" },
  cancelled: { label: "Cancelled", color: "text-red-400", dot: "bg-red-400" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  none: { label: "No priority", color: "text-muted-foreground" },
  low: { label: "Low", color: "text-sky-500" },
  medium: { label: "Medium", color: "text-amber-500" },
  high: { label: "High", color: "text-orange-500" },
  urgent: { label: "Urgent", color: "text-red-500" },
};

export default function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = use(params);
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const task = useQuery(api.tasks.getById, { id: taskId as Id<"tasks"> });
  const comments = useQuery(api.tasks.getComments, { taskId: taskId as Id<"tasks"> });
  const updateTask = useMutation(api.tasks.update);
  const removeTask = useMutation(api.tasks.remove);
  const addComment = useMutation(api.tasks.addComment);

  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [openSelect, setOpenSelect] = useState<string | null>(null);

  const selectProps = (key: string) => ({
    open: openSelect === key,
    onOpenChange: (open: boolean) => setOpenSelect(open ? key : null),
  });

  const project = useQuery(
    api.projects.getById,
    task !== undefined && task && task.projectId ? { id: task.projectId } : "skip",
  );

  if (task === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!task) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-sm text-muted-foreground">Task not found</p>
        <Button variant="ghost" size="sm" onClick={() => router.push("/tasks")} className="mt-2 gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to tasks
        </Button>
      </div>
    );
  }

  const handleUpdate = async (patch: any) => {
    try {
      await updateTask({ id: task._id, ...patch });
    } catch {
      toast.error("Failed to update task");
    }
  };

  const handleTitleSave = async () => {
    if (titleValue.trim() && titleValue !== task.title) {
      await handleUpdate({ title: titleValue.trim() });
    }
    setEditingTitle(false);
  };

  const handleDelete = async () => {
    try {
      await removeTask({ id: task._id });
      toast.success("Task deleted");
      router.push("/tasks");
    } catch {
      toast.error("Failed to delete task");
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !session) return;
    setIsSubmittingComment(true);
    try {
      await addComment({
        taskId: task._id,
        content: commentText.trim(),
        userName: session.user.name,
        userImage: session.user.image ?? undefined,
      });
      setCommentText("");
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const sCfg = statusConfig[task.status] ?? statusConfig.todo;
  const pCfg = priorityConfig[task.priority] ?? priorityConfig.none;
  const isOverdue = task.dueDate && task.dueDate < Date.now() && task.status !== "done";

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8 md:px-10">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <div className="mb-6 flex items-start gap-3">
              <button
                onClick={() => handleUpdate({ status: task.status === "done" ? "todo" : "done" })}
                className="mt-1 shrink-0 text-muted-foreground/50 hover:text-primary transition-colors"
              >
                {task.status === "done" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </button>

              {editingTitle ? (
                <Input
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
                  autoFocus
                  className="text-xl font-bold border-0 px-0 shadow-none focus-visible:ring-0 h-auto"
                />
              ) : (
                <h1
                  className={cn(
                    "flex-1 text-xl font-bold cursor-text transition-colors",
                    task.status === "done" && "line-through text-muted-foreground",
                  )}
                  onClick={() => { setTitleValue(task.title); setEditingTitle(true); }}
                >
                  {task.title}
                </h1>
              )}
            </div>

            {/* Description */}
            <div className="mb-8">
              <Textarea
                placeholder="Add a description..."
                defaultValue={task.description ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (task.description ?? "")) {
                    handleUpdate({ description: e.target.value || undefined });
                  }
                }}
                rows={3}
                className="resize-none text-sm border-0 px-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
              />
            </div>

            {/* Comments */}
            <div className="border-t pt-6">
              <div className="mb-4 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">
                  Comments
                  {(comments?.length ?? 0) > 0 && (
                    <span className="text-muted-foreground font-normal ml-1">({comments?.length})</span>
                  )}
                </h2>
              </div>

              <div className="space-y-3 mb-4">
                {(comments ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground/60 py-4">No comments yet. Start the conversation.</p>
                )}
                {(comments ?? []).map((c) => (
                  <div key={c._id} className="flex gap-3">
                    {c.userImage ? (
                      <img src={c.userImage} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="h-7 w-7 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
                        {c.userName?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold">{c.userName}</span>
                        <span className="text-[10px] text-muted-foreground/60">
                          {new Date(c.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/90">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleComment} className="flex gap-2">
                <Input
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="text-sm h-9"
                />
                <Button type="submit" size="sm" disabled={isSubmittingComment || !commentText.trim()} className="h-9 px-3">
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          </div>

          {/* Sidebar - properties */}
          <div className="shrink-0 lg:w-56">
            <div className="rounded-xl border p-4 space-y-4">
              {/* Status */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Status</p>
                <Select value={task.status} onValueChange={(v) => handleUpdate({ status: v })} {...selectProps("status")}>
                  <SelectTrigger className="h-8 text-xs gap-2">
                    <div className="flex items-center gap-2">
                      <div className={cn("h-2 w-2 rounded-full", sCfg.dot)} />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        <span className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", v.dot)} />
                          {v.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Priority</p>
                <Select value={task.priority} onValueChange={(v) => handleUpdate({ priority: v })} {...selectProps("priority")}>
                  <SelectTrigger className="h-8 text-xs gap-2">
                    <div className="flex items-center gap-2">
                      <Flag className={cn("h-3 w-3", pCfg.color)} />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityConfig).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        <span className={cn("flex items-center gap-2", v.color)}>{v.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Due date */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Due date</p>
                <div className="flex items-center gap-1.5">
                  <Calendar className={cn("h-3 w-3 shrink-0", isOverdue ? "text-red-500" : "text-muted-foreground")} />
                  <input
                    type="date"
                    defaultValue={task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""}
                    onChange={(e) => handleUpdate({ dueDate: e.target.value ? new Date(e.target.value).getTime() : undefined })}
                    className={cn(
                      "flex-1 bg-transparent text-xs outline-none border-0 focus:ring-0 cursor-pointer",
                      isOverdue ? "text-red-500 font-medium" : "text-foreground",
                      !task.dueDate && "text-muted-foreground",
                    )}
                  />
                </div>
              </div>

              {/* Project */}
              {project && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Project</p>
                  <button
                    onClick={() => router.push(`/projects/${project._id}`)}
                    className="flex items-center gap-1.5 text-xs text-foreground hover:text-primary transition-colors group"
                  >
                    <div
                      className="h-3.5 w-3.5 rounded shrink-0"
                      style={{ backgroundColor: project.color ?? "#6366f1" }}
                    />
                    <span className="truncate">{project.name}</span>
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-70 transition-opacity shrink-0" />
                  </button>
                </div>
              )}

              {/* Assignee */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Assignee</p>
                {task.assigneeId ? (
                  <div className="flex items-center gap-2">
                    {task.assigneeImage ? (
                      <img src={task.assigneeImage} alt="" className="h-5 w-5 rounded-full object-cover" />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-semibold text-primary">
                        {task.assigneeName?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                    <span className="text-xs">{task.assigneeName ?? "Assigned"}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <UserCircle className="h-3.5 w-3.5" />
                    Unassigned
                  </div>
                )}
              </div>

              {/* Created */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Created</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(task.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>

              <div className="border-t pt-3">
                <ConfirmModal onConfirm={handleDelete}>
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive h-8 text-xs">
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete task
                  </Button>
                </ConfirmModal>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
