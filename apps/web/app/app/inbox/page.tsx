"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useNotifications, useNotificationMutations } from "@a2e/core";
import { coreFlags } from "@/lib/core-flags";
import { PageContainer, PageHeader, EmptyState, btnOutline, btnPrimary, timeAgo } from "@/components/app/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Notification,
  TickCircle,
  Trash,
  TaskSquare,
  Profile2User,
  DocumentText,
  Messages2,
  Clock,
  ArrowRight,
  DocumentText1,
  Briefcase,
  Archive,
  Eye,
} from "iconsax-reactjs";

const ICON: Record<string, any> = {
  task_created: TaskSquare,
  task_assigned: TaskSquare,
  task_comment: Messages2,
  task_completed: TickCircle,
  mention: Messages2,
  chat_mention: Messages2,
  chat_reply: Messages2,
  comment_mention: Messages2,
  comment: Messages2,
  member_joined: Profile2User,
  member_left: Profile2User,
  project_invitation: Profile2User,
  project_assigned: Briefcase,
  team_invitation: Profile2User,
  deadline_alert: Clock,
  task_due_soon: Clock,
  reminder: Clock,
};

type FilterTab = "all" | "mentions" | "assigned" | "reactions";

const FILTER_TABS: { key: FilterTab; labelKey: "all" | "mentions" | "assigned" | "reactions" }[] = [
  { key: "all", labelKey: "all" },
  { key: "mentions", labelKey: "mentions" },
  { key: "assigned", labelKey: "assigned" },
  { key: "reactions", labelKey: "reactions" },
];

function matchesTab(type: string, tab: FilterTab): boolean {
  if (tab === "all") return true;
  if (tab === "mentions")
    return (
      type === "mention" ||
      type === "task_comment" ||
      type === "chat_mention" ||
      type === "chat_reply" ||
      type === "comment_mention" ||
      type === "comment"
    );
  if (tab === "assigned")
    return type === "task_assigned" || type === "project_assigned";
  if (tab === "reactions")
    return type === "reaction" || type === "chat_reaction" || type === "comment_reaction";
  return true;
}

/** Unified notification shape for the UI (normalizes local + core docs). */
interface NotifItem {
  _id: string;
  source: "core" | "local";
  type: string;
  title: string;
  message?: string;
  read: boolean;
  link?: string;
  createdAt: number;
}

