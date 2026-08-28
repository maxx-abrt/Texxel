import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { assertWorkspaceMember, logActivity, requireUserId, getOptionalUserId } from "./lib/auth";

/**
 * M0.1 (§14.2) — fractional-index sort keys, LexoRank-style.
 * Keys are lowercased base36 (`0-9a-z`) strings that sort lexicographically.
 */

/** Encode a non-negative integer as a base36 sort key (used for backfill). */
export function base36Key(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "a0";
  if (n === 0) return "a0";
  // Bucket by magnitude so keys remain lexicographically comparable across
  // different lengths: <base36len(magnitude)><base36(n)>.
  const b36 = Math.floor(n).toString(36);
  return b36.length.toString(36) + b36;
}

/** Key that sorts after `after` (or a default first key when `after` is null). */
export function sortKeyAfter(after: string | null | undefined): string {
  if (!after) return "a0";
  const head = after.charCodeAt(0);
  if (head < 122 /* 'z' */) return String.fromCharCode(head + 1) + "0";
  return after + "8";
}

/** Backfill `sortKey` for docs that only have numeric `order` (batched; pass cursor to continue). */
export const backfillSortKeys = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 256;
    const page = await ctx.db
      .query("flux_documents")
      .order("asc")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });
    let patched = 0;
    for (const doc of page.page) {
      if (doc.sortKey === undefined) {
        // Per §14.2: sortKey = base36(order), fall back to createdAt.
        await ctx.db.patch(doc._id, {
          sortKey: base36Key(doc.order ?? doc.createdAt),
        });
        patched++;
      }
    }
    return { patched, continueCursor: page.continueCursor, isDone: page.isDone };
  },
});

// ----- M3.3.1: Periodic sortKey rebalance (LexoRank maintenance) -----

const REBALANCE_DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";
/**
 * Evenly-spaced key gap. `base36Key(i * GAP)` produces lexicographically
 * sortable keys with ample room for future `midKey` inserts between any
 * two adjacent siblings.
 */
const REBALANCE_GAP = 1_000_000;
/**
 * SortKey length threshold for triggering a rebalance from the `move`
 * mutation. Normal `midKey` results are 2–4 chars; degenerate adjacency
 * from repeated 'i'-append fallbacks grows keys beyond this.
 */
const DEGENERATE_LENGTH_THRESHOLD = 8;

/**
 * Detect degenerate adjacency in a sorted sibling list: when adjacent
 * sortKeys are so close that `midKey` would fall back to the 'i'-append
 * path (no room for a midpoint at the current digit level). This arises
 * from repeated inserts at the same boundary.
 */
function hasDegenerateAdjacency(docs: Doc<"flux_documents">[]): boolean {
  const keys = docs.map((d) => d.sortKey ?? base36Key(d.order ?? d.createdAt));
  for (let i = 0; i < keys.length - 1; i++) {
    const prev = keys[i];
    const next = keys[i + 1];
    if (prev >= next) return true; // out of order or equal
    let j = 0;
    while (j < prev.length && j < next.length && prev[j] === next[j]) j++;
    // One is a prefix of the other (from repeated 'i'-append fallback).
    if (j === prev.length || j === next.length) return true;
    // First differing digits are adjacent (no room for a midpoint).
    const aIdx = REBALANCE_DIGITS.indexOf(prev[j]);
    const bIdx = REBALANCE_DIGITS.indexOf(next[j]);
    if (bIdx - aIdx <= 1) return true;
  }
  return false;
}

/**
 * M3.3.1 — Periodic sortKey rebalance. Renumbers a sibling list with fresh
 * evenly-spaced keys (`base36Key(i * GAP)`) when degenerate adjacency is
 * detected. Batched via `offset`/`batchSize` for large sibling lists.
 *
 * No-op (returns `needed: false`) when the sibling list is healthy, so it
 * is safe to schedule speculatively from `move` and the daily cron.
 */
