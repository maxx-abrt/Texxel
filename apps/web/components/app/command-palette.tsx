"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCoreSearch } from "@a2e/core";
import { useCoreWorkspaceId } from "@/hooks/use-core-workspace-id";
import { coreFlags } from "@/lib/core-flags";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { useLocale, useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Element3,
  DocumentText,
  TaskSquare,
  Briefcase,
  Calendar,
  Data2,
  Setting2,
  Profile2User,
  AddSquare,
  Message,
  CalendarAdd,
  Moon,
  SidebarLeft,
  FolderOpen,
  Clock,
  SidebarRight,
  UserAdd,
} from "iconsax-reactjs";
import { SynaIcon } from "./syna-icon";

const PAGES_KEYS = [
  { key: "home", href: "/app", Icon: Element3 },
  { key: "documents", href: "/app/documents", Icon: DocumentText },
  { key: "tasks", href: "/app/tasks", Icon: TaskSquare },
  { key: "projects", href: "/app/projects", Icon: Briefcase },
  { key: "calendar", href: "/app/calendar", Icon: Calendar },
  { key: "databases", href: "/app/databases", Icon: Data2 },
  { key: "files", href: "/app/files", Icon: FolderOpen },
  { key: "settings", href: "/app/settings", Icon: Setting2 },
];

const STATUS_COLOR: Record<string, string> = {
  todo: "var(--muted-foreground)",
  in_progress: "#2f7ea6",
  done: "var(--accent-mint)",
  planning: "#2f7ea6",
  active: "var(--accent-mint)",
  on_hold: "#d98324",
  completed: "var(--muted-foreground)",
};

// M2.3 (§5 #3) — frecency ranking. `uses` dominates, `recencyBoost` decays
// with age (half-life ~3 days) so stale picks sink. History lives in
// `flux_userPrefs.commandHistory` (capped at 50 server-side).
type CommandHistoryEntry = { key: string; uses: number; lastUsed: number };

const DAY_MS = 24 * 60 * 60 * 1000;

function frecencyScore(entry: CommandHistoryEntry, now: number): number {
  const ageDays = Math.max(0, (now - entry.lastUsed) / DAY_MS);
  const recencyBoost = 1 / (1 + ageDays / 3);
  return entry.uses * 0.7 + recencyBoost;
}

function useFrecency(open: boolean) {
  const prefs = useQuery(api.flux_userPrefs.get, open ? {} : "skip");
  const record = useMutation(api.flux_userPrefs.recordCommand);
  const history: CommandHistoryEntry[] = (prefs as any)?.commandHistory ?? [];
  const now = Date.now();
  const scores = new Map<string, number>();
  for (const h of history) scores.set(h.key, frecencyScore(h, now));
  const byFrecency = <T extends { frecencyKey: string }>(items: T[]): T[] =>
    [...items].sort(
      (a, b) => (scores.get(b.frecencyKey) ?? 0) - (scores.get(a.frecencyKey) ?? 0),
    );
  const track = (key: string) => {
    void record({ key }).catch(() => {});
  };
  return { byFrecency, track };
}

// M2.2 (§5 #2) — keyboard shortcut hint chip shown at the right edge of an
// action row (kbd styling; sidebar tokens only).
function ShortcutHint({ keys }: { keys: string }) {
  return (
    <kbd className="ml-auto shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium tabular-nums text-muted-foreground">
      {keys}
    </kbd>
  );
}

function GroupHeading({ label, count }: { label: string; count?: number }) {
  return (
    <span className="flex w-full items-center justify-between gap-2">
      <span>{label}</span>
      {typeof count === "number" && count > 0 && (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
          {count}
        </span>
      )}
    </span>
  );
}

function StatusDot({ status }: { status?: string }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: STATUS_COLOR[status ?? ""] ?? "var(--muted-foreground)" }}
    />
  );
}

// M2.4 (§5 #5) — scoped search prefixes. `d:` docs, `t:` tasks, `p:` projects,
// `#` labels (tasks by tag), `@` people. The prefix is stripped before the
// query is sent to Convex; the scope controls which result groups render.
type Scope = "all" | "docs" | "tasks" | "projects" | "labels" | "people";

