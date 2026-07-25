"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { PageContainer, PageHeader, btnPrimary, btnOutline, inputBase } from "@/components/app/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Crown, User, People, ArrowLeft, Add, Trash } from "iconsax-reactjs";

const PERMISSION_CATEGORIES = [
  {
    key: "workspace",
    permissions: [
      { key: "workspace:manage", labelKey: "workspace_manage" },
      { key: "members:manage", labelKey: "members_manage" },
      { key: "roles:manage", labelKey: "roles_manage" },
      { key: "invites:manage", labelKey: "invites_manage" },
    ],
  },
  {
    key: "projects",
    permissions: [
      { key: "projects:manage", labelKey: "projects_manage" },
      { key: "projects:view", labelKey: "projects_view" },
      { key: "projects:assign", labelKey: "projects_assign" },
    ],
  },
  {
    key: "tasks",
    permissions: [
      { key: "tasks:manage", labelKey: "tasks_manage" },
      { key: "tasks:assign", labelKey: "tasks_assign" },
      { key: "tasks:view", labelKey: "tasks_view" },
    ],
  },
  {
    key: "channels",
    permissions: [
      { key: "channels:manage", labelKey: "channels_manage" },
      { key: "channels:post", labelKey: "channels_post" },
      { key: "channels:mention_all", labelKey: "channels_mention_all" },
    ],
  },
];

const ROLE_COLORS = ["#2f7ea6", "#2fbf9b", "#d98324", "#8b5cf6", "#ec4899", "#e5484d", "#0ea5e9", "#f59e0b", "#6366f1"];

export default function RolesPage() {
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const router = useRouter();
  const t = useTranslations("roles");
  const tc = useTranslations("common");
  const roles = useQuery(api.flux_roles.listRoles, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const members = useQuery(api.workspaces.listMembers, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const myPermissions = useQuery(api.flux_roles.myPermissions, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const createRole = useMutation(api.flux_roles.createRole);
  const updateRole = useMutation(api.flux_roles.updateRole);
  const deleteRole = useMutation(api.flux_roles.deleteRole);
  const setMemberRoles = useMutation(api.flux_roles.setMemberRoles);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(ROLE_COLORS[0]);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [memberPanelRole, setMemberPanelRole] = useState<any>(null);

  const canManage = (myPermissions ?? []).includes("roles:manage");

  const reset = () => {
    setName("");
    setColor(ROLE_COLORS[0]);
    setPermissions(new Set());
    setEditing(null);
  };

  const openCreate = () => {
    reset();
    setDialogOpen(true);
  };

  const openEdit = (role: any) => {
    setEditing(role);
    setName(role.name);
    setColor(role.color);
    setPermissions(new Set(role.permissions));
    setDialogOpen(true);
  };

  const togglePermission = (key: string) => {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const save = async () => {
    if (!activeWorkspaceId || !name.trim()) return;
    try {
      if (editing) {
        await updateRole({
          roleId: editing._id,
          name: name.trim(),
          color,
          permissions: Array.from(permissions),
        });
        toast.success(t("roleUpdated"));
      } else {
        await createRole({
          workspaceId: activeWorkspaceId,
          name: name.trim(),
          color,
          permissions: Array.from(permissions),
        });
        toast.success(t("roleCreated"));
      }
      setDialogOpen(false);
      reset();
    } catch {
      toast.error(t("roleSaveFailed"));
    }
  };

  const handleDelete = async (role: any) => {
    if (!confirm(t("deleteConfirm"))) return;
    try {
      await deleteRole({ roleId: role._id });
      toast.success(t("roleDeleted"));
    } catch {
      toast.error(t("roleDeleteFailed"));
    }
  };

  const toggleRoleForMember = async (member: any, roleId: string) => {
    if (!activeWorkspaceId) return;
    const current = new Set(member.roleIds ?? []);
    if (current.has(roleId)) current.delete(roleId);
    else current.add(roleId);
    try {
      await setMemberRoles({ workspaceId: activeWorkspaceId, userId: member.userId, roleIds: Array.from(current) as Id<"flux_roles">[] });
      toast.success(t("memberRolesUpdated"));
    } catch {
      toast.error(t("memberRolesUpdateFailed"));
    }
  };

  return (
    <PageContainer className="max-w-[820px]">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        icon={Crown}
        testId="roles-header"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/app/settings")} className={cn(btnOutline, "h-9")}>
              <ArrowLeft variant="Bulk" size={16} /> {tc("back")}
            </button>
            {canManage && (
              <button onClick={openCreate} className={btnPrimary} data-testid="new-role-btn">
                <Add variant="Bulk" size={18} /> {t("newRole")}
              </button>
            )}
          </div>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-card" data-testid="roles-list">
        {(roles ?? []).length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">{t("noRoles")}</p>
        )}
        {(roles ?? []).map((role: any) => (
          <div key={role._id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
            <span className="h-8 w-8 rounded-lg" style={{ backgroundColor: role.color }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{role.name}</p>
              <p className="text-xs text-muted-foreground">
                {role.permissions.length} {t("permissions.count")}
                {role.isDefault && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px]">{t("default")}</span>}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setMemberPanelRole(role)} className={cn(btnOutline, "h-8 px-2 text-xs")} data-testid="role-assign-members">
                <People variant="Bulk" size={14} /> {t("assignMembers")}
              </button>
              {canManage && !role.isDefault && (
                <button onClick={() => openEdit(role)} className={cn(btnOutline, "h-8 px-2 text-xs")} data-testid="edit-role">
                  {tc("edit")}
                </button>
              )}
              {canManage && !role.isDefault && (
                <button onClick={() => handleDelete(role)} className="flex h-8 w-8 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10">
                  <Trash variant="Bulk" size={15} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="role-dialog">
          <DialogHeader>
            <DialogTitle>{editing ? t("editRole") : t("newRole")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("roleName")} className={inputBase} data-testid="role-name-input" />
              <div className="flex items-center gap-1">
                {ROLE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn("h-6 w-6 rounded-full border border-border", color === c && "ring-2 ring-offset-1 ring-primary")}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {PERMISSION_CATEGORIES.map((cat) => (
                <div key={cat.key}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(`categories.${cat.key}`)}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {cat.permissions.map((p) => (
                      <label key={p.key} className="flex items-center gap-2 rounded-lg border border-border p-2 hover:bg-muted/50">
                        <Switch checked={permissions.has(p.key)} onCheckedChange={() => togglePermission(p.key)} />
                        <span className="text-sm">{t(`permissions.${p.labelKey}`)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setDialogOpen(false)} className={btnOutline}>{tc("cancel")}</button>
            <button onClick={save} className={btnPrimary} data-testid="role-save">{tc("save")}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!memberPanelRole} onOpenChange={(v) => !v && setMemberPanelRole(null)}>
        <DialogContent className="sm:max-w-md" data-testid="role-members-dialog">
          <DialogHeader>
            <DialogTitle>{t("assignMembersFor", { role: memberPanelRole?.name })}</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-auto">
            {(members ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("noMembers")}</p>}
            {(members ?? []).map((m: any) => (
              <label key={m.userId} className="flex items-center gap-3 border-b border-border px-1 py-2 last:border-0">
                <input
                  type="checkbox"
                  checked={(m.roleIds ?? []).includes(memberPanelRole?._id)}
                  onChange={() => toggleRoleForMember(m, memberPanelRole._id)}
                />
                <User variant="Bulk" size={16} className="text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{m.name ?? m.email}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <button onClick={() => setMemberPanelRole(null)} className={btnOutline}>{tc("close")}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
