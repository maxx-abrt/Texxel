"use client";

import { useTranslations } from "next-intl";

interface AuthPageHeaderProps {
  isSignUp: boolean;
}

export function AuthPageHeader({ isSignUp }: AuthPageHeaderProps) {
  const t = useTranslations("auth");
  return (
    <div className="text-center">
      <span className="inline-flex items-center gap-2 h-6 px-2.5 mb-5 rounded-full bg-white/[0.04] border border-white/[0.07] text-[10.5px] uppercase tracking-[0.18em] text-white/50">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[#f76c5e] opacity-70 animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#f76c5e]" />
        </span>
        {isSignUp ? "Sign up" : "Sign in"}
      </span>
      <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-0.025em] leading-[1.05] text-white">
        {isSignUp ? t("signUp") : t("signIn")}
      </h1>
      <p className="mt-2.5 text-[13px] text-white/45 max-w-[320px] mx-auto leading-relaxed">
        {isSignUp
          ? "Create your free workspace — no credit card, no limits."
          : "Welcome back. Pick up where you left off."}
      </p>
    </div>
  );
}

export function AuthPageTerms() {
  const t = useTranslations("auth");
  return (
    <p className="mt-6 text-center text-[11.5px] leading-relaxed text-white/30 max-w-[320px] mx-auto">
      {t("terms")}
    </p>
  );
}
