import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ─── Public (anonymous) access to published documents ───────────────────────
// These functions power the /share/[shareToken] page: guests without accounts
// can read a published doc and — when the owner enabled `allowGuestEdit` —
// edit it live (Convex reactivity gives Google-Docs-style propagation).

const GUEST_TTL_MS = 20_000;
const MAX_CONTENT_BYTES = 900_000; // stay well under Convex 1MB doc limit
const MAX_NAME_LEN = 40;

/** Resolve a published, non-archived document by its share token. */
async function docByToken(ctx: any, shareToken: string) {
  const doc = await ctx.db
    .query("flux_documents")
    .withIndex("by_share_token", (q: any) => q.eq("shareToken", shareToken))
    .unique();
  if (!doc || !doc.isPublished || doc.isArchived) return null;
  return doc;
}

/** Public read: doc content + whether guests may edit. */
export const getByToken = query({
  args: { shareToken: v.string() },
  handler: async (ctx, args) => {
    const doc = await docByToken(ctx, args.shareToken);
    if (!doc) return null;
    return {
      _id: doc._id,
      title: doc.title,
      icon: doc.icon,
      coverImage: doc.coverImage,
      content: doc.content,
      updatedAt: doc.updatedAt,
      isLocked: doc.isLocked ?? false,
      allowGuestEdit: (doc.allowGuestEdit ?? false) && !(doc.isLocked ?? false),
    };
  },
});

/** Guest edit: patch content (and optionally title) of a guest-editable doc. */
export const updatePublic = mutation({
  args: {
    shareToken: v.string(),
    content: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const doc = await docByToken(ctx, args.shareToken);
    if (!doc) throw new Error("Document not available");
    if (!doc.allowGuestEdit) throw new Error("Guest editing is disabled");
    if (doc.isLocked) throw new Error("Document is locked");
    const patch: any = { updatedAt: Date.now() };
    if (args.content !== undefined) {
      if (args.content.length > MAX_CONTENT_BYTES) throw new Error("Content too large");
      patch.content = args.content;
    }
    if (args.title !== undefined) patch.title = args.title.slice(0, 200);
    await ctx.db.patch(doc._id, patch);
    return { updatedAt: patch.updatedAt };
  },
});

/** Guest presence heartbeat (upsert by documentId+guestId). */
export const heartbeat = mutation({
  args: {
    shareToken: v.string(),
    guestId: v.string(),
    guestName: v.string(),
    state: v.optional(v.string()), // "viewing" | "editing"
  },
  handler: async (ctx, args) => {
    const doc = await docByToken(ctx, args.shareToken);
    if (!doc) return null;
    const state = args.state === "editing" ? "editing" : "viewing";
    const guestName = args.guestName.slice(0, MAX_NAME_LEN) || "Guest";
    const now = Date.now();
    const existing = await ctx.db
      .query("flux_guestPresence")
      .withIndex("by_document_guest", (q) =>
        q.eq("documentId", doc._id).eq("guestId", args.guestId.slice(0, 64)),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { state, guestName, lastSeen: now });
      return existing._id;
    }
    return ctx.db.insert("flux_guestPresence", {
      documentId: doc._id,
      guestId: args.guestId.slice(0, 64),
      guestName,
      state,
      lastSeen: now,
    });
  },
});

/** Remove a guest's presence row (tab closed / navigated away). */
export const leave = mutation({
  args: { shareToken: v.string(), guestId: v.string() },
  handler: async (ctx, args) => {
    const doc = await docByToken(ctx, args.shareToken);
    if (!doc) return null;
    const existing = await ctx.db
      .query("flux_guestPresence")
      .withIndex("by_document_guest", (q) =>
        q.eq("documentId", doc._id).eq("guestId", args.guestId.slice(0, 64)),
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return true;
  },
});

/** Everyone currently on the shared page: guests + workspace members. */
export const listPresence = query({
  args: { shareToken: v.string() },
  handler: async (ctx, args) => {
    const doc = await docByToken(ctx, args.shareToken);
    if (!doc) return [];
    const cutoff = Date.now() - GUEST_TTL_MS;
    const out: Array<{
      id: string;
      name: string;
      image: string | null;
      state: string;
      isGuest: boolean;
      lastSeen: number;
    }> = [];

    const guests = await ctx.db
      .query("flux_guestPresence")
      .withIndex("by_document", (q) => q.eq("documentId", doc._id))
      .collect();
    for (const g of guests) {
      if (g.lastSeen < cutoff) continue;
      out.push({ id: `guest:${g.guestId}`, name: g.guestName, image: null, state: g.state, isGuest: true, lastSeen: g.lastSeen });
    }

    const members = await ctx.db
      .query("flux_presence")
      .withIndex("by_document", (q) => q.eq("documentId", doc._id))
      .collect();
    for (const m of members) {
      if (m.lastSeen < cutoff) continue;
      const user = await ctx.db.get(m.userId);
      out.push({
        id: `user:${m.userId}`,
        name: (user as any)?.name ?? "Member",
        image: (user as any)?.image ?? null,
        state: m.state,
        isGuest: false,
        lastSeen: m.lastSeen,
      });
    }
    return out.sort((a, b) => b.lastSeen - a.lastSeen);
  },
});
