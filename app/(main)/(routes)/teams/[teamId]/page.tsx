"use client";

import { use, useState } from "react";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Check, CheckCircle2, Circle, Copy, Crown, FolderKanban, Mail, Pencil, Plus, Shield, Trash2, User as UserIcon, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { useTranslations, useLocale } from "next-intl";

const roleConfig = {
  owner: { labelKey: "roles.owner", icon: Crown, color: "text-amber-500 bg-amber-500/10" },
  admin: { labelKey: "roles.admin", icon: Shield, color: "text-blue-500 bg-blue-500/10" },
  member: { labelKey: "roles.member", icon: UserIcon, color: "text-slate-500 bg-slate-500/10" },
};

const PRIORITY_DOT: Record<string, string> = {
  none: "bg-slate-400", low: "bg-sky-500", medium: "bg-amber-500", high: "bg-orange-500", urgent: "bg-red-500",
};

function PendingInviteRow({ inv, canManage, onCancel }: { inv: any; canManage: boolean; onCancel: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${inv.token}`;
  const ti = useTranslations("teams");
  const tcc = useTranslations("common");

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 text-sm font-semibold shrink-0">
        {inv.invitedEmail[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{inv.invitedEmail}</p>
        <p className="text-muted-foreground text-xs">
          {ti("invitedAs")} <span className="font-medium">{ti(`roles.${inv.role}` as any)}</span>
          {" "}·{" "}
          {ti("expires")} {new Date(inv.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1.5 text-xs text-muted-foreground shrink-0">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? ti("copied") : ti("copyLink")}
      </Button>
      {canManage && (
        <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs text-muted-foreground hover:text-destructive h-7 shrink-0">
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
  const updateTeam = useMutation(api.teams.update);
  const teamProjects = useQuery(api.projects.getMyProjects, { teamId: teamId as Id<"teams"> });
  const teamTasks = useQuery(api.tasks.getByTeam, { teamId: teamId as Id<"teams"> });
  const updateTask = useMutation(api.tasks.update);

  const TEAM_COLORS = ["#f76c5e","#7c3aed","#2563eb","#0d9488","#059669","#d97706","#e11d48","#475569","#ec4899","#f59e0b"];
  const EMOJI_LIST = ["🚀","⚡","🔥","🌟","💡","🎯","🏆","🛠","💎","🎨","🐉","🦄"];

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
      await updateTeam({ id: teamId as Id<"teams">, icon: iconEmoji || undefined, iconColor: iconColor || undefined, iconGradientTo: iconGradientTo || undefined });
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

  const openTasks = (teamTasks ?? []).filter((t) => t.status !== "done" && t.status !== "cancelled");
  const doneTasks = (teamTasks ?? []).filter((t) => t.status === "done");

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-8 md:px-10">

        {/* Back */}
        <button
          onClick={() => router.push("/teams")}
          className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("backToTeams")}
        </button>

        {/* ── Header ── */}
        <div className="mb-8 flex items-start gap-4">
          <div className="relative group/icon shrink-0">
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
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{(team as any).name}</h1>
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md">/{(team as any).slug}</span>
              <Badge variant="secondary" className={cn("text-[10px] gap-1 shrink-0", roleConfig[currentUserRole as keyof typeof roleConfig]?.color)}>
                {currentUserRole === "owner" && <Crown className="h-2.5 w-2.5" />}
                {currentUserRole === "admin" && <Shield className="h-2.5 w-2.5" />}
                {t(`roles.${currentUserRole}` as any)}
              </Badge>
            </div>
            {(team as any).description && (
              <p className="text-muted-foreground text-sm mt-1">{(team as any).description}</p>
            )}
            {/* Workspace info banner */}
            <p className="mt-2 text-[11px] text-muted-foreground/60 flex items-center gap-1.5">
              <Users className="h-3 w-3" />
              {t("workspaceBanner", { count: (members ?? []).length })}
            </p>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: t("statsMembers"), value: (members ?? []).length },
            { label: t("statsProjects"), value: (teamProjects ?? []).length },
            { label: t("statsTasks"), value: openTasks.length },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border bg-card px-4 py-3 text-center">
              <p className="text-2xl font-bold tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Members ── */}
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("sections.members")}</h2>
              <Badge variant="secondary" className="text-[10px] tabular-nums">{(members ?? []).length}</Badge>
            </div>
            {canManage && (
              <Button onClick={() => setShowInvite(true)} size="sm" className="gap-1.5 h-7 text-xs">
                <Plus className="h-3 w-3" />
                {t("invite")}
              </Button>
            )}
          </div>

          <div className="rounded-xl border bg-card divide-y overflow-hidden">
            {(members ?? []).map((member) => {
              const roleCfg = roleConfig[member.role as keyof typeof roleConfig] ?? roleConfig.member;
              const isCurrentUser = member.userId === session?.user?.id;
              const isOwner = member.role === "owner";
              const initials = (member.userName || member.userEmail || "?")[0].toUpperCase();
              return (
                <div key={member._id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
                  {member.userImage ? (
                    <img src={member.userImage} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary shrink-0">
                      {initials}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {member.userName || member.userEmail}
                      {isCurrentUser && <span className="text-muted-foreground text-xs ml-1.5 font-normal">({t("you")})</span>}
                    </p>
                    {member.userName && (
                      <p className="text-muted-foreground text-[11px] truncate">{member.userEmail}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canManage && !isOwner && !isCurrentUser ? (
                      <Select
                        value={member.role}
                        onValueChange={(v) => handleUpdateRole(member.userId, v as "admin" | "member")}
                      >
                        <SelectTrigger className="h-7 w-[90px] text-xs border-border/50 bg-muted/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">{t("roles.admin")}</SelectItem>
                          <SelectItem value="member">{t("roles.member")}</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className={cn("text-[10px] gap-1 border-0", roleCfg.color)}>
                        <roleCfg.icon className="h-2.5 w-2.5" />
                        {t(roleCfg.labelKey as any)}
                      </Badge>
                    )}
                    {canManage && !isOwner && !isCurrentUser && (
                      <ConfirmModal onConfirm={() => handleRemoveMember(member.userId)}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-destructive">
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

        {/* ── Pending invitations ── */}
        {(pendingInvitations ?? []).length > 0 && (
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("sections.pendingInvitations")}</h2>
              <Badge variant="secondary" className="text-[10px] tabular-nums">{(pendingInvitations ?? []).length}</Badge>
            </div>
            <div className="rounded-xl border bg-card divide-y overflow-hidden">
              {(pendingInvitations ?? []).map((inv) => (
                <PendingInviteRow
                  key={inv._id}
                  inv={inv}
                  canManage={canManage}
                  onCancel={() => handleCancelInvitation(inv._id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Projects ── */}
        {(teamProjects ?? []).length > 0 && (
          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("sections.projects")}</h2>
                <Badge variant="secondary" className="text-[10px] tabular-nums">{(teamProjects ?? []).length}</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => router.push("/projects")} className="h-7 text-xs text-muted-foreground gap-1">
                {tc("edit")}
              </Button>
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

        {/* ── Recent tasks ── */}
        {(teamTasks ?? []).length > 0 && (
          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("tasks")}</h2>
                <Badge variant="secondary" className="text-[10px] tabular-nums">{openTasks.length} {t("open")}</Badge>
                {doneTasks.length > 0 && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">{doneTasks.length} {t("done")}</span>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => router.push("/tasks")} className="h-7 text-xs text-muted-foreground">
                {t("seeAll")}
              </Button>
            </div>
            <div className="rounded-xl border bg-card divide-y overflow-hidden">
              {openTasks.slice(0, 8).map((task: any) => {
                const isDone = task.status === "done";
                return (
                  <div
                    key={task._id}
                    onClick={() => router.push(`/tasks/${task._id}`)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors cursor-pointer group"
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); updateTask({ id: task._id, status: isDone ? "todo" : "done" }); }}
                      className="shrink-0 text-muted-foreground/40 hover:text-foreground transition-colors"
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </button>
                    {task.priority !== "none" && (
                      <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", PRIORITY_DOT[task.priority] ?? "bg-slate-400")} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium truncate group-hover:text-primary transition-colors", isDone && "line-through text-muted-foreground")}>
                        {task.title}
                      </p>
                      {task.assigneeName && (
                        <p className="text-[11px] text-muted-foreground">{task.assigneeName}</p>
                      )}
                    </div>
                    {task.dueDate && (
                      <span className={cn(
                        "text-[11px] font-medium shrink-0",
                        task.dueDate < Date.now() && !isDone ? "text-red-500" : "text-muted-foreground"
                      )}>
                        {new Date(task.dueDate).toLocaleDateString(locale, { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {openTasks.length > 8 && (
              <button onClick={() => router.push("/tasks")} className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1">
                +{openTasks.length - 8} {t("moreTasks")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Icon customise dialog ── */}
      <Dialog open={showIconEdit} onOpenChange={setShowIconEdit}>
        <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-base font-semibold">{t("iconCustomize")}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pt-5 pb-4 space-y-5">
            <div className="flex justify-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-md"
                style={{ background: iconGradientTo ? `linear-gradient(135deg, ${iconColor}, ${iconGradientTo})` : `linear-gradient(135deg, ${iconColor}cc, ${iconColor})` }}
              >
                {iconEmoji || (team as any).name[0].toUpperCase()}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("iconEmoji")}</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {EMOJI_LIST.map((e) => (
                  <button key={e} type="button" onClick={() => setIconEmoji(iconEmoji === e ? "" : e)}
                    className={cn("flex h-8 w-8 items-center justify-center rounded-lg border text-base transition-all hover:scale-110", iconEmoji === e ? "border-primary bg-primary/10" : "hover:border-primary/40")}>
                    {e}
                  </button>
                ))}
              </div>
              <Input value={iconEmoji} onChange={(e) => setIconEmoji(e.target.value)} placeholder={t("iconEmojiPlaceholder")} className="h-9 text-sm" maxLength={4} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("iconBgColor")}</label>
              <div className="flex flex-wrap gap-2">
                {TEAM_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setIconColor(c)}
                    className={cn("h-6 w-6 rounded-full border-2 transition-all hover:scale-110", iconColor === c ? "border-foreground scale-110" : "border-transparent")}
                    style={{ backgroundColor: c }} />
                ))}
                <input type="color" value={iconColor} onChange={(e) => setIconColor(e.target.value)} className="h-6 w-6 cursor-pointer rounded-full border-0 p-0 bg-transparent" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("iconGradientEnd")}</label>
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap gap-2 flex-1">
                  {["#f76c5e","#7c3aed","#2563eb","#0d9488","#059669"].map((c) => (
                    <button key={c} type="button" onClick={() => setIconGradientTo(iconGradientTo === c ? "" : c)}
                      className={cn("h-6 w-6 rounded-full border-2 transition-all hover:scale-110", iconGradientTo === c ? "border-foreground scale-110" : "border-transparent")}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
                {iconGradientTo && (
                  <button type="button" onClick={() => setIconGradientTo("")} className="text-xs text-muted-foreground hover:text-foreground">{tc("remove")}</button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-muted/20">
            <Button variant="ghost" size="sm" onClick={() => setShowIconEdit(false)}>{tc("cancel")}</Button>
            <Button size="sm" onClick={handleSaveIcon} disabled={isSavingIcon}>{isSavingIcon ? tc("loading") : t("saveIcon")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Invite dialog ── */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-base font-semibold">{t("inviteMember")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite}>
            <div className="px-6 pt-5 pb-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("inviteEmail")}</label>
                <Input type="email" placeholder="name@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} autoFocus required className="h-10" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("role")}</label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "admin" | "member")}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">
                      <span className="flex items-center gap-2"><UserIcon className="h-3.5 w-3.5 text-muted-foreground" />{t("roles.member")}</span>
                    </SelectItem>
                    <SelectItem value="admin">
                      <span className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-blue-500" />{t("roles.admin")}</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground/60">
                  {inviteRole === "admin" ? t("roleDescAdmin") : t("roleDescMember")}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-muted/20">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowInvite(false)}>{tc("cancel")}</Button>
              <Button type="submit" size="sm" disabled={isInviting || !inviteEmail.trim()}>
                {isInviting ? t("sending") : t("sendInvite")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
