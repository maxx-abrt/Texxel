"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useConvexAuth } from "convex/react";
import { useTranslations } from "next-intl";
import {
  ArrowRight2,
  Magicpen,
  DocumentText,
  TaskSquare,
  Calendar,
  Data2,
  Flash,
  Star1,
  TickCircle,
  Notification,
  Profile2User,
  Chart2,
  Hashtag,
  Command,
  ArrowRight,
} from "iconsax-reactjs";

export default function LandingPage() {
  const { isAuthenticated } = useConvexAuth();
  const appHref = isAuthenticated ? "/app" : "/auth";
  const t = useTranslations("home");
  const ta = useTranslations("auth");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const FEATURES = [
    { Icon: DocumentText, title: t("documents"), desc: t("documentsDesc"), color: "#E14B3D", testId: "documents" },
    { Icon: TaskSquare, title: t("tasksBoards"), desc: t("tasksBoardsDesc"), color: "#2f7ea6", testId: "tasks" },
    { Icon: Calendar, title: t("calendar"), desc: t("calendarDesc"), color: "#1f9d76", testId: "calendar" },
    { Icon: Data2, title: t("databases"), desc: t("databasesDesc"), color: "#d98324", testId: "databases" },
  ];

  const connectedItems = [
    { Icon: Profile2User, text: t("inviteTeam") },
    { Icon: Notification, text: t("unifiedInbox") },
    { Icon: Command, text: t("commandPalette") },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav
        className={`sticky top-0 z-40 border-b transition-colors ${
          scrolled ? "border-border bg-background/80 backdrop-blur-xl" : "border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-6">
          <span className="flex items-center gap-2 text-xl font-extrabold tracking-tight" data-testid="landing-wordmark">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Flash variant="Bulk" size={16} />
            </span>
            texxel
          </span>
          <div className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#workspace" className="transition-colors hover:text-foreground">Workspace</a>
            <a href="#connected" className="transition-colors hover:text-foreground">Connected</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/auth" className="hidden rounded-lg px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:inline-block" data-testid="landing-signin">
              {ta("signIn")}
            </Link>
            <Link
              href={appHref}
              data-testid="landing-cta-top"
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
            >
              {isAuthenticated ? t("openApp") : t("getStarted")} <ArrowRight2 variant="Bulk" size={15} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] flux-grid-bg opacity-60" />
        <div className="mx-auto max-w-5xl px-5 pb-6 pt-16 text-center sm:px-6 md:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-primary shadow-[var(--elev-1)]">
            <Magicpen variant="Bulk" size={15} /> {t("yourSecondBrain")}
          </div>
          <h1
            className="mx-auto mt-6 max-w-3xl font-display text-5xl font-extrabold leading-[0.98] tracking-[-0.03em] sm:text-6xl lg:text-7xl"
            data-testid="landing-hero-title"
          >
            {t("heroTitle")}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            {t("heroDesc")}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={appHref}
              data-testid="landing-cta-hero"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-[var(--elev-2)] transition-transform hover:-translate-y-0.5"
            >
              {isAuthenticated ? t("openWorkspace") : t("getStartedFree")} <ArrowRight2 variant="Bulk" size={18} />
            </Link>
            <Link href="#features" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3.5 text-base font-medium transition-colors hover:bg-muted">
              {t("seeFeatures")}
            </Link>
          </div>
          <div className="mt-7 flex items-center justify-center gap-5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><TickCircle variant="Bulk" size={16} className="text-[#1f9d76]" /> {t("freeToStart")}</span>
            <span className="flex items-center gap-1.5"><TickCircle variant="Bulk" size={16} className="text-[#1f9d76]" /> {t("noCreditCard")}</span>
          </div>
        </div>

        {/* Product preview — docs-like workspace mock */}
        <div className="mx-auto max-w-6xl px-5 pb-16 sm:px-6 md:pb-24">
          <div className="tx-card overflow-hidden !rounded-[22px] elev-3">
            <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-[#E14B3D]" />
              <span className="h-3 w-3 rounded-full bg-[#d98324]" />
              <span className="h-3 w-3 rounded-full bg-[#1f9d76]" />
              <div className="ml-4 flex h-7 flex-1 max-w-sm items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs text-muted-foreground">
                <Command variant="Bulk" size={13} /> Search or run a command…
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr]">
              {/* faux sidebar */}
              <div className="hidden border-r border-border bg-[var(--paper-2,var(--secondary))] p-3 md:block">
                <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-bold">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground"><Flash variant="Bulk" size={13} /></span>
                  Acme Space
                </div>
                <div className="mt-4 space-y-0.5">
                  {[
                    { Icon: Chart2, label: "Dashboard", active: true },
                    { Icon: DocumentText, label: "Docs" },
                    { Icon: TaskSquare, label: "Tasks" },
                    { Icon: Calendar, label: "Calendar" },
                    { Icon: Data2, label: "Databases" },
                  ].map((n) => (
                    <div key={n.label} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${n.active ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground"}`}>
                      <n.Icon variant="Bulk" size={16} /> {n.label}
                    </div>
                  ))}
                </div>
                <div className="mt-5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Private</div>
                <div className="mt-1.5 space-y-0.5 text-sm text-muted-foreground">
                  {["📋 Roadmap", "🎯 OKRs Q3", "📝 Meeting notes"].map((d) => (
                    <div key={d} className="rounded-lg px-2.5 py-1.5">{d}</div>
                  ))}
                </div>
              </div>
              {/* faux content */}
              <div className="bg-card p-6 md:p-9">
                <div className="mx-auto max-w-2xl">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Hashtag variant="Bulk" size={13} /> Product / Weekly plan</div>
                  <h3 className="mt-3 text-3xl font-extrabold tracking-tight">Weekly plan</h3>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="tx-pill tx-status-progress"><span className="tx-dot" /> In progress</span>
                    <span className="tx-pill tx-prio-high"><span className="tx-dot" /> High</span>
                    <span className="tx-pill" style={{ background: "color-mix(in oklch, #E14B3D 12%, var(--card))", color: "color-mix(in oklch, #E14B3D 80%, var(--foreground))" }}>#focus</span>
                  </div>
                  <p className="mt-5 leading-relaxed text-muted-foreground">
                    A single, calm surface where your notes, tasks and plans finally live together.
                  </p>
                  <div className="mt-4 space-y-2">
                    {[true, true, false].map((done, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
                        <span className={`flex h-4 w-4 items-center justify-center rounded-[5px] border ${done ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                          {done && <TickCircle variant="Bulk" size={12} />}
                        </span>
                        <span className={done ? "text-muted-foreground line-through" : ""}>
                          {["Draft the product spec", "Sync with design", "Ship the new dashboard"][i]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24">
        <div className="max-w-2xl">
          <span className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Everything, connected</span>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">{t("everythingInOnePlace")}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{t("stopJuggling")}</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="group tx-card tx-card-hover p-6" data-testid={`landing-feature-${f.testId}`}>
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl transition-transform group-hover:-translate-y-0.5"
                style={{ backgroundColor: `color-mix(in oklch, ${f.color} 15%, transparent)`, color: f.color }}
              >
                <f.Icon variant="Bulk" size={26} />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Workspace / durable band ────────────────────────────────── */}
      <section id="workspace" className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-6 md:grid-cols-2 md:py-24">
          <div>
            <span className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Built to last</span>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight">A workspace that feels durable.</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Strong structure, clean typography, keyboard-first flow. Write in a spacious editor, plan in colorful tables, and track everything on one calm canvas.
            </p>
            <ul className="mt-7 space-y-3.5">
              {[
                "Block editor with beautiful tables & nested pages",
                "Monday-style task tables and Kanban boards",
                "Live analytics that update in real time",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklch,#1f9d76_18%,transparent)] text-[#1f9d76]"><TickCircle variant="Bulk" size={14} /></span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { Icon: DocumentText, label: "Docs", tint: "#E14B3D", lines: 3 },
              { Icon: Chart2, label: "Analytics", tint: "#2f7ea6", lines: 0, chart: true },
              { Icon: TaskSquare, label: "Tasks", tint: "#d98324", lines: 0, pills: true },
              { Icon: Calendar, label: "Calendar", tint: "#1f9d76", lines: 2 },
            ].map((c) => (
              <div key={c.label} className="tx-card tx-card-hover p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `color-mix(in oklch, ${c.tint} 15%, transparent)`, color: c.tint }}>
                    <c.Icon variant="Bulk" size={17} />
                  </span>
                  {c.label}
                </div>
                {c.chart ? (
                  <div className="mt-4 flex h-14 items-end gap-1.5">
                    {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                      <span key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: i === 5 ? c.tint : `color-mix(in oklch, ${c.tint} 30%, var(--muted))` }} />
                    ))}
                  </div>
                ) : c.pills ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <span className="tx-pill tx-status-done"><span className="tx-dot" /> Done</span>
                    <span className="tx-pill tx-status-progress"><span className="tx-dot" /> Doing</span>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    {Array.from({ length: c.lines }).map((_, i) => (
                      <div key={i} className="h-2 rounded-full bg-muted" style={{ width: `${90 - i * 20}%` }} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Connected band ──────────────────────────────────────────── */}
      <section id="connected" className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_oklch,#E14B3D_12%,transparent)] px-3 py-1 text-sm font-medium text-primary">
              <Star1 variant="Bulk" size={15} /> {t("connectedByDesign")}
            </div>
            <h2 className="mt-4 font-display text-4xl font-bold tracking-tight">{t("workspaceThinks")}</h2>
            <p className="mt-4 text-lg text-muted-foreground">{t("connectedDesc")}</p>
            <ul className="mt-7 space-y-3">
              {connectedItems.map((i) => (
                <li key={i.text} className="flex items-center gap-3 text-sm font-medium">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-primary"><i.Icon variant="Bulk" size={18} /></span>
                  {i.text}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { n: "5-in-1", l: "Tools unified" },
              { n: "Real-time", l: "Collaboration" },
              { n: "∞", l: "Nested pages" },
            ].map((s) => (
              <div key={s.l} className="tx-card p-5 text-center">
                <div className="text-2xl font-extrabold tracking-tight text-primary tabular">{s.n}</div>
                <div className="mt-1 text-xs text-muted-foreground">{s.l}</div>
              </div>
            ))}
            <div className="col-span-3 tx-card p-6">
              <div className="flex items-center gap-2 text-sm font-semibold"><Magicpen variant="Bulk" size={17} className="text-primary" /> AI, natively integrated</div>
              <p className="mt-2 text-sm text-muted-foreground">Ask, summarize and plan with context from your docs and tasks — right inside the workspace.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-6">
        <div className="tx-grain-panel relative overflow-hidden rounded-[26px] px-8 py-16 text-center text-white md:py-20">
          <div className="tx-grain-noise absolute inset-0 opacity-30" />
          <h2 className="relative font-display text-4xl font-extrabold tracking-tight md:text-5xl">{t("readyToBuild")}</h2>
          <p className="relative mx-auto mt-4 max-w-md text-white/90">{t("ideasOrganized")}</p>
          <Link
            href={appHref}
            data-testid="landing-cta-bottom"
            className="relative mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-[#a34238] shadow-[var(--elev-2)] transition-transform hover:-translate-y-0.5"
          >
            {isAuthenticated ? t("openApp") : t("getStartedFree")} <ArrowRight variant="Bulk" size={18} />
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-9 sm:flex-row sm:px-6">
          <span className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground"><Flash variant="Bulk" size={13} /></span>
            texxel
          </span>
          <p className="text-sm text-muted-foreground">{t("partOfA2E")}</p>
          <Link href="/auth" className="text-sm font-medium text-primary hover:underline">{ta("signIn")}</Link>
        </div>
      </footer>
    </main>
  );
}
