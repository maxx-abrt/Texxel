"use client";

import { use, useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth/client";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { ArrowLeft, Check, CheckCircle2, ChevronDown, Circle, Copy, Crown, FileText, FolderKanban, GripVertical, Mail, Pencil, Plus, Shield, Trash2, User as UserIcon, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { useTranslations, useLocale } from "next-intl";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const roleConfig = {
  owner: { labelKey: "roles.owner", icon: Crown, color: "text-amber-500" },
  admin: { labelKey: "roles.admin", icon: Shield, color: "text-blue-500" },
  member: { labelKey: "roles.member", icon: UserIcon, color: "text-slate-500" },
};

function SortableNoteRow({ doc, onNavigate }: { doc: any; onNavigate: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: doc._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const relativeDate = (() => {
    const ms = Date.now() - doc._creationTime;
    const mins = Math.floor(ms / 60000);
    const hours = Math.floor(ms / 3600000);
    const days = Math.floor(ms / 86400000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(doc._creationTime).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  })();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 px-3 py-2.5 hover:bg-accent/40 transition-colors first:rounded-t-xl last:rounded-b-xl cursor-pointer"
      onClick={() => onNavigate(doc._id)}
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors p-0.5 -ml-0.5 touch-none"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="shrink-0 text-sm leading-none">{doc.icon ?? "📄"}</span>
      <span className="flex-1 min-w-0 text-sm font-medium truncate group-hover:text-primary transition-colors">
        {doc.title || "Untitled"}
      </span>
      <span className="shrink-0 text-[10px] text-muted-foreground/50 tabular-nums">{relativeDate}</span>
    </div>
  );
}

function InviteRow({ inv, canManage, onCancel }: { inv: any; canManage: boolean; onCancel: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${inv.token}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ti = useTranslations("teams");
  const tcc = useTranslations("common");
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 text-sm font-semibold shrink-0">
        {inv.invitedEmail[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{inv.invitedEmail}</p>
        <p className="text-muted-foreground text-xs">
          {ti("invitedAs")} {inv.role} · {ti("expires")} {new Date(inv.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1.5 text-xs text-muted-foreground">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? ti("copied") : ti("copyLink")}
      </Button>
      {canManage && (
        <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs text-muted-foreground hover:text-destructive h-7">
          {tcc("cancel")}
        </Button>
      )}
    </div>
  );
}

export default function TeamDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const router = useRouter();
  const t = useTranslations("teams");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { data: session } = authClient.useSession();
  const team = useQuery(api.teams.getById, { id: teamId as Id<"teams"> });
  const members = useQuery(api.teams.getMembers, { teamId: teamId as Id<"teams"> });
  const pendingInvitations = useQuery(api.teams.getPendingInvitations, { teamId: teamId as Id<"teams"> });
  const inviteMember = useMutation(api.teams.inviteMember);
  const removeMember = useMutation(api.teams.removeMember);
  const updateRole = useMutation(api.teams.updateMemberRole);
  const cancelInvitation = useMutation(api.teams.cancelInvitation);
  const teamProjects = useQuery(api.projects.getMyProjects, { teamId: teamId as Id<"teams"> });
  const teamDocs = useQuery(api.documents.getByTeam, { teamId: teamId as Id<"teams"> });
  const createNote = useMutation(api.documents.createTeamDocument);
  const reorderDoc = useMutation(api.documents.reorder);

  const teamTasks = useQuery(api.tasks.getByTeam, { teamId: teamId as Id<"teams"> });
  const updateTask = useMutation(api.tasks.update);
  const updateTeam = useMutation(api.teams.update);

  const TEAM_COLORS = ["#f76c5e","#7c3aed","#2563eb","#0d9488","#059669","#d97706","#e11d48","#475569","#ec4899","#f59e0b"];
  const EMOJI_LIST = ["🚀","⚡","🔥","🌟","💡","🎯","🏆","🛠","💎","🎨","🐉","🦄"];

  const [notesCollapsed, setNotesCollapsed] = useState(false);
  const [showNewNote, setShowNewNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const newNoteTitleRef = useRef<HTMLInputElement>(null);
  const [localDocs, setLocalDocs] = useState<any[] | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleCreateNote = useCallback(async () => {
    const title = newNoteTitle.trim();
    if (!title || isCreatingNote) return;
    setIsCreatingNote(true);
    try {
      const docId = await createNote({ title, teamId: teamId as Id<"teams"> });
      toast.success(t("noteCreated"));
      setNewNoteTitle("");
      setShowNewNote(false);
      router.push(`/documents/${docId}`);
    } catch {
      toast.error(t("noteCreateFailed"));
    } finally {
      setIsCreatingNote(false);
    }
  }, [newNoteTitle, isCreatingNote, createNote, teamId, t, router]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const docs = localDocs ?? teamDocs ?? [];
    const oldIndex = docs.findIndex((d) => d._id === active.id);
    const newIndex = docs.findIndex((d) => d._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(docs, oldIndex, newIndex);
    setLocalDocs(reordered);
    reorderDoc({ id: active.id as Id<"documents">, newOrder: newIndex }).catch(() =>
      setLocalDocs(null)
    );
  }, [localDocs, teamDocs, reorderDoc]);

  const displayDocs = localDocs ?? teamDocs ?? [];

  const [showIconEdit, setShowIconEdit] = useState(false);
  const [iconEmoji, setIconEmoji] = useState("");
  const [iconColor, setIconColor] = useState("#f76c5e");
  const [iconGradientTo, setIconGradientTo] = useState("");
  const [isSavingIcon, setIsSavingIcon] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [isInviting, setIsInviting] = useState(false);

  const teamIconStyle = (() => {
    const from = (team as any)?.iconColor ?? "#f76c5e";
    const to = (team as any)?.iconGradientTo;
    if (to) return { background: `linear-gradient(135deg, ${from}, ${to})` };
    return { background: `linear-gradient(135deg, ${from}cc, ${from})` };
  })();

  const handleSaveIcon = async () => {
    setIsSavingIcon(true);
    try {
      await updateTeam({
        id: teamId as Id<"teams">,
        icon: iconEmoji || undefined,
        iconColor: iconColor || undefined,
        iconGradientTo: iconGradientTo || undefined,
      });
      toast.success(t("iconSaved"));
      setShowIconEdit(false);
    } catch (err: any) {
      toast.error(err.message ?? t("iconSaveFailed"));
    } finally {
      setIsSavingIcon(false);
    }
  };

  if (team === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!team) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
        <Button variant="ghost" size="sm" onClick={() => router.push("/teams")} className="mt-2 gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("backToTeams")}
        </Button>
      </div>
    );
  }

  const currentUserRole = (team as any).role as string;
  const canManage = ["owner", "admin"].includes(currentUserRole);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      await inviteMember({ teamId: teamId as Id<"teams">, email: inviteEmail.trim(), role: inviteRole });
      toast.success(t("inviteCreated"));
      setShowInvite(false);
      setInviteEmail("");
    } catch (err: any) {
      toast.error(err.message ?? t("inviteFailed"));
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    try {
      await removeMember({ teamId: teamId as Id<"teams">, targetUserId });
      toast.success(t("memberRemoved"));
    } catch (err: any) {
      toast.error(err.message ?? t("removeFailed"));
    }
  };

  const handleUpdateRole = async (targetUserId: string, role: "admin" | "member") => {
    try {
      await updateRole({ teamId: teamId as Id<"teams">, targetUserId, role });
      toast.success(t("roleUpdated"));
    } catch (err: any) {
      toast.error(err.message ?? t("roleFailed"));
    }
  };

  const handleCancelInvitation = async (invId: Id<"teamInvitations">) => {
    try {
      await cancelInvitation({ invitationId: invId });
      toast.success(t("inviteCancelled"));
    } catch {
      toast.error(t("cancelFailed"));
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-8 md:px-10">
        <button
          onClick={() => router.push("/teams")}
          className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("backToTeams")}
        </button>

        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="relative group/icon">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-sm"
              style={teamIconStyle}
            >
              {(team as any).icon ?? (team as any).name[0].toUpperCase()}
            </div>
            {canManage && (
              <button
                onClick={() => {
                  setIconEmoji((team as any).icon ?? "");
                  setIconColor((team as any).iconColor ?? "#f76c5e");
                  setIconGradientTo((team as any).iconGradientTo ?? "");
                  setShowIconEdit(true);
                }}
                className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 opacity-0 group-hover/icon:opacity-100 transition-opacity"
              >
                <Pencil className="h-4 w-4 text-white" />
              </button>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{(team as any).name}</h1>
            <p className="text-muted-foreground text-sm font-mono">/{(team as any).slug}</p>
            {(team as any).description && (
              <p className="text-muted-foreground text-sm mt-0.5">{(team as any).description}</p>
            )}
          </div>
        </div>

        {/* Members section */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">{t("sections.members")}</h2>
              <Badge variant="secondary" className="text-xs">{(members ?? []).length}</Badge>
            </div>
            {canManage && (
              <Button onClick={() => setShowInvite(true)} size="sm" variant="outline" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                {t("invite")}
              </Button>
            )}
          </div>

          <div className="rounded-xl border bg-card divide-y">
            {(members ?? []).map((member) => {
              const roleCfg = roleConfig[member.role as keyof typeof roleConfig] ?? roleConfig.member;
              const isCurrentUser = member.userId === session?.user?.id;
              const isOwner = member.role === "owner";
              return (
                <div key={member._id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary shrink-0">
                    {member.userName?.[0]?.toUpperCase() ?? member.userEmail?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {member.userName || member.userEmail}
                      {isCurrentUser && <span className="text-muted-foreground text-xs ml-1">({t("you")})</span>}
                    </p>
                    {member.userName && (
                      <p className="text-muted-foreground text-xs truncate">{member.userEmail}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {canManage && !isOwner && !isCurrentUser ? (
                      <Select
                        value={member.role}
                        onValueChange={(v) => handleUpdateRole(member.userId, v as "admin" | "member")}
                      >
                        <SelectTrigger className="h-7 w-24 text-xs border-0 bg-muted">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">{t("roles.admin")}</SelectItem>
                          <SelectItem value="member">{t("roles.member")}</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className={cn("text-xs gap-1", roleCfg.color)}>
                        <roleCfg.icon className="h-3 w-3" />
                        {t(roleCfg.labelKey as any)}
                      </Badge>
                    )}
                    {canManage && !isOwner && !isCurrentUser && (
                      <ConfirmModal onConfirm={() => handleRemoveMember(member.userId)}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </ConfirmModal>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team Projects */}
        {(teamProjects ?? []).length > 0 && (
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">{t("sections.projects")}</h2>
              <Badge variant="secondary" className="text-xs">{(teamProjects ?? []).length}</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(teamProjects ?? []).map((project: any) => (
                <div
                  key={project._id}
                  onClick={() => router.push(`/projects/${project._id}`)}
                  className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all group"
                >
                  <div
                    className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: project.color ?? "#6366f1" }}
                  >
                    {project.icon ?? project.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{project.name}</p>
                    {project.description && (
                      <p className="text-xs text-muted-foreground truncate">{project.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team Notes */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">{t("sections.notes")}</h2>
              {displayDocs.length > 0 && (
                <Badge variant="secondary" className="text-xs">{displayDocs.length}</Badge>
              )}
              <button
                onClick={() => setNotesCollapsed((v) => !v)}
                className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", notesCollapsed && "-rotate-90")} />
              </button>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-7 text-xs"
              onClick={() => {
                setShowNewNote(true);
                setNotesCollapsed(false);
                setTimeout(() => newNoteTitleRef.current?.focus(), 50);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("newNote")}
            </Button>
          </div>

          {!notesCollapsed && (
            <div className="rounded-xl border bg-card overflow-hidden">
              {/* Inline new-note input */}
              {showNewNote && (
                <div className="flex items-center gap-2 border-b px-3 py-2 bg-primary/5">
                  <span className="text-sm">📄</span>
                  <input
                    ref={newNoteTitleRef}
                    type="text"
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateNote();
                      if (e.key === "Escape") { setShowNewNote(false); setNewNoteTitle(""); }
                    }}
                    placeholder={t("notePlaceholder")}
                    className="flex-1 bg-transparent text-sm font-medium placeholder:text-muted-foreground/50 focus:outline-none"
                    disabled={isCreatingNote}
                  />
                  <button
                    onClick={handleCreateNote}
                    disabled={!newNoteTitle.trim() || isCreatingNote}
                    className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-40 transition-opacity"
                  >
                    ↵
                  </button>
                  <button
                    onClick={() => { setShowNewNote(false); setNewNoteTitle(""); }}
                    className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
              )}

              {displayDocs.length === 0 && !showNewNote ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-6">
                  <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">{t("noNotes")}</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">{t("noNotesDesc")}</p>
                  <button
                    onClick={() => { setShowNewNote(true); setTimeout(() => newNoteTitleRef.current?.focus(), 50); }}
                    className="mt-3 rounded-lg border border-dashed px-4 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    {t("newNote")}
                  </button>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={displayDocs.map((d) => d._id)} strategy={verticalListSortingStrategy}>
                    <div className="divide-y">
                      {displayDocs.map((doc: any) => (
                        <SortableNoteRow
                          key={doc._id}
                          doc={doc}
                          onNavigate={(id) => router.push(`/documents/${id}`)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          )}
        </div>

        {/* Team Tasks */}
        {(teamTasks ?? []).length > 0 && (
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">{t("tasks")}</h2>
              <Badge variant="secondary" className="text-xs">{(teamTasks ?? []).length}</Badge>
            </div>
            <div className="rounded-xl border bg-card divide-y">
              {(teamTasks ?? []).slice(0, 12).map((task: any) => {
                const isDone = task.status === "done";
                return (
                  <div key={task._id} className="flex items-center gap-3 px-4 py-2.5">
                    <button
                      onClick={() => updateTask({ id: task._id, status: isDone ? "todo" : "done" })}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium truncate", isDone && "line-through text-muted-foreground")}>
                        {task.title}
                      </p>
                      {task.assigneeName && (
                        <p className="text-xs text-muted-foreground">{task.assigneeName}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {task.priority !== "none" && (
                        <Badge variant="secondary" className="text-[10px] px-1.5">{task.priority}</Badge>
                      )}
                      {task.dueDate && (
                        <span className={cn(
                          "text-[10px] font-medium",
                          task.dueDate < Date.now() && !isDone ? "text-red-500" : "text-muted-foreground"
                        )}>
                          {new Date(task.dueDate).toLocaleDateString(locale, { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {(teamTasks ?? []).length > 12 && (
              <p className="mt-2 text-xs text-muted-foreground text-center">
                +{(teamTasks ?? []).length - 12} {t("moreTasks")}
              </p>
            )}
          </div>
        )}

        {/* Pending invitations */}
        {(pendingInvitations ?? []).length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">{t("sections.pendingInvitations")}</h2>
              <Badge variant="secondary" className="text-xs">{(pendingInvitations ?? []).length}</Badge>
            </div>
            <div className="rounded-xl border bg-card divide-y">
              {(pendingInvitations ?? []).map((inv) => (
                <InviteRow
                  key={inv._id}
                  inv={inv}
                  canManage={canManage}
                  onCancel={() => handleCancelInvitation(inv._id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Icon edit dialog */}
      <Dialog open={showIconEdit} onOpenChange={setShowIconEdit}>
        <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-base font-semibold">{t("iconCustomize")}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pt-5 pb-4 space-y-5">
            {/* Preview */}
            <div className="flex justify-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-md"
                style={{
                  background: iconGradientTo
                    ? `linear-gradient(135deg, ${iconColor}, ${iconGradientTo})`
                    : `linear-gradient(135deg, ${iconColor}cc, ${iconColor})`,
                }}
              >
                {iconEmoji || (team as any).name[0].toUpperCase()}
              </div>
            </div>

            {/* Emoji */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("iconEmoji")}</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {EMOJI_LIST.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setIconEmoji(iconEmoji === e ? "" : e)}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg border text-base transition-all hover:scale-110",
                      iconEmoji === e ? "border-primary bg-primary/10" : "hover:border-primary/40",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <Input
                value={iconEmoji}
                onChange={(e) => setIconEmoji(e.target.value)}
                placeholder={t("iconEmojiPlaceholder")}
                className="h-9 text-sm"
                maxLength={4}
              />
            </div>

            {/* Background colour */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("iconBgColor")}</label>
              <div className="flex flex-wrap gap-2">
                {TEAM_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setIconColor(c)}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-all hover:scale-110",
                      iconColor === c ? "border-foreground scale-110" : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={iconColor}
                  onChange={(e) => setIconColor(e.target.value)}
                  className="h-6 w-6 cursor-pointer rounded-full border-0 p-0 bg-transparent"
                  title="Custom colour"
                />
              </div>
            </div>

            {/* Gradient to */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("iconGradientEnd")}</label>
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap gap-2 flex-1">
                  {["#f76c5e","#7c3aed","#2563eb","#0d9488","#059669"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setIconGradientTo(iconGradientTo === c ? "" : c)}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-all hover:scale-110",
                        iconGradientTo === c ? "border-foreground scale-110" : "border-transparent",
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                {iconGradientTo && (
                  <button
                    type="button"
                    onClick={() => setIconGradientTo("")}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {tc("remove")}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-muted/20">
            <Button variant="ghost" size="sm" onClick={() => setShowIconEdit(false)}>{tc("cancel")}</Button>
            <Button size="sm" onClick={handleSaveIcon} disabled={isSavingIcon}>
              {isSavingIcon ? tc("loading") : t("saveIcon")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("inviteMember")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <Input
              type="email"
              placeholder={t("inviteEmail")}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              autoFocus
              required
            />
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("role")}</label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "admin" | "member")}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">{t("roles.member")}</SelectItem>
                  <SelectItem value="admin">{t("roles.admin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowInvite(false)}>{tc("cancel")}</Button>
              <Button type="submit" size="sm" disabled={isInviting || !inviteEmail.trim()}>
                {isInviting ? t("sending") : t("sendInvite")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
