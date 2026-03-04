import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getMyNotifications = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(50);
  },
});

export const getUnreadCount = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", identity.subject).eq("read", false))
      .collect();
    return unread.length;
  },
});

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await ctx.db.patch(args.id, { read: true });
  },
});

export const markAllRead = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", identity.subject).eq("read", false))
      .collect();
    await Promise.all(unread.map((n) => ctx.db.patch(n._id, { read: true })));
  },
});

export const remove = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await ctx.db.delete(args.id);
  },
});

export const clearAll = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
    await Promise.all(all.map((n) => ctx.db.delete(n._id)));
  },
});

export const createMention = mutation({
  args: {
    targetUserId: v.string(),
    context: v.string(),
    link: v.optional(v.string()),
    fromUserName: v.optional(v.string()),
    fromUserImage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    if (args.targetUserId === userId) return;

    await ctx.db.insert("notifications", {
      userId: args.targetUserId,
      type: "mention",
      title: "mention",
      body: args.context.slice(0, 200),
      read: false,
      link: args.link,
      fromUserId: userId,
      fromUserName: args.fromUserName,
      fromUserImage: args.fromUserImage,
      createdAt: Date.now(),
    });
  },
});

export const checkDueDates = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;
    const userId = identity.subject;

    // Get user profile for alert settings
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // Default: alerts enabled, 3 days before
    const alertsEnabled = profile?.dueDateAlertsEnabled ?? true;
    if (!alertsEnabled) return;
    const alertDays = profile?.dueDateAlertDays ?? 3;

    const now = Date.now();
    const windowEnd = now + alertDays * 24 * 60 * 60 * 1000;

    // Get tasks due soon (not done/cancelled)
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_creator", (q) => q.eq("createdBy", userId))
      .filter((q) =>
        q.and(
          q.neq(q.field("dueDate"), undefined),
          q.neq(q.field("status"), "done"),
          q.neq(q.field("status"), "cancelled"),
        ),
      )
      .collect();

    const dueSoon = tasks.filter(
      (t) => t.dueDate != null && t.dueDate >= now && t.dueDate <= windowEnd,
    );

    for (const task of dueSoon) {
      // Dedup: skip if a due_soon notification already exists for this task today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const existing = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) =>
          q.and(
            q.eq(q.field("type"), "task_due_soon"),
            q.eq(q.field("relatedId"), task._id),
            q.gte(q.field("createdAt"), todayStart.getTime()),
          ),
        )
        .first();
      if (existing) continue;

      const daysLeft = Math.ceil((task.dueDate! - now) / (24 * 60 * 60 * 1000));
      const dueStr = daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;

      await ctx.db.insert("notifications", {
        userId,
        type: "task_due_soon",
        title: "task_due_soon",
        body: task.title,
        read: false,
        link: `/tasks/${task._id}`,
        relatedId: task._id,
        createdAt: Date.now(),
      });
    }
  },
});

export const createReminder = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    link: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await ctx.db.insert("notifications", {
      userId: identity.subject,
      type: "reminder",
      title: args.title,
      body: args.body,
      read: false,
      link: args.link,
      createdAt: Date.now(),
    });
  },
});

export const createNotification = mutation({
  args: {
    targetUserId: v.string(),
    type: v.union(
      v.literal("team_invitation"),
      v.literal("task_assigned"),
      v.literal("task_comment"),
      v.literal("task_completed"),
      v.literal("project_invitation"),
      v.literal("mention"),
    ),
    title: v.string(),
    body: v.string(),
    link: v.optional(v.string()),
    fromUserName: v.optional(v.string()),
    fromUserImage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    await ctx.db.insert("notifications", {
      userId: args.targetUserId,
      type: args.type,
      title: args.title,
      body: args.body,
      read: false,
      link: args.link,
      fromUserId: identity.subject,
      fromUserName: args.fromUserName,
      fromUserImage: args.fromUserImage,
      createdAt: Date.now(),
    });
  },
});
