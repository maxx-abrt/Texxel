"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/spinner";
import { authClient } from "@/lib/auth/client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";

export const Heading = () => {
  const { data: session, isPending } = authClient.useSession();
  const isAuthenticated = !!session;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const th = useTranslations("landing.hero");

  return (
    <div className="relative z-10 w-full max-w-[960px] flex flex-col items-center">
      {/* Badge */}
      <div className="flex items-center gap-2 h-7 px-3.5 mb-6 rounded-full bg-[#f76c5e]/[0.08] dark:bg-[#f76c5e]/[0.12] border border-[#f76c5e]/20">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#f76c5e] animate-pulse" />
        <span className="text-[11px] font-medium tracking-wide text-[#f76c5e]">
          {th("badge")}
        </span>
      </div>

      {/* Headline */}
      <h1 className="text-[clamp(32px,6vw,64px)] font-bold leading-[1.08] tracking-[-0.03em] text-center text-gray-900 dark:text-white">
        {th("headline1")}
      </h1>
      <h1 className="text-[clamp(32px,6vw,64px)] font-bold leading-[1.08] tracking-[-0.03em] text-center text-[#f76c5e]">
        {th("headline2")}
      </h1>

      {/* Subheading */}
      <p className="mt-5 text-[15px] md:text-[17px] text-center leading-relaxed max-w-[520px] text-gray-500 dark:text-gray-400">
        {th("subheading")}
        {" "}
        {th("noContextLoss")}
      </p>

      {/* CTAs */}
      <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
        {isPending && <Spinner size="md" />}
        {!isPending && (
          <>
            {isAuthenticated ? (
              <Link
                href="/documents"
                className="group flex items-center justify-center gap-2 w-full sm:w-auto h-11 px-6 rounded-xl bg-[#f76c5e] text-[14px] font-medium text-white transition-all hover:bg-[#e85d4f] active:scale-[0.98] shadow-[0_1px_2px_rgba(247,108,94,0.3)]"
              >
                {th("openWorkspace")}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/sign-up"
                  className="group flex items-center justify-center gap-2 w-full sm:w-auto h-11 px-6 rounded-xl bg-[#f76c5e] text-[14px] font-medium text-white transition-all hover:bg-[#e85d4f] active:scale-[0.98] shadow-[0_1px_2px_rgba(247,108,94,0.3)]"
                >
                  {th("startFree")}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/auth/sign-in"
                  className="flex items-center justify-center w-full sm:w-auto h-11 px-6 rounded-xl text-[14px] font-medium transition-colors border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-white/20"
                >
                  {th("signIn")}
                </Link>
              </>
            )}
          </>
        )}
      </div>

      <p className="mt-3 text-[12px] text-gray-400 dark:text-gray-500">
        {th("freePlan")}
      </p>

      {/* Workspace mockup */}
      <div className="mt-12 w-full overflow-hidden rounded-xl border border-gray-200/80 dark:border-white/[0.08] shadow-2xl shadow-black/[0.08] dark:shadow-black/40">
        <WorkspaceMockup mounted={mounted} />
      </div>
    </div>
  );
};

