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
import { AiPanel } from "@/components/app/ai-panel";
import { TrashDndProvider } from "@/components/providers/dnd-trash-provider";
import { useTranslations } from "next-intl";

function UserStoreSync({ children }: { children: React.ReactNode }) {
  const storeUser = useMutation(api.users.store);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    storeUser().then(() => setSynced(true)).catch(() => setSynced(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!synced) return <Loader />;
  return <>{children}</>;
}

function Loader() {
  const t = useTranslations("home");
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
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

  if (isLoading) return <Loader />;
  if (needsOnboarding) return <Onboarding />;

  return (
    <TrashDndProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onSearch={() => setSearchOpen(true)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setMobileOpen(true)} onSearch={() => setSearchOpen(true)} />
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
        <CommandPalette open={searchOpen} setOpen={setSearchOpen} />
        <AiPanel />
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
        <Shell>{children}</Shell>
      </WorkspaceProvider>
    </UserStoreSync>
  );
}
