"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { Id } from "@/convex/_generated/dataModel";
import { DocumentTree } from "@/components/app/document-tree";
import { usePersistedState } from "@/hooks/use-sidebar-prefs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useTrashDnd } from "@/components/providers/dnd-trash-provider";
import { TemplatePickerDialog } from "@/components/app/template-picker-dialog";
import { useTranslations } from "next-intl";
import {
  Element3,
  Chart2,
  DocumentText,
  TaskSquare,
  Briefcase,
  Calendar,
  Data2,
  Notification,
  Profile2User,
  Setting2,
  Trash,
  SearchNormal1,
  Add,
  ArrowDown2,
  ArrowRight2,
  CloseCircle,
  Folder,
  Messages3,
  SidebarLeft,
} from "iconsax-reactjs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const NAV_KEYS = [
  { href: "/app", key: "home", Icon: Element3, exact: true },
  { href: "/app/tasks", key: "tasks", Icon: TaskSquare },
  { href: "/app/projects", key: "projects", Icon: Briefcase },
  { href: "/app/discussions", key: "discussions", Icon: Messages3 },
  { href: "/app/calendar", key: "calendar", Icon: Calendar },
  { href: "/app/analytics", key: "analytics", Icon: Chart2 },
  { href: "/app/databases", key: "databases", Icon: Data2 },
  { href: "/app/inbox", key: "inbox", Icon: Notification },
  { href: "/app/members", key: "members", Icon: Profile2User },
];

const MIN_W = 224;
const MAX_W = 400;