function WorkspaceMockup({ mounted }: { mounted: boolean }) {
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
      <svg viewBox="0 0 1100 520" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", width: "100%", height: "auto" }}>
        <rect width="1100" height="520" fill="#111" />

        {/* ── SIDEBAR ── */}
        <rect x="0" y="0" width="180" height="520" fill="#0f0f0f" />
        <line x1="180" y1="0" x2="180" y2="520" stroke="#1e1e1e" strokeWidth="1" />
        <rect x="0" y="0" width="180" height="44" fill="#111" />
        <rect x="14" y="14" width="16" height="16" rx="4" fill="#f76c5e" />
        <rect x="18" y="18" width="8" height="8" rx="1.5" fill="#0f0f0f" />
        <text x="36" y="26" fontFamily="system-ui, sans-serif" fontSize="11" fill="#f0f0ee" fontWeight="600" letterSpacing={0.3}>Texxel</text>

        {/* Sidebar items */}
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
            {"active" in item && item.active && <rect x="4" y={item.y - 2} width="172" height="20" rx="5" fill="#1a1a1a" />}
            {"active" in item && item.active && <rect x="4" y={item.y - 2} width="2.5" height="20" rx="1" fill="#f76c5e" />}
            <text x="18" y={item.y + 12} fontFamily="system-ui, sans-serif" fontSize="10" fill={"active" in item && item.active ? "#eee" : "#555"} letterSpacing={0.2}>{item.label}</text>
          </g>
        ))}

        {/* ── MAIN ── */}
        <rect x="180" y="0" width="920" height="44" fill="#111" />
        <line x1="180" y1="44" x2="1100" y2="44" stroke="#1e1e1e" strokeWidth="1" />
        <text x="200" y="27" fontFamily="system-ui, sans-serif" fontSize="13" fill="#eee" fontWeight="600">My Tasks</text>

        {/* New button */}
        <rect x="984" y="13" width="52" height="20" rx="5" fill="#f76c5e" />
        <text x="994" y="27" fontFamily="system-ui, sans-serif" fontSize="9" fill="#fff" fontWeight="600">+ New</text>

        {/* Search */}
        <rect x="640" y="12" width="180" height="22" rx="6" fill="#1a1a1a" stroke="#252525" strokeWidth="0.75" />
        <text x="654" y="27" fontFamily="system-ui, sans-serif" fontSize="9" fill="#555">Search...</text>

        {/* Kanban columns */}
        {[
          { key: "Todo", x: 196, color: "#666", items: [2, 3] },
          { key: "In Progress", x: 420, color: "#f76c5e", items: [1] },
          { key: "In Review", x: 644, color: "#60a5fa", items: [4] },
          { key: "Done", x: 868, color: "#4ade80", items: [0] },
        ].map((col, ci) => (
          <g key={ci} style={{ opacity: mounted ? 1 : 0, transition: `opacity 0.4s ease ${0.08 + ci * 0.08}s` }}>
            <rect x={col.x} y="56" width="208" height="22" rx="4" fill="#161616" />
            <circle cx={col.x + 10} cy="67" r="3.5" fill={col.color} opacity="0.7" />
            <text x={col.x + 20} y="71" fontFamily="system-ui, sans-serif" fontSize="9" fill="#aaa" fontWeight="500">{col.key}</text>
            <text x={col.x + 190} y="71" fontFamily="system-ui, sans-serif" fontSize="9" fill="#444" fontWeight="500">{col.items.length}</text>

            {col.items.map((ti, tii) => {
              const task = tasks[ti];
              const ty = 88 + tii * 56;
              return (
                <g key={ti}>
                  <rect x={col.x} y={ty} width="208" height="46" rx="6" fill="#161616" stroke="#222" strokeWidth="0.5" />
                  <text x={col.x + 12} y={ty + 18} fontFamily="system-ui, sans-serif" fontSize="9.5" fill="#ccc" letterSpacing={0.1}>{task.label}</text>
                  <rect x={col.x + 12} y={ty + 27} width="38" height="12" rx="3" fill={task.color + "18"} stroke={task.color + "40"} strokeWidth="0.5" />
                  <text x={col.x + 17} y={ty + 36} fontFamily="system-ui, sans-serif" fontSize="6.5" fill={task.color} fontWeight="500">{task.status.split(" ")[0]}</text>
                </g>
              );
            })}
          </g>
        ))}

        {/* ── Right panel: docs ── */}
        <line x1="868" y1="44" x2="868" y2="520" stroke="#1e1e1e" strokeWidth="0.75" />
        <text x="884" y="70" fontFamily="system-ui, sans-serif" fontSize="9.5" fill="#888" fontWeight="500">Recent Docs</text>
        {docs.map((doc, i) => (
          <g key={i} style={{ opacity: mounted ? 1 : 0, transition: `opacity 0.3s ease ${0.25 + i * 0.06}s` }}>
            <rect x="878" y={86 + i * 36} width="200" height="28" rx="5" fill="#161616" stroke="#222" strokeWidth="0.5" />
            <text x="894" y={86 + i * 36 + 18} fontFamily="system-ui, sans-serif" fontSize="9" fill="#888">{doc.label}</text>
          </g>
        ))}

        {/* Status bar */}
        <line x1="0" y1="498" x2="1100" y2="498" stroke="#1a1a1a" strokeWidth="1" />
        <rect x="0" y="499" width="1100" height="21" fill="#0d0d0d" />
        <circle className="tx-pulse" cx="14" cy="510" r="3" fill="#4ade80" />
        <text x="22" y="513" fontFamily="system-ui, sans-serif" fontSize="8" fill="#444">Connected</text>
        <text x="120" y="513" fontFamily="system-ui, sans-serif" fontSize="8" fill="#333">5 tasks open</text>
        <text x="250" y="513" fontFamily="system-ui, sans-serif" fontSize="8" fill="#333">3 members</text>
        <rect className="tx-blink" x="820" y="170" width="4" height="12" rx="1" fill="#f76c5e" opacity="0.7" />
      </svg>
    </>
  );
}
