import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

/** Check for tasks that are due within 24 hours or already overdue, and fire
 *  deadline-alert notifications if not already sent today. */
export const checkDeadlines = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const tomorrow = now + 24 * 60 * 60 * 1000;
    const todayKey = new Date(now).toISOString().slice(0, 10); // "YYYY-MM-DD"

    const dueTasks = await ctx.db
      .query("tasks")
      .collect()
      .then((tasks) =>
        tasks.filter(
          (t) =>
            t.dueDate != null &&
            t.dueDate <= tomorrow &&
            t.status !== "done",
        ),
      );

    for (const task of dueTasks) {
      const recipientId = task.assigneeId ?? task.createdBy;
      const dedupeKey = `deadline_${task._id}_${todayKey}`;

      const existing = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) =>
          q.eq("userId", recipientId as string).eq("read", false),
        )
        .collect()
        .then((ns) => ns.find((n) => n.metadata?.dedupeKey === dedupeKey));

      if (existing) continue;

      const overdue = task.dueDate! < now;
      await ctx.db.insert("notifications", {
        userId: recipientId as string,
        workspaceId: task.workspaceId,
        type: "deadline_alert",
        title: overdue ? "Task overdue" : "Task due soon",
        message: task.title,
        body: overdue
          ? `"${task.title}" was due on ${new Date(task.dueDate!).toLocaleDateString()}.`
          : `"${task.title}" is due within 24 hours.`,
        read: false,
        link: `/app/tasks`,
        metadata: { taskId: task._id, dedupeKey },
        relatedId: task._id,
        createdAt: now,
      });
    }
  },
});

const crons = cronJobs();

crons.daily(
  "deadline-alerts",
  { hourUTC: 7, minuteUTC: 0 },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (internal as any).crons.checkDeadlines,
);

crons.daily(
  "empty-expired-task-trash",
  { hourUTC: 4, minuteUTC: 0 },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (internal as any).flux_tasks.emptyExpiredTrash,
);

// M3.3.1: daily sortKey rebalance scan — detects degenerate adjacency in
// any sibling list and renumbers with evenly-spaced keys (LexoRank maintenance).
crons.daily(
  "rebalance-sortkeys",
  { hourUTC: 3, minuteUTC: 0 },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (internal as any).flux_documents.rebalanceAllSortKeys,
  {},
);

export default crons;
