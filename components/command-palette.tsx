"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  CheckSquare,
  Circle,
  FileText,
  FolderKanban,
  Hash,
  Home,
  Inbox,
  Loader2,
  Plus,
  Search,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ElementType;
  iconColor?: string;
  action: () => void;
  section: string;
  keywords?: string;
}

let globalOpen: ((v: boolean) => void) | null = null;

export function openCommandPalette() {
  globalOpen?.(true);
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const createDoc = useMutation(api.documents.create);
  const createTask = useMutation(api.tasks.create);

  const docs = useQuery(api.documents.getSidebar, { parentDocument: undefined });
  const tasks = useQuery(api.tasks.getMyTasks, {});
  const projects = useQuery(api.projects.getMyProjects, {});
  const teams = useQuery(api.teams.getMyTeams);

  globalOpen = setOpen;

  // Ensure the document body can receive keyboard events without a click
  useEffect(() => {
    if (typeof document !== "undefined" && !document.body.getAttribute("tabindex")) {
      document.body.setAttribute("tabindex", "-1");
      document.body.style.outline = "none";
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K — toggle palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => {
          if (!prev) { setQuery(""); setSelectedIdx(0); }
          return !prev;
        });
        return;
      }
      // Escape — close
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setSelectedIdx(0);
      // Double-rAF ensures the DOM is painted and focus works reliably
      requestAnimationFrame(() => requestAnimationFrame(() => inputRef.current?.focus()));
    }
  }, [open]);

  const navItems: CommandItem[] = useMemo(
    () => [
      { id: "home", label: "Home", icon: Home, action: () => router.push("/documents"), section: "Navigate", keywords: "dashboard accueil" },
      { id: "tasks", label: "My Tasks", icon: CheckSquare, action: () => router.push("/tasks"), section: "Navigate", keywords: "tâches" },
      { id: "calendar", label: "Calendar", icon: CalendarDays, action: () => router.push("/calendar"), section: "Navigate", keywords: "calendrier agenda" },
      { id: "inbox", label: "Inbox", icon: Inbox, action: () => router.push("/inbox"), section: "Navigate", keywords: "boite reception notifications" },
      { id: "projects-nav", label: "Projects", icon: FolderKanban, action: () => router.push("/projects"), section: "Navigate", keywords: "projets" },
      { id: "teams-nav", label: "Teams", icon: Users, action: () => router.push("/teams"), section: "Navigate", keywords: "équipes" },
      { id: "settings", label: "Settings", icon: Settings, action: () => router.push("/settings"), section: "Navigate", keywords: "paramètres" },
    ],
    [router],
  );

  const createItems: CommandItem[] = useMemo(
    () => [
      {
        id: "new-note",
        label: "New Note",
        icon: Plus,
        iconColor: "text-emerald-500",
        action: async () => {
          setCreating(true);
          try {
            const id = await createDoc({ title: "Untitled" });
            setOpen(false);
            router.push(`/documents/${id}`);
          } catch { toast.error("Failed to create note"); }
          finally { setCreating(false); }
        },
        section: "Create",
        keywords: "note page document",
      },
      {
        id: "new-task",
        label: "New Task",
        icon: Plus,
        iconColor: "text-blue-500",
        action: async () => {
          if (!query.trim()) { setOpen(false); router.push("/tasks"); return; }
          setCreating(true);
          try {
            await createTask({ title: query.trim(), priority: "none" });
            toast.success(`Task "${query}" created`);
            setOpen(false);
            setQuery("");
          } catch { toast.error("Failed to create task"); }
          finally { setCreating(false); }
        },
        section: "Create",
        keywords: "tâche task todo",
      },
    ],
    [createDoc, createTask, router, query],
  );

  const docItems: CommandItem[] = useMemo(
    () =>
      (docs ?? []).map((d) => ({
        id: `doc-${d._id}`,
        label: d.title || "Untitled",
        sublabel: "Note",
        icon: FileText,
        iconColor: "text-muted-foreground",
        action: () => router.push(`/documents/${d._id}`),
        section: "Notes",
        keywords: d.title ?? "",
      })),
    [docs, router],
  );

  const taskItems: CommandItem[] = useMemo(
    () =>
      (tasks ?? [])
        .filter((t) => t.status !== "done" && t.status !== "cancelled")
        .map((t) => ({
          id: `task-${t._id}`,
          label: t.title,
          sublabel: t.status.replace("_", " "),
          icon: Circle,
          iconColor: t.status === "in_progress" ? "text-blue-500" : "text-muted-foreground",
          action: () => router.push(`/tasks/${t._id}`),
          section: "Tasks",
          keywords: t.title,
        })),
    [tasks, router],
  );

  const projectItems: CommandItem[] = useMemo(
    () =>
      (projects ?? []).filter(Boolean).map((p) => ({
        id: `proj-${p!._id}`,
        label: p!.name,
        sublabel: p!.status,
        icon: FolderKanban,
        iconColor: "text-violet-500",
        action: () => router.push(`/projects/${p!._id}`),
        section: "Projects",
        keywords: p!.name,
      })),
    [projects, router],
  );

  const teamItems: CommandItem[] = useMemo(
    () =>
      (teams ?? []).filter(Boolean).map((t: any) => ({
        id: `team-${t._id}`,
        label: t.name,
        sublabel: "Team",
        icon: Users,
        iconColor: "text-amber-500",
        action: () => router.push(`/teams/${t._id}`),
        section: "Teams",
        keywords: t.name,
      })),
    [teams, router],
  );

  const allItems = useMemo(
    () => [...createItems, ...navItems, ...docItems, ...taskItems, ...projectItems, ...teamItems],
    [createItems, navItems, docItems, taskItems, projectItems, teamItems],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      return [
        ...createItems,
        ...navItems,
        ...taskItems.slice(0, 5),
        ...docItems.slice(0, 5),
      ];
    }
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.sublabel?.toLowerCase().includes(q) ?? false) ||
        (item.keywords?.toLowerCase().includes(q) ?? false),
    );
  }, [query, allItems, createItems, navItems, taskItems, docItems]);

  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    filtered.forEach((item) => {
      if (!map.has(item.section)) map.set(item.section, []);
      map.get(item.section)!.push(item);
    });
    return map;
  }, [filtered]);

  const flatFiltered = useMemo(() => filtered, [filtered]);

  const execute = useCallback(
    (item: CommandItem) => {
      setOpen(false);
      setQuery("");
      item.action();
    },
    [],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, flatFiltered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const item = flatFiltered[selectedIdx];
        if (item) execute(item);
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [open, flatFiltered, selectedIdx, execute]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  if (!open) return null;

  let flatIdx = 0;

  return (
    <div
      className="fixed inset-0 z-200000 flex items-start justify-center pt-[15vh]"
      onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-xl mx-4 rounded-2xl border bg-background shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          {creating ? (
            <Loader2 className="h-4 w-4 text-muted-foreground shrink-0 animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or type a command..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border bg-muted px-1.5 text-[10px] font-mono text-muted-foreground">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto py-2">
          {flatFiltered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <Sparkles className="h-8 w-8 opacity-20" />
              <p className="text-sm">No results for &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            Array.from(grouped.entries()).map(([section, items]) => (
              <div key={section}>
                <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  {section}
                </p>
                {items.map((item) => {
                  const idx = flatIdx++;
                  const isSelected = idx === selectedIdx;
                  return (
                    <button
                      key={item.id}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      onMouseDown={() => execute(item)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                      )}
                    >
                      <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background", item.iconColor)}>
                        <item.icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.label}</p>
                        {item.sublabel && (
                          <p className="text-[11px] text-muted-foreground capitalize">{item.sublabel}</p>
                        )}
                      </div>
                      {isSelected && (
                        <kbd className="text-[10px] font-mono text-muted-foreground border rounded px-1.5 py-0.5">
                          ↵
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground/60">
          <span className="flex items-center gap-1"><kbd className="font-mono border rounded px-1">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="font-mono border rounded px-1">↵</kbd> select</span>
          <span className="flex items-center gap-1"><kbd className="font-mono border rounded px-1">esc</kbd> close</span>
          <span className="ml-auto flex items-center gap-1">
            <Hash className="h-3 w-3" />
            {flatFiltered.length} results
          </span>
        </div>
      </div>
    </div>
  );
}
