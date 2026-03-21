"use client";

import { Heading } from "./_components/Heading";
import { Features } from "./_components/Features";
import { Footer } from "./_components/Footer";
import { useTranslations } from "next-intl";

const STATS_VALUES = ["10K+", "4", "∞", "99.9%"] as const;
const STATS_KEYS = ["builders", "toolsInOne", "storage", "uptime"] as const;
const HOW_STEP_KEYS = ["step1", "step2", "step3"] as const;
const VALUE_PROP_KEYS = ["solo", "group", "manage", "free"] as const;
const VALUE_PROP_ICONS = ["✏️", "👥", "📋", "🎓"] as const;

export default function LandingPage() {
  const tl = useTranslations("landing");
  const ts = useTranslations("landing.stats");
  const tw = useTranslations("landing.howItWorks");
  const tc = useTranslations("landing.cta");
  const tv = useTranslations("landing.valueProps");

  return (
    <div className="bg-white dark:bg-[#0f0f0f]">

      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center px-5 pt-20 pb-0 md:pt-24 overflow-hidden">
        {/* Subtle radial glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[500px]" style={{ background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(247,108,94,0.12), transparent)" }} />
        <Heading />
      </section>

      {/* ── Stats ticker ── */}
      <section className="bg-gray-50 dark:bg-[#0d0d0d] border-y border-gray-200 dark:border-[#2a2a2a]">
        <div className="mx-auto max-w-[1100px] px-5 md:px-10">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200 dark:divide-[#2a2a2a]">
            {STATS_KEYS.map((key, i) => (
              <div key={key} className="flex flex-col items-center justify-center py-8 gap-1">
                <span className="font-mono text-[32px] md:text-[40px] font-bold tracking-[-1px] text-[#f76c5e]">
                  {STATS_VALUES[i]}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[2px] text-gray-500 dark:text-[#555]">{ts(key)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Value props strip ── */}
      <section className="py-16 md:py-20 bg-white dark:bg-[#0f0f0f]">
        <div className="mx-auto max-w-[1100px] px-5 md:px-10">
          <p className="mb-10 font-mono text-[11px] md:text-[13px] text-center tracking-[1px] text-gray-400 dark:text-[#555]">
            {tv("heading")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-[2px]">
            {VALUE_PROP_KEYS.map((key, i) => (
              <div
                key={key}
                className="flex flex-col gap-3 p-6 border border-gray-100 dark:border-[#1e1e1e] hover:border-gray-300 dark:hover:border-[#2d2d2d] transition-colors bg-gray-50 dark:bg-[#0d0d0d]"
              >
                <span className="text-2xl">{VALUE_PROP_ICONS[i]}</span>
                <h3 className="font-mono text-[13px] font-bold tracking-[-0.5px] text-gray-900 dark:text-[#f0f0ee]">
                  {tv(`${key}.title` as any)}
                </h3>
                <p className="font-mono text-[10px] leading-[1.7] tracking-[0.3px] text-gray-400 dark:text-[#555]">
                  {tv(`${key}.desc` as any)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features bento ── */}
      <Features />

      {/* ── Divider ── */}
      <div className="h-px bg-gray-100 dark:bg-[#1e1e1e]" />

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-20 md:py-[100px] bg-white dark:bg-[#111111]">
        <div className="mx-auto max-w-[1100px] px-5 md:px-10">
          <div className="mb-12 flex flex-col gap-3">
            <span className="font-mono text-[10px] md:text-[12px] font-bold uppercase tracking-[3px] text-[#f76c5e]">{tw("sectionNum")}</span>
            <h2 className="font-mono text-[32px] md:text-[52px] font-bold leading-[1.05] tracking-[-1px] text-gray-900 dark:text-[#f0f0ee]">
              {tw("heading")}
              <br />
              <span className="text-[#f76c5e]">{tw("headingAccent")}</span>
            </h2>
          </div>
          <div className="flex flex-col md:flex-row gap-[2px]">
            {HOW_STEP_KEYS.map((key) => (
              <div
                key={key}
                className="flex flex-col gap-5 p-8 md:p-10 w-full md:flex-1 transition-colors bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#2d2d2d] hover:border-[#f76c5e]"
              >
                <div className="flex items-center justify-center h-10 w-10" style={{ backgroundColor: "#f76c5e" }}>
                  <span className="font-mono text-[13px] font-bold text-white">{tw(`${key}Num` as any)}</span>
                </div>
                <h3 className="font-mono text-[20px] md:text-[24px] font-bold leading-[1.1] whitespace-pre-line text-gray-900 dark:text-[#f0f0ee]">
                  {tw(`${key}Title` as any)}
                </h3>
                <p className="font-mono text-[11px] leading-[1.6] tracking-[0.5px] text-gray-500 dark:text-[#555]">
                  {tw(`${key}Desc` as any)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section
        id="pricing"
        className="py-20 md:py-[100px] bg-gray-50 dark:bg-[#0d0d0d] border-t border-gray-200 dark:border-[#2a2a2a]"
      >
        <div className="mx-auto max-w-[1100px] px-5 md:px-10 flex flex-col items-center text-center gap-6">
          <span className="font-mono text-[10px] md:text-[12px] font-bold uppercase tracking-[3px] text-[#f76c5e]">{tc("sectionNum")}</span>
          <h2 className="font-mono text-[36px] md:text-[64px] font-bold leading-[1.0] tracking-[-1px] text-gray-900 dark:text-[#f0f0ee]">
            {tc("heading")}
            <br />
            <span className="text-[#f76c5e]">{tc("headingAccent")}</span>
          </h2>
          <p className="font-mono text-[12px] md:text-[14px] tracking-[1px] leading-[1.7] max-w-[500px] text-gray-500 dark:text-[#666]">
            {tc("desc")}
            <br />
            {tc("desc2")}
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-4">
            <a
              href="/auth/sign-up"
              className="flex items-center justify-center h-[48px] px-10 rounded-lg font-mono text-[12px] font-bold tracking-[1px] transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#f76c5e", color: "#fff" }}
            >
              {tc("button")}
            </a>
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[1px] text-gray-400 dark:text-[#555]">
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
