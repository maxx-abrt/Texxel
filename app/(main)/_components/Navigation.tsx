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
  CalendarDays,
  CheckSquare,
  ChevronsLeft,
  FileText,
  FolderKanban,
  Home,
  Inbox,
  MenuIcon,
  Plus,
  PlusCircle,
  Search,
  Settings,
  Trash,
  Users,
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

const Navigation = () => {
  const search = useSearch();
  const router = useRouter();
  const t = useTranslations("nav");
  const pathname = usePathname();
  const params = useParams();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const create = useMutation(api.documents.create);
  const unreadCount = useQuery(api.notifications.getUnreadCount) ?? 0;

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
      sidebarRef.current.style.width = isMobile ? "100%" : "252px";
      navbarRef.current.style.setProperty("width", isMobile ? "0" : "calc(100% - 252px)");
      navbarRef.current.style.setProperty("left", isMobile ? "100%" : "252px");
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
        className={cn(
          "group/sidebar bg-sidebar relative z-300 flex h-full w-[252px] flex-col overflow-hidden",
          "border-r border-sidebar-border",
          isResetting && "transition-all duration-300 ease-in-out",
          isMobile && "w-0",
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
        <div className="shrink-0 px-3 pt-1 pb-2">
          <button
            onClick={openCommandPalette}
            className="group flex w-full items-center rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Search className="mr-2 h-[18px] w-[18px] shrink-0" />
            <span className="flex-1 text-left truncate">{t("search")}</span>
            <kbd className="ml-auto hidden rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70 sm:inline-flex">
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
        <div className="shrink-0 px-3 pb-2 border-b border-sidebar-border">
          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            {t("workspace")}
          </p>
          <Item
            label={t("tasks")}
            icon={CheckSquare}
            onClick={() => router.push("/tasks")}
            active={pathname.startsWith("/tasks")}
          />
          <Item
            label={t("calendar")}
            icon={CalendarDays}
            onClick={() => router.push("/calendar")}
            active={pathname.startsWith("/calendar")}
          />
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
        </div>

        {/* Notes section */}
        <div className="flex min-h-0 flex-1 flex-col px-3 pt-1">
          <div className="flex items-center justify-between px-3 pb-1 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              {t("notes")}
            </p>
            <button
              onClick={handleCreate}
              className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <ScrollableList>
              <DocumentList />
            </ScrollableList>
          </div>
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
        className={cn(
          "absolute top-0 left-[252px] z-40 w-[calc(100%-252px)]",
          isResetting && "transition-all duration-300 ease-in-out",
          isMobile && "left-0 w-full",
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
