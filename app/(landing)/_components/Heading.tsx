"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/spinner";
import { authClient } from "@/lib/auth/client";
import Link from "next/link";
import { useTranslations } from "next-intl";

export const Heading = () => {
  const { data: session, isPending } = authClient.useSession();
  const isAuthenticated = !!session;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const th = useTranslations("landing.hero");

  return (
    <div className="relative z-10 w-full max-w-[1100px] flex flex-col items-center">
      {/* Badge */}
      <div className="flex items-center gap-2 h-8 px-4 mb-8 rounded-full bg-orange-50 dark:bg-[#1a1a1a] border border-[#f76c5e]/40 dark:border-[#f76c5e]/60">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: "#f76c5e" }} />
        <span className="font-mono text-[10px] font-semibold tracking-[1.5px] uppercase" style={{ color: "#f76c5e" }}>
          {th("badge")}
        </span>
      </div>

      {/* Headline */}
      <h1 className="font-mono text-[clamp(36px,7.5vw,80px)] font-bold leading-[1.05] tracking-[-2px] text-center w-full text-gray-900 dark:text-[#f0f0ee]">
        {th("headline1")}
      </h1>
      <h1 className="font-mono text-[clamp(36px,7.5vw,80px)] font-bold leading-[1.05] tracking-[-2px] text-center w-full"
        style={{ color: "#f76c5e" }}>
        {th("headline2")}
      </h1>

      {/* Subheading */}
      <p className="mt-6 font-mono text-[13px] md:text-[15px] text-center leading-[1.8] tracking-[0.3px] max-w-[560px] text-gray-500 dark:text-[#777]">
        {th("subheading")}
        <br />
        {th("noContextLoss")}
      </p>

      {/* CTAs */}
      <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
        {isPending && <Spinner size="md" />}
        {!isPending && (
          <>
            {isAuthenticated ? (
              <Link
                href="/documents"
                className="flex items-center justify-center w-full sm:w-[220px] h-[48px] rounded-lg font-mono text-[12px] font-bold tracking-[1px] transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#f76c5e", color: "#fff" }}
              >
                {th("openWorkspace")}
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/sign-up"
                  className="flex items-center justify-center w-full sm:w-[200px] h-[48px] rounded-lg font-mono text-[12px] font-bold tracking-[1px] transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#f76c5e", color: "#fff" }}
                >
                  {th("startFree")}
                </Link>
                <Link
                  href="/auth/sign-in"
                  className="flex items-center justify-center w-full sm:w-[180px] h-[48px] rounded-lg font-mono text-[12px] tracking-[1px] transition-colors border border-gray-300 dark:border-[#2d2d2d] text-gray-600 dark:text-[#999] hover:border-gray-500 dark:hover:border-[#555]"
                >
                  {th("signIn")}
                </Link>
              </>
            )}
          </>
        )}
      </div>

      <p className="mt-4 font-mono text-[11px] tracking-[0.5px] text-gray-400 dark:text-[#555]">
        {th("freePlan")}
      </p>

      {/* Workspace mockup */}
      <div className="mt-14 w-full overflow-hidden border border-gray-200 dark:border-[#2a2a2a] bg-gray-50 dark:bg-[#0f0f0f]">
        <WorkspaceMockup mounted={mounted} />
      </div>
    </div>
  );
};

