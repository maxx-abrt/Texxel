"use client";
import { useTranslations } from "next-intl";
import { LangSwitch } from "./LangSwitch";

export const Footer = () => {
  const tfoot = useTranslations("landing.footer");
  return (
    <footer className="relative overflow-hidden border-t border-black/[0.06] dark:border-white/[0.06]">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="tx-aura"
          style={{
            top: "-20%",
            left: "50%",
            width: "900px",
            height: "400px",
            transform: "translateX(-50%)",
            background: "radial-gradient(closest-side, rgba(247,108,94,0.08), transparent 70%)",
          }}
        />
      </div>
      <div className="mx-auto max-w-[1100px] px-5 md:px-8 py-16">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-gradient-to-br from-[#ff8476] to-[#e85d4f] shadow-[0_1px_2px_rgba(247,108,94,0.4),inset_0_1px_0_rgba(255,255,255,0.3)]">
                <span className="block h-[9px] w-[9px] rounded-[2.5px] bg-white/95" />
              </span>
              <span className="text-[14px] font-semibold tracking-[-0.02em] text-gray-900 dark:text-white">
                Texxel
              </span>
            </div>
            <p className="text-[13px] leading-relaxed max-w-[320px] text-gray-500 dark:text-gray-500">
              {tfoot("tagline")}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 h-6 px-2.5 w-fit rounded-full bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 tracking-tight">
                  {tfoot("systemsOk")}
                </span>
              </div>
              <LangSwitch />
            </div>
          </div>

          {/* Product */}
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
              {tfoot("product")}
            </span>
            {(["documents", "tasks", "projects", "teams", "inbox", "calendar"] as const).map((key) => (
              <a
                key={key}
                href="#features"
                className="text-[13px] text-gray-500 dark:text-gray-500 transition-colors hover:text-gray-900 dark:hover:text-white"
              >
                {tfoot(`links.${key}` as any)}
              </a>
            ))}
          </div>

          {/* Company */}
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
              {tfoot("company")}
            </span>
            {(["about", "changelog", "privacy", "terms"] as const).map((key) => (
              <a
                key={key}
                href="#"
                className="text-[13px] text-gray-500 dark:text-gray-500 transition-colors hover:text-gray-900 dark:hover:text-white"
              >
                {tfoot(`links.${key}` as any)}
              </a>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-black/[0.05] dark:border-white/[0.06]">
          <p className="text-[12px] text-gray-400 dark:text-gray-600">
            &copy; {new Date().getFullYear()} {tfoot("copyright")}
          </p>
          <p className="text-[12px] text-gray-400 dark:text-gray-600">
            {tfoot("madeWith")}
          </p>
        </div>
      </div>
    </footer>
  );
};
