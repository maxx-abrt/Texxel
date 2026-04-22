"use client";

import { authClient } from "@/lib/auth/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CheckSquare,
  FolderKanban,
  FileText,
  Users,
  Plus,
  ArrowRight,
  ArrowUpRight,
  AlertCircle,
  Check,
  Circle,
  Sparkles,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { AiAssistantPanel } from "@/components/ai-assistant";
import { useTranslations, useLocale } from "next-intl";
import { useExtensions } from "@/hooks/useExtensions";
import { useWorkspace } from "@/hooks/useWorkspace";

function useTimeAgo() {
  const tc = useTranslations("common");
  return (ts: number): string => {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return tc("justNow");
    if (m < 60) return `${m}${tc("minAgo")}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}${tc("hAgo")}`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}${tc("dAgo")}`;
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
}

// Priority → editorial accent tokens (dot + text)
const PRIORITY_STYLE: Record<string, { dot: string; ring: string }> = {
  urgent: { dot: "bg-red-500",    ring: "ring-red-500/40" },
  high:   { dot: "bg-orange-500", ring: "ring-orange-500/40" },
  medium: { dot: "bg-amber-500",  ring: "ring-amber-500/40" },
  low:    { dot: "bg-sky-500",    ring: "ring-sky-500/40" },
  none:   { dot: "bg-foreground/20", ring: "ring-foreground/10" },
};

// Smart ordering for the "focus" stream:
// overdue → due today → in_progress → todo-with-priority → todo-rest
function focusScore(t: any, now: number): number {
  if (t.status === "done" || t.status === "cancelled") return 9999;
  const base =
    t.dueDate && t.dueDate < now ? 0 :
    t.dueDate && isToday(t.dueDate) ? 100 :
    t.status === "in_progress" ? 200 :
    t.status === "in_review" ? 250 :
    300;
  const PRIO_WEIGHT: Record<string, number> = { urgent: 0, high: 5, medium: 10, low: 15, none: 20 };
  const prio = PRIO_WEIGHT[t.priority ?? "none"] ?? 20;
  return base + prio;
}

function isToday(ts: number): boolean {
  const d = new Date(ts);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() &&
         d.getMonth() === n.getMonth() &&
         d.getDate() === n.getDate();
}

const DocumentsPage = () => {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const router = useRouter();
  const td = useTranslations("dashboard");
  const tc = useTranslations("common");
  const timeAgo = useTimeAgo();
  const { isEnabled: extEnabled } = useExtensions();
  const { activeWorkspaceId } = useWorkspace();
  const wsId = activeWorkspaceId as any;
  const create = useMutation(api.documents.create);
  const recentDocs = useQuery(api.documents.getSidebar, { parentDocument: undefined, workspaceId: wsId });
  const myTasks = useQuery(api.tasks.getMyTasks, { workspaceId: wsId });
  const myTeams = useQuery(api.teams.getMyTeams, { workspaceId: wsId });
  const myProjects = useQuery(api.projects.getMyProjects, { workspaceId: wsId });
  const notifications = useQuery(api.notifications.getMyNotifications);
  const unreadCount = useQuery(api.notifications.getUnreadCount) ?? 0;
  const [showNewTask, setShowNewTask] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const locale = useLocale();
  const updateTask = useMutation(api.tasks.update);

  const firstName = user?.name?.split(" ")[0] ?? "there";

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return td("greeting.morning");
    if (h < 17) return td("greeting.afternoon");
    return td("greeting.evening");
  };

  const onCreateDoc = () => {
    toast.promise(
      create({ title: tc("untitled"), workspaceId: wsId }).then((id) => router.push(`/documents/${id}`)),
      { loading: td("creating"), success: td("created"), error: td("createFailed") },
    );
  };

  const now = Date.now();
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }, []);
  const todayEnd = todayStart + 86_400_000;

  const activeTasks = (myTasks ?? []).filter((t) => t.status !== "done" && t.status !== "cancelled");
  const overdueTasks = activeTasks.filter((t) => t.dueDate && t.dueDate < now);
  const overdueTaskCount = overdueTasks.length;
  const todayTasks = activeTasks.filter((t) => t.dueDate && t.dueDate >= todayStart && t.dueDate < todayEnd);
  const doneTodayCount = (myTasks ?? []).filter((t) => {
    if (t.status !== "done" || !t.completedAt) return false;
    return t.completedAt >= todayStart;
  }).length;
  const totalTasksToday = todayTasks.length + doneTodayCount;
  const todayProgress = totalTasksToday > 0 ? Math.round((doneTodayCount / totalTasksToday) * 100) : 0;

  // Unified "focus stream" — smart-sorted list of what needs attention now.
  const focusStream = useMemo(
    () => activeTasks.slice().sort((a, b) => focusScore(a, now) - focusScore(b, now)),
    [activeTasks, now],
  );

  const todayLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale, {
        weekday: "long", day: "numeric", month: "long",
      }).format(new Date());
    } catch { return ""; }
  }, [locale]);

  const handleCompleteTask = async (id: any) => {
    try {
      await updateTask({ id, status: "done" });
    } catch { /* noop */ }
  };

  // Loading skeleton state
  const isLoading = myTasks === undefined || recentDocs === undefined;

  return (
    <div className="relative h-full overflow-y-auto tx-route-enter">
      {/* Ambient accent orbs — subtle decoration, paired with paper texture */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
        <div
          className="tx-orb"
          style={{
            top: "-140px",
            right: "-80px",
            width: "460px",
            height: "460px",
            background: "radial-gradient(closest-side, color-mix(in oklch, var(--primary), transparent 60%), transparent 70%)",
          }}
        />
        <div
          className="tx-orb"
          style={{
            top: "-80px",
            right: "280px",
            width: "260px",
            height: "260px",
            background: "radial-gradient(closest-side, color-mix(in oklch, var(--primary), transparent 75%), transparent 70%)",
            opacity: 0.35,
          }}
        />
      </div>

      <div className="relative mx-auto max-w-[1180px] px-6 py-10 md:px-12 md:py-14">
        {/* ── Editorial hero ────────────────────────────────────────── */}
        <header className="mb-12 md:mb-14 tx-stagger">
          <div className="flex items-center gap-2">
            <span className="tx-overline">{todayLabel}</span>
            <span className="tx-hairline mt-0 flex-1 max-w-[140px]" />
          </div>
          <h1 className="tx-display mt-4">
            {getGreeting()},{" "}
            <span className="tx-text-accent">{firstName}</span>
          </h1>

          {/* Inline vital-signs strip — replaces the 5-stat cards */}
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
            {isLoading ? (
              <>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
              </>
            ) : (
              <>
                <VitalSign
                  label={td("stats.openTasks")}
                  value={activeTasks.length}
                  tone="neutral"
                  href="/tasks"
                />
                {overdueTaskCount > 0 && (
                  <VitalSign
                    label={td("stats.overdue")}
                    value={overdueTaskCount}
                    tone="danger"
                    href="/tasks"
                  />
                )}
                {doneTodayCount > 0 && (
                  <VitalSign
                    label={td("stats.doneToday")}
                    value={doneTodayCount}
                    tone="success"
                  />
                )}
                <VitalSign
                  label={td("stats.projects")}
                  value={(myProjects ?? []).length}
                  tone="neutral"
                  href="/projects"
                />
                {(myTeams ?? []).length > 0 && (
                  <VitalSign
                    label={td("stats.teams")}
                    value={(myTeams ?? []).length}
                    tone="neutral"
                    href="/teams"
                  />
                )}
              </>
            )}
          </div>

          {/* Subtle progress ring for today */}
          {!isLoading && totalTasksToday > 0 && (
            <div className="mt-5 flex items-center gap-3 max-w-md">
              <span className="tx-overline shrink-0">{td("todayFocus")}</span>
              <div className="tx-progress flex-1">
                <span style={{ width: `${todayProgress}%` }} />
              </div>
              <span className="tx-overline tx-num shrink-0 text-[var(--tx-text-muted)]">
                {doneTodayCount}/{totalTasksToday}
              </span>
            </div>
          )}
        </header>

        {/* ── Quick actions — compact, chip-style row ──────────────── */}
        <div className="mb-10 flex flex-wrap items-center gap-2">
          <button
            onClick={onCreateDoc}
            className="tx-chip tx-pressable tx-focus-ring"
          >
            <Plus className="h-3 w-3" />
            {td("newNote")}
          </button>
          <button
            onClick={() => setShowNewTask(true)}
            className="tx-chip tx-pressable tx-focus-ring"
          >
            <Plus className="h-3 w-3" />
            {td("newTask")}
          </button>
          <button
            onClick={() => router.push("/projects")}
            className="tx-chip tx-pressable tx-focus-ring"
          >
            <FolderKanban className="h-3 w-3" />
            {td("myProjects")}
          </button>
          {extEnabled("aiAssistant") && (
            <button
              onClick={() => setShowAi(true)}
              className="tx-chip tx-pressable tx-focus-ring"
              data-active="true"
            >
              <Sparkles className="h-3 w-3" />
              A2E AI
            </button>
          )}
          <span className="ml-auto hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground/40">
            <kbd className="rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 font-mono text-[10px]">⌘</kbd>
            <kbd className="rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 font-mono text-[10px]">K</kbd>
            <span>{tc("search") ?? "Search anything"}</span>
          </span>
        </div>

        {/* ── Main grid: focus stream (left) + aside (right) ────────── */}
        <div className="grid gap-10 lg:grid-cols-[1fr_320px] lg:gap-12">
          {/* LEFT — Focus stream */}
          <div className="space-y-10 min-w-0">
            {/* Focus stream */}
            <section>
              <SectionHeader
                eyebrow={td("todayFocus")}
                title={td("myTasks")}
                action={{ label: td("viewAll"), onClick: () => router.push("/tasks") }}
              />
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-1 py-2">
                      <Skeleton className="h-3.5 w-3.5 rounded-full shrink-0" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  ))}
                </div>
              ) : focusStream.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title={td("allCaughtUp")}
                  description={td("noTasksDesc")}
                  cta={{ label: td("addTask"), onClick: () => setShowNewTask(true) }}
                />
              ) : (
                <div className="tx-stagger -mx-1">
                  {focusStream.slice(0, 8).map((task) => (
                    <FocusTaskRow
                      key={task._id}
                      task={task}
                      now={now}
                      onComplete={handleCompleteTask}
                      onOpen={() => router.push(`/tasks/${task._id}`)}
                      locale={locale}
                      overdueLabel={td("overdue")}
                    />
                  ))}
                  {focusStream.length > 8 && (
                    <Link
                      href="/tasks"
                      prefetch
                      className="mt-2 flex items-center justify-between px-3 py-2 text-[11px] text-muted-foreground/50 hover:text-foreground/70 transition-colors rounded-lg hover:bg-foreground/[0.03]"
                    >
                      <span>+{focusStream.length - 8} {td("more")}</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              )}
            </section>

            {/* Inbox stream — only if unread */}
            {unreadCount > 0 && (
              <section>
                <SectionHeader
                  eyebrow={td("stats.unread")}
                  title={td("inbox")}
                  badge={unreadCount}
                  action={{ label: td("viewAll"), onClick: () => router.push("/inbox") }}
                />
                <div className="tx-stagger -mx-1 space-y-0.5">
                  {(notifications ?? []).filter((n) => !n.read).slice(0, 4).map((n) => (
                    <button
                      key={n._id}
                      onClick={() => router.push("/inbox")}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-foreground/[0.03] group"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] shrink-0 ring-4 ring-[color-mix(in_oklch,var(--primary),transparent_90%)]" />
                      <span className="flex-1 text-[13px] truncate text-foreground/85 group-hover:text-foreground">
                        {n.title}
                      </span>
                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/45">
                        {timeAgo(n.createdAt)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* RIGHT — Aside */}
          <aside className="space-y-10 lg:sticky lg:top-4 lg:self-start">
            {/* Recent notes */}
            <section>
              <SectionHeader
                eyebrow={td("stats.notes")}
                title={td("recentNotes")}
                action={{ label: tc("add"), onClick: onCreateDoc, icon: Plus }}
              />
              {recentDocs === undefined ? (
                <div className="space-y-1">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-2 py-2">
                      <Skeleton className="h-4 w-4 rounded shrink-0" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  ))}
                </div>
              ) : (recentDocs ?? []).length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title={td("noNotes")}
                  cta={{ label: td("createNote"), onClick: onCreateDoc }}
                />
              ) : (
                <div className="tx-stagger -mx-1">
                  {(recentDocs ?? []).slice(0, 6).map((doc) => (
                    <Link
                      key={doc._id}
                      href={`/documents/${doc._id}`}
                      prefetch
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-foreground/[0.03] group"
                    >
                      <span className="shrink-0 text-sm leading-none grayscale opacity-85 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                        {doc.icon ?? "📄"}
                      </span>
                      <span className="flex-1 text-[13px] truncate text-foreground/80 group-hover:text-foreground">
                        {doc.title || tc("untitled")}
                      </span>
                      <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground/30 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Projects */}
            {(myProjects ?? []).length > 0 && (
              <section>
                <SectionHeader
                  eyebrow={td("stats.projects")}
                  title={td("myProjects")}
                  action={{ label: td("viewAll"), onClick: () => router.push("/projects") }}
                />
                <div className="tx-stagger space-y-1.5">
                  {(myProjects ?? []).filter(Boolean).slice(0, 4).map((project) => {
                    const isDone = project!.status === "completed";
                    const progressPct = isDone ? 100 : project!.status === "archived" ? 100 : 32;
                    return (
                      <button
                        key={project!._id}
                        onClick={() => router.push(`/projects/${project!._id}`)}
                        className="w-full flex items-center gap-3 rounded-[var(--tx-radius-md)] px-2.5 py-2 text-left transition-all hover:bg-foreground/[0.03] group"
                      >
                        <div
                          className="h-7 w-7 shrink-0 rounded-[var(--tx-radius-sm)] flex items-center justify-center text-white text-[11px] font-semibold"
                          style={{ backgroundColor: project!.color ?? "#6366f1" }}
                        >
                          {project!.icon ?? project!.name[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate text-foreground/85 group-hover:text-foreground">
                            {project!.name}
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="tx-progress flex-1">
                              <span style={{ width: `${progressPct}%`, background: isDone ? "var(--tx-text-muted)" : undefined }} />
                            </div>
                            <span className="shrink-0 text-[9.5px] uppercase tracking-wider text-muted-foreground/50">
                              {project!.status}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Teams */}
            {(myTeams ?? []).length > 0 && (
              <section>
                <SectionHeader
                  eyebrow={td("stats.teams")}
                  title={td("myTeams")}
                  action={{ label: td("viewAll"), onClick: () => router.push("/teams") }}
                />
                <div className="tx-stagger space-y-0.5">
                  {(myTeams ?? []).filter(Boolean).slice(0, 4).map((team: any) => (
                    <button
                      key={team._id}
                      onClick={() => router.push(`/teams/${team._id}`)}
                      className="w-full flex items-center gap-3 rounded-[var(--tx-radius-md)] px-2.5 py-2 text-left transition-colors hover:bg-foreground/[0.03] group"
                    >
                      <div className="h-6 w-6 shrink-0 rounded-[var(--tx-radius-sm)] bg-foreground/[0.06] flex items-center justify-center text-[10px] font-semibold text-foreground/70">
                        {team.icon ?? team.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate text-foreground/85 group-hover:text-foreground">
                          {team.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground/50 capitalize mt-0.5">{team.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>

      <NewTaskDialog open={showNewTask} onClose={() => setShowNewTask(false)} />

      {/* AI Assistant floating panel */}
      {extEnabled("aiAssistant") && showAi && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[520px] rounded-[var(--tx-radius-xl)] border border-border/60 bg-[var(--tx-surface-0)] tx-shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          <AiAssistantPanel onClose={() => setShowAi(false)} />
        </div>
      )}

      {/* AI Assistant floating toggle */}
      {extEnabled("aiAssistant") && !showAi && (
        <button
          onClick={() => setShowAi(true)}
          className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] tx-shadow-lg tx-pressable transition-all hover:scale-[1.06]"
          title="A2E AI"
          aria-label="Open A2E AI"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

// ─── Subcomponents ────────────────────────────────────────────────────────

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  badge?: number;
  action?: { label: string; onClick: () => void; icon?: React.ElementType };
}

function SectionHeader({ eyebrow, title, badge, action }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="tx-overline mb-1.5">{eyebrow}</p>}
        <div className="flex items-center gap-2">
          <h2 className="tx-headline text-[17px] font-medium truncate">{title}</h2>
          {badge !== undefined && badge > 0 && (
            <span className="tx-num inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--primary)] px-1.5 text-[10px] font-semibold text-[var(--primary-foreground)]">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </div>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="group/header flex items-center gap-1 text-[11px] text-muted-foreground/55 hover:text-foreground transition-colors shrink-0 tx-focus-ring rounded-md px-1 -mr-1 py-0.5"
        >
          {action.icon && <action.icon className="h-3 w-3" />}
          {action.label}
          {!action.icon && <ArrowRight className="h-3 w-3 -translate-x-0.5 group-hover/header:translate-x-0 transition-transform" />}
        </button>
      )}
    </div>
  );
}

interface VitalSignProps {
  label: string;
  value: number | string;
  tone: "neutral" | "success" | "danger";
  href?: string;
}

function VitalSign({ label, value, tone, href }: VitalSignProps) {
  const toneClass =
    tone === "danger"  ? "text-red-500 dark:text-red-400" :
    tone === "success" ? "text-emerald-500 dark:text-emerald-400" :
    "text-foreground";

  const inner = (
    <span className="group inline-flex items-baseline gap-1.5 tx-focus-ring rounded-md px-0.5 -mx-0.5">
      <span className={cn("text-lg font-semibold tracking-tight tx-num", toneClass)}>
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground/55 group-hover:text-muted-foreground transition-colors">
        {label.toLowerCase()}
      </span>
    </span>
  );

  return href ? (
    <Link href={href} prefetch className="inline-flex">
      {inner}
    </Link>
  ) : inner;
}

interface FocusTaskRowProps {
  task: any;
  now: number;
  onComplete: (id: any) => void | Promise<void>;
  onOpen: () => void;
  locale: string;
  overdueLabel: string;
}

function FocusTaskRow({ task, now, onComplete, onOpen, locale, overdueLabel }: FocusTaskRowProps) {
  const [completing, setCompleting] = useState(false);
  const isOverdue = !!(task.dueDate && task.dueDate < now && task.status !== "done");
  const isTodayTask = !!task.dueDate && isToday(task.dueDate);
  const prio = PRIORITY_STYLE[task.priority ?? "none"] ?? PRIORITY_STYLE.none;

  const handleCheck = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (completing) return;
    setCompleting(true);
    await onComplete(task._id);
  };

  const dueText = !task.dueDate ? null :
    isOverdue ? overdueLabel :
    isTodayTask ? (locale === "fr" ? "Aujourd’hui" : "Today") :
    new Date(task.dueDate).toLocaleDateString(locale, { month: "short", day: "numeric" });

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      className={cn(
        "relative flex items-center gap-3 rounded-[var(--tx-radius-md)] px-3 py-2 cursor-pointer transition-all group/row",
        "hover:bg-foreground/[0.03]",
        completing && "opacity-40",
      )}
    >
      {/* Completion checkbox */}
      <button
        onClick={handleCheck}
        className={cn(
          "relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all",
          "border-foreground/20 hover:border-[var(--primary)] hover:bg-[var(--primary)]/10",
          "focus-visible:outline-none focus-visible:border-[var(--primary)] focus-visible:bg-[var(--primary)]/10",
        )}
        aria-label="Complete task"
      >
        {completing ? (
          <Loader2 className="h-2.5 w-2.5 animate-spin text-[var(--primary)]" />
        ) : (
          <Check className="h-2.5 w-2.5 text-[var(--primary)] opacity-0 group-hover/row:opacity-100 transition-opacity" />
        )}
      </button>

      {/* Priority dot */}
      {task.priority !== "none" && (
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full ring-2", prio.dot, prio.ring)}
          aria-hidden
        />
      )}

      {/* Title */}
      <span
        className={cn(
          "flex-1 truncate text-[13px] transition-colors",
          isOverdue ? "text-red-500/85 dark:text-red-400/85" : "text-foreground/85 group-hover/row:text-foreground",
        )}
      >
        {task.title}
      </span>

      {/* Status / due chip */}
      <div className="flex items-center gap-2 shrink-0">
        {task.status === "in_progress" && (
          <span className="tx-overline text-[var(--primary)]">
            {locale === "fr" ? "En cours" : "In progress"}
          </span>
        )}
        {dueText && (
          <span
            className={cn(
              "text-[10.5px] tabular-nums font-medium",
              isOverdue ? "text-red-500" :
              isTodayTask ? "text-[var(--primary)]" :
              "text-muted-foreground/60",
            )}
          >
            {dueText}
          </span>
        )}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  cta?: { label: string; onClick: () => void };
}

function EmptyState({ icon: Icon, title, description, cta }: EmptyStateProps) {
  return (
    <div className="rounded-[var(--tx-radius-lg)] border border-dashed border-border/50 p-8 text-center">
      <Icon className="mx-auto mb-3 h-7 w-7 text-muted-foreground/25" />
      <p className="tx-title">{title}</p>
      {description && <p className="mt-1 text-[12px] text-muted-foreground/55 max-w-[240px] mx-auto">{description}</p>}
      {cta && (
        <button
          onClick={cta.onClick}
          className="mt-4 inline-flex items-center gap-1.5 tx-chip tx-pressable"
        >
          <Plus className="h-3 w-3" />
          {cta.label}
        </button>
      )}
    </div>
  );
}

export default DocumentsPage;
