"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { btnPrimary, btnOutline, Spinner } from "@/components/app/common";
import { toast } from "sonner";

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const inv = useQuery(api.invitations.getByToken, { token: params.token });
  const accept = useMutation(api.invitations.accept);
  const [busy, setBusy] = useState(false);

  const onAccept = async () => {
    setBusy(true);
    try {
      await accept({ token: params.token });
      toast.success("Welcome to the workspace!");
      router.push("/app");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not accept invitation");
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 text-center">
        <span className="text-2xl font-extrabold tracking-tight">flux<span className="text-primary">.</span></span>
        {inv === undefined ? (
          <div className="mt-8 flex justify-center"><Spinner /></div>
        ) : inv === null ? (
          <><h1 className="mt-5 text-xl font-bold">Invitation not found</h1><p className="mt-2 text-sm text-muted-foreground">This link is invalid or has expired.</p><Link href="/" className={`${btnOutline} mt-6`}>Go home</Link></>
        ) : (
          <>
            <h1 className="mt-5 text-xl font-bold">Join {inv.workspace?.name ?? "a workspace"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">You have been invited as <span className="font-medium capitalize text-foreground">{inv.role}</span>.</p>
            {isLoading ? (
              <div className="mt-6 flex justify-center"><Spinner /></div>
            ) : isAuthenticated ? (
              <button onClick={onAccept} disabled={busy} className={`${btnPrimary} mt-6 w-full`} data-testid="accept-invite">{busy ? "Joining\u2026" : "Accept invitation"}</button>
            ) : (
              <Link href={`/auth?redirect=/invite/${params.token}`} className={`${btnPrimary} mt-6 w-full`}>Sign in to accept</Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
