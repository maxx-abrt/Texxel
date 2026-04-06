import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ─── Constants ──────────────────────────────────────────────────────────────
// Both tiers: unlimited notes, tasks, projects
// Free tier: 5 AI credits/day, max 5 workspaces
// Suite (€5/mo): unlimited AI, unlimited workspaces, advanced features
export const PLAN_LIMITS = {
  free: {
    dailyRequests: 5,
    dailyTokens: 10_000,
    maxWorkspaces: 5,
    maxFileSize: 5, // MB
    models: ["gemini-2.0-flash"] as string[],
    features: ["chat", "summarize", "improve_writing", "fix_grammar", "make_shorter", "make_longer", "change_tone", "generate_chart"] as string[],
  },
  suite: {
    dailyRequests: -1, // unlimited
    dailyTokens: -1, // unlimited
    maxWorkspaces: -1, // unlimited
    maxFileSize: 50, // MB
    models: ["gemini-2.0-flash", "gemini-2.5-pro-preview-05-06"] as string[],
    features: [
      "chat",
      "summarize",
      "improve_writing",
      "fix_grammar",
      "make_shorter",
      "make_longer",
      "change_tone",
      "generate_chart",
      "translate",
      "generate_tasks",
      "analyze_document",
      "generate_document",
      "brainstorm",
      "code_review",
      "explain",
    ] as string[],
  },
} as const;

// Helper to get authenticated userId
async function getUserId(ctx: any): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}

// ─── Queries ────────────────────────────────────────────────────────────────

export const getMySubscription = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return null;

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!sub) {
      // No subscription record → free tier
      return { plan: "free" as const, status: "active" as const, limits: PLAN_LIMITS.free };
    }

    const isActive = sub.status === "active" && (!sub.currentPeriodEnd || sub.currentPeriodEnd > Date.now());
    const effectivePlan = isActive ? sub.plan : "free";

    return {
      ...sub,
      plan: effectivePlan,
      limits: PLAN_LIMITS[effectivePlan],
    };
  },
});

export const getMyPlan = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return "free" as const;

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!sub || sub.status !== "active") return "free" as const;
    if (sub.currentPeriodEnd && sub.currentPeriodEnd < Date.now()) return "free" as const;

    return sub.plan;
  },
});

// ─── Mutations ──────────────────────────────────────────────────────────────

export const activateSuite = mutation({
  args: {
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    periodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const now = Date.now();
    const periodEnd = args.periodEnd ?? now + 30 * 24 * 60 * 60 * 1000; // 30 days default

    if (existing) {
      await ctx.db.patch(existing._id, {
        plan: "suite",
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        stripeCustomerId: args.stripeCustomerId ?? existing.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId ?? existing.stripeSubscriptionId,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("subscriptions", {
      userId,
      plan: "suite",
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const cancelSuite = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!sub) return;

    await ctx.db.patch(sub._id, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
  },
});

// ─── AI Usage ───────────────────────────────────────────────────────────────

export const getMyAiUsage = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return null;

    const today = new Date().toISOString().slice(0, 10);
    const usage = await ctx.db
      .query("aiUsage")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
      .first();

    return usage ?? { tokensUsed: 0, requestCount: 0, date: today };
  },
});

export const trackAiUsage = mutation({
  args: {
    tokensUsed: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const today = new Date().toISOString().slice(0, 10);
    const existing = await ctx.db
      .query("aiUsage")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        tokensUsed: existing.tokensUsed + args.tokensUsed,
        requestCount: existing.requestCount + 1,
      });
    } else {
      await ctx.db.insert("aiUsage", {
        userId,
        date: today,
        tokensUsed: args.tokensUsed,
        requestCount: 1,
      });
    }
  },
});

export const checkAiLimit = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return { allowed: false, reason: "not_authenticated" };

    // Get plan
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const isActiveSuite =
      sub?.plan === "suite" &&
      sub.status === "active" &&
      (!sub.currentPeriodEnd || sub.currentPeriodEnd > Date.now());

    if (isActiveSuite) {
      return { allowed: true, plan: "suite" as const, remaining: Infinity };
    }

    // Free tier — check daily limits
    const today = new Date().toISOString().slice(0, 10);
    const usage = await ctx.db
      .query("aiUsage")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
      .first();

    const used = usage?.requestCount ?? 0;
    const limit = PLAN_LIMITS.free.dailyRequests;
    const remaining = Math.max(0, limit - used);

    return {
      allowed: remaining > 0,
      plan: "free" as const,
      remaining,
      limit,
      used,
    };
  },
});
