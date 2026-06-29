"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { PageContainer, PageHeader, btnPrimary, btnOutline, inputBase } from "@/components/app/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Profile2User, UserAdd, Crown1, More, Trash, Copy, Sms } from "iconsax-reactjs";

const ROLE_COLORS: Record<string, string> = { owner: "var(--flux-coral)", admin: "#2f7ea6", member: "#2fbf9b", viewer: "var(--muted-foreground)" };

export default function MembersPage() {
  const { activeWorkspaceId, activeWorkspace, me } = useWorkspace();
  const members = useQuery(api.workspaces.listMembers, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const invitations = useQuery(api.invitations.listByWorkspace, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const updateRole = useMutation(api.workspaces.updateMemberRole);
  const removeMember = useMutation(api.workspaces.removeMember);
  const invite = useMutation(api.invitations.invite);
  const revoke = useMutation(api.invitations.revoke);
  const [open, setOpen] = useState(false);
  const t = useTranslations("teams");
  const tc = useTranslations("common");

  const canManage = activeWorkspace?.role === "owner" || activeWorkspace?.role === "admin";
  const pending = (invitations ?? []).filter((i: any) => i.status === "pending");

  return (
    <PageContainer className="max-w-[820px]">
      <PageHeader title={t("membersTitle")} subtitle={t("membersSubtitle", { count: members?.length ?? 0, name: activeWorkspace?.name ?? t("thisWorkspace") })} icon={Profile2User} testId="members-header"
        actions={canManage && <button onClick={() => setOpen(true)} className={btnPrimary} data-testid="invite-member-btn"><UserAdd variant="Bulk" size={18} /> {t("invite")}</button>} />

      <div className="overflow-hidden rounded-2xl border border-border bg-card" data-testid="members-list">
        {(members ?? []).map((m: any) => (
          <div key={m._id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0" data-testid="member-row">
            <Avatar className="h-9 w-9"><AvatarImage src={m.image} /><AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">{(m.name ?? m.email ?? "U").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.name ?? m.email}{m.userId === me?._id && <span className="ml-1.5 text-xs text-muted-foreground">{t("youLabel")}</span>}</p>
              <p className="truncate text-xs text-muted-foreground">{m.email}</p>
            </div>
            {m.role === "owner" ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: "color-mix(in oklch, var(--flux-coral) 16%, transparent)", color: "var(--flux-coral)" }}><Crown1 variant="Bulk" size={13} /> {t(`roles.${m.role}`)}</span>
            ) : canManage ? (
              <Select value={m.role} onValueChange={(v) => updateRole({ workspaceId: activeWorkspaceId!, memberId: m._id, role: v as any }).then(() => toast.success(t("roleUpdated")))}>
                <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="admin">{t("roles.admin")}</SelectItem><SelectItem value="member">{t("roles.member")}</SelectItem><SelectItem value="viewer">{t("roles.viewer")}</SelectItem></SelectContent>
              </Select>
            ) : (
              <span className="rounded-full px-2.5 py-1 text-xs font-medium capitalize" style={{ backgroundColor: `color-mix(in oklch, ${ROLE_COLORS[m.role]} 16%, transparent)`, color: ROLE_COLORS[m.role] }}>{t(`roles.${m.role}`)}</span>
            )}
            {canManage && m.role !== "owner" && m.userId !== me?._id && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><More variant="Bulk" size={16} /></button></DropdownMenuTrigger>
                <DropdownMenuContent align="end"><DropdownMenuItem onClick={() => removeMember({ workspaceId: activeWorkspaceId!, memberId: m._id }).then(() => toast.success(t("memberRemoved")))} className="text-destructive"><Trash variant="Bulk" size={15} /> {tc("remove")}</DropdownMenuItem></DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
      </div>

      {pending.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{t("sections.pendingInvitations")}</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {pending.map((i: any) => (
              <div key={i._id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground"><Sms variant="Bulk" size={16} /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{i.email}</p><p className="text-xs capitalize text-muted-foreground">{i.role} · {t("pending")}</p></div>
                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/invite/${i.token}`); toast.success(t("copied")); }} className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-primary hover:bg-muted"><Copy variant="Bulk" size={15} /> {t("copyLink")}</button>
                {canManage && <button onClick={() => revoke({ invitationId: i._id }).then(() => toast.success(t("revoked")))} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><Trash variant="Bulk" size={15} /></button>}
              </div>
            ))}
          </div>
        </div>
      )}

      <InviteDialog open={open} onOpenChange={setOpen} onInvite={async (email: string, role: string) => {
        if (!activeWorkspaceId) return;
        const res = await invite({ workspaceId: activeWorkspaceId, email, role: role as any });
        const link = `${window.location.origin}/invite/${res.token}`;
        try { await navigator.clipboard.writeText(link); } catch {}
        toast.success(t("inviteCreatedAndCopied"));
        setOpen(false);
      }} />
    </PageContainer>
  );
}

function InviteDialog({ open, onOpenChange, onInvite }: any) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [busy, setBusy] = useState(false);
  const t = useTranslations("teams");
  const tc = useTranslations("common");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" data-testid="invite-dialog">
        <DialogHeader><DialogTitle>{t("inviteMember")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("inviteEmailPlaceholder")} className={inputBase} data-testid="invite-email-input" />
          <Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">{t("roles.admin")}</SelectItem><SelectItem value="member">{t("roles.member")}</SelectItem><SelectItem value="viewer">{t("roles.viewer")}</SelectItem></SelectContent></Select>
          <p className="text-xs text-muted-foreground">{t("inviteLinkHint")}</p>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className={btnOutline}>{tc("cancel")}</button>
          <button onClick={async () => { if (!email.trim()) return toast.error(t("enterEmail")); setBusy(true); try { await onInvite(email.trim(), role); } finally { setBusy(false); } }} disabled={busy} className={btnPrimary} data-testid="invite-submit">{busy ? t("inviting") : t("createInvite")}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