function parseScope(q: string): { scope: Scope; query: string } {
  const trimmed = q.trimStart();
  if (trimmed.startsWith("d:")) return { scope: "docs", query: trimmed.slice(2).trimStart() };
  if (trimmed.startsWith("t:")) return { scope: "tasks", query: trimmed.slice(2).trimStart() };
  if (trimmed.startsWith("p:")) return { scope: "projects", query: trimmed.slice(2).trimStart() };
  if (trimmed.startsWith("#")) return { scope: "labels", query: trimmed.slice(1).trimStart() };
  if (trimmed.startsWith("@")) return { scope: "people", query: trimmed.slice(1).trimStart() };
  return { scope: "all", query: q };
}

// M2.4 (§5 #4) — extract plain text from BlockNote JSON content so we can
// show a snippet preview around the match. BlockNote serializes blocks as
// `[{ type, content: [{ type: "text", text, styles }] }]`.
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

// Return up to `maxLen` chars of `text` centered around the first occurrence
// of `query`. Adds ellipsis when truncated. Returns null when no match.
function buildSnippet(text: string, query: string, maxLen = 80): string | null {
  if (!text || !query.trim()) return null;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return null;
  const half = Math.max(0, Math.floor((maxLen - query.length) / 2));
  const start = Math.max(0, idx - half);
  const end = Math.min(text.length, idx + query.length + half);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = "\u2026" + snippet;
  if (end < text.length) snippet = snippet + "\u2026";
  return snippet;
}

// M2.4 (§5 #4) — snippet preview shown under a result row.
function Snippet({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <span
      className="mt-0.5 block truncate text-xs text-muted-foreground"
      data-testid="cmd-snippet"
    >
      {text}
    </span>
  );
}

// M2.4 (§5 #5) — scope badge shown at the right edge of the search input.
const SCOPE_KEYS: Record<Exclude<Scope, "all">, string> = {
  docs: "scopeDocs",
  tasks: "scopeTasks",
  projects: "scopeProjects",
  labels: "scopeLabels",
  people: "scopePeople",
};

