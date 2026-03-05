"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import {
  User,
  Palette,
  Upload,
  Bell,
  Globe,
  Monitor,
  Moon,
  Sun,
  Check,
  Keyboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ImportModal } from "@/components/modals/ImportModal";
import { useLocale } from "@/components/providers/locale-provider";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

const TABS = [
  { id: "profile", icon: User },
  { id: "appearance", icon: Palette },
  { id: "notifications", icon: Bell },
  { id: "language", icon: Globe },
  { id: "import", icon: Upload },
  { id: "shortcuts", icon: Keyboard },
] as const;

const ACCENT_PALETTES = [
  { id: "coral", label: "Coral", primary: "oklch(0.655 0.21 22)", dark: "oklch(0.72 0.19 22)", hex: "#f76c5e" },
  { id: "violet", label: "Violet", primary: "oklch(0.6 0.22 270)", dark: "oklch(0.68 0.2 270)", hex: "#7c3aed" },
  { id: "blue", label: "Blue", primary: "oklch(0.6 0.2 245)", dark: "oklch(0.67 0.18 245)", hex: "#2563eb" },
  { id: "teal", label: "Teal", primary: "oklch(0.6 0.14 185)", dark: "oklch(0.67 0.13 185)", hex: "#0d9488" },
  { id: "emerald", label: "Emerald", primary: "oklch(0.6 0.17 155)", dark: "oklch(0.67 0.15 155)", hex: "#059669" },
  { id: "amber", label: "Amber", primary: "oklch(0.72 0.17 70)", dark: "oklch(0.78 0.15 70)", hex: "#d97706" },
  { id: "rose", label: "Rose", primary: "oklch(0.65 0.22 355)", dark: "oklch(0.72 0.2 355)", hex: "#e11d48" },
  { id: "slate", label: "Slate", primary: "oklch(0.42 0.02 260)", dark: "oklch(0.82 0.01 260)", hex: "#475569" },
] as const;

function applyPalette(paletteId: string) {
  const palette = ACCENT_PALETTES.find((p) => p.id === paletteId);
  if (!palette) return;
  const root = document.documentElement;
  root.style.setProperty("--primary", palette.primary);
  root.style.setProperty("--ring", palette.primary);
  root.style.setProperty("--sidebar-primary", palette.primary);
  if (root.classList.contains("dark")) {
    root.style.setProperty("--primary", palette.dark);
    root.style.setProperty("--ring", palette.dark);
    root.style.setProperty("--sidebar-primary", palette.dark);
  }
  localStorage.setItem("texxel-palette", paletteId);
}

function useShortcuts(ts: (key: string) => string) {
  return [
    { section: ts("shortcuts.sections.searchNav"), items: [
      { keys: ["⌘", "K"], desc: ts("shortcuts.items.openCommandPalette") },
      { keys: ["Esc"], desc: ts("shortcuts.items.closeCancel") },
      { keys: ["↑↓"], desc: ts("shortcuts.items.navigateResults") },
      { keys: ["↵"], desc: ts("shortcuts.items.selectResult") },
    ]},
    { section: ts("shortcuts.sections.editor"), items: [
      { keys: ["/"], desc: ts("shortcuts.items.insertBlock") },
      { keys: ["⌘", "B"], desc: ts("shortcuts.items.bold") },
      { keys: ["⌘", "I"], desc: ts("shortcuts.items.italic") },
      { keys: ["⌘", "E"], desc: ts("shortcuts.items.inlineCode") },
      { keys: ["⌘", "Z"], desc: ts("shortcuts.items.undo") },
      { keys: ["⌘", "Shift", "Z"], desc: ts("shortcuts.items.redo") },
      { keys: ["⌘", "A", "Del"], desc: ts("shortcuts.items.deleteAll") },
    ]},
    { section: ts("shortcuts.sections.tasks"), items: [
      { keys: ["Enter"], desc: ts("shortcuts.items.createTask") },
      { keys: ["Esc"], desc: ts("shortcuts.items.cancelInlineAdd") },
    ]},
  ];
}