export const rebalanceSortKeys = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    parentId: v.optional(v.id("flux_documents")),
    batchSize: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 256;
    const offset = args.offset ?? 0;

    const children = await ctx.db
      .query("flux_documents")
      .withIndex("by_workspace_parent", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("parentId", args.parentId ?? undefined),
      )
      .collect();
    const sorted = children
      .filter((d) => !d.isArchived)
      .sort(compareDocs);

    if (offset === 0) {
      if (!hasDegenerateAdjacency(sorted)) {
        return { needed: false, rebalanced: 0, total: sorted.length, isDone: true };
      }
    }

    let patched = 0;
    const end = Math.min(offset + batchSize, sorted.length);
    for (let i = offset; i < end; i++) {
      const newKey = base36Key(i * REBALANCE_GAP);
      const doc = sorted[i];
      if (doc.sortKey !== newKey) {
        await ctx.db.patch(doc._id, { sortKey: newKey, updatedAt: Date.now() });
        patched++;
      }
    }
    const isDone = end >= sorted.length;
    return {
      needed: true,
      rebalanced: patched,
      total: sorted.length,
      isDone,
      nextOffset: isDone ? undefined : end,
    };
  },
});

/**
 * M3.3.1 — Workspace-wide rebalance scan. Scans all `flux_documents` in
 * batches, collects unique `(workspaceId, parentId)` groups, and schedules
 * `rebalanceSortKeys` for each. Self-chains via `ctx.scheduler` until all
 * docs have been scanned. Called by the daily cron.
 */
