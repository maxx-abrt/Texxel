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
  Puzzle,
  LayoutGrid,
  GanttChart,
  CalendarDays,
  Clock,
  Eye,
  EyeOff,
  FileText,
  FolderKanban,
  Lock,
  Sparkles,
  Unlock,
  Zap,
  Settings2,
  Columns3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ImportModal } from "@/components/modals/ImportModal";
import { useLocale } from "@/components/providers/locale-provider";
import { useSearchParams } from "next/navigation";
import { useExtensions } from "@/hooks/useExtensions";
import { useTranslations } from "next-intl";

const TABS = [
  { id: "profile", icon: User },
  { id: "appearance", icon: Palette },
  { id: "notifications", icon: Bell },
  { id: "language", icon: Globe },
  { id: "extensions", icon: Puzzle },
  { id: "aiSettings", icon: Sparkles },
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

const EXT_ICONS: Record<string, React.ElementType> = {
  kanban: LayoutGrid,
  gantt: GanttChart,
  retroPlanning: CalendarDays,
  aiAssistant: Sparkles,
  calendar: CalendarDays,
  timeTracking: Clock,
  customFields: Columns3,
  automations: Zap,
};

function ExtensionsPanel() {
  const te = useTranslations("extensions");
  const { getExtensions, getUIConfig, toggleExtension, updateUIConfig } = useExtensions();
  const extensions = getExtensions();
  const uiConfig = getUIConfig();
  const [filterCat, setFilterCat] = useState<string>("all");

  const categories = ["all", "productivity", "visualization", "collaboration", "ai"] as const;
  const filtered = filterCat === "all" ? extensions : extensions.filter((e) => e.category === filterCat);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">{te("title")}</h2>
        <p className="text-sm text-muted-foreground">{te("subtitle")}</p>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium border transition-all",
              filterCat === cat
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30",
            )}
          >
            {te(`categories.${cat}` as any)}
          </button>
        ))}
      </div>

      {/* Extensions grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((ext) => {
          const Icon = EXT_ICONS[ext.id] ?? Puzzle;
          return (
            <div
              key={ext.id}
              className={cn(
                "rounded-xl border p-4 transition-all",
                ext.enabled ? "border-primary/30 bg-primary/5" : "hover:border-primary/20",
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                  ext.enabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">{te(`items.${ext.id}.name` as any)}</h3>
                    <button
                      onClick={() => toggleExtension(ext.id)}
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
                        ext.enabled ? "bg-primary" : "bg-muted",
                      )}
                    >
                      <span className={cn(
                        "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform mt-0.5",
                        ext.enabled ? "translate-x-4 ml-0.5" : "translate-x-0.5",
                      )} />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{te(`items.${ext.id}.desc` as any)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Appearance & Layout ─────────────────────────────────────── */}
      <div className="border-t pt-6 space-y-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/60">{te("uiConfig.title")}</h3>

        {/* Font family */}
        <div className="space-y-2.5">
          <div>
            <p className="text-sm font-medium">{te("uiConfig.fontFamily")}</p>
            <p className="text-xs text-muted-foreground">{te("uiConfig.fontFamilyDesc")}</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(["system", "inter", "mono", "serif"] as const).map((f) => (
              <button
                key={f}
                onClick={() => updateUIConfig({ fontFamily: f })}
                className={cn(
                  "rounded-xl border p-3 text-center transition-all",
                  uiConfig.fontFamily === f
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "hover:border-primary/30",
                )}
              >
                <span className={cn(
                  "block text-lg leading-none mb-1.5",
                  f === "mono" && "font-mono",
                  f === "serif" && "font-serif",
                  f === "inter" && "font-[Inter,sans-serif]",
                )}>Aa</span>
                <span className="text-[10px] font-medium text-muted-foreground">
                  {te(`uiConfig.fonts.${f}` as any)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Font size */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{te("uiConfig.fontSize")}</p>
            <p className="text-xs text-muted-foreground">{te("uiConfig.fontSizeDesc")}</p>
          </div>
          <div className="flex gap-0.5 rounded-lg border p-0.5">
            {(["sm", "base", "lg"] as const).map((size) => (
              <button
                key={size}
                onClick={() => updateUIConfig({ fontSize: size })}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-all",
                  uiConfig.fontSize === size ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {size === "sm" ? "S" : size === "base" ? "M" : "L"}
              </button>
            ))}
          </div>
        </div>

        {/* Editor width */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{te("uiConfig.editorWidth")}</p>
            <p className="text-xs text-muted-foreground">{te("uiConfig.editorWidthDesc")}</p>
          </div>
          <div className="flex gap-0.5 rounded-lg border p-0.5">
            {(["default", "wide", "full"] as const).map((w) => (
              <button
                key={w}
                onClick={() => updateUIConfig({ editorWidth: w })}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                  uiConfig.editorWidth === w ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {te(`uiConfig.editorWidths.${w}` as any)}
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar width presets */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{te("uiConfig.sidebarWidth")}</p>
            <p className="text-xs text-muted-foreground">{te("uiConfig.sidebarWidthDesc")}</p>
          </div>
          <div className="flex gap-0.5 rounded-lg border p-0.5">
            {([
              { value: 220, label: "S" },
              { value: 252, label: "M" },
              { value: 300, label: "L" },
              { value: 360, label: "XL" },
            ] as const).map((preset) => (
              <button
                key={preset.value}
                onClick={() => updateUIConfig({ sidebarWidth: preset.value })}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                  uiConfig.sidebarWidth === preset.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Default views */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{te("uiConfig.defaultTaskView")}</p>
            <p className="text-xs text-muted-foreground">{te("uiConfig.defaultTaskViewDesc")}</p>
          </div>
          <div className="flex gap-0.5 rounded-lg border p-0.5">
            {(["list", "board"] as const).map((view) => (
              <button
                key={view}
                onClick={() => updateUIConfig({ defaultTaskView: view })}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-all capitalize",
                  uiConfig.defaultTaskView === view ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {view}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{te("uiConfig.defaultProjectView")}</p>
            <p className="text-xs text-muted-foreground">{te("uiConfig.defaultProjectViewDesc")}</p>
          </div>
          <div className="flex gap-0.5 rounded-lg border p-0.5">
            {(["board", "list", "gantt"] as const).map((view) => (
              <button
                key={view}
                onClick={() => updateUIConfig({ defaultProjectView: view })}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-all capitalize",
                  uiConfig.defaultProjectView === view ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {view}
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3 border-t pt-4">
          {/* Compact mode */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{te("uiConfig.compactMode")}</p>
              <p className="text-xs text-muted-foreground">{te("uiConfig.compactModeDesc")}</p>
            </div>
            <button
              onClick={() => updateUIConfig({ compactMode: !uiConfig.compactMode })}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
                uiConfig.compactMode ? "bg-primary" : "bg-muted",
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform mt-0.5",
                uiConfig.compactMode ? "translate-x-4 ml-0.5" : "translate-x-0.5",
              )} />
            </button>
          </div>

          {/* Word count */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{te("uiConfig.showWordCount")}</p>
              <p className="text-xs text-muted-foreground">{te("uiConfig.showWordCountDesc")}</p>
            </div>
            <button
              onClick={() => updateUIConfig({ showWordCount: !uiConfig.showWordCount })}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
                uiConfig.showWordCount ? "bg-primary" : "bg-muted",
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform mt-0.5",
                uiConfig.showWordCount ? "translate-x-4 ml-0.5" : "translate-x-0.5",
              )} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AiSettingsPanel() {
  const ta = useTranslations("ai");
  const ts = useTranslations("settings");
  const { getAiAccess, updateAiAccess, isEnabled: extEnabled } = useExtensions();
  const aiAccess = getAiAccess();
  const recentDocs = useQuery(api.documents.getSidebar, { parentDocument: undefined });
  const myProjects = useQuery(api.projects.getMyProjects, {});

  const isRestricted = aiAccess.scope === "restricted";
  const allowedDocs = new Set(aiAccess.allowedDocumentIds);
  const allowedProjects = new Set(aiAccess.allowedProjectIds);

  const toggleDoc = (id: string) => {
    const next = new Set(allowedDocs);
    if (next.has(id)) next.delete(id); else next.add(id);
    updateAiAccess({ allowedDocumentIds: Array.from(next) });
  };

  const toggleProject = (id: string) => {
    const next = new Set(allowedProjects);
    if (next.has(id)) next.delete(id); else next.add(id);
    updateAiAccess({ allowedProjectIds: Array.from(next) });
  };

  const selectAllDocs = () => updateAiAccess({ allowedDocumentIds: (recentDocs ?? []).map((d) => d._id) });
  const clearAllDocs = () => updateAiAccess({ allowedDocumentIds: [] });
  const selectAllProjects = () => updateAiAccess({ allowedProjectIds: (myProjects ?? []).filter(Boolean).map((p) => p!._id) });
  const clearAllProjects = () => updateAiAccess({ allowedProjectIds: [] });

  if (!extEnabled("aiAssistant")) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-1">{ta("title")}</h2>
          <p className="text-sm text-muted-foreground">{ts("tabs.aiSettings")}</p>
        </div>
        <div className="rounded-xl border p-6 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{ts("aiSettings.enableFirst")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">{ta("title")}</h2>
        <p className="text-sm text-muted-foreground">{ts("aiSettings.subtitle")}</p>
      </div>

      {/* Scope toggle */}
      <div className="rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isRestricted ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                <Lock className="h-4 w-4 text-amber-500" />
              </div>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <Unlock className="h-4 w-4 text-emerald-500" />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold">
                {isRestricted ? ts("aiSettings.restricted") : ts("aiSettings.fullAccess")}
              </p>
              <p className="text-xs text-muted-foreground">
                {isRestricted ? ts("aiSettings.restrictedDesc") : ts("aiSettings.fullAccessDesc")}
              </p>
            </div>
          </div>
          <button
            onClick={() => updateAiAccess({ scope: isRestricted ? "all" : "restricted" })}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
              isRestricted ? "bg-amber-500" : "bg-emerald-500",
            )}
          >
            <span className={cn(
              "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform mt-0.5",
              isRestricted ? "translate-x-0.5" : "translate-x-4 ml-0.5",
            )} />
          </button>
        </div>
      </div>

      {/* Restricted mode: pick notes & projects */}
      {isRestricted && (
        <>
          {/* Notes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{ts("aiSettings.allowedNotes")}</h3>
                <span className="text-xs text-muted-foreground">({allowedDocs.size}/{(recentDocs ?? []).length})</span>
              </div>
              <div className="flex gap-1">
                <button onClick={selectAllDocs} className="text-[10px] text-primary hover:underline font-medium">{ts("aiSettings.selectAll")}</button>
                <span className="text-muted-foreground/30 text-[10px]">·</span>
                <button onClick={clearAllDocs} className="text-[10px] text-muted-foreground hover:underline font-medium">{ts("aiSettings.clearAll")}</button>
              </div>
            </div>
            <div className="rounded-xl border divide-y max-h-52 overflow-y-auto">
              {(recentDocs ?? []).length === 0 && (
                <p className="px-4 py-3 text-xs text-muted-foreground">{ts("aiSettings.noNotes")}</p>
              )}
              {(recentDocs ?? []).map((doc) => {
                const checked = allowedDocs.has(doc._id);
                return (
                  <button
                    key={doc._id}
                    onClick={() => toggleDoc(doc._id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/30",
                      checked && "bg-primary/5",
                    )}
                  >
                    <div className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                      checked ? "bg-primary border-primary" : "border-muted-foreground/30",
                    )}>
                      {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </div>
                    <span className="text-sm truncate">{doc.icon ? `${doc.icon} ` : ""}{doc.title}</span>
                    {checked ? <Eye className="h-3 w-3 ml-auto text-primary shrink-0" /> : <EyeOff className="h-3 w-3 ml-auto text-muted-foreground/30 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Projects */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{ts("aiSettings.allowedProjects")}</h3>
                <span className="text-xs text-muted-foreground">({allowedProjects.size}/{(myProjects ?? []).length})</span>
              </div>
              <div className="flex gap-1">
                <button onClick={selectAllProjects} className="text-[10px] text-primary hover:underline font-medium">{ts("aiSettings.selectAll")}</button>
                <span className="text-muted-foreground/30 text-[10px]">·</span>
                <button onClick={clearAllProjects} className="text-[10px] text-muted-foreground hover:underline font-medium">{ts("aiSettings.clearAll")}</button>
              </div>
            </div>
            <div className="rounded-xl border divide-y max-h-52 overflow-y-auto">
              {(myProjects ?? []).length === 0 && (
                <p className="px-4 py-3 text-xs text-muted-foreground">{ts("aiSettings.noProjects")}</p>
              )}
              {(myProjects ?? []).filter(Boolean).map((proj) => {
                const checked = allowedProjects.has(proj!._id);
                return (
                  <button
                    key={proj!._id}
                    onClick={() => toggleProject(proj!._id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/30",
                      checked && "bg-primary/5",
                    )}
                  >
                    <div className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                      checked ? "bg-primary border-primary" : "border-muted-foreground/30",
                    )}>
                      {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </div>
                    <div
                      className="h-3 w-3 rounded shrink-0"
                      style={{ backgroundColor: (proj as any)?.color ?? "#6366f1" }}
                    />
                    <span className="text-sm truncate">{proj!.name}</span>
                    {checked ? <Eye className="h-3 w-3 ml-auto text-primary shrink-0" /> : <EyeOff className="h-3 w-3 ml-auto text-muted-foreground/30 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-muted-foreground/60 leading-relaxed">
            {ts("aiSettings.restrictedHint")}
          </p>
        </>
      )}
    </div>
  );
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

            {/* Extensions */}
            {activeTab === "extensions" && <ExtensionsPanel />}

            {/* AI Settings */}
            {activeTab === "aiSettings" && <AiSettingsPanel />}

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
