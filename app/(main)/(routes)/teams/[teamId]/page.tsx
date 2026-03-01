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
import { ArrowLeft, Check, CheckCircle2, Circle, Copy, Crown, FileText, FolderKanban, Mail, Plus, Shield, Trash2, User as UserIcon, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/modals/ConfirmModal";

const roleConfig = {
  owner: { label: "Owner", icon: Crown, color: "text-amber-500" },
  admin: { label: "Admin", icon: Shield, color: "text-blue-500" },
  member: { label: "Member", icon: UserIcon, color: "text-slate-500" },
};

function InviteRow({ inv, canManage, onCancel }: { inv: any; canManage: boolean; onCancel: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${inv.token}`;

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
          Invited as {inv.role} · expires {new Date(inv.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1.5 text-xs text-muted-foreground">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </Button>
      {canManage && (
        <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs text-muted-foreground hover:text-destructive h-7">
          Cancel
        </Button>
      )}
    </div>
  );
}

export default function TeamDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const router = useRouter();
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

  const teamTasks = useQuery(api.tasks.getByTeam, { teamId: teamId as Id<"teams"> });
  const updateTask = useMutation(api.tasks.update);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [isInviting, setIsInviting] = useState(false);

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
        <p className="text-sm text-muted-foreground">Team not found</p>
        <Button variant="ghost" size="sm" onClick={() => router.push("/teams")} className="mt-2 gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to teams
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
      toast.success(`Invitation created for ${inviteEmail} — copy the link below to share`);
      setShowInvite(false);
      setInviteEmail("");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send invitation");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    try {
      await removeMember({ teamId: teamId as Id<"teams">, targetUserId });
      toast.success("Member removed");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to remove member");
    }
  };

  const handleUpdateRole = async (targetUserId: string, role: "admin" | "member") => {
    try {
      await updateRole({ teamId: teamId as Id<"teams">, targetUserId, role });
      toast.success("Role updated");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update role");
    }
  };

  const handleCancelInvitation = async (invId: Id<"teamInvitations">) => {
    try {
      await cancelInvitation({ invitationId: invId });
      toast.success("Invitation cancelled");
    } catch {
      toast.error("Failed to cancel invitation");
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
          Teams
        </button>

        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary/20 to-primary/5 text-2xl font-bold text-primary">
            {(team as any).icon ?? (team as any).name[0].toUpperCase()}
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
              <h2 className="text-base font-semibold">Members</h2>
              <Badge variant="secondary" className="text-xs">{(members ?? []).length}</Badge>
            </div>
            {canManage && (
              <Button onClick={() => setShowInvite(true)} size="sm" variant="outline" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Invite
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
                      {isCurrentUser && <span className="text-muted-foreground text-xs ml-1">(you)</span>}
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
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className={cn("text-xs gap-1", roleCfg.color)}>
                        <roleCfg.icon className="h-3 w-3" />
                        {roleCfg.label}
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
              <h2 className="text-base font-semibold">Projects</h2>
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

        {/* Team Documents */}
        {(teamDocs ?? []).length > 0 && (
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Documents</h2>
              <span className="text-[10px] text-muted-foreground font-medium">{(teamDocs ?? []).length}</span>
            </div>
            <div className="rounded-xl border divide-y">
              {(teamDocs ?? []).slice(0, 8).map((doc: any) => (
                <div
                  key={doc._id}
                  onClick={() => router.push(`/documents/${doc._id}`)}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors group first:rounded-t-xl last:rounded-b-xl"
                >
                  <span className="shrink-0 text-sm">{doc.icon ?? "📄"}</span>
                  <span className="flex-1 text-sm truncate group-hover:text-primary transition-colors">{doc.title || "Untitled"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team Tasks */}
        {(teamTasks ?? []).length > 0 && (
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Tasks</h2>
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
                          {new Date(task.dueDate).toLocaleDateString("fr-FR", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {(teamTasks ?? []).length > 12 && (
              <p className="mt-2 text-xs text-muted-foreground text-center">
                +{(teamTasks ?? []).length - 12} more tasks
              </p>
            )}
          </div>
        )}

        {/* Pending invitations */}
        {(pendingInvitations ?? []).length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Pending Invitations</h2>
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

      {/* Invite dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <Input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              autoFocus
              required
            />
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Role</label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "admin" | "member")}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowInvite(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isInviting || !inviteEmail.trim()}>
                {isInviting ? "Sending..." : "Send Invite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
