import { action, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { Id } from "./_generated/dataModel";
import { generateSlug, logActivity } from "./lib/auth";
import { ensureChannel } from "./flux_chat";
import { seedDefaultRoles } from "./flux_roles";

/**
 * A2E Core workspace bridge (Pattern B — linked mirror).
 *
 * Bureau keeps its local `workspaces`/`memberships` tables as the enforcement
 * layer; each local workspace can be linked to a canonical A2E Core workspace
 * via `workspaces.coreId`. This module:
 *
 *  - `syncFromCore` / `applyCoreLinks`: materialize local mirrors for every
 *    core workspace the caller belongs to (created in Bilan, the auto-created
 *    personal one, …), link by normalized-name when the caller owns an
 *    unlinked local twin, and heal name/avatar drift (core is canonical).
 *  - `stampCoreId`: binds a freshly client-created core workspace to the local
 *    row, re-verifying ownership server-side (never trusts client roles).
 *  - `importLocalMembers`: pushes the other local members into the linked core
 *    workspace via the service bridge, with their verified LOCAL roles.
 *
 * Requires env (both deployments): CONVEX_CORE_URL, A2E_SERVICE_SECRET.
 * Modeled on A2EMoney/convex/sync.ts + migrations.ts.
 */

const roleValidator = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("member"),
  v.literal("viewer"),
);

const coreWorkspaceRow = v.object({
  workspaceId: v.string(),
  name: v.string(),
  slug: v.string(),
  avatar: v.optional(v.string()),
  locale: v.optional(v.string()),
  currency: v.optional(v.string()),
  type: v.optional(v.string()),
  role: roleValidator,
});

type CoreWorkspaceRow = {
  workspaceId: string;
  name: string;
  slug: string;
  avatar?: string;
  locale?: string;
  currency?: string;
  type?: string;
  role: "owner" | "admin" | "member" | "viewer";
};

const workspacesForUserRef = makeFunctionReference<
  "query",
  { workosId: string; secret: string },
  CoreWorkspaceRow[]
>("sync:workspacesForUser");

const importMembershipRef = makeFunctionReference<
  "mutation",
  Record<string, unknown>,
  { membershipId: string; created: boolean }
>("sync:importMembership");

function coreClient() {
  const url = process.env.CONVEX_CORE_URL;
  if (!url) throw new Error("CONVEX_CORE_URL is not set on this deployment");
  return new ConvexHttpClient(url);
}

function serviceSecret() {
  const s = process.env.A2E_SERVICE_SECRET;
  if (!s) throw new Error("A2E_SERVICE_SECRET is not set on this deployment");
  return s;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Refresh the caller's local mirrors from core. Called by the client bridge
 * after authentication and whenever the core workspace set changes.
 * Cheap and idempotent.
 */
export const syncFromCore = action({
  args: {},
  handler: async (ctx): Promise<{ synced: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { synced: 0 };
    const rows = await coreClient().query(workspacesForUserRef, {
      workosId: identity.subject,
      secret: serviceSecret(),
    });
    await ctx.runMutation(internal.coreSync.applyCoreLinks, {
      workosId: identity.subject,
      rows,
    });
    return { synced: rows.length };
  },
});

export const applyCoreLinks = internalMutation({
  args: { workosId: v.string(), rows: v.array(coreWorkspaceRow) },
  handler: async (ctx, { workosId, rows }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", workosId))
      .unique();
    if (!user) return;

    const myMemberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const row of rows) {
      // 1) Already linked — ensure membership + heal name/avatar drift.
      const linked = await ctx.db
        .query("workspaces")
        .withIndex("by_coreId", (q) => q.eq("coreId", row.workspaceId))
        .unique();
      if (linked) {
        const membership = myMemberships.find((m) => m.workspaceId === linked._id);
        if (!membership) {
          await ctx.db.insert("memberships", {
            userId: user._id,
            workspaceId: linked._id,
            role: row.role,
            joinedAt: Date.now(),
          });
        }
        const patch: { name?: string; avatar?: string; updatedAt?: number } = {};
        if (linked.name !== row.name) patch.name = row.name;
        if (row.avatar !== undefined && linked.avatar !== row.avatar) {
          patch.avatar = row.avatar;
        }
        if (Object.keys(patch).length > 0) {
          patch.updatedAt = Date.now();
          await ctx.db.patch(linked._id, patch);
        }
        continue;
      }

      // 2) Link candidate: caller OWNS an unlinked local workspace with the
      //    same normalized name — stamp, don't duplicate.
      let stamped = false;
      for (const m of myMemberships) {
        if (m.role !== "owner") continue;
        const w = await ctx.db.get(m.workspaceId);
        if (!w || w.coreId) continue;
        if (normalizeName(w.name) === normalizeName(row.name)) {
          await ctx.db.patch(w._id, { coreId: row.workspaceId, updatedAt: Date.now() });
          stamped = true;
          break;
        }
      }
      if (stamped) continue;

      // 3) Create a local mirror (same seed sequence as workspaces.create so
      //    chat/roles/activity work immediately on mirrored workspaces).
      const now = Date.now();
      const mirrorId = await ctx.db.insert("workspaces", {
        name: row.name,
        slug: generateSlug(row.name),
        avatar: row.avatar,
        storageQuota: 524_288_000, // 500MB default, matches workspaces.create
        ownerId: user._id,
        locale: row.locale ?? "en",
        currency: row.currency ?? "EUR",
        type:
          row.type === "business" || row.type === "association"
            ? row.type
            : "individual",
        createdAt: now,
        updatedAt: now,
        coreId: row.workspaceId,
      });
      await ctx.db.insert("memberships", {
        userId: user._id,
        workspaceId: mirrorId,
        role: row.role,
        joinedAt: now,
      });
      await seedDefaultRoles(ctx, mirrorId as string, user._id as string);
      await ensureChannel(ctx, mirrorId as string, "general", "workspace", user._id as string);
      await logActivity(ctx, {
        workspaceId: mirrorId,
        actorId: user._id,
        action: "workspace.created",
        targetType: "workspace",
        targetId: mirrorId,
        metadata: { name: row.name, mirroredFrom: "core" },
      });
    }
  },
});

