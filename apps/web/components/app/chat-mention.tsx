"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Folder, ListTodo, FileText, Hash } from "lucide-react";

export type Mentionable = {
  type: "user" | "project" | "task" | "document";
  id: string;
  name: string;
  subtitle?: string;
  image?: string;
};

const ICONS: Record<string, any> = {
  user: User,
  project: Folder,
  task: ListTodo,
  document: FileText,
};

interface ChatMentionPickerProps {
  query: string;
  onSelect: (item: Mentionable) => void;
  className?: string;
}

export function ChatMentionPicker({ query, onSelect, className }: ChatMentionPickerProps) {
  const { activeWorkspaceId } = useWorkspace();
  const mentionables = useQuery(
    api.flux_chat.mentionables,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );

  const q = query.toLowerCase().trim();
  const items = (mentionables ?? [])
    .filter((m: any) => {
      const text = `${m.name ?? ""} ${m.subtitle ?? ""}`.toLowerCase();
      return q === "" || text.includes(q);
    })
    .slice(0, 8)
    .map((m: any) => ({ ...m, id: m.id }));

  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "z-50 w-64 overflow-hidden rounded-xl border border-border bg-popover shadow-xl",
        className,
      )}
    >
      <div className="max-h-60 overflow-y-auto p-1">
        {items.map((item: Mentionable, idx: number) => {
          const Icon = ICONS[item.type] ?? Hash;
          return (
            <button
              key={`${item.type}-${item.id}-${idx}`}
              onClick={() => onSelect(item)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              {item.type === "user" ? (
                <Avatar className="h-6 w-6">
                  <AvatarImage src={item.image} />
                  <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
                    {(item.name ?? "U").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon size={14} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="truncate text-[10px] text-muted-foreground capitalize">{item.subtitle ?? item.type}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MentionChip({
  item,
  onRemove,
}: {
  item: Mentionable;
  onRemove?: (item: Mentionable) => void;
}) {
  const t = useTranslations("chat");
  const Icon = ICONS[item.type] ?? Hash;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        item.type === "user" && "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
        item.type === "project" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        item.type === "task" && "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        item.type === "document" && "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
      )}
    >
      <Icon size={10} /> {item.name}
      {onRemove && (
        <button
          onClick={() => onRemove(item)}
          className="ml-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
          aria-label={t("removeMention")}
        >
          ×
        </button>
      )}
    </span>
  );
}
