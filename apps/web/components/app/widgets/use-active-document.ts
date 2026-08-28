"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { Id } from "@/convex/_generated/dataModel";

/**
 * Derives the currently-open document id from the route so entity-scoped
 * widgets (Comments, Activity, Presence) can react to what the user is
 * viewing without a dedicated current-entity context (which later milestones
 * wire up). Returns `null` when not on a document page.
 *
 * Matches `/app/documents/<documentId>` (the only document surface today).
 */
export function useActiveDocumentId(): Id<"flux_documents"> | null {
  const pathname = usePathname();
  return useMemo(() => {
    if (!pathname) return null;
    const m = pathname.match(/^\/app\/documents\/([^/]+)$/);
    if (!m) return null;
    const id = decodeURIComponent(m[1]);
    // Convex ids are 32-char base32-ish; loose guard against non-id segments.
    return /^[A-Za-z0-9_-]{10,}$/.test(id) ? (id as Id<"flux_documents">) : null;
  }, [pathname]);
}
