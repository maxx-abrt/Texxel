"use client";
import { useTranslations } from "next-intl";

export const Footer = () => {
  const tfoot = useTranslations("landing.footer");
  return (
    <footer className="bg-white dark:bg-[#0a0a0a] border-t border-gray-100 dark:border-white/5">
      <div className="mx-auto max-w-[1060px] px-5 md:px-8 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#f76c5e]">
                <span className="block h-2 w-2 rounded-[2px] bg-white/90" />
              </span>
              <span className="text-[13px] font-semibold tracking-tight text-gray-900 dark:text-white">Texxel</span>
            </div>
            <p className="text-[13px] leading-relaxed max-w-[280px] text-gray-500 dark:text-gray-500">
              {tfoot("tagline")}
            </p>
            <div className="flex items-center gap-2 h-6 px-2.5 w-fit rounded-md bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-gray-400 dark:text-gray-500">{tfoot("systemsOk")}</span>
            </div>
          </div>

          {/* Product */}
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{tfoot("product")}</span>
            {(["documents", "tasks", "projects", "teams", "inbox", "calendar"] as const).map((key) => (
              <a key={key} href="#features" className="text-[13px] transition-colors text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white">
                {tfoot(`links.${key}` as any)}
              </a>
            ))}
          </div>

          {/* Company */}
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{tfoot("company")}</span>
            {(["about", "changelog", "privacy", "terms"] as const).map((key) => (
              <a key={key} href="#" className="text-[13px] transition-colors text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white">
                {tfoot(`links.${key}` as any)}
              </a>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100 dark:border-white/5">
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
