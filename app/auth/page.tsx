"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useConvexAuth } from "convex/react";
import {
  ArrowRight2,
  Sms,
  Flash,
  DocumentText,
  TaskSquare,
  Calendar,
  TickCircle,
} from "iconsax-reactjs";

// Client-only animated grain gradient (avoids SSR issues with the shader lib).
const GrainGradient = dynamic(
  () => import("@paper-design/shaders-react").then((m) => m.GrainGradient),
  { ssr: false },
);

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" fill="#34A853" />
      <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84Z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" fill="#EB4335" />
    </svg>
  );
}

export default function AuthPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/app");
  }, [isAuthenticated, isLoading, router]);

  const goWorkos = () => {
    setSubmitting(true);
    if (email) {
      try {
        window.localStorage.setItem("texxel:last-email", email);
      } catch {}
    }
    // WorkOS AuthKit owns the credential step; our page is the branded entry.
    const params = new URLSearchParams();
    if (email) params.set("login_hint", email);
    window.location.href = `/next-api/auth/signin?${params.toString()}`;
  };

  return (
    <section className="min-h-screen bg-background p-3 text-foreground antialiased [font-synthesis:none]">
      <div className="grid min-h-[calc(100vh-1.5rem)] gap-3 lg:grid-cols-[0.92fr_1.08fr]">
        {/* ── Left: branded form ─────────────────────────────────────── */}
        <div className="flex min-h-[640px] items-center rounded-2xl border border-border bg-card px-6 py-10 sm:px-10 lg:min-h-0 lg:px-14 xl:px-20">
          <div className="tx-fade-in mx-auto w-full max-w-[440px]">
            {/* Wordmark */}
            <div className="mb-10 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Flash variant="Bulk" size={20} />
              </span>
              <span className="text-xl font-extrabold tracking-tight">texxel</span>
            </div>

            <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-3 text-base leading-snug text-muted-foreground">
              {mode === "signin"
                ? "Sign in to your connected workspace — docs, tasks & plans."
                : "One calm, connected workspace for everything your team builds."}
            </p>

            {/* Social */}
            <div className="mt-8 grid gap-3">
              <button
                type="button"
                onClick={goWorkos}
                disabled={submitting}
                data-testid="auth-google-button"
                className="tx-focus flex h-11 items-center justify-center gap-2.5 rounded-xl border border-border bg-background text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-60"
              >
                <GoogleGlyph /> Continue with Google
              </button>
            </div>

            <div className="my-7 flex items-center gap-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>

            {/* Email form — WorkOS handles magic link / password on its hosted page */}
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                goWorkos();
              }}
            >
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Email</span>
                <div className="flex h-11 items-center gap-2.5 rounded-xl border border-border bg-background px-3.5 transition-colors focus-within:border-primary/60">
                  <Sms variant="Bulk" size={18} className="shrink-0 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    aria-label="Email"
                    data-testid="auth-email-input"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={submitting}
                data-testid="auth-submit-button"
                className="tx-focus mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-[var(--elev-1)] transition-[filter,box-shadow] hover:shadow-[var(--elev-2)] hover:brightness-[0.98] disabled:opacity-60"
              >
                {submitting ? "Redirecting…" : mode === "signin" ? "Continue with email" : "Create account"}
                {!submitting && <ArrowRight2 variant="Bulk" size={16} />}
              </button>

              <p className="text-xs text-muted-foreground">
                You'll receive a magic link or be asked for a password — secured by WorkOS.
              </p>
            </form>

            <p className="mt-6 text-sm text-muted-foreground">
              {mode === "signin" ? "New to Texxel? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
                data-testid="auth-toggle-mode"
                className="font-semibold text-primary hover:underline"
              >
                {mode === "signin" ? "Create an account" : "Sign in"}
              </button>
            </p>

            <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
              Secured by WorkOS. By continuing you agree to our{" "}
              <span className="font-medium underline underline-offset-2">Terms</span> and{" "}
              <span className="font-medium underline underline-offset-2">Privacy Policy</span>.
            </p>
          </div>
        </div>

        {/* ── Right: animated grain gradient panel ───────────────────── */}
        <div className="relative hidden overflow-hidden rounded-2xl bg-[#d14b33] p-10 text-white lg:flex">
          {/* CSS fallback layer (always present) */}
          <div className="tx-grain-panel absolute inset-0" />
          <div className="tx-grain-noise absolute inset-0 opacity-40" />
          {/* Shader layer (client-only, overlays on top when loaded) */}
          <div className="absolute inset-0">
            <GrainGradient
              // @ts-ignore - shader props
              style={{ width: "100%", height: "100%" }}
              speed={0.8}
              scale={1}
              softness={0.55}
              intensity={0.5}
              noise={0.28}
              shape="corners"
              colors={["#FAF6F2", "#F2A58F", "#E55A42", "#FAF6F2"]}
              colorBack="#00000000"
            />
          </div>

          <div className="relative z-10 flex h-full w-full flex-col justify-between">
            <div className="flex items-center gap-2 text-white/90">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                <Flash variant="Bulk" size={20} />
              </span>
              <span className="text-lg font-bold tracking-tight">texxel</span>
            </div>

            <div>
              <h2 className="max-w-[560px] text-5xl font-semibold leading-[1.0] tracking-[-0.03em] xl:text-6xl">
                Think together,
                <br />
                build faster.
              </h2>
              <p className="mt-5 max-w-md text-lg text-white/85">
                Docs, tasks, calendar and databases — one durable, real-time workspace.
              </p>

              <div className="mt-9 flex flex-wrap gap-2.5">
                {[
                  { Icon: DocumentText, label: "Docs" },
                  { Icon: TaskSquare, label: "Tasks" },
                  { Icon: Calendar, label: "Calendar" },
                ].map((c) => (
                  <span
                    key={c.label}
                    className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-sm"
                  >
                    <c.Icon variant="Bulk" size={16} /> {c.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-white/80">
              <TickCircle variant="Bulk" size={18} /> Trusted real-time collaboration
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
