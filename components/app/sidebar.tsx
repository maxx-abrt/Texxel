"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { DocumentTree } from "@/components/app/document-tree";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
} from "iconsax-reactjs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { href: "/app", label: "Home", Icon: Element3, exact: true },
  { href: "/app/documents", label: "Documents", Icon: DocumentText },
  { href: "/app/tasks", label: "Tasks", Icon: TaskSquare },
  { href: "/app/projects", label: "Projects", Icon: Briefcase },
  { href: "/app/calendar", label: "Calendar", Icon: Calendar },
  { href: "/app/databases", label: "Databases", Icon: Data2 },
  { href: "/app/inbox", label: "Inbox", Icon: Notification },
  { href: "/app/members", label: "Members", Icon: Profile2User },
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

  const onCreate = async (parentId?: any) => {
    if (!activeWorkspaceId) return;
    try {
      const id = await createDoc({ workspaceId: activeWorkspaceId, title: "Untitled" });
      router.push(`/app/documents/${id}`);
    } catch {
      toast.error("Could not create document");
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
                  <span className="block truncate text-sm font-semibold">{activeWorkspace?.name ?? "Workspace"}</span>
                  <span className="block truncate text-xs text-muted-foreground">{activeWorkspace?.role ?? ""} · {activeWorkspace?.memberCount ?? 0} member(s)</span>
                </span>
                <ArrowDown2 variant="Bulk" size={16} className="shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
              {workspaces.map((w) => (
                <DropdownMenuItem key={w._id} data-testid="workspace-option" onClick={() => setActive(w._id)} className="gap-2">
                  <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-md bg-primary text-xs font-bold text-primary-foreground">{(w as any).avatar ? <img src={(w as any).avatar} alt="" className="h-full w-full object-cover" /> : w.name.charAt(0).toUpperCase()}</span>
                  <span className="flex-1 truncate">{w.name}</span>
                  {w._id === activeWorkspaceId && <span className="h-2 w-2 rounded-full bg-primary" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/app/settings?new=1")} className="gap-2 text-primary">
                <Add variant="Bulk" size={16} /> New workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button className="md:hidden" onClick={onClose}><CloseCircle variant="Bulk" size={20} /></button>
        </div>

        {/* Search */}
        <div className="px-3">
          <button data-testid="sidebar-search" onClick={onSearch} className="flex w-full items-center gap-2 rounded-xl border border-sidebar-border bg-background/60 px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent">
            <SearchNormal1 variant="Bulk" size={18} /> Search
            <span className="ml-auto rounded-md border border-border px-1.5 text-xs">⌘K</span>
          </button>
        </div>

        <nav className="mt-3 space-y-0.5 px-3">
          {NAV.map(({ href, label, Icon, exact }) => (
            <Link key={href} href={href} data-testid={`sidebar-nav-${label.toLowerCase()}`} onClick={onClose}
              className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-sidebar-accent", isActive(href, exact) && "bg-sidebar-accent font-medium")}>
              <Icon variant="Bulk" size={20} className={cn("text-muted-foreground", isActive(href, exact) && "text-primary")} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-3 no-scrollbar">
          {favorites && favorites.length > 0 && (
            <div className="mb-3">
              <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Favorites</div>
              {favorites.map((d: any) => (
                <Link key={d._id} href={`/app/documents/${d._id}`} onClick={onClose} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-sidebar-accent">
                  <span className="w-4 text-center">{d.icon ?? "\ud83d\udcc4"}</span>
                  <span className="truncate">{d.title || "Untitled"}</span>
                </Link>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Private</span>
            <button data-testid="sidebar-new-doc" onClick={() => onCreate()} className="rounded-md p-0.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"><Add variant="Bulk" size={16} /></button>
          </div>
          <DocumentTree docs={docs ?? []} parentId={null} onNavigate={onClose} onCreateChild={onCreate} level={0} />
          {docs && docs.length === 0 && (
            <button onClick={() => onCreate()} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent">
              <Add variant="Bulk" size={16} /> New page
            </button>
          )}
        </div>

        <div className="space-y-0.5 border-t border-sidebar-border p-3">
          <Link href="/app/trash" onClick={onClose} className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-sidebar-accent", isActive("/app/trash") && "bg-sidebar-accent font-medium")}>
            <Trash variant="Bulk" size={20} className="text-muted-foreground" /> Trash
          </Link>
          <Link href="/app/settings" onClick={onClose} className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-sidebar-accent", isActive("/app/settings") && "bg-sidebar-accent font-medium")}>
            <Setting2 variant="Bulk" size={20} className="text-muted-foreground" /> Settings
          </Link>
        </div>
      </aside>
    </>
  );
}
