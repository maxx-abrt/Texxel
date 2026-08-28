"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { WorkspaceProvider, useWorkspace } from "@/hooks/use-flux-workspace";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { WidgetsBar } from "@/components/app/widgets/widgets-bar";
import { ConnectionBanner } from "@/components/app/connection-banner";
import { WorkbenchTabs } from "@/components/app/tabs/workbench-tabs";
import { useTabScrollRestore } from "@/components/app/tabs/use-tab-scroll-restore";
import { MusicPlayerHost } from "@/components/app/music/music-player-host";
import { MusicMiniPlayer } from "@/components/app/music/music-mini-player";
import { CommandPalette } from "@/components/app/command-palette";
import { Onboarding } from "@/components/app/onboarding";
import { DockedBubbles } from "@/components/app/docked-bubbles";
import { ShortcutsHelp } from "@/components/app/shortcuts-help";
import { TrashDndProvider } from "@/components/providers/dnd-trash-provider";
import { WorkspaceLinkBridge } from "@/components/app/workspace-link-bridge";
import { CoreErrorBoundary } from "@/components/app/core-error-boundary";
import { CoreWorkspaceSync } from "@/components/app/core-workspace-sync";
import { AccentProvider } from "@/components/providers/accent-provider";
import { usePersistedState } from "@/hooks/use-sidebar-prefs";
import { useTranslations } from "next-intl";
import { BureauLogo } from "@/components/app/bureau-logo";

function UserStoreSync({ children }: { children: React.ReactNode }) {
  const storeUser = useMutation(api.users.store);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    storeUser().then(() => setSynced(true)).catch(() => setSynced(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!synced) return <Loader stage="store" />;
  return <>{children}</>;
}

function Loader({ stage = "auth" }: { stage?: string }) {
  const t = useTranslations("home");
  return (
    <div className="flex min-h-screen items-center justify-center bg-background" data-testid="app-loader" data-stage={stage}>
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <span className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <BureauLogo size={32} />
          {t("tagline")}
        </span>
        <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { isLoading, needsOnboarding } = useWorkspace();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = usePersistedState<boolean>("bureau-sidebar-collapsed", false);

  // M4.3 (§12.8) — main content remembers scroll per workbench tab.
  const mainRef = useRef<HTMLElement | null>(null);
  useTabScrollRestore(mainRef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
        return;
      }
      // M2.2 (§5 #2) — `C` opens the command center from anywhere outside a
      // text field; the hint chip rides on the palette's quick actions.
      if (
        !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "c" &&
        !(e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable="true"]'))
      ) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    const onEvt = () => setCollapsed((c) => !c);
    window.addEventListener("keydown", onKey);
    window.addEventListener("bureau:toggle-sidebar", onEvt);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("bureau:toggle-sidebar", onEvt);
    };
  }, [setCollapsed]);

  if (isLoading) return <Loader stage="workspace" />;
  if (needsOnboarding) return <Onboarding />;

  return (
    <TrashDndProvider>
      <AccentProvider />
      {/* 3-zone workbench shell (§1.1): navigator | content | widgets.
          The widgets zone is a hidden stub in M1.1 — M1.2 fills it with the
          real icon rail (MINI) ↔ expanded panel. DockedBubbles stays until
          M1.6 migrates its content into widgets. */}
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Zone 1 — Navigator (left rail) */}
        <Sidebar
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          onSearch={() => setSearchOpen(true)}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />
        {/* Zone 2 — Content (topbar + routed page) */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            onMenu={() => setMobileOpen(true)}
            onSearch={() => setSearchOpen(true)}
            sidebarCollapsed={collapsed}
            onExpandSidebar={() => setCollapsed(false)}
          />
          <ConnectionBanner />
          {/* M4.1 (§4) — workbench tab strip between topbar and content.
              Persisted per user in `flux_userPrefs.tabs`. M4.2 wires
              middle-click / ⌘W / ⌘1..9 / dnd reorder; M4.3 wires internal
              link resolution into an existing tab. */}
          <WorkbenchTabs />
          <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto" data-testid="app-main-scroll">{children}</main>
        </div>
        {/* Zone 3 — Widgets (right dock) */}
        <WidgetsBar />
        <CommandPalette open={searchOpen} setOpen={setSearchOpen} />
        <DockedBubbles />
        <ShortcutsHelp />
        {/* Singleton music player host (§3.1 #5) — mounted once, outside the
            widgets dock, so route/dock/float changes never remount the
            active provider player. */}
        <MusicPlayerHost />
        {/* Mobile Dynamic Island mini-player (§3.1 #4) — bottom pill above
            the safe area on <md. The topbar mounts the wide-screen pill. Both
            are pure control surfaces over the same store; they render null
            until media is loaded. */}
        <MusicMiniPlayer placement="mobile" />
      </div>
    </TrashDndProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/auth");
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) return <Loader />;
  if (!isAuthenticated) return null;

  return (
    <UserStoreSync>
      <WorkspaceProvider>
        {/* Reconcile local workspaces with A2E Core before the shell (and its
            onboarding gate) renders, so mirrored workspaces are already there. */}
        <WorkspaceLinkBridge fallback={<Loader stage="workspace-sync" />}>
          {/* Any A2E Core failure degrades to local data + a banner instead of
              taking the page down (Convex useQuery throws during render). */}
          <CoreErrorBoundary>
            {/* Align core's active workspace with the local one (suite-wide). */}
            <CoreWorkspaceSync />
            <Shell>{children}</Shell>
          </CoreErrorBoundary>
        </WorkspaceLinkBridge>
      </WorkspaceProvider>
    </UserStoreSync>
  );
}
