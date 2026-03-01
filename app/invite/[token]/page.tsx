"use client";

import { use, useEffect, useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Users, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { isAuthenticated, isLoading: convexLoading } = useConvexAuth();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const invitation = useQuery(api.teams.getInvitationByToken, { token });
  const acceptInvitation = useMutation(api.teams.acceptInvitation);
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState(false);

  const isLoading = convexLoading || sessionPending;

  const handleAccept = async () => {
    if (!session?.user) {
      router.push(`/auth/sign-in?callbackUrl=/invite/${token}`);
      return;
    }
    setAccepting(true);
    try {
      const teamId = await acceptInvitation({
        token,
        userId: session.user.id,
        userEmail: session.user.email,
        userName: session.user.name,
        userImage: session.user.image ?? undefined,
      });
      setDone(true);
      toast.success("You've joined the team!");
      setTimeout(() => router.push(`/teams/${teamId}`), 1500);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to accept invitation");
    } finally {
      setAccepting(false);
    }
  };

  if (isLoading || invitation === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
            <XCircle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-xl font-bold mb-2">Invalid invitation</h1>
          <p className="text-muted-foreground text-sm">This invitation link is invalid or has expired.</p>
          <Button className="mt-6" onClick={() => router.push("/")}>Go home</Button>
        </div>
      </div>
    );
  }

  if (invitation.status !== "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <XCircle className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold mb-2">Invitation no longer valid</h1>
          <p className="text-muted-foreground text-sm">
            This invitation has already been {invitation.status}.
          </p>
          <Button className="mt-6" onClick={() => router.push("/teams")}>View Teams</Button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
            <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold mb-2">You&apos;re in!</h1>
          <p className="text-muted-foreground text-sm">Redirecting to your team…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border bg-card p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold mb-1">Team Invitation</h1>
          <p className="text-muted-foreground text-sm mb-6">
            You&apos;ve been invited to join{" "}
            <span className="font-semibold text-foreground">{invitation.teamName}</span>{" "}
            as a <span className="font-medium">{invitation.role}</span>.
          </p>

          {!session ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Sign in to accept this invitation</p>
              <Button
                className="w-full"
                onClick={() => router.push(`/auth/sign-in?callbackUrl=/invite/${token}`)}
              >
                Sign in to accept
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push(`/auth/sign-up?callbackUrl=/invite/${token}`)}
              >
                Create an account
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Accepting as <span className="font-medium">{session.user.email}</span>
              </p>
              <Button className="w-full" onClick={handleAccept} disabled={accepting}>
                {accepting ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Joining…</>
                ) : (
                  "Accept invitation"
                )}
              </Button>
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => router.push("/")}>
                Decline
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
