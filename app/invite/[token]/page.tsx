"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { btnPrimary, btnOutline, Spinner } from "@/components/app/common";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const inv = useQuery(api.invitations.getByToken, { token: params.token });
  const accept = useMutation(api.invitations.accept);
  const storeUser = useMutation(api.users.store);
  const [busy, setBusy] = useState(false);
  const t = useTranslations("invitations");

  const onAccept = async () => {
    setBusy(true);
    try {
      // Ensure the Convex user record exists before joining (the invite page
      // is outside the app shell that normally calls users.store on load).
      await storeUser({});
      await accept({ token: params.token });
      toast.success(t("welcome"));
      router.push("/app");
    } catch (e: any) {
      toast.error(e?.message ?? t("acceptFailed"));
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 text-center">
        <span className="text-2xl font-extrabold tracking-tight">flux<span className="text-primary">.</span></span>
        {inv === undefined ? (
          <div className="mt-8 flex justify-center"><Spinner /></div>
        ) : inv === null ? (
          <><h1 className="mt-5 text-xl font-bold">{t("notFoundTitle")}</h1><p className="mt-2 text-sm text-muted-foreground">{t("notFoundDesc")}</p><Link href="/" className={`${btnOutline} mt-6`}>{t("goHome")}</Link></>
        ) : (
          <>
            <h1 className="mt-5 text-xl font-bold">{t("joinWorkspace", { workspace: inv.workspace?.name ?? "" })}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("invitedAs", { role: inv.role })}</p>
            {isLoading ? (
              <div className="mt-6 flex justify-center"><Spinner /></div>
            ) : isAuthenticated ? (
              <button onClick={onAccept} disabled={busy} className={`${btnPrimary} mt-6 w-full`} data-testid="accept-invite">{busy ? t("joining") : t("acceptInvitation")}</button>
            ) : (
              <Link href={`/auth?redirect=/invite/${params.token}`} className={`${btnPrimary} mt-6 w-full`}>{t("signInToAccept")}</Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
