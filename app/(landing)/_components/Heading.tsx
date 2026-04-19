"use client";

import { useEffect, useState, memo, useRef } from "react";
import { authClient } from "@/lib/auth/client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";

export const Heading = () => {
  const { data: session, isPending } = authClient.useSession();
  const isAuthenticated = !!session;
  const th = useTranslations("landing.hero");

  // Render CTAs immediately (optimistic: assume logged-out) and upgrade once
  // the session resolves, so the hero never shows a spinner / layout shift.
  const showAuthed = !isPending && isAuthenticated;

  return (
    <div className="relative z-10 w-full max-w-[960px] flex flex-col items-center">
      {/* Badge */}
      <div className="tx-animate-in flex items-center gap-2 h-7 px-3.5 mb-7 rounded-full bg-white/70 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[#f76c5e] opacity-70 animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#f76c5e]" />
        </span>
        <span className="text-[11px] font-medium tracking-wide text-gray-700 dark:text-gray-200">
          {th("badge")}
        </span>
      </div>

      {/* Headline */}
      <h1 className="tx-animate-in text-[clamp(38px,7vw,76px)] font-semibold leading-[1.02] tracking-[-0.035em] text-center text-gray-900 dark:text-white"
          style={{ animationDelay: "60ms" }}>
        {th("headline1")}
      </h1>
      <h1 className="tx-animate-in text-[clamp(38px,7vw,76px)] font-semibold leading-[1.02] tracking-[-0.035em] text-center"
          style={{ animationDelay: "120ms" }}>
        <span
          className="bg-clip-text text-transparent"
          style={{ backgroundImage: "linear-gradient(100deg, #ffb5a8 0%, #f76c5e 40%, #e04a3a 80%)" }}
        >
          {th("headline2")}
        </span>
      </h1>

      {/* Subheading */}
      <p className="tx-animate-in mt-6 text-[15.5px] md:text-[17px] text-center leading-[1.55] max-w-[560px] text-gray-500 dark:text-gray-400"
         style={{ animationDelay: "180ms" }}>
        {th("subheading")}
      </p>
      <p className="tx-animate-in mt-1.5 text-[13px] text-center leading-relaxed max-w-[520px] text-gray-400 dark:text-gray-500"
         style={{ animationDelay: "220ms" }}>
        {th("noContextLoss")}
      </p>

      {/* CTAs */}
      <div className="tx-animate-in mt-9 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto"
           style={{ animationDelay: "280ms" }}>
        {showAuthed ? (
          <Link
            href="/documents"
            prefetch
            className="tx-btn-primary w-full sm:w-auto"
          >
            {th("openWorkspace")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <>
            <Link
              href="/auth/sign-up"
              prefetch
              className="tx-btn-primary w-full sm:w-auto"
            >
              {th("startFree")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/auth/sign-in"
              prefetch
              className="tx-btn-ghost w-full sm:w-auto"
            >
              {th("signIn")}
            </Link>
          </>
        )}
      </div>

      <p className="tx-animate-in mt-4 text-[12px] text-gray-400 dark:text-gray-500 tracking-tight"
         style={{ animationDelay: "340ms" }}>
        {th("freePlan")}
      </p>

      {/* Workspace mockup */}
      <div className="tx-animate-in mt-16 w-full group" style={{ animationDelay: "420ms" }}>
        <MockFrame />
      </div>
    </div>
  );
};

/* ── Mockup frame — BrowserChrome + inlined SVG workspace preview ────── */
const MockFrame = memo(function MockFrame() {
  return (
    <div className="relative mx-auto">
      {/* subtle reflection behind the frame */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-8 -bottom-6 -top-4 rounded-[28px] opacity-50"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 100%, rgba(247,108,94,0.14), transparent 70%)",
        }}
      />
      <div className="relative rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.02] p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.22),0_8px_24px_-8px_rgba(0,0,0,0.12)] backdrop-blur">
        <div className="overflow-hidden rounded-[14px] bg-[#0e0e10] ring-1 ring-inset ring-white/5">
          <BrowserChrome />
          <WorkspaceMockup />
        </div>
      </div>
    </div>
  );
});

const BrowserChrome = () => (
  <div className="flex items-center gap-2 h-8 px-3.5 bg-[#0b0b0d] border-b border-white/[0.05]">
    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
    <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
    <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
    <div className="mx-auto flex items-center gap-1.5 h-5 px-2.5 rounded-md bg-white/[0.04] border border-white/[0.04]">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
      <span className="text-[10px] text-white/40 tracking-tight">texxel.app/documents</span>
    </div>
  </div>
);

function WorkspaceMockup() {
  const [mounted, setMounted] = useState(false);
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    // Only animate in once visible; cheaper than always-on CSS opacity
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: "50px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const tasks = [
    { label: "Write thesis introduction", status: "DONE", color: "#4ade80" },
    { label: "Research bibliography", status: "IN PROGRESS", color: "#f76c5e" },
    { label: "Prepare slide deck", status: "TODO", color: "#888" },
    { label: "Review team contributions", status: "TODO", color: "#888" },
    { label: "Submit group project", status: "IN REVIEW", color: "#60a5fa" },
  ];

  const docs = [
    { label: "Project Proposal" },
    { label: "Research Notes" },
    { label: "Study Plan" },
    { label: "Group Assignment" },
  ];

  return (
    <>
      <style>{`
        @keyframes tx-pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }
        @keyframes tx-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .tx-pulse { animation: tx-pulse 2s ease-in-out infinite; }
        .tx-blink { animation: tx-blink 1.1s step-end infinite; }
      `}</style>
      <svg ref={ref} viewBox="0 0 1100 520" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", width: "100%", height: "auto" }}>
        <defs>
          <linearGradient id="tx-mock-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#131315" />
            <stop offset="100%" stopColor="#0e0e10" />
          </linearGradient>
        </defs>
        <rect width="1100" height="520" fill="url(#tx-mock-bg)" />

        {/* ── SIDEBAR ── */}
        <rect x="0" y="0" width="180" height="520" fill="#0a0a0c" />
        <line x1="180" y1="0" x2="180" y2="520" stroke="#1a1a1d" strokeWidth="1" />
        <rect x="0" y="0" width="180" height="44" fill="#0b0b0d" />
        <rect x="14" y="14" width="16" height="16" rx="4" fill="#f76c5e" />
        <rect x="18" y="18" width="8" height="8" rx="1.5" fill="#0a0a0c" />
        <text x="36" y="26" fontFamily="system-ui, sans-serif" fontSize="11" fill="#f0f0ee" fontWeight="600" letterSpacing={0.3}>Texxel</text>

        {[
          { label: "Dashboard", y: 56 },
          { label: "Documents", y: 80 },
          { label: "Tasks", y: 104, active: true },
          { label: "Projects", y: 128 },
          { label: "Teams", y: 152 },
          { label: "Calendar", y: 176 },
          { label: "Inbox", y: 200 },
        ].map((item, i) => (
          <g key={i} style={{ opacity: mounted ? 1 : 0, transition: `opacity 0.3s ease ${i * 0.04}s` }}>
            {"active" in item && item.active && <rect x="4" y={item.y - 2} width="172" height="20" rx="5" fill="#19191c" />}
            {"active" in item && item.active && <rect x="4" y={item.y - 2} width="2.5" height="20" rx="1" fill="#f76c5e" />}
            <text x="18" y={item.y + 12} fontFamily="system-ui, sans-serif" fontSize="10" fill={"active" in item && item.active ? "#eee" : "#555"} letterSpacing={0.2}>{item.label}</text>
          </g>
        ))}

        {/* ── MAIN ── */}
        <rect x="180" y="0" width="920" height="44" fill="#0b0b0d" />
        <line x1="180" y1="44" x2="1100" y2="44" stroke="#1a1a1d" strokeWidth="1" />
        <text x="200" y="27" fontFamily="system-ui, sans-serif" fontSize="13" fill="#eee" fontWeight="600">My Tasks</text>

        <rect x="984" y="13" width="52" height="20" rx="5" fill="#f76c5e" />
        <text x="994" y="27" fontFamily="system-ui, sans-serif" fontSize="9" fill="#fff" fontWeight="600">+ New</text>

        <rect x="640" y="12" width="180" height="22" rx="6" fill="#131316" stroke="#222226" strokeWidth="0.75" />
        <text x="654" y="27" fontFamily="system-ui, sans-serif" fontSize="9" fill="#555">Search...</text>

        {[
          { key: "Todo", x: 196, color: "#666", items: [2, 3] },
          { key: "In Progress", x: 420, color: "#f76c5e", items: [1] },
          { key: "In Review", x: 644, color: "#60a5fa", items: [4] },
          { key: "Done", x: 868, color: "#4ade80", items: [0] },
        ].map((col, ci) => (
          <g key={ci} style={{ opacity: mounted ? 1 : 0, transition: `opacity 0.4s ease ${0.08 + ci * 0.08}s` }}>
            <rect x={col.x} y="56" width="208" height="22" rx="4" fill="#131316" />
            <circle cx={col.x + 10} cy="67" r="3.5" fill={col.color} opacity="0.7" />
            <text x={col.x + 20} y="71" fontFamily="system-ui, sans-serif" fontSize="9" fill="#aaa" fontWeight="500">{col.key}</text>
            <text x={col.x + 190} y="71" fontFamily="system-ui, sans-serif" fontSize="9" fill="#444" fontWeight="500">{col.items.length}</text>

            {col.items.map((ti, tii) => {
              const task = tasks[ti];
              const ty = 88 + tii * 56;
              return (
                <g key={ti}>
                  <rect x={col.x} y={ty} width="208" height="46" rx="6" fill="#131316" stroke="#1e1e22" strokeWidth="0.5" />
                  <text x={col.x + 12} y={ty + 18} fontFamily="system-ui, sans-serif" fontSize="9.5" fill="#ccc" letterSpacing={0.1}>{task.label}</text>
                  <rect x={col.x + 12} y={ty + 27} width="38" height="12" rx="3" fill={task.color + "18"} stroke={task.color + "40"} strokeWidth="0.5" />
                  <text x={col.x + 17} y={ty + 36} fontFamily="system-ui, sans-serif" fontSize="6.5" fill={task.color} fontWeight="500">{task.status.split(" ")[0]}</text>
                </g>
              );
            })}
          </g>
        ))}

        {/* right panel: docs */}
        <line x1="868" y1="44" x2="868" y2="520" stroke="#1a1a1d" strokeWidth="0.75" />
        <text x="884" y="70" fontFamily="system-ui, sans-serif" fontSize="9.5" fill="#888" fontWeight="500">Recent Docs</text>
        {docs.map((doc, i) => (
          <g key={i} style={{ opacity: mounted ? 1 : 0, transition: `opacity 0.3s ease ${0.25 + i * 0.06}s` }}>
            <rect x="878" y={86 + i * 36} width="200" height="28" rx="5" fill="#131316" stroke="#1e1e22" strokeWidth="0.5" />
            <text x="894" y={86 + i * 36 + 18} fontFamily="system-ui, sans-serif" fontSize="9" fill="#888">{doc.label}</text>
          </g>
        ))}

        {/* Status bar */}
        <line x1="0" y1="498" x2="1100" y2="498" stroke="#15151a" strokeWidth="1" />
        <rect x="0" y="499" width="1100" height="21" fill="#08080a" />
        <circle className="tx-pulse" cx="14" cy="510" r="3" fill="#4ade80" />
        <text x="22" y="513" fontFamily="system-ui, sans-serif" fontSize="8" fill="#444">Connected</text>
        <text x="120" y="513" fontFamily="system-ui, sans-serif" fontSize="8" fill="#333">5 tasks open</text>
        <text x="250" y="513" fontFamily="system-ui, sans-serif" fontSize="8" fill="#333">3 members</text>
        <rect className="tx-blink" x="820" y="170" width="4" height="12" rx="1" fill="#f76c5e" opacity="0.7" />
      </svg>
    </>
  );
}
