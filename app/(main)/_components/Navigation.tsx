"use client";

import React, { ComponentRef, useEffect, useRef, useState } from "react";
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
  const { isEnabled: extEnabled, getUIConfig } = useExtensions();
  const sidebarW = getUIConfig().sidebarWidth ?? 252;
  const sidebarPx = `${sidebarW}px`;

  const isResizingRef = useRef(false);
  const sidebarRef = useRef<ComponentRef<"aside">>(null);
  const navbarRef = useRef<ComponentRef<"div">>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(isMobile);

  useEffect(() => {
    if (isMobile) collapse();
    else resetWidth();
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
      setIsCollapsed(false);
      setIsResetting(true);
      sidebarRef.current.style.width = isMobile ? "100%" : sidebarPx;
      navbarRef.current.style.setProperty("width", isMobile ? "0" : `calc(100% - ${sidebarPx})`);
      navbarRef.current.style.setProperty("left", isMobile ? "100%" : sidebarPx);
      setTimeout(() => setIsResetting(false), 300);
    }
  };

  const collapse = () => {
    if (sidebarRef.current && navbarRef.current) {
      setIsCollapsed(true);
      setIsResetting(true);
      sidebarRef.current.style.width = "0";
      navbarRef.current.style.setProperty("width", "100%");
      navbarRef.current.style.setProperty("left", "0");
      setTimeout(() => setIsResetting(false), 300);
    }
  };

  const td = useTranslations("dashboard");

  const handleCreate = () => {
    const promise = create({ title: "Untitled" }).then((documentId) =>
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
          "border-r border-sidebar-border",
          isResetting && "transition-all duration-300 ease-in-out",
        )}
      >
        {/* Collapse button */}
        <div
          onClick={collapse}
          role="button"
          className={cn(
            "text-muted-foreground absolute top-3 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-md opacity-0 transition hover:bg-accent group-hover/sidebar:opacity-100",
            isMobile && "opacity-100",
          )}
        >
          <ChevronsLeft className="h-4 w-4" />
        </div>

        {/* User section */}
        <div className="shrink-0">
          <UserItem />
        </div>

        {/* Quick actions */}
        <div className="shrink-0 px-3 pt-2 pb-2">
          <button
            onClick={openCommandPalette}
            className="group flex w-full items-center rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground/70 transition-all duration-150 hover:bg-accent/60 hover:text-foreground"
          >
            <Search className="mr-2.5 h-4 w-4 shrink-0" />
            <span className="flex-1 text-left truncate">{t("search")}</span>
            <kbd className="ml-auto hidden rounded-md border border-border/40 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/50 sm:inline-flex">
              ⌘K
            </kbd>
          </button>
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
              <div className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold text-white">
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

        {/* Workspace section */}
        <div className="shrink-0 px-3 pb-2 border-b border-sidebar-border/60">
          <p className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/35">
            {t("workspace")}
          </p>
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

        {/* Extension nav items */}
        {(extEnabled("aiAssistant") || extEnabled("automations") || extEnabled("focusTimer")) && (
          <div className="shrink-0 px-3 py-1 border-b border-sidebar-border">
            {extEnabled("aiAssistant") && (
              <Item
                label="A2E AI"
                icon={Sparkles}
                onClick={() => router.push("/documents")}
              />
            )}
            {extEnabled("automations") && (
              <Item
                label={t("workspace") === "Workspace" ? "Automations" : "Automatisations"}
                icon={Zap}
                onClick={() => router.push("/automations")}
                active={pathname === "/automations"}
              />
            )}
            {extEnabled("focusTimer") && (
              <Item
                label={t("workspace") === "Workspace" ? "Focus Timer" : "Minuteur Focus"}
                icon={Clock}
                onClick={() => {
                  const event = new CustomEvent("toggle-pomodoro");
                  window.dispatchEvent(event);
                }}
              />
            )}
          </div>
        )}

        {/* Notes section */}
        <div className="flex min-h-0 flex-1 flex-col px-3 pt-1">
          <div className="flex items-center justify-between px-3 pb-1 pt-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/35">
              {t("notes")}
            </p>
            <div className="flex items-center gap-0.5">
              <button
                onClick={bulkSelect.toggleSelecting}
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-md transition-colors duration-200",
                  bulkSelect.isSelecting
                    ? "text-foreground bg-foreground/10"
                    : "text-muted-foreground/40 hover:bg-accent/60 hover:text-foreground/70",
                )}
                title={tb("selectAll")}
              >
                <ListChecks className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleCreate}
                className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/40 transition-colors duration-200 hover:bg-accent/60 hover:text-foreground/70"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <ScrollableList>
              <DocumentList />
            </ScrollableList>
          </div>
          {/* Bulk action bar */}
          {bulkSelect.isSelecting && bulkSelect.selectedIds.size > 0 && (
            <div className="shrink-0 border-t border-sidebar-border px-2 py-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[10px] font-semibold text-primary">
                  {bulkSelect.selectedIds.size} {tb("selected").replace("{count}", "").trim()}
                </span>
                <button
                  onClick={bulkSelect.exitSelecting}
                  className="ml-auto flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
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
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"
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
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                >
                  <Copy className="h-3 w-3" /> {tb("duplicate")}
                </button>
              </div>
            </div>
          )}
          <div className="shrink-0 border-t border-sidebar-border py-2">
            <Item onClick={handleCreate} icon={PlusCircle} label={t("newNote")} />
            <Popover>
              <PopoverTrigger className="w-full">
                <Item label={t("trash")} icon={Trash} />
              </PopoverTrigger>
              <PopoverContent
                side={isMobile ? "bottom" : "right"}
                className="w-72 p-0"
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
          className="absolute top-0 right-0 h-full w-1 cursor-ew-resize opacity-0 transition hover:bg-primary/20 group-hover/sidebar:opacity-100"
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
          </nav>
        )}
      </div>
    </>
  );
};
export default Navigation;
