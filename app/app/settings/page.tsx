"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useMutation, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { useLocale } from "@/components/providers/locale-provider";
import { PageContainer, PageHeader, btnPrimary, btnOutline, inputBase } from "@/components/app/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Setting2, Profile, Buildings, Sun1, Moon, Add, Logout, Gallery, Trash } from "iconsax-reactjs";

function WorkspaceBranding({ workspace, workspaceId, canManage }: any) {
  const convex = useConvex();
  const generateUploadUrl = useMutation(api.flux_files.generateUploadUrl);
  const updateWorkspace = useMutation(api.workspaces.update);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onPick = async (file?: File) => {
    if (!file || !workspaceId) return;
    if (file.size > 4 * 1024 * 1024) return toast.error("Image must be under 4MB");
    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = await res.json();
      const url = await convex.query(api.flux_files.getUrl, { storageId });
      await updateWorkspace({ workspaceId, avatar: url ?? undefined });
      toast.success("Workspace logo updated");
    } catch {
      toast.error("Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-5 flex items-center gap-4" data-testid="workspace-branding">
      <Avatar className="h-16 w-16 rounded-2xl border border-border">
        {workspace?.avatar && <AvatarImage src={workspace.avatar} className="rounded-2xl object-cover" />}
        <AvatarFallback className="rounded-2xl bg-[var(--flux-coral-soft)] text-xl font-semibold text-primary">{(workspace?.name ?? "W").charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-sm font-medium">Workspace logo</p>
        <p className="mb-2 text-xs text-muted-foreground">PNG or JPG, up to 4MB.</p>
        {canManage && (
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPick(e.target.files?.[0])} data-testid="ws-logo-input" />
            <button onClick={() => fileRef.current?.click()} disabled={busy} className={cn(btnOutline, "h-8 text-xs")} data-testid="ws-logo-upload"><Gallery variant="Bulk" size={15} /> {busy ? "Uploading…" : "Upload logo"}</button>
            {workspace?.avatar && <button onClick={() => updateWorkspace({ workspaceId, avatar: "" }).then(() => toast.success("Logo removed"))} className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-destructive hover:bg-destructive/10"><Trash variant="Bulk" size={14} /> Remove</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: any) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2"><Icon variant="Bulk" size={20} className="text-primary" /><h2 className="font-semibold">{title}</h2></div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useLocale();
  const { me, activeWorkspace, activeWorkspaceId, setActive } = useWorkspace();

  const updateProfile = useMutation(api.users.updateProfile);
  const updateWorkspace = useMutation(api.workspaces.update);
  const createWorkspace = useMutation(api.workspaces.create);

  const [name, setName] = useState("");
  const [wsName, setWsName] = useState("");
  const [newWsName, setNewWsName] = useState("");
  const [newWsType, setNewWsType] = useState("individual");

  useEffect(() => { setName(me?.name ?? ""); }, [me]);
  useEffect(() => { setWsName(activeWorkspace?.name ?? ""); }, [activeWorkspace]);
  useEffect(() => { if (search.get("new") === "1") document.getElementById("create-workspace")?.scrollIntoView({ behavior: "smooth" }); }, [search]);

  const canManageWs = activeWorkspace?.role === "owner" || activeWorkspace?.role === "admin";

  return (
    <PageContainer className="max-w-[760px]">
      <PageHeader title="Settings" subtitle="Manage your profile and workspace" icon={Setting2} testId="settings-header" />

      <div className="space-y-5">
        <Section title="Profile" icon={Profile}>
          <label className="mb-1.5 block text-sm font-medium">Display name</label>
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputBase} data-testid="settings-name-input" />
            <button onClick={() => updateProfile({ name: name.trim() }).then(() => toast.success("Profile updated"))} className={btnPrimary} data-testid="settings-save-profile">Save</button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{me?.email}</p>
        </Section>

        <Section title="Appearance" icon={theme === "dark" ? Moon : Sun1}>
          <div className="flex items-center justify-between">
            <span className="text-sm">Theme</span>
            <div className="flex items-center rounded-full border border-border p-0.5">
              <button onClick={() => setTheme("light")} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-sm", theme !== "dark" ? "bg-muted font-medium" : "text-muted-foreground")}><Sun1 variant="Bulk" size={16} /> Light</button>
              <button onClick={() => setTheme("dark")} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-sm", theme === "dark" ? "bg-muted font-medium" : "text-muted-foreground")}><Moon variant="Bulk" size={16} /> Dark</button>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm">Language</span>
            <Select value={locale} onValueChange={(v) => setLocale(v as any)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="fr">Français</SelectItem></SelectContent></Select>
          </div>
        </Section>

        <Section title="Workspace" icon={Buildings}>
          <WorkspaceBranding workspace={activeWorkspace} workspaceId={activeWorkspaceId} canManage={canManageWs} />
          <label className="mb-1.5 block text-sm font-medium">Workspace name</label>
          <div className="flex gap-2">
            <input value={wsName} onChange={(e) => setWsName(e.target.value)} disabled={!canManageWs} className={cn(inputBase, !canManageWs && "opacity-60")} data-testid="settings-ws-name" />
            {canManageWs && <button onClick={() => updateWorkspace({ workspaceId: activeWorkspaceId!, name: wsName.trim() }).then(() => toast.success("Workspace updated"))} className={btnPrimary}>Save</button>}
          </div>
          <p className="mt-2 text-xs capitalize text-muted-foreground">Your role: {activeWorkspace?.role}</p>
        </Section>

        <Section title="Create a new workspace" icon={Add}>
          <div id="create-workspace" className="space-y-3">
            <input value={newWsName} onChange={(e) => setNewWsName(e.target.value)} placeholder="New workspace name" className={inputBase} data-testid="settings-new-ws-name" />
            <Select value={newWsType} onValueChange={setNewWsType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="individual">Personal</SelectItem><SelectItem value="business">Team / Business</SelectItem><SelectItem value="association">Association</SelectItem></SelectContent></Select>
            <button onClick={async () => { if (!newWsName.trim()) return toast.error("Add a name"); const id = await createWorkspace({ name: newWsName.trim(), type: newWsType as any }); setActive(id); setNewWsName(""); toast.success("Workspace created"); router.push("/app"); }} className={btnPrimary} data-testid="settings-create-ws"><Add variant="Bulk" size={18} /> Create workspace</button>
          </div>
        </Section>

        <button onClick={() => router.push("/api/auth/signout")} className={cn(btnOutline, "text-destructive")} data-testid="settings-signout"><Logout variant="Bulk" size={16} /> Sign out</button>
      </div>
    </PageContainer>
  );
}
