"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { toast } from "sonner";
import { Sms, Lock1, Google, Magicpen } from "iconsax-reactjs";

export default function AuthPage() {
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace("/app");
  }, [isAuthenticated, router]);

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn("password", { email, password, name, flow: mode });
      toast.success(mode === "signUp" ? "Account created" : "Welcome back");
      router.replace("/app");
    } catch (err: any) {
      toast.error(err?.message?.includes("InvalidSecret") ? "Invalid email or password" : "Could not sign you in. Check your details.");
    } finally {
      setBusy(false);
    }
  };

  const handleMagic = async () => {
    if (!email) return toast.error("Enter your email first");
    setBusy(true);
    try {
      await signIn("resend", { email });
      toast.success("Magic link sent — check your inbox");
    } catch {
      toast.error("Could not send magic link");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <span className="text-2xl font-extrabold">flux.</span>
        <div>
          <h2 className="font-display text-5xl font-extrabold leading-[0.95]">your<br/>second<br/>brain</h2>
          <p className="mt-5 max-w-sm text-primary-foreground/85">Organize, track and document your work — all in one calm, connected workspace.</p>
        </div>
        <span className="text-sm text-primary-foreground/70">A2E Suite</span>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold">{mode === "signUp" ? "Create your account" : "Welcome back"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{mode === "signUp" ? "Start building your second brain." : "Sign in to your Flux workspace."}</p>

          <button onClick={() => signIn("google")} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-sm font-medium hover:bg-muted">
            <Google variant="Bulk" size={18} className="text-primary" /> Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border"/>or<div className="h-px flex-1 bg-border"/></div>

          <form onSubmit={handlePassword} className="space-y-3">
            {mode === "signUp" && (
              <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Full name" className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
            )}
            <div className="relative">
              <Sms variant="Bulk" size={18} className="absolute left-3 top-2.5 text-muted-foreground" />
              <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@email.com" className="w-full rounded-xl border border-border bg-card px-4 py-2.5 pl-10 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="relative">
              <Lock1 variant="Bulk" size={18} className="absolute left-3 top-2.5 text-muted-foreground" />
              <input type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password" className="w-full rounded-xl border border-border bg-card px-4 py-2.5 pl-10 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? "Please wait…" : mode === "signUp" ? "Create account" : "Sign in"}
            </button>
          </form>

          <button onClick={handleMagic} disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted">
            <Magicpen variant="Bulk" size={18} className="text-primary" /> Email me a magic link
          </button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signUp" ? "Already have an account?" : "New to Flux?"}{" "}
            <button onClick={() => setMode(mode === "signUp" ? "signIn" : "signUp")} className="font-semibold text-primary">
              {mode === "signUp" ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
