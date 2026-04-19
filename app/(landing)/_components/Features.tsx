"use client";
import { useTranslations } from "next-intl";
import { Noise } from "@/components/ui/noise";

const FEATURES = [
  { key: "f2", color: "#60a5fa" },
  { key: "f3", color: "#4ade80" },
  { key: "f4", color: "#a78bfa" },
  { key: "f5", color: "#f76c5e" },
  { key: "f6", color: "#fbbf24" },
] as const;

export function Features() {
  const tf = useTranslations("landing.features");

  return (
    <section id="features" className="relative w-full py-20 md:py-32 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="tx-aura"
          style={{
            top: "20%",
            left: "-5%",
            width: "480px",
            height: "480px",
            background: "radial-gradient(closest-side, rgba(247,108,94,0.15), transparent 70%)",
          }}
        />
      </div>
      <div className="mx-auto max-w-[1100px] px-5 md:px-8">
        {/* Section header */}
        <div className="mb-16 max-w-[640px]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f76c5e]">
            {tf("sectionNum")}
          </span>
          <h2 className="mt-3 text-[30px] md:text-[52px] font-semibold leading-[1.05] tracking-[-0.03em] text-gray-900 dark:text-white">
            {tf("heading")}{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(100deg, #ffb5a8 0%, #f76c5e 50%, #e04a3a 100%)" }}
            >
              {tf("headingAccent")}
            </span>
          </h2>
          <p className="mt-5 text-[15px] md:text-[17px] leading-[1.55] text-gray-500 dark:text-gray-400">
            {tf("subheading")}
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Accent hero card */}
          <div className="relative overflow-hidden flex flex-col justify-between gap-6 p-7 md:p-8 rounded-2xl min-h-[280px] text-white shadow-[0_24px_60px_-20px_rgba(247,108,94,0.45)]"
               style={{ background: "linear-gradient(160deg, #ff8a7a 0%, #f76c5e 50%, #d94734 100%)" }}>
            {/* noise overlay (canvas, static) */}
            <div className="absolute inset-0 pointer-events-none" style={{ mixBlendMode: "overlay", opacity: 0.6 }}>
              <Noise patternSize={200} patternAlpha={26} />
            </div>
            {/* subtle glow */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full"
              style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.28), transparent 70%)" }}
            />
            <div className="relative flex flex-col gap-3">
              <h3 className="text-[22px] md:text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] whitespace-pre-line">
                {tf("f1Title")}
              </h3>
              <p className="text-[13.5px] leading-[1.6] text-white/80">{tf("f1Desc")}</p>
            </div>
            <span className="relative inline-flex items-center h-6 px-2.5 w-fit rounded-md bg-black/15 text-[10px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur">
              {tf("liveBadge")}
            </span>
          </div>

          {/* Regular cards */}
          {FEATURES.map((f) => (
            <div
              key={f.key}
              className="tx-card group flex flex-col justify-between gap-6 p-7 md:p-8 rounded-2xl min-h-[260px]"
            >
              <div className="flex flex-col gap-3">
                <h3 className="text-[18px] md:text-[22px] font-semibold leading-[1.2] tracking-tight text-gray-900 dark:text-white whitespace-pre-line">
                  {tf(`${f.key}Title` as any)}
                </h3>
                <p className="text-[13px] leading-[1.6] text-gray-500 dark:text-gray-400">
                  {tf(`${f.key}Desc` as any)}
                </p>
              </div>
              <span
                className="inline-flex items-center h-6 px-2.5 w-fit rounded-md text-[10px] font-medium uppercase tracking-wider"
                style={{
                  backgroundColor: f.color + "14",
                  color: f.color,
                  border: `1px solid ${f.color}30`,
                }}
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
