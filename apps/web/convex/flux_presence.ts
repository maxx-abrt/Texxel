import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId, assertWorkspaceMember } from "./lib/auth";

// A presence row is "active" while its lastSeen is within this window.
// The client heartbeats well inside this window (every ~8s).
export const PRESENCE_TTL_MS = 20_000;

/**
 * Heartbeat: upsert the current user's presence on a document.
 * Called on mount and on an interval by the client. `state` distinguishes
 * passive viewers from active editors.
 */
export const heartbeat = mutation({
  args: {
    documentId: v.id("flux_documents"),
    state: v.optional(v.string()), // "viewing" | "editing"
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return null;
    const { userId } = await assertWorkspaceMember(ctx, doc.workspaceId);
    const state = args.state === "editing" ? "editing" : "viewing";
    const now = Date.now();

    const existing = await ctx.db
      .query("flux_presence")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", userId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { state, lastSeen: now });
      return existing._id;
    }
    return ctx.db.insert("flux_presence", {
      workspaceId: doc.workspaceId,
      documentId: args.documentId,
      userId,
      state,
      lastSeen: now,
    });
  },
});

/** Remove the current user's presence from a document (on unmount/navigation). */
export const leave = mutation({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("flux_presence")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", userId),
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return true;
  },
});

/**
 * List active presences for a document (deduped per user, freshest state),
 * enriched with user name/image. Stale rows are filtered out by lastSeen.
 */
export const listForDocument = query({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return [];
    // Only workspace members can see who's present.
    try {
      await assertWorkspaceMember(ctx, doc.workspaceId);
    } catch {
      return [];
    }

    const cutoff = Date.now() - PRESENCE_TTL_MS;
    const rows = await ctx.db
      .query("flux_presence")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const active = rows
      .filter((r) => r.lastSeen >= cutoff)
      .sort((a, b) => b.lastSeen - a.lastSeen);

    const seen = new Set<string>();
    const out: Array<{
      userId: string;
      name: string | null;
      image: string | null;
      state: string;
      lastSeen: number;
    }> = [];
    for (const r of active) {
      if (seen.has(r.userId)) continue;
      seen.add(r.userId);
      const user = await ctx.db.get(r.userId);
      out.push({
        userId: r.userId,
        name: (user as any)?.name ?? (user as any)?.email ?? "Member",
        image: (user as any)?.image ?? null,
        state: r.state,
        lastSeen: r.lastSeen,
      });
    }

    // Merge anonymous guests editing via the public share page.
    const guests = await ctx.db
      .query("flux_guestPresence")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
    for (const g of guests) {
      if (g.lastSeen < cutoff) continue;
      out.push({
        userId: `guest:${g.guestId}` as any,
        name: g.guestName,
        image: null,
        state: g.state,
        lastSeen: g.lastSeen,
      });
    }
    return out;
  },
});

/**
 * List active presences across a whole workspace (who's online anywhere in
 * the workspace right now), deduped per user with the freshest state. Used by
 * the Presence widget (§3). No `by_workspace` index exists yet, so this scans
 * the table and filters by `workspaceId` + the active cutoff — presence rows
 * are short-lived and few, so this is cheap. Additive only (no schema change).
 */
export const listForWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    try {
      await assertWorkspaceMember(ctx, args.workspaceId);
    } catch {
      return [];
    }

    const cutoff = Date.now() - PRESENCE_TTL_MS;
    const rows = await ctx.db.query("flux_presence").collect();
    const active = rows
      .filter((r) => r.workspaceId === args.workspaceId && r.lastSeen >= cutoff)
      .sort((a, b) => b.lastSeen - a.lastSeen);

    const seen = new Set<string>();
    const out: Array<{
      userId: string;
      name: string | null;
      image: string | null;
      state: string;
      lastSeen: number;
    }> = [];
    for (const r of active) {
      if (seen.has(r.userId)) continue;
      seen.add(r.userId);
      const user = await ctx.db.get(r.userId);
      out.push({
        userId: r.userId,
        name: (user as any)?.name ?? (user as any)?.email ?? "Member",
        image: (user as any)?.image ?? null,
        state: r.state,
        lastSeen: r.lastSeen,
      });
    }
    return out;
  },
});
