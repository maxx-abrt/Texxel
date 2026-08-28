"use client";

/**
 * NotifyMarker source (§6 / M5.4).
 *
 * Resolves the set of entity references that have unread notification activity
 * for the current user, merging the local Convex `notifications` table and the
 * shared A2E Core notifications deployment (mirrors the inbox merge in
 * `app/app/inbox/page.tsx`). Links are parsed into `{ kind, id }` refs so the
 * sidebar tree and the workbench tab strip can render Huly-style coral
 * `NotifyMarker` dots without each re-fetching or re-parsing notifications.
 *
 * Convex dedupes identical `useQuery` subscriptions per client, so calling this
 * hook from both the sidebar and the tab strip still costs a single round-trip
 * per source.
 */
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNotifications } from "@a2e/core";
import { coreFlags } from "@/lib/core-flags";

export type UnreadKind = "doc" | "task" | "project";

export interface UnreadEntityRefs {
  /** Keys `"doc:<id>"` / `"task:<id>"` / `"project:<id>"` with unread activity. */
  keys: Set<string>;
  /** `flux_documents` ids with unread activity (for the sidebar tree). */
  docIds: Set<string>;
  /** True while the first fetch is still pending. */
  loading: boolean;
}

/** Parse a notification link into an entity ref, or null when not entity-bound. */
function parseLink(link: string | undefined): { kind: UnreadKind; id: string } | null {
  if (!link) return null;
  // Strip a leading "/app" so both "/app/documents/<id>" and "/documents/<id>"
  // resolve the same way (the inbox uses the same normalization).
  const path = link.startsWith("/app") ? link.slice(4) : link;
  const m = path.match(/^\/(documents|tasks|projects)\/([^/?#]+)/);
  if (!m) return null;
  const kindMap = { documents: "doc", tasks: "task", projects: "project" } as const;
  return { kind: kindMap[m[1] as keyof typeof kindMap], id: m[2] };
}

export function useUnreadEntityRefs(): UnreadEntityRefs {
  const useCore = coreFlags.notifications;

  const localUnread = useQuery(api.notifications.listMine, { unreadOnly: true, limit: 200 });
  const coreUnread = useNotifications({ unreadOnly: true, limit: 200 });

  const loading = localUnread === undefined || (useCore && coreUnread === undefined);

  return useMemo(() => {
    const keys = new Set<string>();
    const docIds = new Set<string>();
    const add = (link?: string) => {
      const ref = parseLink(link);
      if (!ref) return;
      keys.add(`${ref.kind}:${ref.id}`);
      if (ref.kind === "doc") docIds.add(ref.id);
    };
    if (localUnread) for (const n of localUnread as Array<{ link?: string }>) add(n.link);
    if (useCore && coreUnread) for (const n of coreUnread) add(n.link);
    return { keys, docIds, loading };
  }, [localUnread, coreUnread, useCore, loading]);
}
