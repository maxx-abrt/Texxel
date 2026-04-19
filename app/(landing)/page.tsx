"use client";

import { Heading } from "./_components/Heading";
import { Features } from "./_components/Features";
import { Footer } from "./_components/Footer";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, Crown, Sparkles } from "lucide-react";
import Link from "next/link";

const STATS_VALUES = ["10K+", "4", "∞", "99.9%"] as const;
const STATS_KEYS = ["builders", "toolsInOne", "storage", "uptime"] as const;
const HOW_STEP_KEYS = ["step1", "step2", "step3"] as const;
const VALUE_PROP_KEYS = ["solo", "group", "manage", "free"] as const;
const VALUE_PROP_ICONS = ["✏️", "👥", "📋", "🎓"] as const;
const FREE_FEATURES = ["f1", "f2", "f3", "f4", "f5", "f6", "f7"] as const;
const SUITE_FEATURES = ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8"] as const;

export default function LandingPage() {
  const ts = useTranslations("landing.stats");
  const tw = useTranslations("landing.howItWorks");
  const tc = useTranslations("landing.cta");
  const tv = useTranslations("landing.valueProps");
  const tp = useTranslations("landing.pricing");

  return (
    <div className="relative isolate">
      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center px-5 pt-16 md:pt-24 pb-0 overflow-hidden">
        {/* Ambient gradient blobs + noise */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div
            className="tx-aura tx-animate-drift"
            style={{
              top: "-200px",
              left: "50%",
              width: "720px",
              height: "720px",
              transform: "translateX(-50%)",
              background: "radial-gradient(closest-side, rgba(247,108,94,0.35), transparent 70%)",
            }}
          />
          <div
            className="tx-aura tx-animate-drift"
            style={{
              top: "80px",
              left: "10%",
              width: "420px",
              height: "420px",
              background: "radial-gradient(closest-side, rgba(255,172,136,0.22), transparent 70%)",
              animationDelay: "-6s",
            }}
          />
          <div
            className="tx-aura tx-animate-drift"
            style={{
              top: "180px",
              right: "8%",
              width: "380px",
              height: "380px",
              background: "radial-gradient(closest-side, rgba(224,74,58,0.20), transparent 70%)",
              animationDelay: "-3s",
            }}
          />
          {/* soft grid */}
          <div
            className="absolute inset-0 opacity-[0.25] dark:opacity-[0.18]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(120,120,120,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(120,120,120,0.08) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage:
                "radial-gradient(ellipse 65% 55% at 50% 0%, black 30%, transparent 80%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 65% 55% at 50% 0%, black 30%, transparent 80%)",
            }}
          />
        </div>
        <Heading />
      </section>

      {/* ── Logos / trust strip ── */}
      <section className="mt-24 md:mt-32">
        <div className="mx-auto max-w-[1100px] px-5 md:px-8">
          <div className="tx-hairline mb-10" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6">
            {STATS_KEYS.map((key, i) => (
              <div
                key={key}
                className="flex flex-col items-center justify-center gap-1.5 border-l first:border-l-0 md:border-l border-black/[0.05] dark:border-white/[0.05]"
              >
                <span
                  className="text-[30px] md:text-[38px] font-semibold tracking-[-0.03em] bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(180deg, #f76c5e 0%, #e04a3a 100%)" }}
                >
                  {STATS_VALUES[i]}
                </span>
                <span className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  {ts(key)}
                </span>
              </div>
            ))}
          </div>
          <div className="tx-hairline mt-10" />
        </div>
      </section>

      {/* ── Value props ── */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-[1100px] px-5 md:px-8">
          <p className="mb-10 text-center text-[12px] font-medium uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            {tv("heading")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {VALUE_PROP_KEYS.map((key, i) => (
              <div
                key={key}
                className="tx-card group flex flex-col gap-3 p-6 rounded-2xl"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/[0.03] dark:bg-white/[0.05] text-[18px] transition-transform group-hover:scale-110">
                  {VALUE_PROP_ICONS[i]}
                </span>
                <h3 className="text-[14px] font-semibold tracking-tight text-gray-900 dark:text-white">
                  {tv(`${key}.title` as any)}
                </h3>
                <p className="text-[12.5px] leading-[1.55] text-gray-500 dark:text-gray-400">
                  {tv(`${key}.desc` as any)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <Features />

      {/* ── How it works ── */}
      <section id="how-it-works" className="relative py-20 md:py-32 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="tx-aura"
            style={{
              top: "30%",
              right: "-5%",
              width: "460px",
              height: "460px",
              background: "radial-gradient(closest-side, rgba(247,108,94,0.18), transparent 70%)",
            }}
          />
        </div>
        <div className="mx-auto max-w-[1100px] px-5 md:px-8">
          <div className="mb-16 max-w-[620px]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f76c5e]">
              {tw("sectionNum")}
            </span>
            <h2 className="mt-3 text-[30px] md:text-[52px] font-semibold leading-[1.05] tracking-[-0.03em] text-gray-900 dark:text-white">
              {tw("heading")}{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(100deg, #ffb5a8 0%, #f76c5e 50%, #e04a3a 100%)" }}
              >
                {tw("headingAccent")}
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {HOW_STEP_KEYS.map((key, i) => (
              <div
                key={key}
                className="tx-card group relative flex flex-col gap-5 p-7 md:p-8 rounded-2xl"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff8476] to-[#e85d4f] text-[13px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_8px_20px_-8px_rgba(247,108,94,0.45)]">
                  {tw(`${key}Num` as any)}
                </div>
                <h3 className="text-[18px] md:text-[22px] font-semibold leading-[1.2] tracking-tight text-gray-900 dark:text-white whitespace-pre-line">
                  {tw(`${key}Title` as any)}
                </h3>
                <p className="text-[13px] leading-[1.6] text-gray-500 dark:text-gray-400">
                  {tw(`${key}Desc` as any)}
                </p>
                {i < HOW_STEP_KEYS.length - 1 && (
                  <div className="pointer-events-none absolute top-1/2 -right-3 hidden md:flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white dark:bg-[#0a0a0a] border border-black/[0.06] dark:border-white/[0.08] text-gray-400">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section
        id="pricing"
        className="relative py-20 md:py-32 overflow-hidden"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="tx-aura"
            style={{
              top: "-80px",
              left: "50%",
              width: "800px",
              height: "600px",
              transform: "translateX(-50%)",
              background: "radial-gradient(closest-side, rgba(247,108,94,0.16), transparent 70%)",
            }}
          />
        </div>

        <div className="mx-auto max-w-[1100px] px-5 md:px-8">
          <div className="mb-14 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f76c5e]">
              {tp("sectionNum")}
            </span>
            <h2 className="mt-3 text-[30px] md:text-[52px] font-semibold leading-[1.05] tracking-[-0.03em] text-gray-900 dark:text-white">
              {tp("heading")}{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(100deg, #ffb5a8 0%, #f76c5e 50%, #e04a3a 100%)" }}
              >
                {tp("headingAccent")}
              </span>
            </h2>
            <p className="mt-5 text-[15px] md:text-[17px] leading-[1.55] text-gray-500 dark:text-gray-400 max-w-[560px] mx-auto">
              {tp("subheading")}
            </p>
            <p className="mt-3 text-[12.5px] text-gray-400 dark:text-gray-500 max-w-[460px] mx-auto italic">
              {tp("workspaceExplainer")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[820px] mx-auto">
            {/* Free plan */}
            <div className="tx-card relative flex flex-col p-7 md:p-8 rounded-2xl">
              <h3 className="text-[16px] font-semibold tracking-tight text-gray-900 dark:text-white">
                {tp("free.name")}
              </h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-[38px] md:text-[48px] font-semibold tracking-[-0.03em] text-gray-900 dark:text-white">
                  {tp("free.price")}
                </span>
                <span className="text-[13px] text-gray-400 dark:text-gray-500">{tp("free.period")}</span>
              </div>
              <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">{tp("free.desc")}</p>

              <ul className="mt-6 flex flex-col gap-2.5 flex-1">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-gray-600 dark:text-gray-300">
                    <span className="flex h-4 w-4 shrink-0 mt-0.5 items-center justify-center rounded-full bg-emerald-500/10">
                      <Check className="h-3 w-3 text-emerald-500" />
                    </span>
                    {tp(`free.${f}` as any)}
                  </li>
                ))}
              </ul>

              <Link
                href="/auth/sign-up"
                prefetch
                className="tx-btn-ghost mt-8 w-full"
              >
                {tp("free.cta")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Suite plan */}
            <div className="relative flex flex-col rounded-2xl p-7 md:p-8 bg-gradient-to-b from-white to-[#fff7f5] dark:from-white/[0.03] dark:to-[#f76c5e]/[0.06] border border-[#f76c5e]/30 shadow-[0_24px_60px_-24px_rgba(247,108,94,0.32)]">
              {/* subtle inner glow */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  background:
                    "radial-gradient(ellipse at top, rgba(247,108,94,0.12), transparent 60%)",
                }}
              />
              <div className="absolute -top-3 right-6 flex items-center gap-1 rounded-full bg-gradient-to-b from-[#ff8476] to-[#e85d4f] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-[0_4px_14px_-4px_rgba(247,108,94,0.55)]">
                <Crown className="h-3 w-3" />
                {tp("suite.badge")}
              </div>

              <div className="relative flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#f76c5e]" />
                <h3 className="text-[16px] font-semibold tracking-tight text-gray-900 dark:text-white">
                  {tp("suite.name")}
                </h3>
              </div>
              <div className="relative mt-4 flex items-baseline gap-1">
                <span
                  className="text-[38px] md:text-[48px] font-semibold tracking-[-0.03em] bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(180deg, #f76c5e 0%, #e04a3a 100%)" }}
                >
                  {tp("suite.price")}
                </span>
                <span className="text-[13px] text-gray-400 dark:text-gray-500">{tp("suite.period")}</span>
              </div>
              <p className="relative mt-2 text-[13px] text-gray-500 dark:text-gray-400">{tp("suite.desc")}</p>

              <ul className="relative mt-6 flex flex-col gap-2.5 flex-1">
                {SUITE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-gray-700 dark:text-gray-300">
                    <span className="flex h-4 w-4 shrink-0 mt-0.5 items-center justify-center rounded-full bg-[#f76c5e]/12">
                      <Check className="h-3 w-3 text-[#f76c5e]" />
                    </span>
                    {tp(`suite.${f}` as any)}
                  </li>
                ))}
              </ul>

              <Link
                href="/auth/sign-up"
                prefetch
                className="tx-btn-primary mt-8 w-full relative"
              >
                {tp("suite.cta")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="tx-aura"
            style={{
              top: "20%",
              left: "50%",
              width: "720px",
              height: "540px",
              transform: "translateX(-50%)",
              background: "radial-gradient(closest-side, rgba(247,108,94,0.22), transparent 70%)",
            }}
          />
        </div>
        <div className="mx-auto max-w-[1100px] px-5 md:px-8 flex flex-col items-center text-center gap-5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f76c5e]">
            {tc("sectionNum")}
          </span>
          <h2 className="text-[32px] md:text-[64px] font-semibold leading-[1.02] tracking-[-0.035em] text-gray-900 dark:text-white max-w-[820px]">
            {tc("heading")}{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(100deg, #ffb5a8 0%, #f76c5e 50%, #e04a3a 100%)" }}
            >
              {tc("headingAccent")}
            </span>
          </h2>
          <p className="text-[15px] md:text-[17px] leading-[1.55] max-w-[520px] text-gray-500 dark:text-gray-400">
            {tc("desc")} {tc("desc2")}
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
            <Link href="/auth/sign-up" prefetch className="tx-btn-primary">
              {tc("button")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <div className="flex items-center gap-2 text-[12px] text-gray-400 dark:text-gray-500">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              {tc("noSetup")}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
