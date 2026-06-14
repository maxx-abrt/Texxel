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

export function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace();
  const [q, setQ] = useState("");
  const results = useQuery(
    api.flux_documents.search,
    open && activeWorkspaceId ? { workspaceId: activeWorkspaceId, query: q } : "skip",
  );

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl" data-testid="command-palette" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Search and navigate</DialogTitle>
        <Command shouldFilter={false} className="rounded-2xl">
          <CommandInput data-testid="global-search-input" placeholder="Search documents and jump to…" value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            {results && results.length > 0 && (
              <CommandGroup heading="Documents">
                {results.map((d: any) => (
                  <CommandItem key={d._id} value={`doc-${d._id}`} data-testid="global-search-result-item" onSelect={() => go(`/app/documents/${d._id}`)} className="gap-2">
                    <span className="w-5 text-center">{d.icon ?? "\ud83d\udcc4"}</span>
                    <span className="truncate">{d.title || "Untitled"}</span>
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
