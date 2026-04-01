"use client";

import { Spinner } from "@/components/spinner";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import Navigation from "./_components/Navigation";
import { SearchCommand } from "@/components/search-command";
import { CommandPalette } from "@/components/command-palette";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useExtensions } from "@/hooks/useExtensions";
import { cn } from "@/lib/utils";

const FONT_SIZE_CLASS: Record<string, string> = {
  sm: "text-[14px]",
  base: "",
  lg: "text-[17px]",
};

const FONT_FAMILY_CLASS: Record<string, string> = {
  system: "",
  inter: "font-[Inter,ui-sans-serif,system-ui,sans-serif]",
  mono: "font-mono",
  serif: "font-serif",
};

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading: convexLoading } = useConvexAuth();
  const profile = useQuery(
    api.userProfiles.getMyProfile,
    isAuthenticated ? {} : "skip",
  );
  const router = useRouter();
  const redirected = useRef(false);
  const wsInitRef = useRef(false);

  const getOrCreatePersonal = useMutation(api.workspaces.getOrCreatePersonal);
  const { activeWorkspaceId, setActiveWorkspaceId } = useWorkspace();
  const { setWorkspaceId, getUIConfig } = useExtensions();
  const uiConfig = getUIConfig();

  // Auto-create personal workspace on first authenticated load
  useEffect(() => {
    if (wsInitRef.current || !isAuthenticated || convexLoading) return;
    if (!profile?.onboardingCompleted) return;
    wsInitRef.current = true;

    if (!activeWorkspaceId) {
      getOrCreatePersonal({}).then((wsId) => {
        setActiveWorkspaceId(wsId);
        setWorkspaceId(wsId);
      }).catch(() => {});
    } else {
      setWorkspaceId(activeWorkspaceId);
    }
  }, [isAuthenticated, convexLoading, profile, activeWorkspaceId, getOrCreatePersonal, setActiveWorkspaceId, setWorkspaceId]);

  useEffect(() => {
    if (redirected.current) return;

    if (!convexLoading && !isAuthenticated) {
      redirected.current = true;
      router.push("/auth/sign-in");
      return;
    }

    if (!convexLoading && isAuthenticated && profile !== undefined) {
      if (!profile || !profile.onboardingCompleted) {
        redirected.current = true;
        router.push("/onboarding");
      }
    }
  }, [convexLoading, isAuthenticated, profile, router]);

  if (convexLoading || (isAuthenticated && profile === undefined)) {
    return (
      <div className="dark:bg-dark flex h-full items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  if (!isAuthenticated || !profile?.onboardingCompleted) {
    return (
      <div className="dark:bg-dark flex h-full items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className={cn(
      "dark:bg-dark flex h-full",
      FONT_SIZE_CLASS[uiConfig.fontSize] ?? "",
      FONT_FAMILY_CLASS[uiConfig.fontFamily] ?? "",
      uiConfig.compactMode && "leading-tight **:leading-snug",
    )}>
      <Navigation />
      <main className="h-full flex-1 overflow-y-auto">
        <SearchCommand />
        <CommandPalette />
        {children}
      </main>
    </div>
  );
};
export default MainLayout;
