"use client";

import { useState } from "react";
import { useScrollTop } from "@/hooks/useScrollTop";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth/client";
import { Spinner } from "@/components/spinner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export const Navbar = () => {
  const { data: session, isPending } = authClient.useSession();
  const isAuthenticated = !!session;
  const scrolled = useScrollTop();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const tl = useTranslations("landing.nav");

  const NAV_LINKS = [
    { label: tl("features"), href: "#features" },
    { label: tl("howItWorks"), href: "#how-it-works" },
    { label: tl("pricing"), href: "#pricing" },
  ];

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-gray-200/60 dark:border-white/[0.06] bg-white/80 dark:bg-[#111]/80 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-5 md:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#f76c5e]">
            <span className="block h-2 w-2 rounded-[2px] bg-white/90" />
          </span>
          <span className="text-[13px] font-semibold tracking-tight text-gray-900 dark:text-white">
            Texxel
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="px-3 py-1.5 rounded-md text-[13px] text-gray-500 dark:text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/60 dark:hover:bg-white/[0.04]"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-2">
          {isPending && <Spinner />}
          {!isPending && !isAuthenticated && (
            <>
              <Link
                href="/auth/sign-in"
                className="px-3 py-1.5 rounded-md text-[13px] text-gray-500 dark:text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-white"
              >
                {tl("login")}
              </Link>
              <Link
                href="/auth/sign-up"
                className="flex h-8 items-center px-4 rounded-lg bg-[#f76c5e] text-[13px] font-medium text-white transition-all hover:bg-[#e85d4f] active:scale-[0.98]"
              >
                {tl("getStarted")}
              </Link>
            </>
          )}
          {isAuthenticated && !isPending && (
            <>
              <Link
                href="/documents"
                className="flex h-8 items-center px-4 rounded-lg bg-[#f76c5e] text-[13px] font-medium text-white transition-all hover:bg-[#e85d4f] active:scale-[0.98]"
              >
                {tl("openApp")}
              </Link>
              <button
                onClick={async () => { await authClient.signOut(); router.push("/"); }}
                className="px-3 py-1.5 rounded-md text-[13px] text-gray-500 dark:text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-white"
              >
                {tl("logout")}
              </button>
            </>
          )}
        </div>

        {/* Mobile burger */}
        <button className="md:hidden flex flex-col gap-[5px] p-2" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle menu">
          <span className="block h-[1.5px] w-5 rounded-full bg-gray-700 dark:bg-gray-300 transition-transform duration-200 origin-center"
            style={{ transform: menuOpen ? "translateY(6.5px) rotate(45deg)" : "none" }} />
          <span className="block h-[1.5px] w-5 rounded-full bg-gray-700 dark:bg-gray-300 transition-opacity duration-200"
            style={{ opacity: menuOpen ? 0 : 1 }} />
          <span className="block h-[1.5px] w-5 rounded-full bg-gray-700 dark:bg-gray-300 transition-transform duration-200 origin-center"
            style={{ transform: menuOpen ? "translateY(-6.5px) rotate(-45deg)" : "none" }} />
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        className="md:hidden overflow-hidden transition-all duration-300 border-b border-gray-200/60 dark:border-white/[0.06] bg-white/95 dark:bg-[#111]/95 backdrop-blur-xl"
        style={{ maxHeight: menuOpen ? "400px" : "0px" }}
      >
        <nav className="flex flex-col px-5 py-3 gap-0.5">
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="py-2.5 px-2 rounded-md text-[14px] text-gray-600 dark:text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/[0.04]"
            >
              {label}
            </a>
          ))}
          <div className="flex flex-col gap-2 pt-3 mt-1 border-t border-gray-100 dark:border-white/[0.06]">
            {!isAuthenticated ? (
              <>
                <Link href="/auth/sign-in" className="py-2.5 px-2 text-[14px] text-gray-500 dark:text-gray-400" onClick={() => setMenuOpen(false)}>{tl("login")}</Link>
                <Link href="/auth/sign-up" onClick={() => setMenuOpen(false)}
                  className="flex h-10 items-center justify-center rounded-lg bg-[#f76c5e] text-[14px] font-medium text-white">{tl("getStarted")}</Link>
              </>
            ) : (
              <Link href="/documents" onClick={() => setMenuOpen(false)}
                className="flex h-10 items-center justify-center rounded-lg bg-[#f76c5e] text-[14px] font-medium text-white">{tl("openApp")}</Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
};