/** Parse a notification link into a previewable entity reference. */
function parseLink(
  link: string | undefined,
): { kind: "document" | "task" | "project"; id: string } | null {
  if (!link) return null;
  // Strip leading /app if present (some notifications use /app/documents/<id>,
  // others use /documents/<id>).
  const path = link.startsWith("/app") ? link.slice(4) : link;
  // /documents/<id>, /tasks/<id>, /projects/<id>
  const m = path.match(/^\/(documents|tasks|projects)\/([^/?#]+)/);
  if (!m) return null;
  const kindMap = { documents: "document", tasks: "task", projects: "project" } as const;
  return { kind: kindMap[m[1] as keyof typeof kindMap], id: m[2] };
}

/** Group notifications by day (Today / Yesterday / Earlier). */
function dayKey(ts: number, now: Date): "today" | "yesterday" | "earlier" {
  const d = new Date(ts);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  if (ts >= startOfToday) return "today";
  if (ts >= startOfYesterday) return "yesterday";
  return "earlier";
}

/** Extract plain text from a BlockNote JSON content string. */
function extractPlainText(content: string | undefined): string {
  if (!content) return "";
  try {
    const blocks = JSON.parse(content);
    if (!Array.isArray(blocks)) return "";
    return blocks
      .map((block: any) => {
        let text = "";
        if (Array.isArray(block.content)) {
          for (const item of block.content) {
            if (typeof item.text === "string") text += item.text;
            if (Array.isArray(item.content)) {
              text += item.content.map((c: any) => c.text ?? "").join("");
            }
          }
        }
        return text;
      })
      .filter(Boolean)
      .join(" ")
      .trim();
  } catch {
    return "";
  }
}

export default function InboxPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const t = useTranslations("inbox");

  // Legacy local path
  const localNotifications = useQuery(api.notifications.listMine, { limit: 200 });
  const localMarkRead = useMutation(api.notifications.markRead);
  const localMarkAllRead = useMutation(api.notifications.markAllRead);
  const localRemove = useMutation(api.notifications.remove);
  const localClearAll = useMutation(api.notifications.clearAll);

  // Core path
  const coreNotifications = useNotifications({ limit: 200 });
  const coreMutations = useNotificationMutations();

  const useCore = coreFlags.notifications;

  const coreItems: NotifItem[] = (coreNotifications ?? []).map((n) => ({
    _id: n._id,
    source: "core" as const,
    type: n.type,
    title: n.title,
    message: n.message,
    read: n.read,
    link: n.link,
    createdAt: n.createdAt,
  }));
  const localItems: NotifItem[] = (localNotifications ?? []).map((n: any) => ({
    _id: n._id,
    source: "local" as const,
    type: n.type,
    title: n.title,
    message: n.message ?? n.body,
    read: n.read,
    link: n.link,
    createdAt: n.createdAt,
  }));

  const notifications: NotifItem[] | undefined = useCore
    ? [...coreItems, ...localItems].sort((a, b) => b.createdAt - a.createdAt)
    : localItems;

  const loading = useCore
    ? coreNotifications === undefined || localNotifications === undefined
    : localNotifications === undefined;

  const handleMarkRead = (item: NotifItem) => {
    if (item.source === "core") return coreMutations.markRead({ notificationId: item._id as any });
    return localMarkRead({ id: item._id as any });
  };
  const handleMarkAllRead = () => {
    if (useCore) {
      return Promise.all([coreMutations.markAllRead({}), localMarkAllRead({})]).then(
        () => undefined,
      );
    }
    return localMarkAllRead({});
  };
  const handleRemove = (item: NotifItem) => {
    if (item.source === "core") return coreMutations.remove({ notificationId: item._id as any });
    return localRemove({ id: item._id as any });
  };
  const handleClearAll = () => {
    if (useCore) {
      return Promise.all([coreMutations.clearAll({}), localClearAll({})]).then(() => undefined);
    }
    return localClearAll({});
  };

  // Archive all read notifications (Huly "Archive all read" bulk action).
  // Iterates client-side over read items calling remove() on each, since the
  // shared core notifications API has no batch-archive-read endpoint.
  const handleArchiveRead = async () => {
    const readItems = (notifications ?? []).filter((n) => n.read);
    if (readItems.length === 0) return;
    await Promise.all(readItems.map((item) => handleRemove(item)));
  };

  const filtered = (notifications ?? []).filter(
    (n) => matchesTab(n.type, activeTab) && (!onlyUnread || !n.read),
  );

  // Day grouping
  const now = useMemo(() => new Date(), []);
  const grouped = useMemo(() => {
    const groups: { today: NotifItem[]; yesterday: NotifItem[]; earlier: NotifItem[] } = {
      today: [],
      yesterday: [],
      earlier: [],
    };
    for (const n of filtered) {
      groups[dayKey(n.createdAt, now)].push(n);
    }
    return groups;
  }, [filtered, now]);

  const selected = useMemo(
    () => filtered.find((n) => n._id === selectedId) ?? null,
    [filtered, selectedId],
  );

  // Selecting a notification marks it read + shows preview.
  const handleSelect = (item: NotifItem) => {
    setSelectedId(item._id);
    if (!item.read) {
      handleMarkRead(item).catch(() => undefined);
    }
  };

  // Reset selection when filter changes and the selected item is no longer visible.
  useEffect(() => {
    if (selectedId && !filtered.some((n) => n._id === selectedId)) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  // Keyboard triage (§6 / M5.3): ↑↓ navigate, E archive, Enter open.
  // M (mute) deferred to M5.3b — no thread/mute API exists yet.
  useEffect(() => {
    if (loading || filtered.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in an input/textarea/contenteditable.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      // Ignore modifier combos (let ⌘K etc. pass through).
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const currentIndex = selectedId ? filtered.findIndex((n) => n._id === selectedId) : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, filtered.length - 1);
        handleSelect(filtered[next]);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = currentIndex <= 0 ? 0 : currentIndex - 1;
        handleSelect(filtered[prev]);
      } else if (e.key === "e" || e.key === "E") {
        if (currentIndex < 0) return;
        e.preventDefault();
        const item = filtered[currentIndex];
        const neighbor =
          filtered[currentIndex + 1] ?? filtered[currentIndex - 1] ?? null;
        handleRemove(item)
          .then(() => toast.success(t("archived")))
          .catch(() => undefined);
        setSelectedId(neighbor ? neighbor._id : null);
      } else if (e.key === "Enter") {
        if (currentIndex < 0) return;
        e.preventDefault();
        const item = filtered[currentIndex];
        if (item.link) {
          router.push(item.link.startsWith("/app") ? item.link : `/app${item.link}`);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // handleSelect/handleRemove/router/t are stable enough; filtered drives re-bind.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, selectedId, loading]);

  // Scroll the keyboard-selected row into view inside the list pane.
  useEffect(() => {
    if (!selectedId) return;
    const el = document.querySelector<HTMLElement>(
      `[data-testid="inbox-item"][data-inbox-id="${CSS.escape(selectedId)}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  return (
    <PageContainer className="max-w-[1280px]">
      <PageHeader
        title={t("title")}
        subtitle={t("notifTypes.subtitle")}
        icon={Notification}
        testId="inbox-header"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                handleArchiveRead().then(() => toast.success(t("archivedRead")))
              }
              className={btnOutline}
              data-testid="inbox-archive-read"
            >
              <Archive variant="Bulk" size={16} /> {t("archiveRead")}
            </button>
            <button
              onClick={() => handleMarkAllRead().then(() => toast.success(t("markedAllRead")))}
              className={btnOutline}
              data-testid="inbox-mark-all"
            >
              <TickCircle variant="Bulk" size={16} /> {t("markAllRead")}
            </button>
            <button
              onClick={() => handleClearAll().then(() => toast.success(t("cleared")))}
              className={btnOutline}
              data-testid="inbox-clear-all"
            >
              <Trash variant="Bulk" size={16} /> {t("notifTypes.clear")}
            </button>
          </div>
        }
      />

      {/* Type filter tabs + Only-unread toggle */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div
          className="flex items-center gap-1 rounded-full border border-border bg-card p-0.5 w-fit"
          data-testid="inbox-filter-tabs"
        >
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              data-testid={`inbox-filter-${tab.key}`}
              className={cn(
                "h-8 rounded-full px-3 text-sm transition-colors",
                activeTab === tab.key
                  ? "bg-muted font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`filters.${tab.labelKey}`)}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOnlyUnread((v) => !v)}
          data-testid="inbox-only-unread"
          aria-pressed={onlyUnread}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
            onlyUnread
              ? "border-primary bg-primary/10 font-medium text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          <Eye variant={onlyUnread ? "Bold" : "Bulk"} size={16} /> {t("onlyUnread")}
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
          <div className="hidden h-64 animate-pulse rounded-2xl bg-muted md:block" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Notification}
          title={t("allCaughtUp")}
          description={t("empty.description")}
          testId="inbox-empty"
        />
      ) : (
        <div
          className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
          data-testid="inbox-two-pane"
        >
          {/* Left: day-grouped list */}
          <div
            className="overflow-hidden rounded-2xl border border-border bg-card"
            data-testid="inbox-list"
          >
            {(["today", "yesterday", "earlier"] as const).map((group) => {
              const items = grouped[group];
              if (items.length === 0) return null;
              return (
                <div key={group} data-testid={`inbox-group-${group}`}>
                  <div className="sticky top-0 z-10 bg-card/95 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                    {t(group)}
                  </div>
                  {items.map((n) => {
                    const Icon = ICON[n.type] ?? DocumentText;
                    const isSelected = n._id === selectedId;
                    return (
                      <div
                        key={n._id}
                        data-testid="inbox-item"
                        data-inbox-id={n._id}
                        className={cn(
                          "group flex items-start gap-3 border-b border-border px-4 py-3 last:border-0 transition-colors",
                          !n.read && "bg-[var(--flux-coral-soft)]/40",
                          isSelected && "ring-2 ring-inset ring-primary/50",
                          isSelected && !n.read && "bg-[var(--flux-coral-soft)]/60",
                        )}
                      >
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <Icon variant="Bulk" size={18} />
                        </span>
                        <button
                          onClick={() => handleSelect(n)}
                          className="min-w-0 flex-1 text-left"
                          data-testid="inbox-item-select"
                        >
                          <p className="text-sm font-medium">
                            {n.title}
                            {!n.read && (
                              <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />
                            )}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">{n.message}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {timeAgo(n.createdAt)}
                          </p>
                        </button>
                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {!n.read && (
                            <button
                              onClick={() => handleMarkRead(n)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                              title={t("notifTypes.markRead")}
                              data-testid="inbox-item-mark-read"
                            >
                              <TickCircle variant="Bulk" size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemove(n)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                            title={t("notifTypes.remove")}
                            data-testid="inbox-item-remove"
                          >
                            <Trash variant="Bulk" size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Right: entity preview */}
          <div
            className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block"
            data-testid="inbox-preview"
          >
            {selected ? (
              <InboxPreview
                item={selected}
                onOpen={() => {
                  if (selected.link) {
                    router.push(
                      selected.link.startsWith("/app") ? selected.link : `/app${selected.link}`,
                    );
                  }
                }}
              />
            ) : (
              <div
                className="flex h-full flex-col items-center justify-center px-6 py-16 text-center"
                data-testid="inbox-preview-empty"
              >
                <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-muted text-muted-foreground">
                  <DocumentText1 variant="Bulk" size={30} />
                </span>
                <h3 className="text-base font-semibold">{t("preview.selectPrompt")}</h3>
                <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                  {t("preview.selectHint")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}

/** Right-pane entity preview. Resolves the notification link into a doc/task/project. */
function InboxPreview({ item, onOpen }: { item: NotifItem; onOpen: () => void }) {
  const t = useTranslations("inbox");
  const ref = parseLink(item.link);
  const docQuery = useQuery(
    api.flux_documents.get,
    ref && ref.kind === "document" ? ({ documentId: ref.id as Id<"flux_documents"> } as any) : "skip",
  );
  const taskQuery = useQuery(
    api.flux_tasks.get,
    ref && ref.kind === "task" ? ({ taskId: ref.id as Id<"tasks"> } as any) : "skip",
  );
  const projectQuery = useQuery(
    api.projects.get,
    ref && ref.kind === "project" ? ({ projectId: ref.id as Id<"projects"> } as any) : "skip",
  );

  const loading =
    (ref?.kind === "document" && docQuery === undefined) ||
    (ref?.kind === "task" && taskQuery === undefined) ||
    (ref?.kind === "project" && projectQuery === undefined);

  const entity =
    ref?.kind === "document"
      ? docQuery
        ? { type: "document" as const, data: docQuery as Doc<"flux_documents"> }
        : null
      : ref?.kind === "task"
        ? taskQuery
          ? { type: "task" as const, data: taskQuery as any }
          : null
        : ref?.kind === "project"
          ? projectQuery
            ? { type: "project" as const, data: projectQuery as Doc<"projects"> }
            : null
          : null;

  return (
    <div className="flex h-full flex-col">
      {/* Header: notification context */}
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            {(() => {
              const Icon = ICON[item.type] ?? DocumentText;
              return <Icon variant="Bulk" size={18} />;
            })()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(item.createdAt)}</p>
          </div>
          <button
            onClick={onOpen}
            className={cn(btnPrimary, "h-8 px-3 py-1 text-xs")}
            data-testid="inbox-preview-open"
          >
            {t("preview.open")} <ArrowRight variant="Bold" size={14} />
          </button>
        </div>
        {item.message && (
          <p className="mt-3 text-sm text-muted-foreground" data-testid="inbox-preview-message">
            {item.message}
          </p>
        )}
      </div>

      {/* Entity body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4" data-testid="inbox-preview-body">
        {!ref ? (
          <PreviewEmpty
            icon={Messages2}
            title={t("preview.noPreview")}
            hint={t("preview.noPreviewHint")}
            testId="inbox-preview-none"
          />
        ) : loading ? (
          <div className="space-y-3">
            <div className="h-6 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-24 animate-pulse rounded-xl bg-muted" />
          </div>
        ) : !entity ? (
          <PreviewEmpty
            icon={DocumentText}
            title={t("preview.notFound")}
            testId="inbox-preview-not-found"
          />
        ) : entity.type === "document" ? (
          <DocumentPreview doc={entity.data} />
        ) : entity.type === "task" ? (
          <TaskPreview task={entity.data} />
        ) : (
          <ProjectPreview project={entity.data} />
        )}
      </div>
    </div>
  );
}

function PreviewEmpty({
  icon: Icon,
  title,
  hint,
  testId,
}: {
  icon: any;
  title: string;
  hint?: string;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon variant="Bulk" size={22} />
      </span>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function DocumentPreview({ doc }: { doc: Doc<"flux_documents"> }) {
  const t = useTranslations("inbox");
  const excerpt = useMemo(() => {
    const plain = extractPlainText(doc.content);
    return plain ? (plain.length > 280 ? plain.slice(0, 280) + "…" : plain) : "";
  }, [doc.content]);
  return (
    <div data-testid="inbox-preview-document">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <DocumentText1 variant="Bulk" size={16} />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("preview.document")}
        </span>
      </div>
      <h2 className="font-display text-lg font-bold tracking-tight">
        {doc.icon ? <span className="mr-1.5">{doc.icon}</span> : null}
        {doc.title || "Untitled"}
      </h2>
      {excerpt ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {excerpt}
        </p>
      ) : (
        <p className="mt-3 text-sm italic text-muted-foreground">—</p>
      )}
      <div className="mt-4 text-xs text-muted-foreground">
        {t("preview.excerpt")}: {doc.updatedAt ? timeAgo(doc.updatedAt) : ""}
      </div>
    </div>
  );
}

function TaskPreview({ task }: { task: any }) {
  const t = useTranslations("inbox");
  return (
    <div data-testid="inbox-preview-task">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <TaskSquare variant="Bulk" size={16} />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("preview.task")}
        </span>
      </div>
      <h2 className="font-display text-lg font-bold tracking-tight">{task.title}</h2>
      {task.description && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {task.description.length > 280 ? task.description.slice(0, 280) + "…" : task.description}
        </p>
      )}
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <dt className="w-20 shrink-0 text-xs font-medium text-muted-foreground">
            {t("preview.status")}
          </dt>
          <dd className="text-sm">{task.status?.replace(/_/g, " ") ?? "—"}</dd>
        </div>
        {task.assignee && (
          <div className="flex items-center gap-2">
            <dt className="w-20 shrink-0 text-xs font-medium text-muted-foreground">
              {t("preview.assignee")}
            </dt>
            <dd className="text-sm">{task.assignee.name ?? task.assignee.email ?? "—"}</dd>
          </div>
        )}
        {task.dueDate && (
          <div className="flex items-center gap-2">
            <dt className="w-20 shrink-0 text-xs font-medium text-muted-foreground">
              {t("preview.due")}
            </dt>
            <dd className="text-sm">{new Date(task.dueDate).toLocaleDateString()}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function ProjectPreview({ project }: { project: Doc<"projects"> }) {
  const t = useTranslations("inbox");
  return (
    <div data-testid="inbox-preview-project">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Briefcase variant="Bulk" size={16} />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("preview.project")}
        </span>
      </div>
      <h2 className="font-display text-lg font-bold tracking-tight">{project.name}</h2>
      {project.description && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {project.description.length > 280
            ? project.description.slice(0, 280) + "…"
            : project.description}
        </p>
      )}
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <dt className="w-20 shrink-0 text-xs font-medium text-muted-foreground">
            {t("preview.status")}
          </dt>
          <dd className="text-sm">{project.status.replace(/_/g, " ")}</dd>
        </div>
        {project.client && (
          <div className="flex items-center gap-2">
            <dt className="w-20 shrink-0 text-xs font-medium text-muted-foreground">
              {t("preview.client")}
            </dt>
            <dd className="text-sm">{project.client}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
