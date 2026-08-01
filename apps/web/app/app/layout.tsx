"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { WorkspaceProvider, useWorkspace } from "@/hooks/use-flux-workspace";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
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
        <span className="text-2xl font-extrabold tracking-tight">{t("tagline")}</span>
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
  const [collapsed, setCollapsed] = usePersistedState<boolean>("texxel-sidebar-collapsed", false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
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
    window.addEventListener("texxel:toggle-sidebar", onEvt);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("texxel:toggle-sidebar", onEvt);
    };
  }, [setCollapsed]);

  if (isLoading) return <Loader stage="workspace" />;
  if (needsOnboarding) return <Onboarding />;

  return (
    <TrashDndProvider>
      <AccentProvider />
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          onSearch={() => setSearchOpen(true)}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            onMenu={() => setMobileOpen(true)}
            onSearch={() => setSearchOpen(true)}
            sidebarCollapsed={collapsed}
            onExpandSidebar={() => setCollapsed(false)}
          />
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
        <CommandPalette open={searchOpen} setOpen={setSearchOpen} />
        <DockedBubbles />
        <ShortcutsHelp />
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
