"use client";

import React, { ComponentRef, useCallback, useEffect, useRef, useState } from "react";
import { useMediaQuery } from "usehooks-ts";
import { useMutation, useQuery } from "convex/react";
import { useParams, usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import { DocumentList } from "./DocumentList";
import { Item } from "./Item";
import { UserItem } from "./UserItem";

import { toast } from "sonner";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronsLeft,
  Clock,
  Copy,
  Database,
  FileText,
  FolderKanban,
  Home,
  Inbox,
  ListChecks,
  MenuIcon,
  Plus,
  PlusCircle,
  Search,
  Settings,
  Sparkles,
  Trash,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TrashBox } from "./TrashBox";
import { useSearch } from "@/hooks/useSearch";
import { Navbar } from "./Navbar";
import { ScrollableList } from "@/components/scrollable-list";
import { openCommandPalette } from "@/components/command-palette";
import { useTranslations } from "next-intl";
import { useDocumentUI } from "@/hooks/useDocumentUI";
import { useBulkSelect } from "@/hooks/useBulkSelect";
import { useExtensions } from "@/hooks/useExtensions";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useWorkspace } from "@/hooks/useWorkspace";

const Navigation = () => {
  const search = useSearch();
  const router = useRouter();
  const t = useTranslations("nav");
  const pathname = usePathname();
  const params = useParams();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const create = useMutation(api.documents.create);
  const unreadCount = useQuery(api.notifications.getUnreadCount) ?? 0;
  const { focusMode } = useDocumentUI();
  const bulkSelect = useBulkSelect();
  const bulkArchive = useMutation(api.documents.bulkArchive);
  const bulkDuplicate = useMutation(api.documents.bulkDuplicate);
  const tb = useTranslations("bulk");
  const { activeWorkspaceId } = useWorkspace();
  const { isEnabled: extEnabled, getUIConfig } = useExtensions();
  const sidebarW = getUIConfig().sidebarWidth ?? 252;
  const sidebarPx = `${sidebarW}px`;

  const isResizingRef = useRef(false);
  const sidebarRef = useRef<ComponentRef<"aside">>(null);
  const navbarRef = useRef<ComponentRef<"div">>(null);
  const [isResetting, setIsResetting] = useState(false);
  const { isCollapsed, setCollapsed } = useSidebarState();

  // Collapsible section states
  const [sectionsCollapsed, setSectionsCollapsed] = useState<Record<string, boolean>>({});
  const toggleSection = useCallback((key: string) => {
    setSectionsCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  useEffect(() => {
    if (isMobile) collapse();
    else if (isCollapsed) collapse();
    else resetWidth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) collapse();
  }, [pathname, isMobile]);

  useEffect(() => {
    if (focusMode) {
      collapse();
    } else if (!isMobile) {
      resetWidth();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMode]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizingRef.current) return;
    let newWidth = e.clientX;
    if (newWidth < 240) newWidth = 240;
    if (newWidth > 480) newWidth = 480;
    if (sidebarRef.current && navbarRef.current) {
      sidebarRef.current.style.width = `${newWidth}px`;
      navbarRef.current.style.setProperty("left", `${newWidth}px`);
      navbarRef.current.style.setProperty("width", `calc(100% - ${newWidth}px)`);
    }
  };

  const handleMouseUp = () => {
    isResizingRef.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const resetWidth = () => {
    if (sidebarRef.current && navbarRef.current) {
      setCollapsed(false);
      setIsResetting(true);
      sidebarRef.current.style.width = isMobile ? "100%" : sidebarPx;
      navbarRef.current.style.setProperty("width", isMobile ? "0" : `calc(100% - ${sidebarPx})`);
      navbarRef.current.style.setProperty("left", isMobile ? "100%" : sidebarPx);
      setTimeout(() => setIsResetting(false), 300);
    }
  };

  const collapse = () => {
    if (sidebarRef.current && navbarRef.current) {
      setCollapsed(true);
      setIsResetting(true);
      sidebarRef.current.style.width = "0";
      navbarRef.current.style.setProperty("width", "100%");
      navbarRef.current.style.setProperty("left", "0");
      setTimeout(() => setIsResetting(false), 300);
    }
  };

  const td = useTranslations("dashboard");

  const handleCreate = () => {
    const promise = create({ title: "Untitled", workspaceId: activeWorkspaceId as any }).then((documentId) =>
      router.push(`/documents/${documentId}`),
    );
    toast.promise(promise, {
      loading: td("creating"),
      success: td("created"),
      error: td("createFailed"),
    });
  };

  return (
    <>
      <aside
        ref={sidebarRef}
        style={{ width: isMobile ? 0 : sidebarW }}
        className={cn(
          "group/sidebar bg-sidebar relative z-300 flex h-full flex-col overflow-hidden",
          "border-r border-sidebar-border/70",
          isResetting && "transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        )}
      >
        {/* Collapse button */}
        <div
          onClick={collapse}
          role="button"
          className={cn(
            "text-muted-foreground/50 absolute top-3.5 right-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-lg opacity-0 transition-all duration-200 ease-out hover:bg-foreground/[0.06] hover:text-foreground/70 group-hover/sidebar:opacity-100",
            isMobile && "opacity-100",
          )}
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </div>

        {/* User section */}
        <div className="shrink-0">
          <UserItem />
        </div>

        {/* Search bar */}
        <div className="shrink-0 px-3 pt-1 pb-1">
          <button
            onClick={openCommandPalette}
            className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium text-muted-foreground/50 transition-all duration-200 ease-out hover:bg-foreground/[0.04] hover:text-muted-foreground/80"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left truncate">{t("search")}</span>
            <kbd className="ml-auto hidden rounded-md border border-border/30 bg-foreground/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/35 sm:inline-flex">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Quick actions — collapsible */}
        <div className="shrink-0 px-3 pb-1">
          <button
            onClick={() => toggleSection("quick")}
            className="group/header flex w-full items-center gap-1.5 px-3 pb-1 pt-2.5"
          >
            <ChevronDown className={cn(
              "h-2.5 w-2.5 text-muted-foreground/30 transition-transform duration-200 ease-out group-hover/header:text-muted-foreground/50",
              sectionsCollapsed.quick && "-rotate-90",
            )} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/30 transition-colors duration-200 group-hover/header:text-muted-foreground/50">
              {t("home")}
            </span>
          </button>
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
              sectionsCollapsed.quick ? "max-h-0 opacity-0" : "max-h-[200px] opacity-100",
            )}
          >
            <Item
              label={t("home")}
              icon={Home}
              onClick={() => router.push("/documents")}
              active={pathname === "/documents"}
            />
            <div className="relative">
              <Item
                label={t("inbox")}
                icon={Inbox}
                onClick={() => router.push("/inbox")}
                active={pathname === "/inbox"}
              />
              {unreadCount > 0 && (
                <div className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-blue-500/90 px-1 text-[9px] font-semibold text-white shadow-sm shadow-blue-500/20">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </div>
              )}
            </div>
            <Item
              label={t("settings")}
              icon={Settings}
              onClick={() => router.push("/settings")}
              active={pathname.startsWith("/settings")}
            />
          </div>
        </div>

        {/* Workspace section — collapsible */}
        <div className="shrink-0 px-3 pb-1">
          <button
            onClick={() => toggleSection("workspace")}
            className="group/header flex w-full items-center gap-1.5 px-3 pb-1 pt-2.5"
          >
            <ChevronDown className={cn(
              "h-2.5 w-2.5 text-muted-foreground/30 transition-transform duration-200 ease-out group-hover/header:text-muted-foreground/50",
              sectionsCollapsed.workspace && "-rotate-90",
            )} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/30 transition-colors duration-200 group-hover/header:text-muted-foreground/50">
              {t("workspace")}
            </span>
          </button>
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
              sectionsCollapsed.workspace ? "max-h-0 opacity-0" : "max-h-[300px] opacity-100",
            )}
          >
            <Item
              label={t("tasks")}
              icon={CheckSquare}
              onClick={() => router.push("/tasks")}
              active={pathname.startsWith("/tasks")}
            />
            {extEnabled("calendar") && (
              <Item
                label={t("calendar")}
                icon={CalendarDays}
                onClick={() => router.push("/calendar")}
                active={pathname.startsWith("/calendar")}
              />
            )}
            <Item
              label={t("projects")}
              icon={FolderKanban}
              onClick={() => router.push("/projects")}
              active={pathname.startsWith("/projects")}
            />
            <Item
              label={t("teams")}
              icon={Users}
              onClick={() => router.push("/teams")}
              active={pathname.startsWith("/teams")}
            />
            <Item
              label={t("templates")}
              icon={BookOpen}
              onClick={() => router.push("/templates")}
              active={pathname.startsWith("/templates")}
            />
            {extEnabled("databases") && (
              <Item
                label={t("databases")}
                icon={Database}
                onClick={() => router.push("/databases")}
                active={pathname.startsWith("/databases")}
              />
            )}
          </div>
        </div>

        {/* Extension nav items — collapsible */}
        {(extEnabled("aiAssistant") || extEnabled("automations") || extEnabled("focusTimer")) && (
          <div className="shrink-0 px-3 pb-1">
            <button
              onClick={() => toggleSection("extensions")}
              className="group/header flex w-full items-center gap-1.5 px-3 pb-1 pt-2.5"
            >
              <ChevronDown className={cn(
                "h-2.5 w-2.5 text-muted-foreground/30 transition-transform duration-200 ease-out group-hover/header:text-muted-foreground/50",
                sectionsCollapsed.extensions && "-rotate-90",
              )} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/30 transition-colors duration-200 group-hover/header:text-muted-foreground/50">
                {t("extensions")}
              </span>
            </button>
            <div
              className={cn(
                "overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                sectionsCollapsed.extensions ? "max-h-0 opacity-0" : "max-h-[200px] opacity-100",
              )}
            >
              {extEnabled("aiAssistant") && (
                <Item
                  label={t("aiAssistant")}
                  icon={Sparkles}
                  onClick={() => router.push("/documents")}
                />
              )}
              {extEnabled("automations") && (
                <Item
                  label={t("automations")}
                  icon={Zap}
                  onClick={() => router.push("/automations")}
                  active={pathname === "/automations"}
                />
              )}
              {extEnabled("focusTimer") && (
                <Item
                  label={t("focusTimer")}
                  icon={Clock}
                  onClick={() => {
                    const event = new CustomEvent("toggle-pomodoro");
                    window.dispatchEvent(event);
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* Subtle divider before notes */}
        <div className="mx-5 border-t border-sidebar-border/40" />

        {/* Notes section — always visible, takes remaining space */}
        <div className="flex min-h-0 flex-1 flex-col px-3 pt-0.5">
          <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
            <div className="flex items-center gap-1.5">
              <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/30" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/30">
                {t("notes")}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={bulkSelect.toggleSelecting}
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-md transition-all duration-200 ease-out",
                  bulkSelect.isSelecting
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground/30 hover:bg-foreground/[0.04] hover:text-muted-foreground/60",
                )}
                title={tb("selectAll")}
              >
                <ListChecks className="h-3 w-3" />
              </button>
              <button
                onClick={handleCreate}
                className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/30 transition-all duration-200 ease-out hover:bg-foreground/[0.04] hover:text-muted-foreground/60"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <ScrollableList>
              <DocumentList />
            </ScrollableList>
          </div>
          {/* Bulk action bar */}
          {bulkSelect.isSelecting && bulkSelect.selectedIds.size > 0 && (
            <div className="shrink-0 border-t border-sidebar-border/40 px-2 py-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[10px] font-semibold text-primary">
                  {bulkSelect.selectedIds.size} {tb("selected").replace("{count}", "").trim()}
                </span>
                <button
                  onClick={bulkSelect.exitSelecting}
                  className="ml-auto flex h-5 w-5 items-center justify-center rounded-lg text-muted-foreground/50 hover:bg-foreground/[0.06] hover:text-foreground transition-all duration-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={async () => {
                    const ids = Array.from(bulkSelect.selectedIds) as any;
                    try {
                      await bulkArchive({ ids });
                      toast.success(tb("archived"));
                      bulkSelect.exitSelecting();
                    } catch { toast.error(tb("failed")); }
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border/30 px-2 py-1.5 text-[11px] font-medium text-muted-foreground/70 hover:text-destructive hover:border-destructive/30 transition-all duration-200"
                >
                  <Trash2 className="h-3 w-3" /> {tb("archive")}
                </button>
                <button
                  onClick={async () => {
                    const ids = Array.from(bulkSelect.selectedIds) as any;
                    try {
                      await bulkDuplicate({ ids });
                      toast.success(tb("duplicated"));
                      bulkSelect.exitSelecting();
                    } catch { toast.error(tb("failed")); }
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border/30 px-2 py-1.5 text-[11px] font-medium text-muted-foreground/70 hover:text-foreground hover:border-primary/30 transition-all duration-200"
                >
                  <Copy className="h-3 w-3" /> {tb("duplicate")}
                </button>
              </div>
            </div>
          )}
          <div className="shrink-0 border-t border-sidebar-border/40 py-1.5">
            <Item onClick={handleCreate} icon={PlusCircle} label={t("newNote")} />
            <Popover>
              <PopoverTrigger className="w-full">
                <Item label={t("trash")} icon={Trash} />
              </PopoverTrigger>
              <PopoverContent
                side={isMobile ? "bottom" : "right"}
                className="w-72 rounded-xl border-border/50 p-0 shadow-lg shadow-black/5"
                collisionPadding={16}
              >
                <TrashBox />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          onClick={resetWidth}
          className="absolute top-0 right-0 h-full w-1 cursor-ew-resize opacity-0 transition-opacity duration-200 hover:bg-primary/15 group-hover/sidebar:opacity-100"
        />
      </aside>

      <div
        ref={navbarRef}
        style={isMobile ? { left: 0, width: "100%" } : { left: sidebarW, width: `calc(100% - ${sidebarPx})` }}
        className={cn(
          "absolute top-0 z-40",
          isResetting && "transition-all duration-300 ease-in-out",
        )}
      >
        {!!params.documentId ? (
          (!isMobile || isCollapsed) && (
            <Navbar isCollapsed={isCollapsed} onResetWidth={resetWidth} />
          )
        ) : (
          <nav
            className={cn(
              "w-full bg-transparent px-3 py-2",
              !isCollapsed && "p-0",
            )}
          >
            {isCollapsed && (
              <MenuIcon
                onClick={resetWidth}
                role="button"
                className="text-muted-foreground h-6 w-6"
              />
            )}
            {isCollapsed && extEnabled("aiAssistant") && (
              <button
                onClick={resetWidth}
                className="fixed bottom-5 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg transition-all hover:scale-105 hover:bg-primary hover:shadow-xl"
                title="Open AI"
              >
                <Sparkles className="h-[18px] w-[18px]" />
              </button>
            )}
          </nav>
        )}
      </div>
    </>
  );
};
export default Navigation;
