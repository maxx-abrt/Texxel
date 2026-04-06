"use client";

import { Heading } from "./_components/Heading";
import { Features } from "./_components/Features";
import { Footer } from "./_components/Footer";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, Crown, Sparkles } from "lucide-react";

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
    <div className="bg-white dark:bg-[#0a0a0a]">

      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center px-5 pt-20 pb-0 md:pt-24 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px]" style={{ background: "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(247,108,94,0.08), transparent)" }} />
        <Heading />
      </section>

      {/* ── Stats ── */}
      <section className="mt-20 md:mt-28 border-y border-gray-100 dark:border-white/5">
        <div className="mx-auto max-w-[1060px] px-5 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100 dark:divide-white/5">
            {STATS_KEYS.map((key, i) => (
              <div key={key} className="flex flex-col items-center justify-center py-8 gap-1.5">
                <span className="text-[28px] md:text-[36px] font-bold tracking-tight text-[#f76c5e]">
                  {STATS_VALUES[i]}
                </span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">{ts(key)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Value props ── */}
      <section className="py-20 md:py-24 bg-white dark:bg-[#0a0a0a]">
        <div className="mx-auto max-w-[1060px] px-5 md:px-8">
          <p className="mb-10 text-[13px] text-center text-gray-400 dark:text-gray-500">
            {tv("heading")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {VALUE_PROP_KEYS.map((key, i) => (
              <div
                key={key}
                className="flex flex-col gap-3 p-6 rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/2 transition-all hover:border-gray-200 dark:hover:border-white/10 hover:shadow-sm"
              >
                <span className="text-2xl">{VALUE_PROP_ICONS[i]}</span>
                <h3 className="text-[14px] font-semibold text-gray-900 dark:text-white">
                  {tv(`${key}.title` as any)}
                </h3>
                <p className="text-[12px] leading-relaxed text-gray-500 dark:text-gray-500">
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
      <section id="how-it-works" className="py-20 md:py-28 bg-white dark:bg-[#0a0a0a]">
        <div className="mx-auto max-w-[1060px] px-5 md:px-8">
          <div className="mb-14 max-w-[520px]">
            <span className="text-[12px] font-semibold uppercase tracking-widest text-[#f76c5e]">{tw("sectionNum")}</span>
            <h2 className="mt-3 text-[28px] md:text-[44px] font-bold leading-[1.1] tracking-tight text-gray-900 dark:text-white">
              {tw("heading")}{" "}
              <span className="text-[#f76c5e]">{tw("headingAccent")}</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {HOW_STEP_KEYS.map((key) => (
              <div
                key={key}
                className="group flex flex-col gap-5 p-7 md:p-8 rounded-2xl bg-gray-50/50 dark:bg-white/2 border border-gray-100 dark:border-white/5 transition-all hover:border-[#f76c5e]/30 hover:shadow-sm"
              >
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-[#f76c5e] text-[13px] font-bold text-white">
                  {tw(`${key}Num` as any)}
                </div>
                <h3 className="text-[18px] md:text-[22px] font-bold leading-tight text-gray-900 dark:text-white">
                  {tw(`${key}Title` as any)}
                </h3>
                <p className="text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
                  {tw(`${key}Desc` as any)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section
        id="pricing"
        className="py-20 md:py-28 bg-gray-50/50 dark:bg-[#0f0f0f] border-t border-gray-100 dark:border-white/5"
      >
        <div className="mx-auto max-w-[1060px] px-5 md:px-8">
          <div className="mb-14 text-center">
            <span className="text-[12px] font-semibold uppercase tracking-widest text-[#f76c5e]">{tp("sectionNum")}</span>
            <h2 className="mt-3 text-[28px] md:text-[44px] font-bold leading-[1.1] tracking-tight text-gray-900 dark:text-white">
              {tp("heading")}{" "}
              <span className="text-[#f76c5e]">{tp("headingAccent")}</span>
            </h2>
            <p className="mt-4 text-[14px] md:text-[16px] leading-relaxed text-gray-500 dark:text-gray-400 max-w-[520px] mx-auto">
              {tp("subheading")}
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-gray-400 dark:text-gray-500 max-w-[440px] mx-auto italic">
              {tp("workspaceExplainer")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[780px] mx-auto">
            {/* Free plan */}
            <div className="flex flex-col rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-white/2 p-7 md:p-8">
              <h3 className="text-[16px] font-bold text-gray-900 dark:text-white">{tp("free.name")}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-[36px] md:text-[44px] font-bold tracking-tight text-gray-900 dark:text-white">{tp("free.price")}</span>
                <span className="text-[13px] text-gray-400 dark:text-gray-500">{tp("free.period")}</span>
              </div>
              <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">{tp("free.desc")}</p>

              <ul className="mt-6 flex flex-col gap-2.5 flex-1">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-gray-600 dark:text-gray-300">
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                    {tp(`free.${f}` as any)}
                  </li>
                ))}
              </ul>

              <a
                href="/auth/sign-up"
                className="mt-8 flex items-center justify-center gap-2 h-11 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[14px] font-medium text-gray-900 dark:text-white transition-all hover:bg-gray-100 dark:hover:bg-white/10 active:scale-[0.98]"
              >
                {tp("free.cta")}
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>

            {/* Suite plan */}
            <div className="relative flex flex-col rounded-2xl border-2 border-[#f76c5e]/40 bg-white dark:bg-white/2 p-7 md:p-8 shadow-lg shadow-[#f76c5e]/5">
              <div className="absolute -top-3 right-6 flex items-center gap-1 rounded-full bg-[#f76c5e] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                <Crown className="h-3 w-3" />
                {tp("suite.badge")}
              </div>

              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#f76c5e]" />
                <h3 className="text-[16px] font-bold text-gray-900 dark:text-white">{tp("suite.name")}</h3>
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-[36px] md:text-[44px] font-bold tracking-tight text-[#f76c5e]">{tp("suite.price")}</span>
                <span className="text-[13px] text-gray-400 dark:text-gray-500">{tp("suite.period")}</span>
              </div>
              <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">{tp("suite.desc")}</p>

              <ul className="mt-6 flex flex-col gap-2.5 flex-1">
                {SUITE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-gray-600 dark:text-gray-300">
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-[#f76c5e]" />
                    {tp(`suite.${f}` as any)}
                  </li>
                ))}
              </ul>

              <a
                href="/auth/sign-up"
                className="mt-8 group flex items-center justify-center gap-2 h-11 rounded-xl bg-[#f76c5e] text-[14px] font-medium text-white transition-all hover:bg-[#e85d4f] active:scale-[0.98] shadow-[0_1px_2px_rgba(247,108,94,0.3)]"
              >
                {tp("suite.cta")}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 md:py-28 bg-white dark:bg-[#0a0a0a]">
        <div className="mx-auto max-w-[1060px] px-5 md:px-8 flex flex-col items-center text-center gap-5">
          <span className="text-[12px] font-semibold uppercase tracking-widest text-[#f76c5e]">{tc("sectionNum")}</span>
          <h2 className="text-[32px] md:text-[52px] font-bold leading-[1.08] tracking-tight text-gray-900 dark:text-white">
            {tc("heading")}{" "}
            <span className="text-[#f76c5e]">{tc("headingAccent")}</span>
          </h2>
          <p className="text-[14px] md:text-[16px] leading-relaxed max-w-[480px] text-gray-500 dark:text-gray-400">
            {tc("desc")} {tc("desc2")}
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
            <a
              href="/auth/sign-up"
              className="group flex items-center justify-center gap-2 h-11 px-7 rounded-xl bg-[#f76c5e] text-[14px] font-medium text-white transition-all hover:bg-[#e85d4f] active:scale-[0.98] shadow-[0_1px_2px_rgba(247,108,94,0.3)]"
            >
              {tc("button")}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </a>
            <div className="flex items-center gap-2 text-[12px] text-gray-400 dark:text-gray-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {tc("noSetup")}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
