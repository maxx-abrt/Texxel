"use client";

import { useLocale } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";

/**
 * Compact FR/EN toggle for the landing navbar.
 * Intentionally dependency-free (no dropdown) so it stays instant.
 */
export const LangSwitch = ({ className }: { className?: string }) => {
  const { locale, setLocale } = useLocale();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-black/5 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] p-0.5",
        className,
      )}
      role="group"
      aria-label="Language"
    >
      {(["fr", "en"] as const).map((code) => (
        <button
          key={code}
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={cn(
            "h-6 min-w-[28px] px-1.5 rounded-full text-[10.5px] font-semibold uppercase tracking-wider transition-all",
            locale === code
              ? "bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white",
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
};
