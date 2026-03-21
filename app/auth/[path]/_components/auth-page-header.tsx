"use client";

import { useTranslations } from "next-intl";

interface AuthPageHeaderProps {
  isSignUp: boolean;
}

export function AuthPageHeader({ isSignUp }: AuthPageHeaderProps) {
  const t = useTranslations("auth");
  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold text-white tracking-tight">Texxel</h1>
      <p className="text-sm text-white/50 mt-0.5">
        {isSignUp ? t("signUp") : t("signIn")}
      </p>
    </div>
  );
}

export function AuthPageTerms() {
  const t = useTranslations("auth");
  return (
    <p className="mt-6 text-center text-xs text-white/30">
      {t("terms")}
    </p>
  );
}
