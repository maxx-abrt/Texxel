"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Flash, ArrowRight2, Logout } from "iconsax-reactjs";
import { useTranslations } from "next-intl";

const TYPES = [
  { id: "individual", labelKey: "personal", descKey: "personalDesc" },
  { id: "business", labelKey: "teamBusiness", descKey: "teamBusinessDesc" },
  { id: "association", labelKey: "association", descKey: "associationDesc" },
] as const;

export function Onboarding() {
  const create = useMutation(api.workspaces.create);
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]["id"]>("individual");
  const [busy, setBusy] = useState(false);
  const t = useTranslations("onboarding.simple");
  const th = useTranslations("home");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error(t("nameRequired"));
    setBusy(true);
    try {
      await create({ name: name.trim(), type });
      toast.success(t("workspaceReady"));
      router.refresh();
    } catch {
      toast.error(t("createFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <span className="text-2xl font-extrabold tracking-tight">{th("tagline")}</span>
          <button onClick={() => router.push("/api/auth/signout")} data-testid="onboarding-signout" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <Logout variant="Bulk" size={16} /> {t("signOut")}
          </button>
        </div>
        <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-[var(--flux-coral-soft)] px-3 py-1 text-sm font-medium text-primary">
          <Flash variant="Bulk" size={16} /> {t("badge")}
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">{t("createTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("createDesc")}</p>

        <form onSubmit={submit} className="mt-7 space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("workspaceName")}</label>
            <input data-testid="onboarding-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("workspacePlaceholder")} className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-2">
            {TYPES.map((typeOption) => (
              <button type="button" key={typeOption.id} data-testid={`onboarding-type-${typeOption.id}`} onClick={() => setType(typeOption.id)} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${type === typeOption.id ? "border-primary bg-[var(--flux-coral-soft)]" : "border-border hover:bg-muted"}`}>
                <div>
                  <div className="text-sm font-semibold">{t(`types.${typeOption.labelKey}`)}</div>
                  <div className="text-xs text-muted-foreground">{t(`types.${typeOption.descKey}`)}</div>
                </div>
                <span className={`h-4 w-4 rounded-full border-2 ${type === typeOption.id ? "border-primary bg-primary" : "border-border"}`} />
              </button>
            ))}
          </div>
          <button disabled={busy} data-testid="onboarding-submit" className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? t("creating") : t("createWorkspace")} <ArrowRight2 variant="Bulk" size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
