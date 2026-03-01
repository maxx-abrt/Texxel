"use client";

import { useScrollTop } from "@/hooks/useScrollTop";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { ModeToggle } from "@/components/mode-toggle";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/spinner";
import Link from "next/link";
import { useRouter } from "next/navigation";

export const Navbar = () => {
  const { data: session, isPending } = authClient.useSession();
  const isAuthenticated = !!session;
  const scrolled = useScrollTop();
  const router = useRouter();

  return (
    <nav
      className={cn(
        "sticky inset-x-0 top-0 z-50 flex w-full items-center justify-between px-6 py-4 backdrop-blur-md transition-all",
        scrolled
          ? "border-b bg-background/80 shadow-sm"
          : "bg-transparent",
      )}
    >
      <Logo />
      <div className="flex items-center gap-2">
        {isPending && <Spinner />}
        {!isPending && !isAuthenticated && (
          <>
            <Button variant="ghost" size="sm" asChild className="rounded-full">
              <Link href="/auth/sign-in">Log in</Link>
            </Button>
            <Button size="sm" asChild className="rounded-full px-5">
              <Link href="/auth/sign-up">Get started</Link>
            </Button>
          </>
        )}

        {isAuthenticated && !isPending && (
          <>
            <Button variant="ghost" size="sm" asChild className="rounded-full">
              <Link href="/documents">Dashboard</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={async () => {
                await authClient.signOut();
                router.push("/");
              }}
            >
              Log out
            </Button>
          </>
        )}
        <ModeToggle />
      </div>
    </nav>
  );
};
