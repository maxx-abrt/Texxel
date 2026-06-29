"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
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
} from "iconsax-reactjs";

const PAGES = [
  { label: "Home", href: "/app", Icon: Element3 },
  { label: "Documents", href: "/app/documents", Icon: DocumentText },
  { label: "Tasks", href: "/app/tasks", Icon: TaskSquare },
  { label: "Projects", href: "/app/projects", Icon: Briefcase },
  { label: "Calendar", href: "/app/calendar", Icon: Calendar },
  { label: "Databases", href: "/app/databases", Icon: Data2 },
  { label: "Settings", href: "/app/settings", Icon: Setting2 },
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
  const { activeWorkspaceId } = useWorkspace();
  const [q, setQ] = useState("");

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

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const hasDocResults = docResults && docResults.length > 0;
  const hasTasks = other && other.tasks.length > 0;
  const hasProjects = other && other.projects.length > 0;
  const hasEvents = other && other.events.length > 0;
  const hasDatabases = other && other.databases.length > 0;
  const hasMembers = other && other.members.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl" data-testid="command-palette" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Search and navigate</DialogTitle>
        <Command shouldFilter={false} className="rounded-2xl">
          <CommandInput
            data-testid="global-search-input"
            placeholder="Search anything — documents, tasks, projects…"
            value={q}
            onValueChange={setQ}
          />
          <CommandList className="max-h-[420px]">
            <CommandEmpty>No results.</CommandEmpty>

            {hasDocResults && (
              <CommandGroup heading="Documents">
                {docResults.map((d: any) => (
                  <CommandItem
                    key={d._id}
                    value={`doc-${d._id}`}
                    data-testid="global-search-result-item"
                    onSelect={() => go(`/app/documents/${d._id}`)}
                    className="gap-2"
                  >
                    <span className="w-5 shrink-0 text-center">{d.icon ?? "📄"}</span>
                    <span className="truncate">{d.title || "Untitled"}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {hasTasks && (
              <CommandGroup heading="Tasks">
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
              <CommandGroup heading="Projects">
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
              <CommandGroup heading="Events">
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
                      {new Date(e.start).toLocaleDateString()}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {hasDatabases && (
              <CommandGroup heading="Databases">
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
              <CommandGroup heading="Members">
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

            <CommandGroup heading="Go to">
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
