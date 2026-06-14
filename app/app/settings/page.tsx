"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { useLocale } from "@/components/providers/locale-provider";
import { PageContainer, PageHeader, btnPrimary, btnOutline, inputBase } from "@/components/app/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Setting2, Profile, Buildings, Sun1, Moon, Add, Logout } from "iconsax-reactjs";

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
