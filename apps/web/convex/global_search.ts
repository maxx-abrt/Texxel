import { query } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember } from "./lib/auth";

const LIMIT = 5;

export const search = query({
  args: { workspaceId: v.id("workspaces"), query: v.string() },
  handler: async (ctx, args) => {
    if (args.query.trim().length < 2) {
      return { tasks: [], projects: [], events: [], databases: [], members: [] };
    }
    await assertWorkspaceMember(ctx, args.workspaceId);
    const q = args.query.toLowerCase();

    // Tasks
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_workspace", (qi) => qi.eq("workspaceId", args.workspaceId))
      .collect();
    const tasks = allTasks
      .filter((t) => t.title.toLowerCase().includes(q))
      .slice(0, LIMIT)
      .map((t) => ({
        _id: t._id,
        title: t.title,
        status: t.status,
        projectId: t.projectId ?? null,
        description: t.description ?? null, // M2.4 snippet preview
      }));

    // Projects
    const allProjects = await ctx.db
      .query("projects")
      .withIndex("by_workspace", (qi) => qi.eq("workspaceId", args.workspaceId))
      .collect();
    const projects = allProjects
      .filter((p) => p.name.toLowerCase().includes(q) || (p.client ?? "").toLowerCase().includes(q))
      .slice(0, LIMIT)
      .map((p) => ({
        _id: p._id,
        name: p.name,
        status: p.status,
        color: p.color ?? null,
        description: p.description ?? null, // M2.4 snippet preview
        client: p.client ?? null,
      }));

    // Events
    const allEvents = await ctx.db
      .query("flux_events")
      .withIndex("by_workspace", (qi) => qi.eq("workspaceId", args.workspaceId))
      .collect();
    const events = allEvents
      .filter((e) => e.title.toLowerCase().includes(q))
      .sort((a, b) => b.start - a.start)
      .slice(0, LIMIT)
      .map((e) => ({
        _id: e._id,
        title: e.title,
        start: e.start,
        description: e.description ?? null, // M2.4 snippet preview
        location: e.location ?? null,
      }));

    // Databases
    const allDbs = await ctx.db
      .query("flux_databases")
      .withIndex("by_workspace", (qi) => qi.eq("workspaceId", args.workspaceId))
      .collect();
    const databases = allDbs
      .filter((d) => !d.isArchived && d.title.toLowerCase().includes(q))
      .slice(0, LIMIT)
      .map((d) => ({
        _id: d._id,
        title: d.title,
        icon: d.icon ?? null,
        description: d.description ?? null, // M2.4 snippet preview
      }));

    // Members
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_workspace", (qi) => qi.eq("workspaceId", args.workspaceId))
      .collect();
    const members: Array<{ _id: string; name: string | null; email: string; role: string }> = [];
    for (const m of memberships) {
      if (members.length >= LIMIT) break;
      const u: any = await ctx.db.get(m.userId);
      if (!u) continue;
      const matchName = (u.name ?? "").toLowerCase().includes(q);
      const matchEmail = (u.email ?? "").toLowerCase().includes(q);
      if (matchName || matchEmail) {
        members.push({ _id: u._id, name: u.name ?? null, email: u.email, role: m.role });
      }
    }

    return { tasks, projects, events, databases, members };
  },
});

// M2.4 (§5 #5) — scoped `#tag` prefix: search tasks by label name.
// Labels live on `flux_taskMeta` (sidecar to the shared `tasks` table).
export const searchByLabel = query({
  args: { workspaceId: v.id("workspaces"), query: v.string() },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    const q = args.query.toLowerCase().trim();

    // Match workspace labels by name (for the heading context).
    const allLabels = await ctx.db
      .query("flux_labels")
      .withIndex("by_workspace", (qi) => qi.eq("workspaceId", args.workspaceId))
      .collect();
    const labels = allLabels
      .filter((l) => l.name.toLowerCase().includes(q))
      .slice(0, LIMIT)
      .map((l) => ({ _id: l._id, name: l.name, color: l.color ?? null }));

    // Task metadata carrying any matching label.
    const allMeta = await ctx.db
      .query("flux_taskMeta")
      .withIndex("by_workspace", (qi) => qi.eq("workspaceId", args.workspaceId))
      .collect();
    const matchedMeta = allMeta
      .filter((m) => (m.labels ?? []).some((l) => l.toLowerCase().includes(q)))
      .slice(0, LIMIT * 2);

    // Join back to the task rows.
    const tasks: Array<{
      _id: string;
      title: string;
      status: string;
      projectId: string | null;
      description: string | null;
      labels: string[] | null;
    }> = [];
    for (const m of matchedMeta) {
      const task: any = await ctx.db.get(m.taskId);
      if (!task) continue;
      tasks.push({
        _id: task._id,
        title: task.title,
        status: task.status,
        projectId: task.projectId ?? null,
        description: task.description ?? null,
        labels: m.labels ?? null,
      });
    }

    return { labels, tasks };
  },
});