export function Sidebar({
  mobileOpen,
  onClose,
  onSearch,
  collapsed,
  setCollapsed,
}: {
  mobileOpen: boolean;
  onClose: () => void;
  onSearch: () => void;
  collapsed: boolean;
  setCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { workspaces, activeWorkspace, activeWorkspaceId, setActive } = useWorkspace();
  const docs = useQuery(
    api.flux_documents.list,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );
  const favorites = useQuery(
    api.flux_documents.listFavorites,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );
  const createDoc = useMutation(api.flux_documents.create);
  const createFolder = useMutation(api.flux_documents.createFolder);
  const { isOver, setNodeRef } = useDroppable({ id: "sidebar-trash" });
  // Two root drop targets: the "Private" section header and the tree area itself.
  // (The old extra "sidebar-root-tree" strip was redundant with the area and
  // competed for pointerWithin hits.)
  const { isOver: isOverRoot, setNodeRef: setRootRef } = useDroppable({ id: "sidebar-private-root" });
  const { isOver: isOverRootArea, setNodeRef: setRootAreaRef } = useDroppable({ id: "sidebar-root-area" });
  const { activeDrag } = useTrashDnd();

  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const NAV = NAV_KEYS.map((n) => ({ ...n, label: t(n.key as any) }));

  // ── Persisted layout preferences ──
  const [width, setWidth] = usePersistedState<number>("bureau-sidebar-width", 280);
  const [sections, setSections] = usePersistedState<Record<string, boolean>>("bureau-sidebar-sections", {});
  const [openList, setOpenList] = usePersistedState<string[]>(
    `bureau-tree-open:${activeWorkspaceId ?? "ws"}`,
    [],
  );
  const [resizing, setResizing] = useState(false);
  const openIds = useMemo(() => new Set(openList), [openList]);
  const sectionOpen = (key: string) => sections[key] !== false;
  const toggleSection = (key: string) =>
    setSections((prev) => ({ ...prev, [key]: !(prev[key] !== false) }));
  const onToggleOpen = (id: string, open: boolean) =>
    setOpenList((prev) => (open ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)));

  // ── Active document detection + auto-expand ancestors ──
  const activeDocId = pathname?.startsWith("/app/documents/")
    ? pathname.split("/")[3] ?? null
    : null;
  useEffect(() => {
    if (!activeDocId || !docs?.length) return;
    const byId = new Map(docs.map((d: any) => [String(d._id), d]));
    const toOpen: string[] = [];
    let cursor: any = byId.get(activeDocId);
    let guard = 0;
    while (cursor?.parentId && guard++ < 50) {
      toOpen.push(String(cursor.parentId));
      cursor = byId.get(String(cursor.parentId));
    }
    if (toOpen.length) setOpenList((prev) => Array.from(new Set([...prev, ...toOpen])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocId, docs]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    setResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) =>
      setWidth(Math.min(MAX_W, Math.max(MIN_W, startW + ev.clientX - startX)));
    const onUp = () => {
      setResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const favoriteIds = useMemo(
    () => new Set((favorites ?? []).map((f: any) => String(f._id))),
    [favorites],
  );

  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateParentId, setTemplateParentId] = useState<Id<"flux_documents"> | undefined>();

  const openTemplatePicker = (parentId?: Id<"flux_documents">) => {
    setTemplateParentId(parentId);
    setTemplatePickerOpen(true);
  };

  const createDocFromTemplate = async (opts: { title: string; content?: string; icon?: string; parentId?: Id<"flux_documents"> }) => {
    if (!activeWorkspaceId) return;
    try {
      const id = await createDoc({ workspaceId: activeWorkspaceId, title: opts.title, content: opts.content, icon: opts.icon, parentId: opts.parentId });
      router.push(`/app/documents/${id}`);
    } catch {
      toast.error(tc("createFailed"));
    }
  };

  const onCreate = openTemplatePicker;

  const onCreateFolder = async () => {
    if (!activeWorkspaceId) return;
    try {
      await createFolder({ workspaceId: activeWorkspaceId });
    } catch {
      toast.error(tc("createFailed"));
    }
  };

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onClose} />
      )}
      <aside
        data-testid="app-sidebar"
        data-collapsed={collapsed || undefined}
        style={{ "--sb-w": collapsed ? "0px" : `${width}px` } as React.CSSProperties}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:static md:w-[var(--sb-w)] md:translate-x-0",
          !resizing && "transition-[width,transform] duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed && "md:overflow-hidden md:border-r-0",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col" style={{ minWidth: MIN_W }}>
        {/* Workspace switcher */}
        <div className="flex items-center gap-1 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-testid="workspace-switcher"
                className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-sidebar-accent"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                  {activeWorkspace?.avatar ? (
                    <img src={activeWorkspace.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (activeWorkspace?.name ?? "F").charAt(0).toUpperCase()
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{activeWorkspace?.name ?? t("workspace")}</span>
                  <span className="block truncate text-xs text-muted-foreground">{activeWorkspace?.role ?? ""} · {t("memberCount", { count: activeWorkspace?.memberCount ?? 0 })}</span>
                </span>
                <ArrowDown2 variant="Bulk" size={16} className="shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>{t("workspaces")}</DropdownMenuLabel>
              {workspaces.map((w) => (
                <DropdownMenuItem key={w._id} data-testid="workspace-option" onClick={() => setActive(w._id)} className="gap-2">
                  <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-md bg-primary text-xs font-bold text-primary-foreground">{(w as any).avatar ? <img src={(w as any).avatar} alt="" className="h-full w-full object-cover" /> : w.name.charAt(0).toUpperCase()}</span>
                  <span className="flex-1 truncate">{w.name}</span>
                  {w._id === activeWorkspaceId && <span className="h-2 w-2 rounded-full bg-primary" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/app/settings?new=1")} className="gap-2 text-primary">
                <Add variant="Bulk" size={16} /> {t("newWorkspace")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={() => setCollapsed(true)}
            className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground md:flex"
            title={`${t("collapseSidebar")} (\u2318\\)`}
            data-testid="sidebar-collapse-btn"
          >
            <SidebarLeft variant="Bulk" size={17} />
          </button>
          <button className="md:hidden" onClick={onClose}><CloseCircle variant="Bulk" size={20} /></button>
        </div>

        {/* Search */}
        <div className="px-3">
          <button data-testid="sidebar-search" onClick={onSearch} className="flex w-full items-center gap-2 rounded-xl border border-sidebar-border bg-background/60 px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent">
            <SearchNormal1 variant="Bulk" size={18} /> {t("search")}
            <span className="ml-auto rounded-md border border-border px-1.5 text-xs">⌘K</span>
          </button>
        </div>

        <nav className="mt-3 space-y-0.5 px-3">
          {NAV.map(({ href, label, Icon, exact, key }) => {
            const active = isActive(href, exact);
            return (
              <Link key={href} href={href} data-testid={`sidebar-nav-${key}`} onClick={onClose}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors",
                  active ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" : "text-foreground/80 hover:bg-sidebar-accent hover:text-foreground",
                )}>
                {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-primary" />}
                <Icon variant="Bulk" size={19} className={cn("shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-1.5 no-scrollbar">
          {favorites && favorites.length > 0 && (
            <div className="mb-3">
              <button
                onClick={() => toggleSection("favorites")}
                className="group flex w-full items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                data-testid="section-favorites-toggle"
              >
                <span>{t("favorites")}</span>
                <ArrowRight2
                  variant="Bulk"
                  size={12}
                  className={cn("opacity-0 transition-all group-hover:opacity-100", sectionOpen("favorites") && "rotate-90")}
                />
              </button>
              {sectionOpen("favorites") && favorites.map((d: any) => (
                <DraggableFavorite key={d._id} doc={d} onNavigate={onClose} active={activeDocId === String(d._id)} />
              ))}
            </div>
          )}
          <div
            ref={setRootRef}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-1 transition-colors",
              activeDrag && "ring-1 ring-transparent",
              isOverRoot && activeDrag && "bg-primary/10 ring-primary/40",
            )}
          >
            <button
              onClick={() => toggleSection("private")}
              className="group flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
              data-testid="section-private-toggle"
            >
              <span>{t("private")}</span>
              <ArrowRight2
                variant="Bulk"
                size={12}
                className={cn("opacity-0 transition-all group-hover:opacity-100", sectionOpen("private") && "rotate-90")}
              />
            </button>
            <div className="flex items-center">
              <button data-testid="sidebar-new-folder" onClick={onCreateFolder} className="rounded-md p-0.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground" title={t("newFolder")}><Folder variant="Bulk" size={16} /></button>
              <button data-testid="sidebar-new-doc" onClick={() => onCreate()} className="rounded-md p-0.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground" title={t("newPage")}><Add variant="Bulk" size={16} /></button>
            </div>
          </div>
          {sectionOpen("private") && (
            <div
              ref={setRootAreaRef}
              className={cn(
                "mt-0.5 min-h-[3rem] rounded-lg transition-all",
                activeDrag && "border border-dashed border-primary/30 p-0.5",
                isOverRootArea && activeDrag && "bg-primary/[0.07] ring-2 ring-primary/40 border-primary/50",
              )}
            >
              <DocumentTree
                docs={docs ?? []}
                parentId={null}
                onNavigate={onClose}
                onCreateChild={onCreate}
                level={0}
                activeId={activeDocId}
                favoriteIds={favoriteIds}
                openIds={openIds}
                onToggleOpen={onToggleOpen}
              />
              {docs && docs.length === 0 && (
                <button onClick={() => onCreate()} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent">
                  <Add variant="Bulk" size={16} /> {t("newPage")}
                </button>
              )}
              {activeDrag && docs && docs.length === 0 && (
                <div className="flex items-center justify-center gap-1.5 py-3 text-xs text-primary/60">
                  <DocumentText variant="Bulk" size={14} /> {t("moveToRoot")}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-0.5 border-t border-sidebar-border p-3">
          <div
            ref={setNodeRef}
            data-testid="sidebar-trash-drop"
            className={cn(
              "rounded-xl transition-all",
              isOver && "bg-destructive/10 ring-2 ring-destructive/50",
            )}
          >
            <Link
              href="/app/trash"
              onClick={onClose}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all hover:bg-sidebar-accent",
                isActive("/app/trash") && "bg-sidebar-accent font-medium",
                isOver && "scale-105 text-destructive",
              )}
            >
              <Trash variant="Bulk" size={20} className={cn("text-muted-foreground transition-colors", isOver && "text-destructive tx-trash-wobble")} /> {t("trash")}
            </Link>
          </div>
          <Link href="/app/settings" onClick={onClose} className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-sidebar-accent", isActive("/app/settings") && "bg-sidebar-accent font-medium")}>
            <Setting2 variant="Bulk" size={20} className="text-muted-foreground" /> {t("settings")}
          </Link>
        </div>
        </div>
        {/* Resize handle (desktop) */}
        {!collapsed && (
          <div
            onMouseDown={startResize}
            className="absolute inset-y-0 right-0 hidden w-1 cursor-col-resize bg-transparent transition-colors hover:bg-primary/30 active:bg-primary/50 md:block"
            data-testid="sidebar-resize-handle"
          />
        )}
      </aside>
      <TemplatePickerDialog
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        parentId={templateParentId}
        onSelect={createDocFromTemplate}
      />
    </>
  );
}

function DraggableFavorite({ doc, onNavigate, active }: { doc: any; onNavigate: () => void; active?: boolean }) {
  const tc = useTranslations("common");
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `favorite-${doc._id}`,
    data: { documentId: doc._id, title: doc.title, icon: doc.icon, type: "favorite" },
  });
  const { trashingIds } = useTrashDnd();
  const isTrashing = trashingIds.has(doc._id);
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef as any}
      {...attributes}
      {...listeners}
      style={style}
      className={cn(
        "relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-sidebar-accent",
        active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
        isDragging && "z-50 cursor-grabbing opacity-0",
        isTrashing && "pointer-events-none scale-80 translate-y-2 opacity-0 transition-all duration-350",
      )}
    >
      {active && <span className="pointer-events-none absolute inset-y-1 left-0 w-[3px] rounded-full bg-primary" />}
      <Link href={`/app/documents/${doc._id}`} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2">
        <span className="w-4 text-center">{doc.icon ?? "\ud83d\udcc4"}</span>
        <span className="truncate">{doc.title || tc("untitled")}</span>
      </Link>
    </div>
  );
}