export const rebalanceAllSortKeys = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 512;
    const page = await ctx.db
      .query("flux_documents")
      .order("asc")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    const seen = new Set<string>();
    let scheduled = 0;
    for (const doc of page.page) {
      if (doc.isArchived) continue;
      const key = `${doc.workspaceId}|${doc.parentId ?? "root"}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await ctx.scheduler.runAfter(0, internal.flux_documents.rebalanceSortKeys, {
        workspaceId: doc.workspaceId,
        parentId: doc.parentId,
      });
      scheduled++;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.flux_documents.rebalanceAllSortKeys, {
        cursor: page.continueCursor,
        batchSize: args.batchSize,
      });
    }

    return {
      scanned: page.page.length,
      scheduled,
      isDone: page.isDone,
    };
  },
});

function makeToken() {
  return (
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  ).replace(/[^a-z0-9]/gi, "");
}

/** Whether a user can access a document given its visibility settings. */
function canAccessDoc(doc: any, userId: any): boolean {
  const vis = doc.visibility ?? "workspace";
  if (vis === "workspace") return true;
  if (String(doc.createdBy) === String(userId)) return true;
  if (vis === "custom") return (doc.accessUserIds ?? []).some((u: any) => String(u) === String(userId));
  return false; // private + not owner
}

/**
 * Position comparator. M3.3 read-path flip: `sortKey` is now the authoritative
 * position — reorders (§14.2) write a `midKey`-computed sortKey via `move`.
 * Numeric `order` is kept only as a legacy fallback for docs that still lack
 * a `sortKey` (e.g. un-backfilled deployments) and as a final tiebreak.
 */
function compareDocs(a: Doc<"flux_documents">, b: Doc<"flux_documents">): number {
  const ka = a.sortKey ?? null;
  const kb = b.sortKey ?? null;
  if (ka !== null && kb !== null) {
    if (ka !== kb) return ka < kb ? -1 : 1;
  } else if (ka !== null) {
    // Backfill-encoded legacy position for comparison during rollout.
    const legacy = base36Key(b.order ?? b.createdAt);
    if (ka !== legacy) return ka < legacy ? -1 : 1;
  } else if (kb !== null) {
    const legacy = base36Key(a.order ?? a.createdAt);
    if (legacy !== kb) return legacy < kb ? -1 : 1;
  }
  return (a.order ?? a.createdAt) - (b.order ?? b.createdAt);
}

/** All non-archived docs in a workspace the current user may see. */
export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId);
    const docs = await ctx.db
      .query("flux_documents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return docs
      .filter((d) => !d.isArchived && canAccessDoc(d, userId))
      .sort(compareDocs);
  },
});

export const listChildren = query({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return [];
    const { userId } = await assertWorkspaceMember(ctx, doc.workspaceId);
    const children = await ctx.db
      .query("flux_documents")
      .withIndex("by_workspace_parent", (q) =>
        q.eq("workspaceId", doc.workspaceId).eq("parentId", args.documentId),
      )
      .collect();
    return children
      .filter((d) => !d.isArchived && canAccessDoc(d, userId))
      .sort(compareDocs);
  },
});

export const get = query({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return null;
    const { userId } = await assertWorkspaceMember(ctx, doc.workspaceId);
    if (!canAccessDoc(doc, userId)) return null;
    return doc;
  },
});

/** Public read of a published doc by share token (no auth required). */
export const getPublic = query({
  args: { shareToken: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("flux_documents")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.shareToken))
      .unique();
    if (!doc || !doc.isPublished || doc.isArchived) return null;
    return doc;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.optional(v.string()),
    parentId: v.optional(v.id("flux_documents")),
    icon: v.optional(v.string()),
    content: v.optional(v.string()),
    visibility: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId, "member");
    const now = Date.now();
    const id = await ctx.db.insert("flux_documents", {
      workspaceId: args.workspaceId,
      title: args.title ?? "Untitled",
      parentId: args.parentId,
      icon: args.icon,
      content: args.content,
      visibility: args.visibility ?? "workspace",
      isArchived: false,
      isPublished: false,
      order: now,
      sortKey: base36Key(now),
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      actorId: userId,
      action: "document.created",
      targetType: "flux_document",
      targetId: id,
      metadata: { title: args.title ?? "Untitled" },
    });
    return id;
  },
});

/** Duplicate a document (content, icon, cover). Never copies publish/lock state. */
export const duplicate = mutation({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    const { userId } = await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    const now = Date.now();
    const id = await ctx.db.insert("flux_documents", {
      workspaceId: doc.workspaceId,
      title: `${doc.title ?? "Untitled"} (copy)`,
      parentId: doc.parentId,
      icon: doc.icon,
      coverImage: doc.coverImage,
      content: doc.content,
      visibility: doc.visibility ?? "workspace",
      accessUserIds: doc.accessUserIds,
      isArchived: false,
      isPublished: false,
      order: now,
      sortKey: base36Key(now),
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, {
      workspaceId: doc.workspaceId,
      actorId: userId,
      action: "document.duplicated",
      targetType: "flux_document",
      targetId: id,
      metadata: { title: doc.title },
    });
    return id;
  },
});

export const createFolder = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.optional(v.string()),
    parentId: v.optional(v.id("flux_documents")),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId, "member");
    const now = Date.now();
    const id = await ctx.db.insert("flux_documents", {
      workspaceId: args.workspaceId,
      title: args.title ?? "New folder",
      parentId: args.parentId,
      isFolder: true,
      icon: "📁",
      visibility: "workspace",
      isArchived: false,
      isPublished: false,
      order: now,
      sortKey: base36Key(now),
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      actorId: userId,
      action: "document.created",
      targetType: "flux_document",
      targetId: id,
      metadata: { title: args.title ?? "New folder", isFolder: true },
    });
    return id;
  },
});

export const move = mutation({
  args: {
    documentId: v.id("flux_documents"),
    parentId: v.optional(v.id("flux_documents")),
    // §14.2 / M3.3: fractional-index sort key computed client-side from the
    // sibling neighbors (midKey). Server only persists it; the cycle guard
    // below still runs on `parentId`.
    sortKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    const { userId } = await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    if (!canAccessDoc(doc, userId)) throw new Error("No access to this document");
    if (args.parentId !== undefined) {
      if (args.parentId === args.documentId) throw new Error("Cannot move a document into itself");
      let cursor: Id<"flux_documents"> | null = args.parentId;
      while (cursor) {
        const parent: Doc<"flux_documents"> | null = await ctx.db.get(cursor);
        if (!parent) break;
        if (parent.workspaceId !== doc.workspaceId) throw new Error("Parent must be in the same workspace");
        if (String(parent._id) === String(args.documentId)) throw new Error("Cannot move a document into its own descendants");
        cursor = parent.parentId ?? null;
      }
    }
    const patch: any = { parentId: args.parentId, updatedAt: Date.now() };
    if (args.sortKey !== undefined) patch.sortKey = args.sortKey;
    await ctx.db.patch(args.documentId, patch);
    // M3.3.1: if the computed sortKey is unusually long (degenerate adjacency
    // from repeated 'i'-append fallbacks), schedule a rebalance for this
    // sibling list. The rebalance mutation no-ops when the list is healthy.
    if (args.sortKey !== undefined && args.sortKey.length > DEGENERATE_LENGTH_THRESHOLD) {
      await ctx.scheduler.runAfter(0, internal.flux_documents.rebalanceSortKeys, {
        workspaceId: doc.workspaceId,
        parentId: args.parentId ?? undefined,
      });
    }
    return args.documentId;
  },
});

export const update = mutation({
  args: {
    documentId: v.id("flux_documents"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    icon: v.optional(v.string()),
    coverImage: v.optional(v.string()),
    coverY: v.optional(v.number()),
    parentId: v.optional(v.id("flux_documents")),
    order: v.optional(v.number()),
    sortKey: v.optional(v.string()),
    visibility: v.optional(v.string()),
    accessUserIds: v.optional(v.array(v.id("users"))),
    allowGuestEdit: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    const { userId } = await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    if (!canAccessDoc(doc, userId)) throw new Error("No access to this document");
    const { documentId, ...rest } = args;
    const patch: any = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(rest)) {
      if (val !== undefined) patch[k] = val;
    }
    if (args.parentId !== undefined) {
      if (args.parentId === args.documentId) throw new Error("Cannot move a document into itself");
      let cursor: Id<"flux_documents"> | null = args.parentId;
      while (cursor) {
        const parent: Doc<"flux_documents"> | null = await ctx.db.get(cursor);
        if (!parent) break;
        if (parent.workspaceId !== doc.workspaceId) throw new Error("Parent must be in the same workspace");
        if (String(parent._id) === String(args.documentId)) throw new Error("Cannot move a document into its own descendants");
        cursor = parent.parentId ?? null;
      }
    }
    await ctx.db.patch(args.documentId, patch);
    return args.documentId;
  },
});

/** Parse mention nodes out of BlockNote content and notify mentioned users. */
export const processMentions = mutation({
  args: { documentId: v.id("flux_documents"), userIds: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return;
    const { userId } = await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    const seen = new Set<string>();
    for (const target of args.userIds) {
      if (String(target) === String(userId) || seen.has(String(target))) continue;
      seen.add(String(target));
      // Avoid duplicate mention notifications within a short window for same doc.
      await ctx.db.insert("notifications", {
        userId: target,
        workspaceId: doc.workspaceId,
        type: "mention",
        title: "You were mentioned",
        message: doc.title || "a document",
        read: false,
        link: `/documents/${args.documentId}`,
        createdAt: Date.now(),
      });
    }
    return true;
  },
});

/** Remove the cover image. */
export const removeCover = mutation({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    await ctx.db.patch(args.documentId, { coverImage: undefined, updatedAt: Date.now() });
  },
});

export const removeIcon = mutation({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    await ctx.db.patch(args.documentId, { icon: undefined, updatedAt: Date.now() });
  },
});

export const archive = mutation({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    const { userId } = await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    // Recursively archive descendants.
    const queue: Id<"flux_documents">[] = [args.documentId];
    while (queue.length) {
      const current = queue.shift()!;
      await ctx.db.patch(current, { isArchived: true, updatedAt: Date.now() });
      const children = await ctx.db
        .query("flux_documents")
        .withIndex("by_workspace_parent", (q) =>
          q.eq("workspaceId", doc.workspaceId).eq("parentId", current),
        )
        .collect();
      for (const c of children) queue.push(c._id);
    }
    await logActivity(ctx, {
      workspaceId: doc.workspaceId,
      actorId: userId,
      action: "document.archived",
      targetType: "flux_document",
      targetId: args.documentId,
    });
    return true;
  },
});

export const restore = mutation({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    const patch: any = { isArchived: false, updatedAt: Date.now() };
    // If parent is archived, detach to root.
    if (doc.parentId) {
      const parent = await ctx.db.get(doc.parentId);
      if (parent?.isArchived) patch.parentId = undefined;
    }
    await ctx.db.patch(args.documentId, patch);
    return true;
  },
});

export const remove = mutation({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    const { userId } = await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    // Delete descendants + versions + favorites + tag links.
    const queue: Id<"flux_documents">[] = [args.documentId];
    const toDelete: Id<"flux_documents">[] = [];
    while (queue.length) {
      const current = queue.shift()!;
      toDelete.push(current);
      const children = await ctx.db
        .query("flux_documents")
        .withIndex("by_workspace_parent", (q) =>
          q.eq("workspaceId", doc.workspaceId).eq("parentId", current),
        )
        .collect();
      for (const c of children) queue.push(c._id);
    }
    for (const docId of toDelete) {
      const versions = await ctx.db
        .query("flux_documentVersions")
        .withIndex("by_document", (q) => q.eq("documentId", docId))
        .collect();
      for (const ver of versions) await ctx.db.delete(ver._id);
      const favs = await ctx.db
        .query("flux_favorites")
        .withIndex("by_user_document", (q) => q.eq("userId", userId).eq("documentId", docId))
        .collect();
      for (const f of favs) await ctx.db.delete(f._id);
      const tagLinks = await ctx.db
        .query("flux_documentTags")
        .withIndex("by_document", (q) => q.eq("documentId", docId))
        .collect();
      for (const t of tagLinks) await ctx.db.delete(t._id);
      await ctx.db.delete(docId);
    }
    return true;
  },
});

export const getTrash = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    const docs = await ctx.db
      .query("flux_documents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return docs.filter((d) => d.isArchived).sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const search = query({
  args: { workspaceId: v.id("workspaces"), query: v.string() },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    if (!args.query.trim()) {
      const docs = await ctx.db
        .query("flux_documents")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect();
      return docs.filter((d) => !d.isArchived).slice(0, 20);
    }
    return await ctx.db
      .query("flux_documents")
      .withSearchIndex("search_title", (q) =>
        q.search("title", args.query).eq("workspaceId", args.workspaceId).eq("isArchived", false),
      )
      .take(20);
  },
});

export const setPublished = mutation({
  args: { documentId: v.id("flux_documents"), isPublished: v.boolean() },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    const patch: any = { isPublished: args.isPublished, updatedAt: Date.now() };
    if (args.isPublished && !doc.shareToken) patch.shareToken = makeToken();
    await ctx.db.patch(args.documentId, patch);
    return patch.shareToken ?? doc.shareToken ?? null;
  },
});

// ----- Lock / encryption metadata -----
export const setLock = mutation({
  args: {
    documentId: v.id("flux_documents"),
    isLocked: v.boolean(),
    passphraseSalt: v.optional(v.string()),
    lockIv: v.optional(v.string()),
    passphraseHint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    const { userId } = await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    if (String(doc.createdBy) !== String(userId)) throw new Error("Only the document owner can lock/unlock");
    await ctx.db.patch(args.documentId, {
      isLocked: args.isLocked,
      passphraseSalt: args.passphraseSalt,
      lockIv: args.lockIv,
      passphraseHint: args.passphraseHint,
      updatedAt: Date.now(),
    });
  },
});

// ----- Versions -----
export const saveVersion = mutation({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    const { userId } = await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    await ctx.db.insert("flux_documentVersions", {
      documentId: doc._id,
      workspaceId: doc.workspaceId,
      title: doc.title,
      content: doc.content,
      savedBy: userId,
      savedAt: Date.now(),
    });
  },
});

export const listVersions = query({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return [];
    await assertWorkspaceMember(ctx, doc.workspaceId);
    const versions = await ctx.db
      .query("flux_documentVersions")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .take(50);
    const out = [];
    for (const v of versions) {
      const u: any = await ctx.db.get(v.savedBy);
      out.push({ ...v, savedByName: u?.name ?? u?.email ?? "Unknown" });
    }
    return out;
  },
});

export const restoreVersion = mutation({
  args: { versionId: v.id("flux_documentVersions") },
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.versionId);
    if (!version) throw new Error("Version not found");
    const doc = await ctx.db.get(version.documentId);
    if (!doc) throw new Error("Document not found");
    const { userId } = await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    await ctx.db.insert("flux_documentVersions", {
      documentId: doc._id,
      workspaceId: doc.workspaceId,
      title: doc.title,
      content: doc.content,
      savedBy: userId,
      savedAt: Date.now(),
    });
    await ctx.db.patch(version.documentId, {
      title: version.title,
      content: version.content,
      updatedAt: Date.now(),
    });
    return true;
  },
});

// ----- Favorites -----
export const toggleFavorite = mutation({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    const { userId } = await assertWorkspaceMember(ctx, doc.workspaceId);
    const existing = await ctx.db
      .query("flux_favorites")
      .withIndex("by_user_document", (q) => q.eq("userId", userId).eq("documentId", args.documentId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }
    await ctx.db.insert("flux_favorites", {
      userId,
      workspaceId: doc.workspaceId,
      documentId: args.documentId,
      createdAt: Date.now(),
    });
    return true;
  },
});

export const listFavorites = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) return [];
    const favs = await ctx.db
      .query("flux_favorites")
      .withIndex("by_user_workspace", (q) => q.eq("userId", userId).eq("workspaceId", args.workspaceId))
      .collect();
    const out = [] as any[];
    for (const f of favs) {
      const doc = await ctx.db.get(f.documentId);
      if (doc && !doc.isArchived) out.push(doc);
    }
    return out;
  },
});
