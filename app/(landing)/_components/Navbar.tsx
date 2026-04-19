"use client";

import { useEffect, useState } from "react";
import { useScrollTop } from "@/hooks/useScrollTop";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LangSwitch } from "./LangSwitch";

export const Navbar = () => {
  const { data: session, isPending } = authClient.useSession();
  const isAuthenticated = !!session;
  const scrolled = useScrollTop(8);
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const tl = useTranslations("landing.nav");

  const NAV_LINKS = [
    { label: tl("features"), href: "#features" },
    { label: tl("howItWorks"), href: "#how-it-works" },
    { label: tl("pricing"), href: "#pricing" },
  ];

  // Pre-warm auth & workspace routes so the jump from landing is instant
  useEffect(() => {
    try {
      router.prefetch("/auth/sign-in");
      router.prefetch("/auth/sign-up");
      router.prefetch("/documents");
    } catch {}
  }, [router]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background,border-color,box-shadow] duration-300",
        scrolled
          ? "border-b border-black/[0.06] dark:border-white/[0.06] bg-white/70 dark:bg-[#0a0a0a]/70 backdrop-blur-xl shadow-[0_1px_0_0_rgba(0,0,0,0.02)]"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-5 md:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-[8px] bg-gradient-to-br from-[#ff8476] to-[#e85d4f] shadow-[0_1px_2px_rgba(247,108,94,0.4),inset_0_1px_0_rgba(255,255,255,0.3)] transition-transform group-hover:scale-[1.06]">
            <span className="block h-[9px] w-[9px] rounded-[2.5px] bg-white/95" />
          </span>
          <span className="text-[14px] font-semibold tracking-[-0.02em] text-gray-900 dark:text-white">
            Texxel
          </span>
        </Link>

        {/* Desktop nav — pill */}
        <nav className="hidden md:flex items-center gap-0.5 rounded-full border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.03] px-1 py-1 backdrop-blur">
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="px-3.5 py-1.5 rounded-full text-[12.5px] font-medium text-gray-600 dark:text-gray-300 transition-colors hover:text-gray-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-white/[0.06]"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-2.5">
          <LangSwitch />
          {!isPending && !isAuthenticated && (
            <>
              <Link
                href="/auth/sign-in"
                prefetch
                className="px-3 h-9 flex items-center rounded-lg text-[13px] font-medium text-gray-600 dark:text-gray-300 transition-colors hover:text-gray-900 dark:hover:text-white"
              >
                {tl("login")}
              </Link>
              <Link
                href="/auth/sign-up"
                prefetch
                className="group relative inline-flex h-9 items-center overflow-hidden rounded-lg px-4 text-[13px] font-medium text-white bg-gradient-to-b from-[#ff8476] via-[#f76c5e] to-[#e85d4f] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.14),0_1px_2px_rgba(247,108,94,0.35),0_4px_18px_-4px_rgba(247,108,94,0.45)] transition-[filter,transform] hover:brightness-[1.04] active:scale-[0.98]"
              >
                <span
                  className="pointer-events-none absolute inset-0 -translate-x-[120%] bg-[linear-gradient(120deg,transparent_20%,rgba(255,255,255,0.28)_50%,transparent_80%)] transition-transform duration-[550ms] ease-out group-hover:translate-x-[120%]"
                />
                {tl("getStarted")}
              </Link>
            </>
          )}
          {isAuthenticated && !isPending && (
            <>
              <Link
                href="/documents"
                prefetch
                className="group relative inline-flex h-9 items-center overflow-hidden rounded-lg px-4 text-[13px] font-medium text-white bg-gradient-to-b from-[#ff8476] via-[#f76c5e] to-[#e85d4f] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_2px_rgba(247,108,94,0.35),0_4px_18px_-4px_rgba(247,108,94,0.45)] transition-[filter,transform] hover:brightness-[1.04] active:scale-[0.98]"
              >
                {tl("openApp")}
              </Link>
              <button
                onClick={async () => { await authClient.signOut(); router.push("/"); }}
                className="px-3 h-9 flex items-center rounded-lg text-[13px] font-medium text-gray-500 dark:text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-white"
              >
                {tl("logout")}
              </button>
            </>
          )}
        </div>

        {/* Mobile burger */}
        <button
          className="md:hidden flex flex-col gap-[5px] p-2 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <span
            className="block h-[1.5px] w-5 rounded-full bg-gray-800 dark:bg-gray-200 transition-transform duration-200 origin-center"
            style={{ transform: menuOpen ? "translateY(6.5px) rotate(45deg)" : "none" }}
          />
          <span
            className="block h-[1.5px] w-5 rounded-full bg-gray-800 dark:bg-gray-200 transition-opacity duration-200"
            style={{ opacity: menuOpen ? 0 : 1 }}
          />
          <span
            className="block h-[1.5px] w-5 rounded-full bg-gray-800 dark:bg-gray-200 transition-transform duration-200 origin-center"
            style={{ transform: menuOpen ? "translateY(-6.5px) rotate(-45deg)" : "none" }}
          />
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        className="md:hidden overflow-hidden transition-[max-height,opacity] duration-300 border-b border-black/[0.06] dark:border-white/[0.06] bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl"
        style={{ maxHeight: menuOpen ? "420px" : "0px", opacity: menuOpen ? 1 : 0 }}
      >
        <nav className="flex flex-col px-5 py-3 gap-0.5">
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="py-2.5 px-2 rounded-md text-[14px] text-gray-700 dark:text-gray-300 transition-colors hover:text-gray-900 dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
            >
              {label}
            </a>
          ))}
          <div className="flex items-center justify-between pt-3 mt-1 border-t border-black/[0.06] dark:border-white/[0.06]">
            <LangSwitch />
            <div className="flex gap-2">
              {!isAuthenticated ? (
                <>
                  <Link
                    href="/auth/sign-in"
                    prefetch
                    className="px-3 h-9 flex items-center rounded-lg text-[13px] font-medium text-gray-600 dark:text-gray-400"
                    onClick={() => setMenuOpen(false)}
                  >
                    {tl("login")}
                  </Link>
                  <Link
                    href="/auth/sign-up"
                    prefetch
                    onClick={() => setMenuOpen(false)}
                    className="flex h-9 items-center px-4 rounded-lg bg-gradient-to-b from-[#ff8476] to-[#e85d4f] text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(247,108,94,0.35)]"
                  >
                    {tl("getStarted")}
                  </Link>
                </>
              ) : (
                <Link
                  href="/documents"
                  prefetch
                  onClick={() => setMenuOpen(false)}
                  className="flex h-9 items-center px-4 rounded-lg bg-gradient-to-b from-[#ff8476] to-[#e85d4f] text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(247,108,94,0.35)]"
                >
                  {tl("openApp")}
                </Link>
              )}
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
};