export function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const { activeWorkspaceId } = useWorkspace();
  const coreWsId = useCoreWorkspaceId();
  const [q, setQ] = useState("");
  // M2.4 (§5 #5) — parse scoped prefix from the raw input.
  const { scope, query: scopedQuery } = parseScope(q);
  const isScoped = scope !== "all";
  const coreSearch = useCoreSearch(coreFlags.search && open ? (coreWsId as never) : null, scopedQuery);
  const t = useTranslations("commandPalette");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");

  const PAGES = PAGES_KEYS.map((p) => ({
    ...p,
    label: tn(p.key as any),
    frecencyKey: `page:${p.key}`,
  }));
  const settingsPage = PAGES.find((p) => p.key === "settings");

  // M2.4 — docs query only when scope allows (all or docs).
  const docResults = useQuery(
    api.flux_documents.search,
    open && activeWorkspaceId && (scope === "all" || scope === "docs")
      ? { workspaceId: activeWorkspaceId, query: scopedQuery }
      : "skip",
  );
  const other = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).global_search.search,
    open && activeWorkspaceId && scopedQuery.trim().length >= 2 && scope !== "docs" && scope !== "labels"
      ? { workspaceId: activeWorkspaceId, query: scopedQuery }
      : "skip",
  );
  // M2.4 (§5 #5) — `#` prefix: search tasks by label.
  const labelResults = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).global_search.searchByLabel,
    open && activeWorkspaceId && scope === "labels" && scopedQuery.trim().length >= 1
      ? { workspaceId: activeWorkspaceId, query: scopedQuery }
      : "skip",
  );

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  // M2.5 (§5 #6) — close the palette when the route changes so it never
  // lingers over a new page (covers sidebar/back-button navigation that
  // bypasses the `go()` helper which already closes on select).
  useEffect(() => {
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Recently opened documents (tracked by the document view).
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => {
    if (!open) return;
    try {
      setRecentIds(JSON.parse(localStorage.getItem("bureau-recent-docs") ?? "[]"));
    } catch {
      setRecentIds([]);
    }
  }, [open]);
  const allDocs = useQuery(
    api.flux_documents.list,
    open && activeWorkspaceId && recentIds.length ? { workspaceId: activeWorkspaceId } : "skip",
  );
  const { byFrecency, track } = useFrecency(open);
  // M2.3 — pages ranked by frecency too (§5 #3).
  const goToPages = byFrecency(PAGES.filter((p) => p.key !== "settings"));

  const recentDocs = byFrecency(
    (recentIds
      .map((id) => (allDocs ?? []).find((d: any) => String(d._id) === id))
      .filter(Boolean) as any[]).map((d) => ({ ...d, frecencyKey: `doc:${d._id}` })),
  ).slice(0, 5);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const createDoc = useMutation(api.flux_documents.create);
  const newDoc = async () => {
    if (!activeWorkspaceId) return;
    const id = await createDoc({ workspaceId: activeWorkspaceId });
    setOpen(false);
    router.push(`/app/documents/${id}`);
  };
  const fire = (event: string) => {
    setOpen(false);
    window.dispatchEvent(new Event(event));
  };

  const { resolvedTheme, setTheme } = useTheme();
  // M2.2 (§5 #2) — action verbs ("new …") first, each with an icon and an
  // optional keyboard shortcut hint shown as a right-aligned kbd chip.
  // M2.3 (§5 #3) — every action is frecency-tracked; list is re-ranked.
  const ACTIONS = byFrecency([
    { key: "newDoc", Icon: AddSquare, run: () => { track("action:newDoc"); newDoc(); }, testId: "cmd-new-doc", frecencyKey: "action:newDoc" },
    { key: "newTask", Icon: TaskSquare, run: () => { track("action:newTask"); go("/app/tasks"); }, testId: "cmd-new-task", frecencyKey: "action:newTask" },
    { key: "newProject", Icon: Briefcase, run: () => { track("action:newProject"); go("/app/projects?new=1"); }, testId: "cmd-new-project", frecencyKey: "action:newProject" },
    { key: "newEvent", Icon: CalendarAdd, run: () => { track("action:newEvent"); go("/app/calendar"); }, testId: "cmd-new-event", frecencyKey: "action:newEvent" },
    { key: "inviteMember", Icon: UserAdd, run: () => { track("action:inviteMember"); go("/app/members"); }, testId: "cmd-invite-member", frecencyKey: "action:inviteMember" },
    { key: "openChat", Icon: Message, run: () => { track("action:openChat"); fire("bureau:open-chat"); }, testId: "cmd-open-chat", frecencyKey: "action:openChat" },
    { key: "askAi", Icon: SynaIcon, run: () => { track("action:askAi"); fire("bureau:open-ai"); }, testId: "cmd-ask-ai", frecencyKey: "action:askAi" },
    { key: "toggleTheme", Icon: Moon, run: () => { track("action:toggleTheme"); setTheme(resolvedTheme === "dark" ? "light" : "dark"); setOpen(false); }, testId: "cmd-toggle-theme", frecencyKey: "action:toggleTheme" },
    { key: "toggleSidebar", Icon: SidebarLeft, run: () => { track("action:toggleSidebar"); fire("bureau:toggle-sidebar"); }, testId: "cmd-toggle-sidebar", shortcut: "toggleSidebar", frecencyKey: "action:toggleSidebar" },
    { key: "toggleWidgets", Icon: SidebarRight, run: () => { track("action:toggleWidgets"); fire("bureau:toggle-widgets"); }, testId: "cmd-toggle-widgets", shortcut: "toggleWidgets", frecencyKey: "action:toggleWidgets" },
  ]);
  // M2.4 — hide quick actions / recent / go-to while a scoped search is active.
  const showActions = !isScoped && q.trim().length < 2;

  const hasDocResults = scope === "all" || scope === "docs" ? (docResults && docResults.length > 0) : false;
  const hasTasks = scope === "all" || scope === "tasks" ? (other && other.tasks.length > 0) : false;
  const hasProjects = scope === "all" || scope === "projects" ? (other && other.projects.length > 0) : false;
  const hasEvents = scope === "all" ? (other && other.events.length > 0) : false;
  const hasDatabases = scope === "all" ? (other && other.databases.length > 0) : false;
  const hasMembers = scope === "all" || scope === "people" ? (other && other.members.length > 0) : false;
  const hasLabels = scope === "labels" ? (labelResults && (labelResults.labels.length > 0 || labelResults.tasks.length > 0)) : false;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="overflow-hidden rounded-2xl p-0 shadow-none elev-3 sm:max-w-xl"
        data-testid="command-palette"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>
        <Command shouldFilter={false} className="rounded-2xl">
          <CommandInput
            data-testid="global-search-input"
            placeholder={t("searchPlaceholder")}
            value={q}
            onValueChange={setQ}
          />
          {isScoped && (
            <div
              className="flex items-center gap-1.5 border-b border-border px-3 py-1 text-xs text-muted-foreground"
              data-testid="cmd-scope-hint"
            >
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                {t(`scopes.${SCOPE_KEYS[scope]}`)}
              </span>
              <span>{t("scopeHint")}</span>
            </div>
          )}
          <CommandList className="max-h-[420px]">
            <CommandEmpty>{tc("noResults")}</CommandEmpty>

            {showActions && recentDocs.length > 0 && (
              <CommandGroup heading={<GroupHeading label={t("recent")} count={recentDocs.length} />}>
                {recentDocs.map((d: any) => (
                  <CommandItem
                    key={`recent-${d._id}`}
                    value={`recent-${d._id}`}
                    onSelect={() => { track(`doc:${d._id}`); go(`/app/documents/${d._id}`); }}
                    className="gap-2"
                    data-testid="cmd-recent-doc"
                  >
                    <Clock variant="Bulk" size={16} className="shrink-0 text-muted-foreground" />
                    <span className="w-5 shrink-0 text-center">{d.icon ?? "📄"}</span>
                    <span className="truncate">{d.title || tc("untitled")}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {showActions && (
              <CommandGroup heading={<GroupHeading label={t("quickActions")} count={ACTIONS.length} />}>
                {ACTIONS.map(({ key, Icon, run, testId, shortcut }) => (
                  <CommandItem key={key} value={`action-${key}`} onSelect={run} className="gap-2" data-testid={testId}>
                    <Icon variant="Bulk" size={18} className="text-primary" /> {t(`actions.${key}`)}
                    {shortcut && <ShortcutHint keys={t(`shortcuts.${shortcut}`)} />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {hasDocResults && docResults && (
              <CommandGroup heading={<GroupHeading label={tn("documents")} count={docResults.length} />}>
                {docResults.map((d: any) => {
                  const plainText = extractPlainText(d.content);
                  const snippet = buildSnippet(plainText, scopedQuery) ?? buildSnippet(d.title, scopedQuery);
                  return (
                    <CommandItem
                      key={d._id}
                      value={`doc-${d._id}`}
                      data-testid="global-search-result-item"
                      onSelect={() => { track(`doc:${d._id}`); go(`/app/documents/${d._id}`); }}
                      className="gap-2"
                    >
                      <span className="w-5 shrink-0 text-center">{d.icon ?? "📄"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{d.title || tc("untitled")}</span>
                        <Snippet text={snippet} />
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {hasTasks && (
              <CommandGroup heading={<GroupHeading label={tn("tasks")} count={other.tasks.length} />}>
                {other.tasks.map((t: any) => {
                  const snippet = buildSnippet(t.description, scopedQuery);
                  return (
                    <CommandItem
                      key={t._id}
                      value={`task-${t._id}`}
                      onSelect={() => { track(`task:${t._id}`); go(`/app/tasks`); }}
                      className="gap-2"
                    >
                      <TaskSquare variant="Bulk" size={16} className="shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{t.title}</span>
                        <Snippet text={snippet} />
                      </span>
                      <StatusDot status={t.status} />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {hasProjects && (
              <CommandGroup heading={<GroupHeading label={tn("projects")} count={other.projects.length} />}>
                {other.projects.map((p: any) => {
                  const snippet = buildSnippet(p.description, scopedQuery) ?? buildSnippet(p.client, scopedQuery);
                  return (
                    <CommandItem
                      key={p._id}
                      value={`project-${p._id}`}
                      onSelect={() => { track(`project:${p._id}`); go(`/app/projects/${p._id}`); }}
                      className="gap-2"
                    >
                      <span
                        className="h-4 w-4 shrink-0 rounded-md"
                        style={{ backgroundColor: p.color ?? "var(--flux-coral)" }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{p.name}</span>
                        <Snippet text={snippet} />
                      </span>
                      <StatusDot status={p.status} />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {hasEvents && (
              <CommandGroup heading={<GroupHeading label={tn("events")} count={other.events.length} />}>
                {other.events.map((e: any) => {
                  const snippet = buildSnippet(e.description, scopedQuery) ?? buildSnippet(e.location, scopedQuery);
                  return (
                    <CommandItem
                      key={e._id}
                      value={`event-${e._id}`}
                      onSelect={() => { track(`event:${e._id}`); go(`/app/calendar`); }}
                      className="gap-2"
                    >
                      <Calendar variant="Bulk" size={16} className="shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{e.title}</span>
                        <Snippet text={snippet} />
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(e.start).toLocaleDateString(locale)}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {hasDatabases && (
              <CommandGroup heading={<GroupHeading label={tn("databases")} count={other.databases.length} />}>
                {other.databases.map((d: any) => {
                  const snippet = buildSnippet(d.description, scopedQuery);
                  return (
                    <CommandItem
                      key={d._id}
                      value={`db-${d._id}`}
                      onSelect={() => { track(`db:${d._id}`); go(`/app/databases/${d._id}`); }}
                      className="gap-2"
                    >
                      <span className="w-5 shrink-0 text-center">{d.icon ?? "🗄️"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{d.title}</span>
                        <Snippet text={snippet} />
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {hasMembers && (
              <CommandGroup heading={<GroupHeading label={t("people")} count={other.members.length} />}>
                {other.members.map((m: any) => {
                  const snippet = buildSnippet(m.email, scopedQuery);
                  return (
                    <CommandItem
                      key={m._id}
                      value={`member-${m._id}`}
                      onSelect={() => { track(`member:${m._id}`); go(`/app/members`); }}
                      className="gap-2"
                    >
                      <Profile2User variant="Bulk" size={16} className="shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{m.name ?? m.email}</span>
                        {m.name && <Snippet text={snippet} />}
                      </span>
                      <span className="shrink-0 text-xs capitalize text-muted-foreground">{m.role}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {/* M2.4 (§5 #5) — `#` prefix: labels + tasks matching the tag */}
            {hasLabels && labelResults && (
              <>
                {labelResults.labels.length > 0 && (
                  <CommandGroup heading={<GroupHeading label={t("scopes.scopeLabels")} count={labelResults.labels.length} />}>
                    {labelResults.labels.map((l: any) => (
                      <CommandItem
                        key={`label-${l._id}`}
                        value={`label-${l._id}`}
                        onSelect={() => { track(`label:${l._id}`); go(`/app/tasks`); }}
                        className="gap-2"
                        data-testid="cmd-label-result"
                      >
                        <span
                          className="h-3 w-3 shrink-0 rounded-sm"
                          style={{ backgroundColor: l.color ?? "var(--muted-foreground)" }}
                        />
                        <span className="truncate flex-1">#{l.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {labelResults.tasks.length > 0 && (
                  <CommandGroup heading={<GroupHeading label={tn("tasks")} count={labelResults.tasks.length} />}>
                    {labelResults.tasks.map((t: any) => {
                      const matchedLabels = (t.labels ?? []).filter((l: string) =>
                        l.toLowerCase().includes(scopedQuery.toLowerCase()),
                      );
                      return (
                        <CommandItem
                          key={`labeltask-${t._id}`}
                          value={`labeltask-${t._id}`}
                          onSelect={() => { track(`task:${t._id}`); go(`/app/tasks`); }}
                          className="gap-2"
                          data-testid="cmd-label-task"
                        >
                          <TaskSquare variant="Bulk" size={16} className="shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{t.title}</span>
                            {matchedLabels.length > 0 && (
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                {matchedLabels.map((l: string) => `#${l}`).join("  ")}
                              </span>
                            )}
                          </span>
                          <StatusDot status={t.status} />
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
              </>
            )}

            {/* Core (suite-wide) search results — hidden when scoped */}
            {!isScoped && coreFlags.search && coreSearch.results.files.length > 0 && (
              <CommandGroup heading={<GroupHeading label={`${t("suite")} — ${tn("documents")}`} count={coreSearch.results.files.length} />}>
                {coreSearch.results.files.map((f) => (
                  <CommandItem
                    key={`core-file-${f.id}`}
                    value={`core-file-${f.id}`}
                    onSelect={() => f.href && go(f.href)}
                    className="gap-2"
                  >
                    <DocumentText variant="Bulk" size={16} className="shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1">{f.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">suite</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!isScoped && coreFlags.search && coreSearch.results.tasks.length > 0 && (
              <CommandGroup heading={<GroupHeading label={`${t("suite")} — ${tn("tasks")}`} count={coreSearch.results.tasks.length} />}>
                {coreSearch.results.tasks.map((tk) => (
                  <CommandItem
                    key={`core-task-${tk.id}`}
                    value={`core-task-${tk.id}`}
                    onSelect={() => tk.href && go(tk.href)}
                    className="gap-2"
                  >
                    <TaskSquare variant="Bulk" size={16} className="shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1">{tk.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">suite</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!isScoped && coreFlags.search && coreSearch.results.events.length > 0 && (
              <CommandGroup heading={<GroupHeading label={`${t("suite")} — ${tn("events")}`} count={coreSearch.results.events.length} />}>
                {coreSearch.results.events.map((e) => (
                  <CommandItem
                    key={`core-event-${e.id}`}
                    value={`core-event-${e.id}`}
                    onSelect={() => e.href && go(e.href)}
                    className="gap-2"
                  >
                    <Calendar variant="Bulk" size={16} className="shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1">{e.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">suite</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!isScoped && coreFlags.search && coreSearch.results.contacts.length > 0 && (
              <CommandGroup heading={<GroupHeading label={`${t("suite")} — ${t("people")}`} count={coreSearch.results.contacts.length} />}>
                {coreSearch.results.contacts.map((c) => (
                  <CommandItem
                    key={`core-contact-${c.id}`}
                    value={`core-contact-${c.id}`}
                    onSelect={() => c.href && go(c.href)}
                    className="gap-2"
                  >
                    <Profile2User variant="Bulk" size={16} className="shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1">{c.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">suite</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!isScoped && settingsPage && (
              <CommandGroup heading={<GroupHeading label={settingsPage.label} count={1} />}>
                <CommandItem
                  value={`page-${settingsPage.label}`}
                  onSelect={() => { track(settingsPage.frecencyKey); go(settingsPage.href); }}
                  className="gap-2"
                  data-testid="cmd-page-settings"
                >
                  <settingsPage.Icon variant="Bulk" size={18} className="text-muted-foreground" /> {settingsPage.label}
                </CommandItem>
              </CommandGroup>
            )}

            {!isScoped && (
              <CommandGroup heading={<GroupHeading label={t("goTo")} count={goToPages.length} />}>
                {goToPages.map(({ label, href, Icon, frecencyKey }) => (
                  <CommandItem key={href} value={`page-${label}`} onSelect={() => { track(frecencyKey); go(href); }} className="gap-2">
                    <Icon variant="Bulk" size={18} className="text-muted-foreground" /> {label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