function WorkspaceMockup({ mounted }: { mounted: boolean }) {
  const tasks = [
    { label: "Design system tokens", status: "DONE", color: "#4ade80" },
    { label: "Implement Kanban board", status: "IN PROGRESS", color: "#f76c5e" },
    { label: "Write API documentation", status: "TODO", color: "#666" },
    { label: "Set up CI/CD pipeline", status: "TODO", color: "#666" },
    { label: "Review pull requests", status: "IN REVIEW", color: "#60a5fa" },
  ];

  const docs = [
    { icon: "📄", label: "Product Roadmap" },
    { icon: "📋", label: "Team Handbook" },
    { icon: "🎯", label: "Q1 Goals" },
    { icon: "📊", label: "Analytics Report" },
  ];

  return (
    <>
      <style>{`
        @keyframes tx-pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }
        @keyframes tx-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes tx-scan { 0%{transform:translateY(-100%)} 100%{transform:translateY(600px)} }
        .tx-pulse { animation: tx-pulse 2s ease-in-out infinite; }
        .tx-blink { animation: tx-blink 1.1s step-end infinite; }
        .tx-scan { animation: tx-scan 6s linear infinite; }
      `}</style>
      <svg viewBox="0 0 1100 520" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", width: "100%", height: "auto" }}>
        {/* BG */}
        <rect width="1100" height="520" fill="#0f0f0f" />
        {/* Scan */}
        <rect className="tx-scan" x="0" y="0" width="1100" height="3" fill="rgba(247,108,94,0.04)" />
        {/* Grid dots */}
        {Array.from({ length: 22 }, (_, c) => Array.from({ length: 11 }, (_, r) => (
          <circle key={`d${c}-${r}`} cx={c * 50 + 25} cy={r * 50 + 25} r="0.8" fill="#1e1e1e" />
        )))}

        {/* ── SIDEBAR ── */}
        <rect x="0" y="0" width="180" height="520" fill="#111111" />
        <line x1="180" y1="0" x2="180" y2="520" stroke="#2a2a2a" strokeWidth="1" />
        <rect x="0" y="0" width="180" height="40" fill="#141414" />
        <rect x="12" y="14" width="16" height="16" fill="#f76c5e" />
        <rect x="17" y="19" width="6" height="6" fill="#0f0f0f" />
        <text x="34" y="26" fontFamily="monospace" fontSize="9" fill="#f0f0ee" letterSpacing={2} fontWeight="700">TEXXEL</text>

        {/* Sidebar items */}
        {[
          { label: "DASHBOARD", active: false, y: 52 },
          { label: "DOCUMENTS", active: false, y: 76 },
          { label: "TASKS", active: true, y: 100 },
          { label: "PROJECTS", active: false, y: 124 },
          { label: "TEAMS", active: false, y: 148 },
          { label: "CALENDAR", active: false, y: 172 },
          { label: "INBOX", active: false, y: 196 },
        ].map((item, i) => (
          <g key={i} style={{ opacity: mounted ? 1 : 0, transition: `opacity 0.3s ease ${i * 0.05}s` }}>
            {item.active && <rect x="0" y={item.y - 2} width="180" height="20" fill="#1e1e1e" />}
            {item.active && <rect x="0" y={item.y - 2} width="2" height="20" fill="#f76c5e" />}
            <text x="16" y={item.y + 12} fontFamily="monospace" fontSize="7.5" fill={item.active ? "#f0f0ee" : "#444"} letterSpacing={1}>{item.label}</text>
          </g>
        ))}

        {/* ── MAIN CONTENT ── */}
        {/* Topbar */}
        <rect x="180" y="0" width="920" height="40" fill="#141414" />
        <line x1="180" y1="40" x2="1100" y2="40" stroke="#2a2a2a" strokeWidth="1" />
        <text x="200" y="25" fontFamily="monospace" fontSize="9" fill="#f76c5e" letterSpacing={2} fontWeight="700">MY TASKS</text>
        <rect x="980" y="12" width="50" height="16" fill="#f76c5e" />
        <text x="988" y="24" fontFamily="monospace" fontSize="7.5" fill="#0f0f0f" fontWeight="700" letterSpacing={1}>+ NEW</text>
        {/* Search bar */}
        <rect x="620" y="11" width="200" height="18" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1" />
        <text x="633" y="23" fontFamily="monospace" fontSize="7" fill="#444" letterSpacing={1}>SEARCH...</text>

        {/* Kanban columns */}
        {[
          { key: "TODO", x: 196, color: "#444", tasks: [0, 2, 3] },
          { key: "IN PROGRESS", x: 436, color: "#f76c5e", tasks: [1] },
          { key: "IN REVIEW", x: 676, color: "#60a5fa", tasks: [4] },
          { key: "DONE", x: 916, color: "#4ade80", tasks: [] },
        ].map((col, ci) => (
          <g key={ci} style={{ opacity: mounted ? 1 : 0, transition: `opacity 0.4s ease ${0.1 + ci * 0.1}s` }}>
            <rect x={col.x} y="52" width="220" height="18" fill="#1a1a1a" />
            <rect x={col.x} y="52" width="3" height="18" fill={col.color} />
            <text x={col.x + 10} y="64" fontFamily="monospace" fontSize="7.5" fill={col.color} letterSpacing={1.5} fontWeight="700">{col.key}</text>
            <text x={col.x + 190} y="64" fontFamily="monospace" fontSize="7.5" fill="#333">{col.tasks.length}</text>
            {col.tasks.map((ti, tii) => {
              const task = tasks[ti];
              const ty = 80 + tii * 54;
              return (
                <g key={ti}>
                  <rect x={col.x} y={ty} width="220" height="44" fill="#161616" stroke="#2a2a2a" strokeWidth="0.75" />
                  <text x={col.x + 10} y={ty + 16} fontFamily="monospace" fontSize="7.5" fill="#c0c0be" letterSpacing={0.5}>{task.label}</text>
                  <rect x={col.x + 10} y={ty + 24} width="28" height="10" fill="#1e1e1e" stroke={task.color} strokeWidth="0.75" />
                  <text x={col.x + 13} y={ty + 32} fontFamily="monospace" fontSize="5.5" fill={task.color} letterSpacing={0.5}>{task.status.split(" ")[0]}</text>
                  <rect x={col.x + 192} y={ty + 26} width="16" height="8" fill="#1e1e1e" />
                  <circle cx={col.x + 197} cy={ty + 30} r="3" fill="#333" />
                </g>
              );
            })}
          </g>
        ))}

        {/* ── Right mini-panel: recent docs ── */}
        <line x1="900" y1="40" x2="900" y2="520" stroke="#2a2a2a" strokeWidth="0.75" strokeDasharray="3 3" />
        <text x="918" y="64" fontFamily="monospace" fontSize="7.5" fill="#f76c5e" letterSpacing={2} fontWeight="700">RECENT DOCS</text>
        {docs.map((doc, i) => (
          <g key={i} style={{ opacity: mounted ? 1 : 0, transition: `opacity 0.3s ease ${0.3 + i * 0.07}s` }}>
            <rect x="912" y={80 + i * 36} width="164" height="28" fill="#161616" stroke="#2a2a2a" strokeWidth="0.75" />
            <text x="924" y={80 + i * 36 + 17} fontFamily="monospace" fontSize="8" fill="#888">{doc.label}</text>
          </g>
        ))}

        {/* Status bar */}
        <line x1="0" y1="498" x2="1100" y2="498" stroke="#222" strokeWidth="1" />
        <rect x="0" y="499" width="1100" height="21" fill="#0d0d0d" />
        <circle className="tx-pulse" cx="14" cy="510" r="3.5" fill="#4ade80" />
        <text x="24" y="514" fontFamily="monospace" fontSize="7" fill="#444" letterSpacing={1}>CONNECTED</text>
        <text x="150" y="514" fontFamily="monospace" fontSize="7" fill="#333" letterSpacing={1}>5 TASKS OPEN</text>
        <text x="300" y="514" fontFamily="monospace" fontSize="7" fill="#333" letterSpacing={1}>3 TEAM MEMBERS</text>
        <text x="1040" y="514" fontFamily="monospace" fontSize="7" fill="#333" letterSpacing={1}>v2.0</text>
        {/* Cursor blink */}
        <rect className="tx-blink" x="870" y="170" width="5" height="10" fill="#f76c5e" opacity="0.8" />
      </svg>
    </>
  );
}
