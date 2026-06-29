"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { Id } from "@/convex/_generated/dataModel";
import { DocumentTree } from "@/components/app/document-tree";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useTrashDnd } from "@/components/providers/dnd-trash-provider";
import { useTranslations } from "next-intl";
import {
  Element3,
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
  Star1,
  ArrowDown2,
  CloseCircle,
  Folder,
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
  { href: "/app/documents", key: "documents", Icon: DocumentText },
  { href: "/app/tasks", key: "tasks", Icon: TaskSquare },
  { href: "/app/projects", key: "projects", Icon: Briefcase },
  { href: "/app/calendar", key: "calendar", Icon: Calendar },
  { href: "/app/databases", key: "databases", Icon: Data2 },
  { href: "/app/inbox", key: "inbox", Icon: Notification },
  { href: "/app/members", key: "members", Icon: Profile2User },
];

export function Sidebar({
  mobileOpen,
  onClose,
  onSearch,
}: {
  mobileOpen: boolean;
  onClose: () => void;
  onSearch: () => void;
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
  const { isOver: isOverRoot, setNodeRef: setRootRef } = useDroppable({ id: "sidebar-private-root" });
  const { isOver: isOverRootTree, setNodeRef: setRootTreeRef } = useDroppable({ id: "sidebar-root-tree" });
  const { activeDrag } = useTrashDnd();

  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const tw = useTranslations("settings");
  const NAV = NAV_KEYS.map((n) => ({ ...n, label: t(n.key as any) }));

  const onCreate = async (parentId?: Id<"flux_documents">) => {
    if (!activeWorkspaceId) return;
    try {
      const id = await createDoc({ workspaceId: activeWorkspaceId, title: tc("untitled"), parentId });
      router.push(`/app/documents/${id}`);
    } catch {
      toast.error(tc("createFailed"));
    }
  };

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
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Workspace switcher */}
        <div className="flex items-center gap-2 p-3">
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
          {NAV.map(({ href, label, Icon, exact, key }) => (
            <Link key={href} href={href} data-testid={`sidebar-nav-${key}`} onClick={onClose}
              className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-sidebar-accent", isActive(href, exact) && "bg-sidebar-accent font-medium")}>
              <Icon variant="Bulk" size={20} className={cn("text-muted-foreground", isActive(href, exact) && "text-primary")} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-3 no-scrollbar">
          {favorites && favorites.length > 0 && (
            <div className="mb-3">
              <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("favorites")}</div>
              {favorites.map((d: any) => (
                <DraggableFavorite key={d._id} doc={d} onNavigate={onClose} />
              ))}
            </div>
          )}
          <div
            ref={setRootRef}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-1 transition-colors",
              isOverRoot && "bg-primary/10 ring-1 ring-primary/40",
            )}
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("private")}</span>
            <div className="flex items-center">
              <button data-testid="sidebar-new-folder" onClick={onCreateFolder} className="rounded-md p-0.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground" title={t("newFolder")}><Folder variant="Bulk" size={16} /></button>
              <button data-testid="sidebar-new-doc" onClick={() => onCreate()} className="rounded-md p-0.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground" title={t("newPage")}><Add variant="Bulk" size={16} /></button>
            </div>
          </div>
          <DocumentTree docs={docs ?? []} parentId={null} onNavigate={onClose} onCreateChild={onCreate} level={0} />
          {docs && docs.length === 0 && (
            <button onClick={() => onCreate()} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent">
              <Add variant="Bulk" size={16} /> {t("newPage")}
            </button>
          )}
          {activeDrag && (
            <div
              ref={setRootTreeRef}
              className={cn(
                "mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/30 px-3 py-1.5 text-xs text-primary/70 transition-all",
                isOverRootTree && "bg-primary/10 ring-1 ring-primary/40 border-primary/60 text-primary",
              )}
            >
              <DocumentText variant="Bulk" size={14} /> {t("moveToRoot")}
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
              <Trash variant="Bulk" size={20} className={cn("text-muted-foreground", isOver && "text-destructive")} /> {t("trash")}
            </Link>
          </div>
          <Link href="/app/settings" onClick={onClose} className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-sidebar-accent", isActive("/app/settings") && "bg-sidebar-accent font-medium")}>
            <Setting2 variant="Bulk" size={20} className="text-muted-foreground" /> {t("settings")}
          </Link>
        </div>
      </aside>
    </>
  );
}

function DraggableFavorite({ doc, onNavigate }: { doc: any; onNavigate: () => void }) {
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
        "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-sidebar-accent",
        isDragging && "z-50 cursor-grabbing opacity-0",
        isTrashing && "pointer-events-none scale-95 opacity-0 transition-all duration-300",
      )}
    >
      <Link href={`/app/documents/${doc._id}`} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2">
        <span className="w-4 text-center">{doc.icon ?? "\ud83d\udcc4"}</span>
        <span className="truncate">{doc.title || tc("untitled")}</span>
      </Link>
    </div>
  );
}
