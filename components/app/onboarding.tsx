"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Flash, ArrowRight2, Logout } from "iconsax-reactjs";

const TYPES = [
  { id: "individual", label: "Personal", desc: "Just for me" },
  { id: "business", label: "Team / Business", desc: "Collaborate with a team" },
  { id: "association", label: "Association", desc: "Non-profit / community" },
] as const;

export function Onboarding() {
  const create = useMutation(api.workspaces.create);
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]["id"]>("individual");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Give your workspace a name");
    setBusy(true);
    try {
      await create({ name: name.trim(), type });
      toast.success("Workspace ready \u2014 welcome to Flux");
      router.refresh();
    } catch {
      toast.error("Could not create workspace");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <span className="text-2xl font-extrabold tracking-tight">flux<span className="text-primary">.</span></span>
          <button onClick={() => router.push("/api/auth/signout")} data-testid="onboarding-signout" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <Logout variant="Bulk" size={16} /> Sign out
          </button>
        </div>
        <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-[var(--flux-coral-soft)] px-3 py-1 text-sm font-medium text-primary">
          <Flash variant="Bulk" size={16} /> Let’s set up your space
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">Create your workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">A workspace is your shared home for docs, tasks, projects and calendar.</p>

        <form onSubmit={submit} className="mt-7 space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Workspace name</label>
            <input data-testid="onboarding-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme, My brain, Design team…" className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-2">
            {TYPES.map((t) => (
              <button type="button" key={t.id} data-testid={`onboarding-type-${t.id}`} onClick={() => setType(t.id)} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${type === t.id ? "border-primary bg-[var(--flux-coral-soft)]" : "border-border hover:bg-muted"}`}>
                <div>
                  <div className="text-sm font-semibold">{t.label}</div>
                  <div className="text-xs text-muted-foreground">{t.desc}</div>
                </div>
                <span className={`h-4 w-4 rounded-full border-2 ${type === t.id ? "border-primary bg-primary" : "border-border"}`} />
              </button>
            ))}
          </div>
          <button disabled={busy} data-testid="onboarding-submit" className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? "Creating…" : "Create workspace"} <ArrowRight2 variant="Bulk" size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
