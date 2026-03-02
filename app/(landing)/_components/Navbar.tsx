"use client";

import { useState, useEffect } from "react";
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
          ? "border-b border-gray-200 dark:border-[#2a2a2a] bg-white/90 dark:bg-[#111111]/90 backdrop-blur-md"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-[58px] max-w-[1200px] items-center justify-between px-5 md:px-10">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2.5 shrink-0">
          <span className="flex h-[22px] w-[22px] items-center justify-center" style={{ backgroundColor: "#f76c5e" }}>
            <span className="block h-[8px] w-[8px] bg-white dark:bg-[#0f0f0f]" />
          </span>
          <span className="font-mono text-[13px] font-bold tracking-[2.5px] text-gray-900 dark:text-white">
            TEXXEL
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(({ label, href }) => (
            <a key={label} href={href}
              className="relative font-mono text-[10px] uppercase tracking-[1.5px] text-gray-500 dark:text-[#666] transition-colors duration-150 hover:text-gray-900 dark:hover:text-[#f0f0ee]"
            >
              {label}
              <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#f76c5e] transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          {isPending && <Spinner />}
          {!isPending && !isAuthenticated && (
            <>
              <Link href="/auth/sign-in"
                className="font-mono text-[10px] tracking-[1.5px] text-gray-500 dark:text-[#666] transition-colors hover:text-gray-900 dark:hover:text-[#f0f0ee]">
                {tl("login")}
              </Link>
              <Link href="/auth/sign-up"
                className="flex h-[34px] items-center px-4 rounded-md font-mono text-[10px] font-bold tracking-[1.5px] transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#f76c5e", color: "#fff" }}>
                {tl("getStarted")}
              </Link>
            </>
          )}
          {isAuthenticated && !isPending && (
            <>
              <Link href="/documents"
                className="flex h-[34px] items-center px-4 rounded-md font-mono text-[10px] font-bold tracking-[1.5px] transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#f76c5e", color: "#fff" }}>
                {tl("openApp")}
              </Link>
              <button onClick={async () => { await authClient.signOut(); router.push("/"); }}
                className="font-mono text-[10px] tracking-[1.5px] text-gray-500 dark:text-[#666] transition-colors hover:text-gray-900 dark:hover:text-[#f0f0ee]">
                {tl("logout")}
              </button>
            </>
          )}
        </div>

        {/* Mobile burger */}
        <button className="md:hidden flex flex-col gap-[5px] p-2" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle menu">
          <span className="block h-[1.5px] w-5 bg-gray-800 dark:bg-[#f0f0ee] transition-transform duration-200 origin-center"
            style={{ transform: menuOpen ? "translateY(6.5px) rotate(45deg)" : "none" }} />
          <span className="block h-[1.5px] w-5 bg-gray-800 dark:bg-[#f0f0ee] transition-opacity duration-200"
            style={{ opacity: menuOpen ? 0 : 1 }} />
          <span className="block h-[1.5px] w-5 bg-gray-800 dark:bg-[#f0f0ee] transition-transform duration-200 origin-center"
            style={{ transform: menuOpen ? "translateY(-6.5px) rotate(-45deg)" : "none" }} />
        </button>
      </div>

      {/* Mobile drawer */}
      <div className="md:hidden overflow-hidden transition-all duration-300 border-b border-gray-200 dark:border-[#2a2a2a] bg-white/98 dark:bg-[rgba(15,15,15,0.98)] backdrop-blur-md"
        style={{ maxHeight: menuOpen ? "400px" : "0px" }}>
        <nav className="flex flex-col px-5 py-4 gap-0">
          {NAV_LINKS.map(({ label, href }) => (
            <a key={label} href={href} onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 py-3.5 border-b border-gray-100 dark:border-[#1e1e1e] font-mono text-[11px] uppercase tracking-[2px] text-gray-500 dark:text-[#666] transition-colors hover:text-gray-900 dark:hover:text-[#f0f0ee]">
              <span className="h-1 w-1 bg-gray-300 dark:bg-[#2d2d2d]" />
              {label}
            </a>
          ))}
          <div className="flex flex-col gap-2 pt-4">
            {!isAuthenticated ? (
              <>
                <Link href="/auth/sign-in" className="font-mono text-[11px] tracking-[1.5px] text-gray-500 dark:text-[#666]" onClick={() => setMenuOpen(false)}>{tl("login")}</Link>
                <Link href="/auth/sign-up" onClick={() => setMenuOpen(false)}
                  className="flex h-10 items-center justify-center rounded-md font-mono text-[11px] font-bold tracking-[1.5px]"
                  style={{ backgroundColor: "#f76c5e", color: "#fff" }}>{tl("getStarted")}</Link>
              </>
            ) : (
              <Link href="/documents" onClick={() => setMenuOpen(false)}
                className="flex h-10 items-center justify-center rounded-md font-mono text-[11px] font-bold tracking-[1.5px]"
                style={{ backgroundColor: "#f76c5e", color: "#fff" }}>{tl("openApp")}</Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
};
