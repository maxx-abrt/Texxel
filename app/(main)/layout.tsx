"use client";

import { Spinner } from "@/components/spinner";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import Navigation from "./_components/Navigation";
import { SearchCommand } from "@/components/search-command";
import { CommandPalette } from "@/components/command-palette";

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading: convexLoading } = useConvexAuth();
  const profile = useQuery(
    api.userProfiles.getMyProfile,
    isAuthenticated ? {} : "skip",
  );
  const router = useRouter();
  const redirected = useRef(false);

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
    <div className="dark:bg-dark flex h-full">
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
