import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getOptionalUserId, requireUserId } from "./lib/auth";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) return null;
    const prefs = await ctx.db
      .query("flux_userPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return prefs;
  },
});

export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("flux_userPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) return existing._id;
    const now = Date.now();
    return await ctx.db.insert("flux_userPrefs", {
      userId,
      onboardingCompleted: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    locale: v.optional(v.string()),
    theme: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    density: v.optional(v.string()),
    easyRead: v.optional(v.boolean()),
    docToolbarHidden: v.optional(v.array(v.string())),
    onboardingCompleted: v.optional(v.boolean()),
    lastWorkspaceId: v.optional(v.id("workspaces")),
    tabs: v.optional(
      v.array(
        v.object({
          id: v.string(),
          kind: v.string(),
          refId: v.optional(v.string()),
          title: v.string(),
          icon: v.optional(v.string()),
        }),
      ),
    ),
    commandHistory: v.optional(
      v.array(
        v.object({
          key: v.string(),
          uses: v.number(),
          lastUsed: v.number(),
        }),
      ),
    ),
    shortcuts: v.optional(v.any()),
    quietHours: v.optional(
      v.object({
        enabled: v.boolean(),
        start: v.string(),
        end: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("flux_userPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const now = Date.now();
    const patch: any = { updatedAt: now };
    for (const [k, val] of Object.entries(args)) if (val !== undefined) patch[k] = val;
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("flux_userPrefs", {
      userId,
      onboardingCompleted: false,
      createdAt: now,
      ...patch,
    });
  },
});

// M2.3 (§5 #3) — frecency history. Records one command-palette pick:
// increments `uses`, refreshes `lastUsed`, caps history at 50 entries
// (most recently used kept).
export const recordCommand = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("flux_userPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const now = Date.now();
    if (!existing) {
      return await ctx.db.insert("flux_userPrefs", {
        userId,
        onboardingCompleted: false,
        commandHistory: [{ key, uses: 1, lastUsed: now }],
        createdAt: now,
        updatedAt: now,
      });
    }
    const history = [...(existing.commandHistory ?? [])];
    const idx = history.findIndex((h) => h.key === key);
    if (idx >= 0) {
      history[idx] = { key, uses: history[idx].uses + 1, lastUsed: now };
    } else {
      history.push({ key, uses: 1, lastUsed: now });
    }
    history.sort((a, b) => b.lastUsed - a.lastUsed);
    const trimmed = history.slice(0, 50);
    await ctx.db.patch(existing._id, { commandHistory: trimmed, updatedAt: now });
    return existing._id;
  },
});
