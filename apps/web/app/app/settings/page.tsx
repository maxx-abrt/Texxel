"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { useCoreWorkspaceLink } from "@/hooks/use-core-workspace-link";
import { useUserPrefs, useUpdatePrefs, useMyPermissions } from "@a2e/core";
import { useCoreWorkspaceId } from "@/hooks/use-core-workspace-id";
import { coreFlags } from "@/lib/core-flags";
import { useLocale } from "@/components/providers/locale-provider";
import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/switch";
import { PageContainer, PageHeader, btnPrimary, btnOutline, inputBase } from "@/components/app/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Setting2, Profile, Buildings, Sun1, Moon, Add, Logout, Gallery, Trash, Crown, People, Brush2, Activity, Edit2, Global } from "iconsax-reactjs";
import { ACCENT_PRESETS, DEFAULT_ACCENT, normalizeAccent, applyAccent, cacheAccent, applyDensity, cacheDensity, applyEasyRead, cacheEasyRead, type Density } from "@/components/providers/accent-provider";
import { ActivityFeed } from "@/components/app/activity-feed";
import { CoreStatusCard } from "@/components/app/core-status-card";
import { ImageCropperModal } from "@/components/app/image-cropper-modal";

function EasyReadToggle() {
  const t = useTranslations("settings");
  const prefs = useQuery(api.flux_userPrefs.get);
  const updatePrefs = useMutation(api.flux_userPrefs.update);
  const on = !!(prefs as any)?.easyRead;

  const toggle = async (next: boolean) => {
    applyEasyRead(next);
    cacheEasyRead(next);
    await updatePrefs({ easyRead: next });
    toast.success(t("easyRead.saved"));
  };

  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
      <div>
        <span className="text-sm font-medium">{t("easyRead.title")}</span>
        <p className="text-xs text-muted-foreground">{t("easyRead.desc")}</p>
      </div>
      <Switch checked={on} onCheckedChange={toggle} data-testid="easyread-toggle" />
    </div>
  );
}