export default function SettingsPage() {
  const ts = useTranslations("settings");
  const shortcuts = useShortcuts(ts as any);
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const profile = useQuery(api.userProfiles.getMyProfile);
  const upsertProfile = useMutation(api.userProfiles.upsertProfile);
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useLocale();

  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") ?? "profile");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);
  const [showImport, setShowImport] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileRole, setProfileRole] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [profileIcon, setProfileIcon] = useState("");
  const [profileAccentColor, setProfileAccentColor] = useState("#f76c5e");
  const [isSaving, setIsSaving] = useState(false);
  const [nameInit, setNameInit] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [alertDays, setAlertDays] = useState(3);
  const [activePalette, setActivePalette] = useState("coral");
  const alertInitRef = useRef(false);
  const paletteInitRef = useRef(false);

  if (profile && !nameInit) {
    setProfileName(profile.name ?? user?.name ?? "");
    setProfileRole(profile.role ?? "");
    setProfileDescription((profile as any).description ?? "");
    setProfileIcon((profile as any).icon ?? "");
    setProfileAccentColor((profile as any).accentColor ?? "#f76c5e");
    setNameInit(true);
  }
  if (profile && !alertInitRef.current) {
    alertInitRef.current = true;
    setAlertsEnabled(profile.dueDateAlertsEnabled ?? true);
    setAlertDays(profile.dueDateAlertDays ?? 3);
  }

  useEffect(() => {
    if (!paletteInitRef.current) {
      paletteInitRef.current = true;
      const saved = localStorage.getItem("texxel-palette") ?? (profile as any)?.accentPalette ?? "coral";
      setActivePalette(saved);
      applyPalette(saved);
    }
  }, [profile]);

  const PROFILE_COLORS = [
    "#f76c5e", "#7c3aed", "#2563eb", "#0d9488",
    "#059669", "#d97706", "#e11d48", "#475569",
  ];
  const EMOJI_SUGGESTIONS = ["😊", "🚀", "💡", "🎯", "⚡", "🌟", "🔥", "🎨", "💎", "🦄", "🐉", "🌈"];

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await upsertProfile({
        name: profileName.trim(),
        role: profileRole.trim() || undefined,
        description: profileDescription.trim() || undefined,
        icon: profileIcon.trim() || undefined,
        accentColor: profileAccentColor || undefined,
        accentPalette: activePalette || undefined,
        email: user?.email ?? undefined,
        image: user?.image ?? undefined,
      });
      toast.success(ts("profile.saved"));
    } catch {
      toast.error(ts("profile.saving").replace("...", " failed"));
    } finally {
      setIsSaving(false);
    }
  };

  const themes = [
    { id: "light", icon: Sun },
    { id: "dark", icon: Moon },
    { id: "system", icon: Monitor },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">{ts("title")}</h1>
        <p className="text-muted-foreground text-sm mb-8">
          {ts("subtitle")}
        </p>

        <div className="flex flex-col gap-8 md:flex-row">
          {/* Tab nav */}
          <nav className="shrink-0 md:w-48">
            <div className="flex flex-row gap-1 md:flex-col">
              {TABS.map((tab) => {
                const label = ts(`tabs.${tab.id}` as any);
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                      activeTab === tab.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                    )}
                  >
                    <tab.icon className="h-4 w-4 shrink-0" />
                    {label}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Profile */}
            {activeTab === "profile" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">{ts("profile.title")}</h2>
                  <p className="text-sm text-muted-foreground">{ts("profile.subtitle")}</p>
                </div>

                {/* Avatar preview */}
                <div className="flex items-center gap-4 p-5 rounded-xl border bg-card">
                  <div
                    className="relative h-16 w-16 shrink-0 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-sm"
                    style={{
                      background: profileAccentColor
                        ? `linear-gradient(135deg, ${profileAccentColor}cc, ${profileAccentColor})`
                        : "linear-gradient(135deg, #f76c5e, #f76c5ecc)",
                    }}
                  >
                    {profileIcon ? (
                      <span className="text-2xl">{profileIcon}</span>
                    ) : (
                      <span>{(profileName || user?.name || "U")[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{profileName || user?.name || "User"}</p>
                    <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                    {profileDescription && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{profileDescription}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-5">
                  {/* Basic info */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">{ts("profile.displayName")}</Label>
                      <Input
                        id="name"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder={ts("profile.namePlaceholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">{ts("profile.role")}</Label>
                      <Input
                        id="role"
                        value={profileRole}
                        onChange={(e) => setProfileRole(e.target.value)}
                        placeholder={ts("profile.rolePlaceholder")}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">{ts("profile.email")}</Label>
                    <Input id="email" value={user?.email ?? ""} disabled className="opacity-60" />
                    <p className="text-xs text-muted-foreground">{ts("profile.emailNote")}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">{ts("profile.bio")}</Label>
                    <textarea
                      id="description"
                      value={profileDescription}
                      onChange={(e) => setProfileDescription(e.target.value)}
                      placeholder={ts("profile.bioPlaceholder")}
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    />
                  </div>

                  {/* Emoji icon */}
                  <div className="space-y-2">
                    <Label>{ts("profile.icon")}</Label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {EMOJI_SUGGESTIONS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => setProfileIcon(profileIcon === e ? "" : e)}
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-all hover:scale-110",
                            profileIcon === e ? "border-primary bg-primary/10 scale-110" : "hover:border-primary/40",
                          )}
                        >
                          {e}
                        </button>
                      ))}
                      <Input
                        value={profileIcon}
                        onChange={(e) => setProfileIcon(e.target.value)}
                        placeholder={ts("profile.iconPlaceholder")}
                        className="h-9 w-36 text-sm"
                        maxLength={4}
                      />
                    </div>
                  </div>

                  {/* Accent colour */}
                  <div className="space-y-2">
                    <Label>{ts("profile.accentColor")}</Label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {PROFILE_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setProfileAccentColor(c)}
                          className={cn(
                            "h-7 w-7 rounded-full border-2 transition-all hover:scale-110",
                            profileAccentColor === c ? "border-foreground scale-110" : "border-transparent",
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <input
                        type="color"
                        value={profileAccentColor}
                        onChange={(e) => setProfileAccentColor(e.target.value)}
                        className="h-7 w-7 rounded-full cursor-pointer border-0 bg-transparent p-0"
                        title={ts("profile.customColor")}
                      />
                    </div>
                  </div>

                  <Button onClick={handleSaveProfile} disabled={isSaving} size="sm">
                    {isSaving ? ts("profile.saving") : ts("profile.saveChanges")}
                  </Button>
                </div>
              </div>
            )}

            {/* Appearance */}
            {activeTab === "appearance" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">{ts("appearance.title")}</h2>
                  <p className="text-sm text-muted-foreground">{ts("appearance.subtitle")}</p>
                </div>

                <div className="space-y-3">
                  <Label>{ts("appearance.theme")}</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {themes.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={cn(
                          "relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-all",
                          theme === t.id
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "hover:border-primary/30",
                        )}
                      >
                        <t.icon className="h-5 w-5" />
                        <span className="text-sm font-medium">{ts(`appearance.themes.${t.id}` as any)}</span>
                        {theme === t.id && (
                          <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-2.5 w-2.5" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Accent colour palette */}
                <div className="space-y-3">
                  <div>
                    <Label>{ts("appearance.accentColor")}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{ts("appearance.accentColorDesc")}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {ACCENT_PALETTES.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setActivePalette(p.id);
                          applyPalette(p.id);
                          upsertProfile({ accentPalette: p.id });
                        }}
                        className={cn(
                          "relative flex items-center gap-2.5 rounded-xl border px-3 py-3 transition-all",
                          activePalette === p.id
                            ? "border-foreground bg-accent shadow-sm"
                            : "hover:border-primary/30",
                        )}
                      >
                        <div className="h-5 w-5 rounded-full shrink-0" style={{ backgroundColor: p.hex }} />
                        <span className="text-sm font-medium">{ts(`appearance.palettes.${p.id}` as any)}</span>
                        {activePalette === p.id && (
                          <div className="absolute top-1.5 right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-foreground text-background">
                            <Check className="h-2 w-2" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Notifications */}
            {activeTab === "notifications" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">{ts("tabs.notifications")}</h2>
                  <p className="text-sm text-muted-foreground">{ts("notifications.subtitle")}</p>
                </div>

                {/* Due-date alerts */}
                <div className="rounded-xl border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{ts("notifications.dueDateReminders")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{ts("notifications.dueDateDesc")}</p>
                    </div>
                    <button
                      onClick={() => {
                        const next = !alertsEnabled;
                        setAlertsEnabled(next);
                        upsertProfile({ dueDateAlertsEnabled: next });
                      }}
                      className={cn(
                        "flex h-5 w-9 cursor-pointer items-center rounded-full p-0.5 transition-colors",
                        alertsEnabled ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                    >
                      <div className={cn(
                        "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                        alertsEnabled ? "translate-x-4" : "translate-x-0",
                      )} />
                    </button>
                  </div>

                  {alertsEnabled && (
                    <div className="flex items-center gap-3 pt-1 border-t">
                      <p className="text-sm text-muted-foreground flex-1">{ts("notifications.alertMeBefore")}</p>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 5, 7].map((days) => (
                          <button
                            key={days}
                            onClick={() => { setAlertDays(days); upsertProfile({ dueDateAlertDays: days }); }}
                            className={cn(
                              "h-7 min-w-[28px] rounded-md border px-2 text-xs font-medium transition-all",
                              alertDays === days
                                ? "bg-primary text-primary-foreground border-primary"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {days}d
                          </button>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">{ts("notifications.beforeDueDate")}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {[
                    { label: ts("notifications.taskAssignments"), desc: ts("notifications.taskAssignmentsDesc") },
                    { label: ts("notifications.taskComments"), desc: ts("notifications.taskCommentsDesc") },
                    { label: ts("notifications.teamInvitations"), desc: ts("notifications.teamInvitationsDesc") },
                    { label: ts("notifications.mentions"), desc: ts("notifications.mentionsDesc") },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-xl border p-4">
                      <div>
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <div className="flex h-5 w-9 cursor-pointer items-center rounded-full bg-primary p-0.5">
                        <div className="h-4 w-4 translate-x-4 rounded-full bg-white shadow-sm" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Language */}
            {activeTab === "language" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">{ts("tabs.language")}</h2>
                  <p className="text-sm text-muted-foreground">{ts("language.subtitle")}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { id: "fr", label: "Français", flag: "🇫🇷" },
                    { id: "en", label: "English", flag: "🇬🇧" },
                  ] as const).map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => { setLocale(lang.id); toast.success(ts("language.saved")); }}
                      className={cn(
                        "relative flex items-center gap-3 rounded-xl border p-4 transition-all text-left",
                        locale === lang.id
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "hover:border-primary/30",
                      )}
                    >
                      <span className="text-2xl">{lang.flag}</span>
                      <span className="text-sm font-medium">{lang.label}</span>
                      {locale === lang.id && (
                        <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-2.5 w-2.5" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Shortcuts */}
            {activeTab === "shortcuts" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">{ts("shortcuts.title")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {ts("shortcuts.subtitle")}{" "}<kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">?</kbd>
                  </p>
                </div>
                <div className="space-y-6">
                  {shortcuts.map((section) => (
                    <div key={section.section}>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{section.section}</h3>
                      <div className="rounded-xl border divide-y">
                        {section.items.map((item) => (
                          <div key={item.desc} className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-sm">{item.desc}</span>
                            <div className="flex items-center gap-1">
                              {item.keys.map((k) => (
                                <kbd key={k} className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border bg-muted px-1.5 text-[11px] font-mono font-medium">{k}</kbd>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Import */}
            {activeTab === "import" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">{ts("import.title")}</h2>
                  <p className="text-sm text-muted-foreground">{ts("import.subtitle")}</p>
                </div>

                <div className="rounded-xl border p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Upload className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{ts("import.fromNotion")}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{ts("import.fromNotionDesc")}</p>
                      <Button
                        onClick={() => setShowImport(true)}
                        size="sm"
                        className="gap-1.5"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {ts("import.importFiles")}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ImportModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
