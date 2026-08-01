"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Magicpen,
  CalendarAdd,
  Moon,
  SidebarLeft,
  Clock,
} from "iconsax-reactjs";

const PAGES_KEYS = [
  { key: "home", href: "/app", Icon: Element3 },
  { key: "documents", href: "/app/documents", Icon: DocumentText },
  { key: "tasks", href: "/app/tasks", Icon: TaskSquare },
  { key: "projects", href: "/app/projects", Icon: Briefcase },
  { key: "calendar", href: "/app/calendar", Icon: Calendar },
  { key: "databases", href: "/app/databases", Icon: Data2 },
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

function StatusDot({ status }: { status?: string }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: STATUS_COLOR[status ?? ""] ?? "var(--muted-foreground)" }}
    />
  );
}

export function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const router = useRouter();
  const locale = useLocale();
  const { activeWorkspaceId } = useWorkspace();
  const coreWsId = useCoreWorkspaceId();
  const [q, setQ] = useState("");
  const coreSearch = useCoreSearch(coreFlags.search && open ? (coreWsId as never) : null, q);
  const t = useTranslations("commandPalette");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const ttm = useTranslations("teams");

  const PAGES = PAGES_KEYS.map((p) => ({ ...p, label: tn(p.key as any) }));

  const docResults = useQuery(
    api.flux_documents.search,
    open && activeWorkspaceId ? { workspaceId: activeWorkspaceId, query: q } : "skip",
  );
  const other = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).global_search.search,
    open && activeWorkspaceId && q.trim().length >= 2
      ? { workspaceId: activeWorkspaceId, query: q }
      : "skip",
  );

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  // Recently opened documents (tracked by the document view).
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => {
    if (!open) return;
    try {
      setRecentIds(JSON.parse(localStorage.getItem("texxel-recent-docs") ?? "[]"));
    } catch {
      setRecentIds([]);
    }
  }, [open]);
  const allDocs = useQuery(
    api.flux_documents.list,
    open && activeWorkspaceId && recentIds.length ? { workspaceId: activeWorkspaceId } : "skip",
  );
  const recentDocs = (recentIds
    .map((id) => (allDocs ?? []).find((d: any) => String(d._id) === id))
    .filter(Boolean) as any[]).slice(0, 5);

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
  const ACTIONS = [
    { key: "newDoc", Icon: AddSquare, run: newDoc, testId: "cmd-new-doc" },
    { key: "newTask", Icon: TaskSquare, run: () => go("/app/tasks"), testId: "cmd-new-task" },
    { key: "newEvent", Icon: CalendarAdd, run: () => go("/app/calendar"), testId: "cmd-new-event" },
    { key: "openChat", Icon: Message, run: () => fire("flux:open-chat"), testId: "cmd-open-chat" },
    { key: "askAi", Icon: Magicpen, run: () => fire("flux:open-ai"), testId: "cmd-ask-ai" },
    { key: "toggleTheme", Icon: Moon, run: () => { setTheme(resolvedTheme === "dark" ? "light" : "dark"); setOpen(false); }, testId: "cmd-toggle-theme" },
    { key: "toggleSidebar", Icon: SidebarLeft, run: () => fire("texxel:toggle-sidebar"), testId: "cmd-toggle-sidebar" },
  ];
  const showActions = q.trim().length < 2;

  const hasDocResults = docResults && docResults.length > 0;
  const hasTasks = other && other.tasks.length > 0;
  const hasProjects = other && other.projects.length > 0;
  const hasEvents = other && other.events.length > 0;
  const hasDatabases = other && other.databases.length > 0;
  const hasMembers = other && other.members.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl" data-testid="command-palette" aria-describedby={undefined}>
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>
        <Command shouldFilter={false} className="rounded-2xl">
          <CommandInput
            data-testid="global-search-input"
            placeholder={t("searchPlaceholder")}
            value={q}
            onValueChange={setQ}
          />
          <CommandList className="max-h-[420px]">
            <CommandEmpty>{tc("noResults")}</CommandEmpty>

            {showActions && recentDocs.length > 0 && (
              <CommandGroup heading={t("recent")}>
                {recentDocs.map((d: any) => (
                  <CommandItem
                    key={`recent-${d._id}`}
                    value={`recent-${d._id}`}
                    onSelect={() => go(`/app/documents/${d._id}`)}
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
              <CommandGroup heading={t("quickActions")}>
                {ACTIONS.map(({ key, Icon, run, testId }) => (
                  <CommandItem key={key} value={`action-${key}`} onSelect={run} className="gap-2" data-testid={testId}>
                    <Icon variant="Bulk" size={18} className="text-primary" /> {t(`actions.${key}`)}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {hasDocResults && (
              <CommandGroup heading={tn("documents")}>
                {docResults.map((d: any) => (
                  <CommandItem
                    key={d._id}
                    value={`doc-${d._id}`}
                    data-testid="global-search-result-item"
                    onSelect={() => go(`/app/documents/${d._id}`)}
                    className="gap-2"
                  >
                    <span className="w-5 shrink-0 text-center">{d.icon ?? "📄"}</span>
                    <span className="truncate">{d.title || tc("untitled")}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {hasTasks && (
              <CommandGroup heading={tn("tasks")}>
                {other.tasks.map((t: any) => (
                  <CommandItem
                    key={t._id}
                    value={`task-${t._id}`}
                    onSelect={() => go(`/app/tasks`)}
                    className="gap-2"
                  >
                    <TaskSquare variant="Bulk" size={16} className="shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1">{t.title}</span>
                    <StatusDot status={t.status} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {hasProjects && (
              <CommandGroup heading={tn("projects")}>
                {other.projects.map((p: any) => (
                  <CommandItem
                    key={p._id}
                    value={`project-${p._id}`}
                    onSelect={() => go(`/app/projects/${p._id}`)}
                    className="gap-2"
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-md"
                      style={{ backgroundColor: p.color ?? "var(--flux-coral)" }}
                    />
                    <span className="truncate flex-1">{p.name}</span>
                    <StatusDot status={p.status} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {hasEvents && (
              <CommandGroup heading={tn("events")}>
                {other.events.map((e: any) => (
                  <CommandItem
                    key={e._id}
                    value={`event-${e._id}`}
                    onSelect={() => go(`/app/calendar`)}
                    className="gap-2"
                  >
                    <Calendar variant="Bulk" size={16} className="shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1">{e.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(e.start).toLocaleDateString(locale)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {hasDatabases && (
              <CommandGroup heading={tn("databases")}>
                {other.databases.map((d: any) => (
                  <CommandItem
                    key={d._id}
                    value={`db-${d._id}`}
                    onSelect={() => go(`/app/databases/${d._id}`)}
                    className="gap-2"
                  >
                    <span className="w-5 shrink-0 text-center">{d.icon ?? "🗄️"}</span>
                    <span className="truncate">{d.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {hasMembers && (
              <CommandGroup heading={ttm("membersTitle")}>
                {other.members.map((m: any) => (
                  <CommandItem
                    key={m._id}
                    value={`member-${m._id}`}
                    onSelect={() => go(`/app/members`)}
                    className="gap-2"
                  >
                    <Profile2User variant="Bulk" size={16} className="shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1">{m.name ?? m.email}</span>
                    <span className="shrink-0 text-xs capitalize text-muted-foreground">{m.role}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Core (suite-wide) search results */}
            {coreFlags.search && coreSearch.results.files.length > 0 && (
              <CommandGroup heading={`${t("suite")} — ${tn("documents")}`}>
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
            {coreFlags.search && coreSearch.results.tasks.length > 0 && (
              <CommandGroup heading={`${t("suite")} — ${tn("tasks")}`}>
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
            {coreFlags.search && coreSearch.results.events.length > 0 && (
              <CommandGroup heading={`${t("suite")} — ${tn("events")}`}>
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
            {coreFlags.search && coreSearch.results.contacts.length > 0 && (
              <CommandGroup heading={`${t("suite")} — ${ttm("membersTitle")}`}>
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

            <CommandGroup heading={t("goTo")}>
              {PAGES.map(({ label, href, Icon }) => (
                <CommandItem key={href} value={`page-${label}`} onSelect={() => go(href)} className="gap-2">
                  <Icon variant="Bulk" size={18} className="text-muted-foreground" /> {label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
