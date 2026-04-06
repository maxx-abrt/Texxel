"use client";
import { useTranslations } from "next-intl";

const FEATURES = [
  { key: "f1", color: "#f76c5e", accent: true },
  { key: "f2", color: "#60a5fa" },
  { key: "f3", color: "#4ade80" },
  { key: "f4", color: "#a78bfa" },
  { key: "f5", color: "#f76c5e" },
  { key: "f6", color: "#fbbf24" },
] as const;

export function Features() {
  const tf = useTranslations("landing.features");

  return (
    <section id="features" className="w-full py-20 md:py-28 bg-gray-50/50 dark:bg-[#0a0a0a]">
      <div className="mx-auto max-w-[1060px] px-5 md:px-8">
        {/* Section header */}
        <div className="mb-14 max-w-[520px]">
          <span className="text-[12px] font-semibold uppercase tracking-widest text-[#f76c5e]">{tf("sectionNum")}</span>
          <h2 className="mt-3 text-[28px] md:text-[44px] font-bold leading-[1.1] tracking-tight text-gray-900 dark:text-white">
            {tf("heading")}{" "}
            <span className="text-[#f76c5e]">{tf("headingAccent")}</span>
          </h2>
          <p className="mt-4 text-[14px] md:text-[16px] leading-relaxed text-gray-500 dark:text-gray-400">{tf("subheading")}</p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Accent card */}
          <div className="flex flex-col justify-between gap-6 p-7 md:p-8 rounded-2xl bg-[#f76c5e] min-h-[260px]">
            <div className="flex flex-col gap-3">
              <h3 className="text-[20px] md:text-[24px] font-bold leading-tight text-white">{tf("f1Title")}</h3>
              <p className="text-[13px] leading-relaxed text-white/70">{tf("f1Desc")}</p>
            </div>
            <span className="inline-flex items-center h-6 px-2.5 w-fit rounded-md bg-black/15 text-[10px] font-semibold uppercase tracking-wider text-white/90">{tf("liveBadge")}</span>
          </div>

          {/* Regular cards */}
          {FEATURES.slice(1).map((f) => (
            <div
              key={f.key}
              className="flex flex-col justify-between gap-6 p-7 md:p-8 rounded-2xl bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] transition-all hover:border-gray-200 dark:hover:border-white/[0.1] hover:shadow-sm min-h-[240px]"
            >
              <div className="flex flex-col gap-3">
                <h3 className="text-[18px] md:text-[22px] font-bold leading-tight text-gray-900 dark:text-white">{tf(`${f.key}Title` as any)}</h3>
                <p className="text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">{tf(`${f.key}Desc` as any)}</p>
              </div>
              <span
                className="inline-flex items-center h-6 px-2.5 w-fit rounded-md text-[10px] font-medium uppercase tracking-wider"
                style={{ backgroundColor: f.color + "12", color: f.color, border: `1px solid ${f.color}25` }}
              >
                {tf(`${f.key}Tag` as any)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
