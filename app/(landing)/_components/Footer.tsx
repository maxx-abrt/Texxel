"use client";
import { useTranslations } from "next-intl";

export const Footer = () => {
  const tfoot = useTranslations("landing.footer");
  return (
  <footer className="bg-gray-50 dark:bg-[#0d0d0d] border-t border-gray-200 dark:border-[#2a2a2a]">
    <div className="mx-auto max-w-[1100px] px-5 md:px-10 py-16">
      <div className="grid gap-10 md:grid-cols-4">
        {/* Brand */}
        <div className="md:col-span-2 flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-[22px] w-[22px] items-center justify-center" style={{ backgroundColor: "#f76c5e" }}>
              <span className="block h-[8px] w-[8px] bg-white dark:bg-[#0f0f0f]" />
            </span>
            <span className="font-mono text-[13px] font-bold tracking-[2.5px] text-gray-900 dark:text-[#f0f0ee]">TEXXEL</span>
          </div>
          <p className="font-mono text-[11px] leading-[1.7] tracking-[0.5px] max-w-[300px] text-gray-500 dark:text-[#555]">
            {tfoot("tagline")}
          </p>
          <div className="flex items-center gap-2 h-7 px-3 w-fit bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2d2d2d]">
            <span className="h-1.5 w-1.5 bg-emerald-400" />
            <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-gray-400 dark:text-[#444]">{tfoot("systemsOk")}</span>
          </div>
        </div>

        {/* Product */}
        <div className="flex flex-col gap-4">
          <span className="font-mono text-[9px] font-bold uppercase tracking-[2px] text-[#f76c5e]">{tfoot("product")}</span>
          {["Documents", "Tasks", "Projects", "Teams", "Inbox", "Calendar"].map((l) => (
            <a key={l} href="#" className="font-mono text-[11px] tracking-[1px] transition-colors text-gray-500 dark:text-[#555] hover:text-gray-900 dark:hover:text-[#f0f0ee]">    
              {l.toUpperCase()}
            </a>
          ))}
        </div>

        {/* Company */}
        <div className="flex flex-col gap-4">
          <span className="font-mono text-[9px] font-bold uppercase tracking-[2px] text-[#f76c5e]">{tfoot("company")}</span>
          {["About", "Changelog", "Privacy", "Terms"].map((l) => (
            <a key={l} href="#" className="font-mono text-[11px] tracking-[1px] transition-colors text-gray-500 dark:text-[#555] hover:text-gray-900 dark:hover:text-[#f0f0ee]">    
              {l.toUpperCase()}
            </a>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mt-14 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100 dark:border-[#1e1e1e]">
        <p className="font-mono text-[10px] tracking-[1.5px] text-gray-400 dark:text-[#333]">
          &copy; {new Date().getFullYear()} {tfoot("copyright")}
        </p>
        <p className="font-mono text-[10px] tracking-[1.5px] text-gray-400 dark:text-[#333]">
          {tfoot("madeWith")}
        </p>
      </div>
    </div>
  </footer>
  );
};
