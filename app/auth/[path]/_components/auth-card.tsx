"use client";

import { AuthView } from "@neondatabase/auth/react";
import { AuthUIWrapper } from "@/components/providers/auth-ui-provider";
import { AuthPageHeader, AuthPageTerms } from "./auth-page-header";
import { AuthBackground } from "./auth-background";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface AuthCardProps {
  path: string;
}

export function AuthCard({ path }: AuthCardProps) {
  const isSignUp = path === "sign-up";
  const t = useTranslations("auth");

  // Map our i18n keys to better-auth-ui's AuthLocalization shape
  // Using 'any' because AuthLocalization type is not exported from the package surface
  const localization: any = {
    // Labels
    NAME: t("name"),
    EMAIL: t("email"),
    PASSWORD: t("password"),

    // Placeholders
    NAME_PLACEHOLDER: t("namePlaceholder"),
    EMAIL_PLACEHOLDER: t("emailPlaceholder"),
    PASSWORD_PLACEHOLDER: t("passwordPlaceholder"),

    // Actions / Buttons
    SIGN_IN: t("signIn"),
    SIGN_UP: t("signUp"),
    SIGN_IN_ACTION: t("signIn"),
    SIGN_UP_ACTION: t("createAccount"),
    SIGN_IN_WITH: t("signInWith", { provider: "" }),
    SIGN_OUT: t("signOut"),

    // Dividers / Helpers
    OR_CONTINUE_WITH: t("orContinueWith"),
    ALREADY_HAVE_AN_ACCOUNT: t("alreadyHaveAccount"),
    DONT_HAVE_AN_ACCOUNT: t("dontHaveAccount"),
    FORGOT_PASSWORD_LINK: t("forgotPassword"),
    FORGOT_PASSWORD: t("forgotPassword"),
    FORGOT_PASSWORD_ACTION: t("sendResetLink"),
    FORGOT_PASSWORD_DESCRIPTION: t("resetPassword"),

    // Magic link
    MAGIC_LINK: t("magicLink"),
    MAGIC_LINK_ACTION: t("sendMagicLink"),

    // Reset
    RESET_PASSWORD: t("resetPassword"),
    RESET_PASSWORD_ACTION: t("sendResetLink"),

    // Email OTP
    EMAIL_OTP: t("email"),
    EMAIL_OTP_SEND_ACTION: t("sendResetLink"),
    EMAIL_OTP_VERIFY_ACTION: t("checkYourEmail"),

    // Misc
    GO_BACK: "← Back",
  };

  return (
    <main className="auth-shell relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0a0a] text-[#f0f0ee] p-5">
      <AuthBackground />

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
          ← {t("backToSignIn")}
        </Link>
      </header>

      <div className="relative z-10 w-full max-w-[400px] tx-animate-in">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <AuthPageHeader isSignUp={isSignUp} />
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <AuthUIWrapper>
            <AuthView
              path={path}
              localization={localization}
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
