"use client";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { usePresence } from "@/hooks/use-presence";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

const COLORS = ["#E14B3D", "#2f7ea6", "#2fbf9b", "#d98324", "#7c5cff", "#1f9d76"];

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

/**
 * Stacked avatars of everyone currently on a document, with viewing/editing
 * state. Editors get a coral ring + a pulsing dot. Hover shows name + state.
 */
export function PresenceAvatars({
  documentId,
  meId,
  editing,
  max = 4,
}: {
  documentId: Id<"flux_documents">;
  meId?: string | null;
  editing: boolean;
  max?: number;
}) {
  const presence = usePresence(documentId, editing);
  if (!presence.length) return null;

  // Show self first, then most-recent others.
  const ordered = [...presence].sort((a, b) => {
    if (a.userId === meId) return -1;
    if (b.userId === meId) return 1;
    return b.lastSeen - a.lastSeen;
  });
  const shown = ordered.slice(0, max);
  const extra = ordered.length - shown.length;

  return (
    <TooltipProvider delayDuration={120}>
      <div
        className="flex items-center -space-x-2 pr-1"
        data-testid="presence-avatars"
        aria-label={`${ordered.length} collaborator(s) present`}
      >
        {shown.map((p) => {
          const isEditing = p.state === "editing";
          const isMe = p.userId === meId;
          const color = colorFor(p.userId);
          return (
            <Tooltip key={p.userId}>
              <TooltipTrigger asChild>
                <span
                  className="relative inline-block"
                  data-testid="presence-avatar"
                  data-state={p.state}
                >
                  <Avatar
                    size="sm"
                    className={cn(
                      "ring-2 ring-background transition-transform duration-150 hover:-translate-y-0.5",
                      isEditing && "ring-[var(--flux-coral)]",
                    )}
                  >
                    {p.image ? (
                      <AvatarImage src={p.image} alt={p.name ?? ""} />
                    ) : null}
                    <AvatarFallback
                      className="text-[10px] font-semibold"
                      style={{ backgroundColor: `${color}22`, color }}
                    >
                      {initials(p.name)}
                    </AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--flux-coral)] opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--flux-coral)] ring-2 ring-background" />
                    </span>
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span className="font-medium">
                  {p.name ?? "Member"}
                  {isMe ? " (you)" : ""}
                </span>
                <span className="opacity-70"> · {isEditing ? "Editing" : "Viewing"}</span>
              </TooltipContent>
            </Tooltip>
          );
        })}
        {extra > 0 && (
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background"
            data-testid="presence-overflow"
          >
            +{extra}
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}

export default PresenceAvatars;