/**
 * Bind a local workspace to a core workspace the caller just created
 * client-side (via `useCoreMutation(coreApi.workspaces.create)` with their own
 * token). Re-verifies local ownership server-side. Idempotent.
 */
export const stampCoreId = mutation({
  args: { localWorkspaceId: v.id("workspaces"), coreId: v.string() },
  handler: async (ctx, { localWorkspaceId, coreId }): Promise<{ coreId: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found — call users.store after login");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", localWorkspaceId),
      )
      .unique();
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      throw new Error("Forbidden: only the workspace owner can link it to core");
    }
    const w = await ctx.db.get(localWorkspaceId);
    if (!w) throw new Error("Workspace not found");
    if (w.coreId === coreId) return { coreId };
    if (w.coreId) throw new Error("Already linked to another core workspace");

    const taken = await ctx.db
      .query("workspaces")
      .withIndex("by_coreId", (q) => q.eq("coreId", coreId))
      .unique();
    if (taken && taken._id !== localWorkspaceId) {
      throw new Error("Core workspace already linked to another local workspace");
    }
    await ctx.db.patch(localWorkspaceId, { coreId, updatedAt: Date.now() });
    return { coreId };
  },
});

/** Caller's verified local role (derived from JWT, never from client args). */
export const callerRole = internalQuery({
  args: { localWorkspaceId: v.id("workspaces") },
  handler: async (ctx, { localWorkspaceId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", identity.subject))
      .unique();
    if (!user) return null;
    const m = await ctx.db
      .query("memberships")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", localWorkspaceId),
      )
      .unique();
    return m?.role ?? null;
  },
});

export const localCoreId = internalQuery({
  args: { localWorkspaceId: v.id("workspaces") },
  handler: async (ctx, { localWorkspaceId }) => {
    const w = await ctx.db.get(localWorkspaceId);
    return w?.coreId ?? null;
  },
});

/** Other local members with their WorkOS id + verified local role. */
export const localMembers = internalQuery({
  args: { localWorkspaceId: v.id("workspaces") },
  handler: async (ctx, { localWorkspaceId }) => {
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", localWorkspaceId))
      .collect();
    const out: Array<{ workosId: string; role: "owner" | "admin" | "member" | "viewer" }> = [];
    for (const m of memberships) {
      const u = await ctx.db.get(m.userId);
      if (!u) continue;
      out.push({ workosId: u.externalId, role: m.role });
    }
    return out;
  },
});

/**
 * Import the OTHER local members of a linked workspace into core via the
 * service bridge (server-verified local roles). Per-member failures (e.g. the
 * member has never logged into a core-connected app) are skipped — their side
 * is materialized by their own first `syncFromCore`.
 */
export const importLocalMembers = action({
  args: { localWorkspaceId: v.id("workspaces") },
  handler: async (
    ctx,
    { localWorkspaceId },
  ): Promise<{ imported: number; skipped: number; coreId: string | null }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const role = await ctx.runQuery(internal.coreSync.callerRole, { localWorkspaceId });
    if (!role || (role !== "owner" && role !== "admin")) {
      throw new Error("Forbidden: only the workspace owner can sync members to core");
    }
    const coreId = await ctx.runQuery(internal.coreSync.localCoreId, { localWorkspaceId });
    if (!coreId) return { imported: 0, skipped: 0, coreId: null };

    const members = await ctx.runQuery(internal.coreSync.localMembers, { localWorkspaceId });
    let imported = 0;
    let skipped = 0;
    for (const m of members) {
      if (m.workosId === identity.subject) continue;
      try {
        await coreClient().mutation(importMembershipRef, {
          secret: serviceSecret(),
          workosId: m.workosId,
          workspaceId: coreId,
          role: m.role,
        });
        imported++;
      } catch {
        skipped++;
      }
    }
    return { imported, skipped, coreId };
  },
});
