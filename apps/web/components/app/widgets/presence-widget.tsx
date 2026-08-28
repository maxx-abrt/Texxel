"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { timeAgo } from "@/components/app/common";
import { Profile2User } from "iconsax-reactjs";

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
 * Presence widget (§3): who's online anywhere in the workspace right now.
 * Reuses the avatar/color rendering pattern from `PresenceAvatars` and the
 * new additive `flux_presence.listForWorkspace` query (full-table scan
 * filtered by workspaceId + active cutoff — no schema change). Editors get a
 * coral ring + pulsing dot, mirroring the document presence component.
 */
export function PresenceWidget() {
  const t = useTranslations("widgets");
  const { activeWorkspaceId, me } = useWorkspace();
  const presence = useQuery(
    api.flux_presence.listForWorkspace,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );

  if (presence === undefined) {
    return (
      <div data-testid="widget-presence" className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (presence.length === 0) {
    return (
      <div
        data-testid="widget-presence-empty"
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center"
      >
        <Profile2User variant="Bulk" size={32} className="opacity-40 text-muted-foreground" />
        <p className="text-sm font-medium">{t("presenceEmpty")}</p>
        <p className="text-xs text-muted-foreground">{t("presenceEmptyHint")}</p>
      </div>
    );
  }

  const meId = me?._id ?? null;

  return (
    <div data-testid="widget-presence" className="min-h-0 flex-1 overflow-y-auto p-2">
      {presence.map((p) => {
        const isEditing = p.state === "editing";
        const isMe = p.userId === meId;
        const color = colorFor(p.userId);
        return (
          <div
            key={p.userId}
            data-testid="widget-presence-item"
            className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-sidebar-accent"
          >
            <span className="relative inline-block">
              <Avatar
                size="sm"
                className={cn(
                  "ring-2 ring-background",
                  isEditing && "ring-[var(--flux-coral)]",
                )}
              >
                {p.image ? <AvatarImage src={p.image} alt={p.name ?? ""} /> : null}
                <AvatarFallback
                  className="text-[10px] font-semibold"
                  style={{ backgroundColor: `${color}22`, color }}
                >
                  {initials(p.name)}
                </AvatarFallback>
              </Avatar>
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background",
                  isEditing ? "bg-[var(--flux-coral)]" : "bg-emerald-500",
                )}
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {p.name ?? "Member"}
                {isMe && <span className="ml-1 text-xs text-muted-foreground">({t("presenceYou")})</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {isEditing ? t("presenceEditing") : t("presenceViewing")} · {timeAgo(p.lastSeen)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
