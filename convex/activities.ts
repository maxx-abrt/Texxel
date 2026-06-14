import { query } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember } from "./lib/auth";

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    const rows = await ctx.db
      .query("activities")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(args.limit ?? 100);
    // Hydrate actor
    const out = [] as any[];
    for (const a of rows) {
      const u: any = await ctx.db.get(a.actorId);
      out.push({
        ...a,
        actor: u
          ? { _id: u._id, name: u.name, email: u.email, image: u.image }
          : null,
      });
    }
    return out;
  },
});

/** GDPR-style workspace export: returns all data scoped to the workspace. */
export const exportWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { role } = await assertWorkspaceMember(ctx, args.workspaceId);
    if (role !== "owner" && role !== "admin") {
      throw new Error("Forbidden: requires admin role for export");
    }
    const w = await ctx.db.get(args.workspaceId);
    const tables = [
      "memberships",
      "invitations",
      "projects",
      "tasks",
      "activities",
      "a2e_invoices",
      "a2e_expenses",
      "a2e_documents",
      "a2e_bookSheets",
      "a2e_bookEntries",
      "a2e_budgets",
      "a2e_categories",
      "a2e_fiches",
    ] as const;
    const data: Record<string, any[]> = {};
    for (const t of tables) {
      const rows = await ctx.db
        .query(t as any)
        .withIndex("by_workspace" as any, (q: any) =>
          q.eq("workspaceId", args.workspaceId),
        )
        .collect();
      data[t] = rows;
    }
    return {
      exportedAt: Date.now(),
      workspace: w,
      data,
    };
  },
});