function DensityPicker() {
  const t = useTranslations("settings");
  const prefs = useQuery(api.flux_userPrefs.get);
  const updatePrefs = useMutation(api.flux_userPrefs.update);
  const current: Density = ((prefs as any)?.density as Density) ?? "default";

  const pick = async (d: Density) => {
    applyDensity(d);
    cacheDensity(d);
    await updatePrefs({ density: d });
    toast.success(t("density.saved"));
  };

  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
      <div>
        <span className="text-sm font-medium">{t("density.title")}</span>
        <p className="text-xs text-muted-foreground">{t("density.desc")}</p>
      </div>
      <div className="flex items-center rounded-full border border-border p-0.5" data-testid="density-picker">
        {(["compact", "default", "comfortable"] as Density[]).map((d) => (
          <button
            key={d}
            onClick={() => pick(d)}
            data-testid={`density-${d}`}
            className={cn(
              "h-8 rounded-full px-3 text-xs",
              current === d ? "bg-muted font-semibold" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`density.options.${d}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

function AccentPicker() {
  const t = useTranslations("settings");
  const localPrefs = useQuery(api.flux_userPrefs.get);
  const localUpdatePrefs = useMutation(api.flux_userPrefs.update);
  const corePrefs = useUserPrefs();
  const coreUpdatePrefs = useUpdatePrefs();
  const useCore = coreFlags.prefs;
  const accentColor = useCore ? corePrefs?.accentColor : (localPrefs as any)?.accentColor;
  const current = normalizeAccent(accentColor) ?? DEFAULT_ACCENT;

  const pick = async (color: string) => {
    applyAccent(color);
    cacheAccent(color === DEFAULT_ACCENT ? null : color);
    if (useCore) {
      await coreUpdatePrefs({ accentColor: color });
    } else {
      await localUpdatePrefs({ accentColor: color });
    }
    toast.success(t("accent.saved"));
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="mb-1 flex items-center gap-2">
        <Brush2 variant="Bulk" size={16} className="text-primary" />
        <span className="text-sm font-medium">{t("accent.title")}</span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{t("accent.desc")}</p>
      <div className="flex flex-wrap items-center gap-2" data-testid="accent-picker">
        {ACCENT_PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => pick(p.color)}
            aria-label={p.name}
            data-testid={`accent-${p.name}`}
            className={cn(
              "h-8 w-8 rounded-full transition-transform hover:scale-110",
              current.toLowerCase() === p.color.toLowerCase() && "ring-2 ring-ring ring-offset-2 ring-offset-background",
            )}
            style={{ backgroundColor: p.color }}
          />
        ))}
        <label
          className={cn(
            "relative flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-border px-2.5 transition-colors hover:bg-muted",
            !ACCENT_PRESETS.some((p) => p.color.toLowerCase() === current.toLowerCase()) && "ring-2 ring-ring ring-offset-2 ring-offset-background",
          )}
          data-testid="accent-custom"
        >
          <span
            className="h-4.5 w-4.5 rounded-full border border-border"
            style={{ background: ACCENT_PRESETS.some((p) => p.color.toLowerCase() === current.toLowerCase()) ? "conic-gradient(#e65a41,#d98324,#2fbf9b,#2f7ea6,#7c5cff,#e65a41)" : current }}
          />
          <span className="text-xs font-medium">{t("accent.custom")}</span>
          <input type="color" value={current} onChange={(e) => pick(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" data-testid="accent-custom-input" />
        </label>
        {current.toLowerCase() !== DEFAULT_ACCENT && (
          <button onClick={() => pick(DEFAULT_ACCENT)} className="h-8 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-muted" data-testid="accent-reset">
            {t("accent.reset")}
          </button>
        )}
      </div>
    </div>
  );
}

function ProfileAvatar({ me, updateProfile }: { me: any; updateProfile: any }) {
  const convex = useConvex();
  const generateUploadUrl = useMutation(api.flux_files.generateUploadUrl);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperSource, setCropperSource] = useState<File | string | null>(null);
  const t = useTranslations("settings");
  const tc = useTranslations("common");

  const uploadFile = async (file: File) => {
    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = await res.json();
      const url = await convex.query(api.flux_files.getUrl, { storageId });
      await updateProfile({ image: url ?? undefined });
      toast.success(t("profile.saved"));
    } catch {
      toast.error(t("uploadFailed"));
    } finally {
      setBusy(false);
    }
  };

  const onPick = (file?: File) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return toast.error(t("imageTooLarge"));
    setCropperSource(file);
    setCropperOpen(true);
  };

  const onEdit = () => {
    if (!me?.image) return;
    setCropperSource(me.image);
    setCropperOpen(true);
  };

  return (
    <div className="mb-4 flex items-center gap-4">
      <Avatar className="h-16 w-16 rounded-2xl border border-border">
        {me?.image && <AvatarImage src={me.image} className="rounded-2xl object-cover" />}
        <AvatarFallback className="rounded-2xl bg-(--flux-coral-soft) text-xl font-semibold text-primary">
          {(me?.name ?? me?.email ?? "U").charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div>
        <p className="text-sm font-medium">{t("profile.displayName")}</p>
        <p className="mb-2 text-xs text-muted-foreground">{t("workspaceLogoHint")}</p>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPick(e.target.files?.[0])} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} className={cn(btnOutline, "h-8 text-xs")}>
            <Gallery variant="Bulk" size={15} /> {busy ? t("uploading") : t("uploadLogo")}
          </button>
          {me?.image && (
            <>
              <button onClick={onEdit} disabled={busy} className={cn(btnOutline, "h-8 text-xs")}>
                <Edit2 variant="Bulk" size={15} /> {tc("edit")}
              </button>
              <button onClick={() => updateProfile({ image: "" }).then(() => toast.success(t("logoRemoved")))} className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-destructive hover:bg-destructive/10">
                <Trash variant="Bulk" size={14} /> {tc("remove")}
              </button>
            </>
          )}
        </div>
      </div>
      <ImageCropperModal
        open={cropperOpen}
        source={cropperSource}
        title={t("cropImage.title")}
        applyLabel={tc("save")}
        cancelLabel={tc("cancel")}
        zoomLabel={t("cropImage.zoom")}
        resetLabel={t("cropImage.reset")}
        onClose={() => setCropperOpen(false)}
        onConfirm={(file) => {
          setCropperOpen(false);
          uploadFile(file);
        }}
      />
    </div>
  );
}

function WorkspaceBranding({ workspace, workspaceId, canManage }: any) {
  const convex = useConvex();
  const generateUploadUrl = useMutation(api.flux_files.generateUploadUrl);
  const updateWorkspace = useMutation(api.workspaces.update);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperSource, setCropperSource] = useState<File | string | null>(null);
  const t = useTranslations("settings");
  const tc = useTranslations("common");

  const uploadFile = async (file: File) => {
    if (!workspaceId) return;
    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = await res.json();
      const url = await convex.query(api.flux_files.getUrl, { storageId });
      await updateWorkspace({ workspaceId, avatar: url ?? undefined });
      toast.success(t("workspaceLogoUpdated"));
    } catch {
      toast.error(t("uploadFailed"));
    } finally {
      setBusy(false);
    }
  };

  const onPick = (file?: File) => {
    if (!file || !workspaceId) return;
    if (file.size > 4 * 1024 * 1024) return toast.error(t("imageTooLarge"));
    setCropperSource(file);
    setCropperOpen(true);
  };

  const onEdit = () => {
    if (!workspace?.avatar) return;
    setCropperSource(workspace.avatar);
    setCropperOpen(true);
  };

  return (
    <div className="mb-5 flex items-center gap-4" data-testid="workspace-branding">
      <Avatar className="h-16 w-16 rounded-2xl border border-border">
        {workspace?.avatar && <AvatarImage src={workspace.avatar} className="rounded-2xl object-cover" />}
        <AvatarFallback className="rounded-2xl bg-(--flux-coral-soft) text-xl font-semibold text-primary">{(workspace?.name ?? "W").charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-sm font-medium">{t("workspaceLogo")}</p>
        <p className="mb-2 text-xs text-muted-foreground">{t("workspaceLogoHint")}</p>
        {canManage && (
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPick(e.target.files?.[0])} data-testid="ws-logo-input" />
            <button onClick={() => fileRef.current?.click()} disabled={busy} className={cn(btnOutline, "h-8 text-xs")} data-testid="ws-logo-upload"><Gallery variant="Bulk" size={15} /> {busy ? t("uploading") : t("uploadLogo")}</button>
            {workspace?.avatar && (
              <>
                <button onClick={onEdit} disabled={busy} className={cn(btnOutline, "h-8 text-xs")}><Edit2 variant="Bulk" size={15} /> {tc("edit")}</button>
                <button onClick={() => updateWorkspace({ workspaceId, avatar: "" }).then(() => toast.success(t("logoRemoved")))} className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-destructive hover:bg-destructive/10"><Trash variant="Bulk" size={14} /> {tc("remove")}</button>
              </>
            )}
          </div>
        )}
      </div>
      <ImageCropperModal
        open={cropperOpen}
        source={cropperSource}
        title={t("cropImage.title")}
        applyLabel={tc("save")}
        cancelLabel={tc("cancel")}
        zoomLabel={t("cropImage.zoom")}
        resetLabel={t("cropImage.reset")}
        onClose={() => setCropperOpen(false)}
        onConfirm={(file) => {
          setCropperOpen(false);
          uploadFile(file);
        }}
      />
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
  const { workspaces, me, activeWorkspace, activeWorkspaceId, setActive } = useWorkspace();
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const ta = useTranslations("auth");
  const myPermissions = useQuery(api.flux_roles.myPermissions, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const ta2e = useTranslations("settings.coreStatus");
  const coreWsId = useCoreWorkspaceId();
  const coreMyPermissions = useMyPermissions(coreFlags.roles ? (coreWsId as never) : null);
  const effectivePermissions = coreFlags.roles ? (coreMyPermissions ?? []) : (myPermissions ?? []);

  const updateProfile = useMutation(api.users.updateProfile);
  const updateWorkspace = useMutation(api.workspaces.update);
  const createWorkspace = useMutation(api.workspaces.create);
  const deleteWorkspace = useMutation(api.workspaces.remove);
  const { linkNewWorkspace, pushRename } = useCoreWorkspaceLink();

  const [name, setName] = useState("");
  const [wsName, setWsName] = useState("");
  const [newWsName, setNewWsName] = useState("");
  const [newWsType, setNewWsType] = useState("individual");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => { setName(me?.name ?? ""); }, [me]);
  useEffect(() => { setWsName(activeWorkspace?.name ?? ""); }, [activeWorkspace]);
  useEffect(() => { if (search.get("new") === "1") document.getElementById("create-workspace")?.scrollIntoView({ behavior: "smooth" }); }, [search]);

  const canManageWs = effectivePermissions.includes("workspace:manage");
  const isOwner = activeWorkspace?.role === "owner";

  const handleDeleteWorkspace = async () => {
    if (!activeWorkspaceId || !isOwner) return;
    if (deleteConfirm.trim() !== activeWorkspace?.name) {
      toast.error(t("deleteWorkspaceConfirmError"));
      return;
    }
    setDeleteBusy(true);
    try {
      await deleteWorkspace({ workspaceId: activeWorkspaceId });
      toast.success(t("workspaceDeleted"));
      const next = workspaces.find((w) => w._id !== activeWorkspaceId);
      if (next) setActive(next._id);
      router.push(next ? "/app" : "/app/settings?new=1");
    } catch (e: any) {
      toast.error(e?.message ?? t("workspaceDeleteFailed"));
    } finally {
      setDeleteBusy(false);
      setDeleteOpen(false);
      setDeleteConfirm("");
    }
  };

  return (
    <PageContainer className="max-w-[760px]">
      <PageHeader title={t("title")} subtitle={t("profileWorkspace")} icon={Setting2} testId="settings-header" />

      <div className="space-y-5">
        <Section title={t("tabs.profile")} icon={Profile}>
          <ProfileAvatar me={me} updateProfile={updateProfile} />
          <label className="mb-1.5 block text-sm font-medium">{t("profile.displayName")}</label>
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputBase} data-testid="settings-name-input" />
            <button onClick={() => updateProfile({ name: name.trim() }).then(() => toast.success(t("profile.saved")))} className={btnPrimary} data-testid="settings-save-profile">{t("profile.saveChanges")}</button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{me?.email}</p>
        </Section>

        <Section title={t("tabs.appearance")} icon={theme === "dark" ? Moon : Sun1}>
          <div className="flex items-center justify-between">
            <span className="text-sm">{t("appearance.theme")}</span>
            <div className="flex items-center rounded-full border border-border p-0.5">
              <button onClick={() => setTheme("light")} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-sm", theme !== "dark" ? "bg-muted font-medium" : "text-muted-foreground")}><Sun1 variant="Bulk" size={16} /> {t("appearance.themes.light")}</button>
              <button onClick={() => setTheme("dark")} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-sm", theme === "dark" ? "bg-muted font-medium" : "text-muted-foreground")}><Moon variant="Bulk" size={16} /> {t("appearance.themes.dark")}</button>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm">{t("tabs.language")}</span>
            <Select value={locale} onValueChange={(v) => setLocale(v as any)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">{t("language.languages.en")}</SelectItem><SelectItem value="fr">{t("language.languages.fr")}</SelectItem></SelectContent></Select>
          </div>
          <AccentPicker />
          <DensityPicker />
          <EasyReadToggle />
        </Section>

        <Section title={t("workspace")} icon={Buildings}>
          <WorkspaceBranding workspace={activeWorkspace} workspaceId={activeWorkspaceId} canManage={canManageWs} />
          <label className="mb-1.5 block text-sm font-medium">{t("workspaceName")}</label>
          <div className="flex gap-2">
            <input value={wsName} onChange={(e) => setWsName(e.target.value)} disabled={!canManageWs} className={cn(inputBase, !canManageWs && "opacity-60")} data-testid="settings-ws-name" />
            {canManageWs && <button onClick={() => updateWorkspace({ workspaceId: activeWorkspaceId!, name: wsName.trim() }).then(() => { toast.success(t("workspaceUpdated")); pushRename(activeWorkspace?.coreId, wsName.trim()); })} className={btnPrimary}>{t("profile.saveChanges")}</button>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("yourRole", { role: activeWorkspace?.role ?? "" })}</p>
          {isOwner && (
            <div className="mt-4 border-t border-border pt-4">
              <div className="mb-3">
                <p className="text-sm font-medium text-destructive">{t("deleteWorkspace")}</p>
                <p className="text-xs text-muted-foreground">{t("deleteWorkspaceHint")}</p>
              </div>
              <button onClick={() => setDeleteOpen(true)} className={cn(btnOutline, "text-destructive")} data-testid="settings-delete-ws">
                <Trash variant="Bulk" size={16} /> {t("deleteWorkspace")}
              </button>
            </div>
          )}
        </Section>

        <Section title={ta2e("title")} icon={Global}>
          <CoreStatusCard />
        </Section>

        <Section title={t("activityTitle")} icon={Activity}>
          <p className="mb-3 text-xs text-muted-foreground">{t("activitySubtitle")}</p>
          <div className="max-h-[360px] overflow-y-auto rounded-2xl border border-border bg-card/40 p-3">
            <ActivityFeed limit={50} />
          </div>
        </Section>

        <Section title={t("roles")} icon={Crown}>
          <p className="mb-3 text-xs text-muted-foreground">{t("rolesHint")}</p>
          <button onClick={() => router.push("/app/settings/roles")} className={cn(btnOutline, "h-9 text-xs")} data-testid="settings-roles-link">
            <People variant="Bulk" size={15} /> {t("manageRoles")}
          </button>
        </Section>

        <Section title={t("createNewWorkspace")} icon={Add}>
          <div id="create-workspace" className="space-y-3">
            <input value={newWsName} onChange={(e) => setNewWsName(e.target.value)} placeholder={t("newWorkspaceNamePlaceholder")} className={inputBase} data-testid="settings-new-ws-name" />
            <Select value={newWsType} onValueChange={setNewWsType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="individual">{t("workspaceTypes.individual")}</SelectItem><SelectItem value="business">{t("workspaceTypes.business")}</SelectItem><SelectItem value="association">{t("workspaceTypes.association")}</SelectItem></SelectContent></Select>
            <button onClick={async () => { if (!newWsName.trim()) return toast.error(t("workspaceNameRequired")); const id = await createWorkspace({ name: newWsName.trim(), type: newWsType as any }); await linkNewWorkspace(id, { name: newWsName.trim(), type: newWsType }); setActive(id); setNewWsName(""); toast.success(t("workspaceCreated")); router.push("/app"); }} className={btnPrimary} data-testid="settings-create-ws"><Add variant="Bulk" size={18} /> {t("createNewWorkspace")}</button>
          </div>
        </Section>

        <button onClick={() => router.push("/next-api/auth/signout")} className={cn(btnOutline, "text-destructive")} data-testid="settings-signout"><Logout variant="Bulk" size={16} /> {ta("signOut")}</button>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm" data-testid="delete-workspace-dialog">
          <DialogHeader><DialogTitle className="text-destructive">{t("deleteWorkspace")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("deleteWorkspaceConfirm", { name: activeWorkspace?.name })}</p>
            {activeWorkspace?.coreId && (
              <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground" data-testid="delete-workspace-shared-hint">
                {t("deleteWorkspaceSharedHint")}
              </p>
            )}
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={activeWorkspace?.name ?? ""}
              className={inputBase}
              data-testid="delete-workspace-confirm"
            />
          </div>
          <DialogFooter>
            <button onClick={() => setDeleteOpen(false)} className={btnOutline} disabled={deleteBusy}>{tc("cancel")}</button>
            <button onClick={handleDeleteWorkspace} disabled={deleteBusy || deleteConfirm.trim() !== activeWorkspace?.name} className={cn(btnPrimary, "bg-destructive text-destructive-foreground hover:bg-destructive/90")} data-testid="delete-workspace-submit">
              {deleteBusy ? t("deletingWorkspace") : t("deleteWorkspace")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
