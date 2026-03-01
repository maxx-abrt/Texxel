"use client";

import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { ArrowRight, Zap } from "lucide-react";
import Link from "next/link";

export const Heading = () => {
  const { data: session, isPending } = authClient.useSession();
  const isAuthenticated = !!session;

  return (
    <div className="relative z-10 max-w-3xl space-y-6">
      <div className="mx-auto flex w-fit items-center gap-2 rounded-full border bg-card/80 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
        <Zap className="h-3.5 w-3.5 text-primary" />
        Real-time collaboration for modern teams
      </div>

      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
        Your workspace,{" "}
        <span className="bg-linear-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
          threaded together.
        </span>
      </h1>

      <p className="mx-auto max-w-xl text-base text-muted-foreground sm:text-lg leading-relaxed">
        Notes, tasks, projects, and teams in a single fast workspace.
        Ship faster, stay aligned, and stop switching tools.
      </p>

      {isPending && (
        <div className="flex w-full items-center justify-center pt-2">
          <Spinner size="md" />
        </div>
      )}

      {!isPending && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          {isAuthenticated ? (
            <Button size="lg" asChild className="gap-2 rounded-full px-8">
              <Link href="/documents">
                Open workspace <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button size="lg" asChild className="gap-2 rounded-full px-8">
                <Link href="/auth/sign-up">
                  Start free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="rounded-full px-8">
                <Link href="/auth/sign-in">Sign in</Link>
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
