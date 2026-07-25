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
      .map((t) => ({ _id: t._id, title: t.title, status: t.status, projectId: t.projectId ?? null }));

    // Projects
    const allProjects = await ctx.db
      .query("projects")
      .withIndex("by_workspace", (qi) => qi.eq("workspaceId", args.workspaceId))
      .collect();
    const projects = allProjects
      .filter((p) => p.name.toLowerCase().includes(q) || (p.client ?? "").toLowerCase().includes(q))
      .slice(0, LIMIT)
      .map((p) => ({ _id: p._id, name: p.name, status: p.status, color: p.color ?? null }));

    // Events
    const allEvents = await ctx.db
      .query("flux_events")
      .withIndex("by_workspace", (qi) => qi.eq("workspaceId", args.workspaceId))
      .collect();
    const events = allEvents
      .filter((e) => e.title.toLowerCase().includes(q))
      .sort((a, b) => b.start - a.start)
      .slice(0, LIMIT)
      .map((e) => ({ _id: e._id, title: e.title, start: e.start }));

    // Databases
    const allDbs = await ctx.db
      .query("flux_databases")
      .withIndex("by_workspace", (qi) => qi.eq("workspaceId", args.workspaceId))
      .collect();
    const databases = allDbs
      .filter((d) => !d.isArchived && d.title.toLowerCase().includes(q))
      .slice(0, LIMIT)
      .map((d) => ({ _id: d._id, title: d.title, icon: d.icon ?? null }));

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
