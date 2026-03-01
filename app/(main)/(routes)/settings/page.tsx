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

const SHORTCUTS = [
  { section: "Search & Navigation", items: [
    { keys: ["⌘", "K"], desc: "Open command palette" },
    { keys: ["Esc"], desc: "Close / Cancel" },
    { keys: ["↑↓"], desc: "Navigate results" },
    { keys: ["↵"], desc: "Select result" },
  ]},
  { section: "Editor", items: [
    { keys: ["/"], desc: "Insert block" },
    { keys: ["⌘", "B"], desc: "Bold" },
    { keys: ["⌘", "I"], desc: "Italic" },
    { keys: ["⌘", "E"], desc: "Inline code" },
    { keys: ["⌘", "Z"], desc: "Undo" },
    { keys: ["⌘", "Shift", "Z"], desc: "Redo" },
  ]},
  { section: "Tasks", items: [
    { keys: ["Enter"], desc: "Create task (inline add)" },
    { keys: ["Esc"], desc: "Cancel inline add" },
  ]},
];

export default function SettingsPage() {
  const ts = useTranslations("settings");
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
  const [isSaving, setIsSaving] = useState(false);
  const [nameInit, setNameInit] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [alertDays, setAlertDays] = useState(3);
  const alertInitRef = useRef(false);

  if (profile && !nameInit) {
    setProfileName(profile.name ?? user?.name ?? "");
    setProfileRole(profile.role ?? "");
    setNameInit(true);
  }
  if (profile && !alertInitRef.current) {
    alertInitRef.current = true;
    setAlertsEnabled(profile.dueDateAlertsEnabled ?? true);
    setAlertDays(profile.dueDateAlertDays ?? 3);
  }

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await upsertProfile({
        name: profileName.trim(),
        role: profileRole.trim() || undefined,
        email: user?.email ?? undefined,
        image: user?.image ?? undefined,
      });
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const themes = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Settings</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Manage your account preferences and workspace settings.
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
                  <h2 className="text-lg font-semibold mb-1">Profile</h2>
                  <p className="text-sm text-muted-foreground">
                    Manage your personal information.
                  </p>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl border bg-card">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={user?.image ?? undefined} />
                    <AvatarFallback className="text-lg font-semibold">
                      {user?.name?.[0]?.toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{user?.name ?? "User"}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input
                      id="name"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={user?.email ?? ""}
                      disabled
                      className="opacity-60"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email is managed by your auth provider.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role / Title</Label>
                    <Input
                      id="role"
                      value={profileRole}
                      onChange={(e) => setProfileRole(e.target.value)}
                      placeholder="e.g. Designer, Developer, PM"
                    />
                  </div>
                  <Button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    size="sm"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            )}

            {/* Appearance */}
            {activeTab === "appearance" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Appearance</h2>
                  <p className="text-sm text-muted-foreground">
                    Customize how A2E Thread looks.
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Theme</Label>
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
                        <span className="text-sm font-medium">{t.label}</span>
                        {theme === t.id && (
                          <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-2.5 w-2.5" />
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
                  <h2 className="text-lg font-semibold mb-1">Notifications</h2>
                  <p className="text-sm text-muted-foreground">Configure how you receive notifications.</p>
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
                    { label: "Task assignments", desc: "When someone assigns a task to you" },
                    { label: "Task comments", desc: "When someone comments on your tasks" },
                    { label: "Team invitations", desc: "When you're invited to join a team" },
                    { label: "Mentions", desc: "When someone @mentions you" },
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
                  <h2 className="text-lg font-semibold mb-1">Language</h2>
                  <p className="text-sm text-muted-foreground">
                    Choose the language for the interface.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { id: "fr", label: "Français", flag: "🇫🇷" },
                    { id: "en", label: "English", flag: "🇬🇧" },
                  ] as const).map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => { setLocale(lang.id); toast.success("Language saved!"); }}
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
                  <h2 className="text-lg font-semibold mb-1">Keyboard Shortcuts</h2>
                  <p className="text-sm text-muted-foreground">
                    Speed up your workflow with these keyboard shortcuts. Press <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">?</kbd> anywhere to open this reference.
                  </p>
                </div>
                <div className="space-y-6">
                  {SHORTCUTS.map((section) => (
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
                  <h2 className="text-lg font-semibold mb-1">
                    Import & Export
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Import notes from Notion or other tools.
                  </p>
                </div>

                <div className="rounded-xl border p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Upload className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">
                        Import from Notion
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Export your Notion workspace as HTML files, then import
                        them here. Your page structure and content will be
                        preserved.
                      </p>
                      <Button
                        onClick={() => setShowImport(true)}
                        size="sm"
                        className="gap-1.5"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Import Files
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
