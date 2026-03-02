"use client";
import { useTranslations } from "next-intl";

const FEATURE_COLORS = [
  { num: "[01]", tagColor: "#f76c5e", accent: true },
  { num: "[02]", tagColor: "#60a5fa", accent: false },
  { num: "[03]", tagColor: "#4ade80", accent: false },
  { num: "[04]", tagColor: "#a78bfa", accent: false },
  { num: "[05]", tagColor: "#f76c5e", accent: false },
  { num: "[06]", tagColor: "#fbbf24", accent: false },
];

const FEATURE_KEYS = ["f1", "f2", "f3", "f4", "f5", "f6"] as const;

export function Features() {
  const tf = useTranslations("landing.features");

  const row1 = FEATURE_KEYS.slice(0, 3);
  const row2 = FEATURE_KEYS.slice(3);

  return (
    <section id="features" className="w-full py-20 md:py-[100px] bg-gray-50 dark:bg-[#0d0d0d]">
      <div className="mx-auto max-w-[1100px] px-5 md:px-10">
        <div className="mb-12 flex flex-col gap-3">
          <span className="font-mono text-[10px] md:text-[12px] font-bold uppercase tracking-[3px] text-[#f76c5e]">{tf("sectionNum")}</span>
          <h2 className="font-mono text-[32px] md:text-[52px] font-bold leading-[1.05] tracking-[-1px] text-gray-900 dark:text-[#f0f0ee]">
            {tf("heading")}<br />
            <span className="text-[#f76c5e]">{tf("headingAccent")}</span>
          </h2>
          <p className="font-mono text-[11px] md:text-[13px] leading-[1.6] tracking-[1px] max-w-[500px] text-gray-500 dark:text-[#666]">{tf("subheading")}</p>
        </div>

        <div className="flex flex-col gap-[2px]">
          <div className="flex flex-col md:flex-row gap-[2px]">
            {/* Accent card */}
            <div className="flex flex-col gap-4 p-8 md:p-10 w-full md:flex-1" style={{ backgroundColor: "#f76c5e", minHeight: 280 }}>
              <span className="font-mono text-[11px] font-bold uppercase tracking-[2px]" style={{ color: "rgba(0,0,0,0.5)" }}>{FEATURE_COLORS[0].num}</span>
              <h3 className="font-mono text-[22px] md:text-[26px] font-bold leading-[1.1] whitespace-pre-line" style={{ color: "#fff" }}>{tf("f1Title")}</h3>
              <p className="font-mono text-[11px] leading-[1.6] tracking-[0.5px]" style={{ color: "rgba(255,255,255,0.75)" }}>{tf("f1Desc")}</p>
              <div className="flex items-center h-7 px-3 w-fit rounded" style={{ backgroundColor: "rgba(0,0,0,0.2)" }}>
                <span className="font-mono text-[9px] font-bold uppercase tracking-[2px]" style={{ color: "#fff" }}>{tf("liveBadge")}</span>
              </div>
            </div>
            {row1.slice(1).map((key, i) => {
              const fc = FEATURE_COLORS[i + 1];
              return (
                <div key={key} className="flex flex-col gap-4 p-8 md:p-10 w-full md:flex-1 group transition-colors bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#2d2d2d] hover:border-gray-400 dark:hover:border-[#3a3a3a]" style={{ minHeight: 280 }}>
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[2px]" style={{ color: fc.tagColor }}>{fc.num}</span>
                  <h3 className="font-mono text-[22px] md:text-[26px] font-bold leading-[1.1] whitespace-pre-line text-gray-900 dark:text-[#f0f0ee]">{tf(`${key}Title` as any)}</h3>
                  <p className="font-mono text-[11px] leading-[1.6] tracking-[0.5px] text-gray-500 dark:text-[#666]">{tf(`${key}Desc` as any)}</p>
                  <div className="flex items-center h-7 px-3 w-fit rounded bg-gray-100 dark:bg-[#1a1a1a]" style={{ border: `1px solid ${fc.tagColor}` }}>
                    <span className="font-mono text-[9px] uppercase tracking-[2px]" style={{ color: fc.tagColor }}>{tf(`${key}Tag` as any)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col md:flex-row gap-[2px]">
            {row2.map((key, i) => {
              const fc = FEATURE_COLORS[i + 3];
              return (
                <div key={key} className="flex flex-col gap-4 p-8 md:p-10 w-full md:flex-1 transition-colors bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#2d2d2d] hover:border-gray-400 dark:hover:border-[#3a3a3a]" style={{ minHeight: 240 }}>
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[2px]" style={{ color: fc.tagColor }}>{fc.num}</span>
                  <h3 className="font-mono text-[20px] md:text-[24px] font-bold leading-[1.1] whitespace-pre-line text-gray-900 dark:text-[#f0f0ee]">{tf(`${key}Title` as any)}</h3>
                  <p className="font-mono text-[11px] leading-[1.6] tracking-[0.5px] text-gray-500 dark:text-[#666]">{tf(`${key}Desc` as any)}</p>
                  <div className="flex items-center h-7 px-3 w-fit rounded bg-gray-100 dark:bg-[#1a1a1a]" style={{ border: `1px solid ${fc.tagColor}` }}>
                    <span className="font-mono text-[9px] uppercase tracking-[2px]" style={{ color: fc.tagColor }}>{tf(`${key}Tag` as any)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
