import { AuthView } from "@neondatabase/auth/react";
import { AuthUIWrapper } from "@/components/providers/auth-ui-provider";
import { AuthPageHeader, AuthPageTerms } from "./_components/auth-page-header";
import { AuthBackground } from "./_components/auth-background";
import Link from "next/link";

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
    <main className="auth-shell relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0a0a] text-[#f0f0ee] p-5">
      {/* Static background — radial spotlight + canvas grain */}
      <AuthBackground />

      {/* Top bar — Logo + back link */}
      <header className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-6 md:px-10 h-16">
        <Link href="/" className="group flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-gradient-to-br from-[#ff8476] to-[#e85d4f] shadow-[0_1px_2px_rgba(247,108,94,0.4),inset_0_1px_0_rgba(255,255,255,0.3)] transition-transform group-hover:scale-[1.06]">
            <span className="block h-[9px] w-[9px] rounded-[2.5px] bg-white/95" />
          </span>
          <span className="text-[14px] font-semibold tracking-[-0.02em] text-white">
            Texxel
          </span>
        </Link>
        <Link
          href="/"
          className="hidden sm:inline-flex items-center h-8 px-3 rounded-lg text-[12.5px] text-white/50 hover:text-white transition-colors"
        >
          ← Back to home
        </Link>
      </header>

      {/* Card */}
      <div className="relative z-10 w-full max-w-[400px] tx-animate-in">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <AuthPageHeader isSignUp={isSignUp} />
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <AuthUIWrapper>
            <AuthView
              path={path}
              classNames={{
                base: "!w-full !max-w-none !border-0 !shadow-none !bg-transparent !p-0 !gap-5 [&_*]:!font-sans",
                header: "!hidden",
                content: "!p-0 !gap-5",
                footer: "!p-0 !pt-2 !justify-center !text-white/40 !text-[12.5px]",
                footerLink: "!text-[#f76c5e] hover:!text-[#ff8476] !no-underline !font-medium",
                continueWith: "!text-white/30 !text-[11px] [&_span]:!text-white/30 [&_span]:!text-[11px] [&_span]:!uppercase [&_span]:!tracking-[0.18em]",
                separator: "!bg-white/[0.07]",
                form: {
                  base: "!gap-3.5",
                  label: "!text-white/60 !text-[12px] !font-medium",
                  input: "!h-10 !rounded-lg !bg-white/[0.04] !border !border-white/[0.07] !text-white !text-[13.5px] placeholder:!text-white/25 focus-visible:!ring-1 focus-visible:!ring-[#f76c5e]/50 focus-visible:!border-[#f76c5e]/40 !transition-all",
                  button: "!h-10 !rounded-lg !text-[13px] !font-medium !text-white !bg-gradient-to-b !from-[#ff8476] !via-[#f76c5e] !to-[#e85d4f] !border-0 !shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.14),0_1px_2px_rgba(247,108,94,0.35),0_4px_18px_-4px_rgba(247,108,94,0.45)] hover:!brightness-[1.04] active:!scale-[0.98] !transition-[filter,transform]",
                  forgotPasswordLink: "!text-white/40 hover:!text-white/70 !text-[11.5px]",
                  outlineButton: "!h-10 !rounded-lg !text-[13px] !font-medium !bg-white/[0.04] hover:!bg-white/[0.08] !border !border-white/[0.07] hover:!border-white/[0.12] !text-white !transition-colors",
                  providerButton: "!h-10 !rounded-lg !text-[13px] !font-medium !bg-white/[0.04] hover:!bg-white/[0.08] !border !border-white/[0.07] hover:!border-white/[0.12] !text-white !transition-colors",
                },
              }}
            />
          </AuthUIWrapper>
        </div>

        <AuthPageTerms />
      </div>
    </main>
  );
}
