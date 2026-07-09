"use client";

import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import {
  HamburgerMenu,
  SearchNormal1,
  Sun1,
  Moon,
  Notification,
  Setting2,
  Logout,
  Profile,
} from "iconsax-reactjs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTranslations } from "next-intl";

export function Topbar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { me, activeWorkspaceId } = useWorkspace();
  const unread = useQuery(api.notifications.unreadCount) as number | undefined;
  const t = useTranslations("nav");
  const ts = useTranslations("settings");
  const ta = useTranslations("auth");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur md:h-16 md:px-5">
      <button onClick={onMenu} className="md:hidden" data-testid="topbar-menu">
        <HamburgerMenu variant="Bulk" size={22} />
      </button>

      <button
        onClick={onSearch}
        data-testid="global-search-open"
        className="flex h-9 w-full max-w-sm items-center gap-2 rounded-full border border-border bg-card px-3.5 text-sm text-muted-foreground hover:bg-muted"
      >
        <SearchNormal1 variant="Bulk" size={18} />
        <span className="flex-1 text-left">{t("searchDocuments")}</span>
        <span className="hidden rounded-md border border-border px-1.5 text-xs sm:inline">⌘K</span>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} data-testid="theme-toggle" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
          {theme === "dark" ? <Sun1 variant="Bulk" size={20} /> : <Moon variant="Bulk" size={20} />}
        </button>
        <button onClick={() => router.push("/app/inbox")} data-testid="topbar-inbox" className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
          <Notification variant="Bulk" size={20} />
          {!!unread && unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{unread > 9 ? "9+" : unread}</span>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button data-testid="user-menu" className="ml-1">
              <Avatar className="h-8 w-8 border border-border">
                <AvatarImage src={me?.image} />
                <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">{(me?.name ?? me?.email ?? "U").charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="truncate text-sm font-semibold">{me?.name ?? ts("tabs.profile")}</div>
              <div className="truncate text-xs font-normal text-muted-foreground">{me?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/app/settings")} className="gap-2"><Profile variant="Bulk" size={16} /> {ts("tabs.profile")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/app/settings")} className="gap-2"><Setting2 variant="Bulk" size={16} /> {t("settings")}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/next-api/auth/signout")} data-testid="signout" className="gap-2 text-destructive"><Logout variant="Bulk" size={16} /> {ta("signOut")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
