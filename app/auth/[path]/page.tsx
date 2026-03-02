import { AuthView } from "@neondatabase/auth/react";
import { AuthUIWrapper } from "@/components/providers/auth-ui-provider";

export const dynamicParams = false;

export async function generateStaticParams() {
  return [
    { path: "sign-in" },
    { path: "sign-up" },
    { path: "sign-out" },
    { path: "forgot-password" },
    { path: "reset-password" },
  ];
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  const isSignUp = path === "sign-up";

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0f1117] p-4">
      {/* Background gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-[#f76c5e]/20 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-[#7c3aed]/15 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-[#f76c5e]/8 blur-[80px]" />
      </div>

      {/* Card */}
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f76c5e] text-white text-lg font-black shadow-lg shadow-[#f76c5e]/30">
            Tx
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">Texxel</h1>
            <p className="text-sm text-white/50 mt-0.5">
              {isSignUp ? "Create your account" : "Welcome back"}
            </p>
          </div>
        </div>

        {/* Auth form card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <AuthUIWrapper>
            <AuthView path={path} />
          </AuthUIWrapper>
        </div>

        <p className="mt-6 text-center text-xs text-white/30">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </main>
  );
}
