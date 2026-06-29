"use client";

import Link from "next/link";
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
} from "iconsax-reactjs";

const HERO_DECOR =
  "https://images.unsplash.com/photo-1658181916717-d7b0cf8181d8?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=900";

export default function LandingPage() {
  const { isAuthenticated } = useConvexAuth();
  const appHref = isAuthenticated ? "/app" : "/auth";
  const t = useTranslations("home");
  const ta = useTranslations("auth");

  const FEATURES = [
    { Icon: DocumentText, title: t("documents"), desc: t("documentsDesc"), color: "var(--flux-coral)", testId: "documents" },
    { Icon: TaskSquare, title: t("tasksBoards"), desc: t("tasksBoardsDesc"), color: "var(--accent-ocean)", testId: "tasks" },
    { Icon: Calendar, title: t("calendar"), desc: t("calendarDesc"), color: "var(--accent-mint)", testId: "calendar" },
    { Icon: Data2, title: t("databases"), desc: t("databasesDesc"), color: "#d98324", testId: "databases" },
  ];

  const connectedItems = [
    { Icon: Profile2User, text: t("inviteTeam") },
    { Icon: Notification, text: t("unifiedInbox") },
    { Icon: Magicpen, text: t("commandPalette") },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-background">
      {/* Nav */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-6">
        <span className="text-2xl font-extrabold tracking-tight" data-testid="landing-wordmark">
          {t("tagline")}
        </span>
        <div className="flex items-center gap-2">
          <Link href="/auth" className="hidden rounded-full px-4 py-2 text-sm font-medium text-foreground hover:bg-muted sm:inline-block" data-testid="landing-signin">
            {ta("signIn")}
          </Link>
          <Link
            href={appHref}
            data-testid="landing-cta-top"
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
          >
            {isAuthenticated ? t("openApp") : t("getStarted")} <ArrowRight2 variant="Bulk" size={16} />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-10 pt-8 sm:px-6 md:grid-cols-2 md:pt-14">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--flux-coral-soft)] px-3 py-1 text-sm font-medium text-primary">
            <Magicpen variant="Bulk" size={16} /> {t("yourSecondBrain")}
          </div>
          <h1 className="mt-5 font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl" data-testid="landing-hero-title">
            {t("heroTitle")}
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
            {t("heroDesc")}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={appHref}
              data-testid="landing-cta-hero"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5"
            >
              {isAuthenticated ? t("openWorkspace") : t("getStartedFree")} <ArrowRight2 variant="Bulk" size={18} />
            </Link>
            <Link href="#features" className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3.5 text-base font-medium hover:bg-muted">
              {t("seeFeatures")}
            </Link>
          </div>
          <div className="mt-7 flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><TickCircle variant="Bulk" size={16} className="text-[var(--accent-mint)]" /> {t("freeToStart")}</span>
            <span className="flex items-center gap-1.5"><TickCircle variant="Bulk" size={16} className="text-[var(--accent-mint)]" /> {t("noCreditCard")}</span>
          </div>
        </div>

        {/* Coral brand card with floating mocks */}
        <div className="relative">
          <div className="relative overflow-hidden rounded-[2.25rem] bg-primary p-7 text-primary-foreground shadow-xl shadow-primary/20 md:p-9">
            <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold">{t("tagline")}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"><Flash variant="Bulk" size={18} /></span>
            </div>

            {/* floating document mock */}
            <div className="flux-float mt-7 rounded-2xl bg-background p-4 text-foreground shadow-lg">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧠</span>
                <span className="text-sm font-semibold">{t("weeklyPlan")}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{t("saved")}</span>
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-2 w-3/4 rounded-full bg-muted" />
                <div className="h-2 w-1/2 rounded-full bg-muted" />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-[var(--flux-coral-soft)] px-2 py-0.5 text-[11px] font-medium text-primary">#{t("focus")}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">#{t("ideas")}</span>
              </div>
            </div>

            {/* floating task chips */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/12 p-3 backdrop-blur">
                <TaskSquare variant="Bulk" size={20} />
                <p className="mt-2 text-xs font-medium opacity-90">{t("tasksDoneToday", { count: 3 })}</p>
              </div>
              <div className="rounded-2xl bg-white/12 p-3 backdrop-blur">
                <Calendar variant="Bulk" size={20} />
                <p className="mt-2 text-xs font-medium opacity-90">{t("eventsThisWeek", { count: 2 })}</p>
              </div>
            </div>

            <div className="mt-6 text-right text-sm font-medium opacity-90">{t("organizeTrackDocument")}</div>
          </div>

          {/* small decorative inset image */}
          <div className="absolute -bottom-6 -left-6 hidden h-28 w-28 rotate-[-6deg] overflow-hidden rounded-2xl border-4 border-background shadow-lg sm:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={HERO_DECOR} alt="" className="h-full w-full object-cover" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24">
        <div className="max-w-xl">
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{t("everythingInOnePlace")}</h2>
          <p className="mt-3 text-muted-foreground">
            {t("stopJuggling")}
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="group rounded-3xl border border-border bg-card p-6 transition-shadow hover:shadow-md" data-testid={`landing-feature-${f.testId}`}>
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl transition-transform group-hover:-translate-y-0.5"
                style={{ backgroundColor: `color-mix(in oklch, ${f.color} 16%, transparent)`, color: f.color }}
              >
                <f.Icon variant="Bulk" size={26} />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Connected band */}
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-6 md:pb-24">
        <div className="grid items-center gap-8 rounded-[2.25rem] border border-border bg-card p-8 md:grid-cols-2 md:p-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--flux-coral-soft)] px-3 py-1 text-sm font-medium text-primary">
              <Star1 variant="Bulk" size={16} /> {t("connectedByDesign")}
            </div>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight md:text-4xl">{t("workspaceThinks")}</h2>
            <p className="mt-4 text-muted-foreground">
              {t("connectedDesc")}
            </p>
            <ul className="mt-6 space-y-3">
              {connectedItems.map((i) => (
                <li key={i.text} className="flex items-center gap-3 text-sm">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-primary"><i.Icon variant="Bulk" size={18} /></span>
                  {i.text}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative grid grid-cols-2 gap-3">
            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                <DocumentText variant="Bulk" size={22} className="text-primary" />
                <div className="mt-3 h-2 w-3/4 rounded-full bg-muted" />
                <div className="mt-2 h-2 w-1/2 rounded-full bg-muted" />
              </div>
              <div className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                <Calendar variant="Bulk" size={22} className="text-[var(--accent-mint)]" />
                <div className="mt-3 h-2 w-2/3 rounded-full bg-muted" />
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <div className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                <TaskSquare variant="Bulk" size={22} className="text-[var(--accent-ocean)]" />
                <div className="mt-3 flex gap-1.5">
                  <span className="h-5 w-12 rounded-full bg-[var(--flux-coral-soft)]" />
                  <span className="h-5 w-10 rounded-full bg-muted" />
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                <Data2 variant="Bulk" size={22} style={{ color: "#d98324" }} />
                <div className="mt-3 grid grid-cols-3 gap-1">
                  {Array.from({ length: 6 }).map((_, i) => <span key={i} className="h-2 rounded bg-muted" />)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-[2.25rem] bg-primary px-8 py-14 text-center text-primary-foreground md:py-20">
          <div className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <h2 className="relative font-display text-4xl font-extrabold tracking-tight md:text-5xl">{t("readyToBuild")}</h2>
          <p className="relative mx-auto mt-4 max-w-md text-primary-foreground/85">{t("ideasOrganized")}</p>
          <Link
            href={appHref}
            data-testid="landing-cta-bottom"
            className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-background px-8 py-4 text-base font-semibold text-foreground transition-transform hover:-translate-y-0.5"
          >
            {isAuthenticated ? t("openApp") : t("getStartedFree")} <ArrowRight2 variant="Bulk" size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-6">
          <span className="text-lg font-extrabold tracking-tight">{t("tagline")}</span>
          <p className="text-sm text-muted-foreground">{t("partOfA2E")}</p>
          <Link href="/auth" className="text-sm font-medium text-primary hover:underline">{ta("signIn")}</Link>
        </div>
      </footer>
    </main>
  );
}
