import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  assertWorkspaceMember,
  logActivity,
  notifyWorkspaceMembers,
} from "./lib/auth";
import { api } from "./_generated/api";

function nextInvoiceNumber(existing: string[]): string {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const max = existing
    .filter((n) => n.startsWith(prefix))
    .map((n) => parseInt(n.slice(prefix.length), 10))
    .filter((n) => !isNaN(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    return ctx.db
      .query("a2e_invoices")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { invoiceId: v.id("a2e_invoices") },
  handler: async (ctx, args) => {
    const inv = await ctx.db.get(args.invoiceId);
    if (!inv) return null;
    await assertWorkspaceMember(ctx, inv.workspaceId);
    return inv;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    client: v.string(),
    clientEmail: v.string(),
    clientAddress: v.optional(v.string()),
    items: v.array(
      v.object({
        id: v.string(),
        description: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
      }),
    ),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("sent"),
        v.literal("paid"),
        v.literal("overdue"),
        v.literal("cancelled"),
      ),
    ),
    issueDate: v.number(),
    dueDate: v.number(),
    notes: v.optional(v.string()),
    taxRate: v.optional(v.number()),
    currency: v.optional(v.string()),
    linkedClientId: v.optional(v.id("a2e_clients")),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(
      ctx,
      args.workspaceId,
      "member",
    );
    const all = await ctx.db
      .query("a2e_invoices")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const number = nextInvoiceNumber(all.map((i) => i.number));
    const now = Date.now();
    const id = await ctx.db.insert("a2e_invoices", {
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      number,
      client: args.client,
      clientEmail: args.clientEmail,
      clientAddress: args.clientAddress,
      items: args.items,
      status: args.status ?? "draft",
      issueDate: args.issueDate,
      dueDate: args.dueDate,
      notes: args.notes,
      linkedDocuments: [],
      linkedBookEntries: [],
      taxRate: args.taxRate,
      currency: args.currency ?? "EUR",
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      actorId: userId,
      action: "invoice.created",
      targetType: "invoice",
      targetId: id,
      metadata: { number, client: args.client },
    });
    // Update client total invoiced
    if (args.linkedClientId) {
      const client = await ctx.db.get(args.linkedClientId);
      if (client) {
        const total = args.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
        await ctx.db.patch(args.linkedClientId, {
          totalInvoiced: (client.totalInvoiced ?? 0) + total,
          updatedAt: Date.now(),
        });
      }
    }
    return id;
  },
});

export const update = mutation({
  args: {
    invoiceId: v.id("a2e_invoices"),
    projectId: v.optional(v.id("projects")),
    client: v.optional(v.string()),
    clientEmail: v.optional(v.string()),
    clientAddress: v.optional(v.string()),
    items: v.optional(
      v.array(
        v.object({
          id: v.string(),
          description: v.string(),
          quantity: v.number(),
          unitPrice: v.number(),
        }),
      ),
    ),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("sent"),
        v.literal("paid"),
        v.literal("overdue"),
        v.literal("cancelled"),
      ),
    ),
    issueDate: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    paidDate: v.optional(v.number()),
    notes: v.optional(v.string()),
    taxRate: v.optional(v.number()),
    currency: v.optional(v.string()),
    paidMethod: v.optional(v.string()),
    linkedDocuments: v.optional(v.array(v.string())),
    linkedBookEntries: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const inv = await ctx.db.get(args.invoiceId);
    if (!inv) throw new Error("Invoice not found");
    const { userId } = await assertWorkspaceMember(
      ctx,
      inv.workspaceId,
      "member",
    );
    const { invoiceId, ...rest } = args as any;
    const patch: any = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(rest)) {
      if (val !== undefined) patch[k] = val;
    }
    const prevStatus = inv.status;
    await ctx.db.patch(args.invoiceId, patch);
    await logActivity(ctx, {
      workspaceId: inv.workspaceId,
      actorId: userId,
      action: "invoice.updated",
      targetType: "invoice",
      targetId: args.invoiceId,
    });
    if (args.status === "paid" && prevStatus !== "paid") {
      await notifyWorkspaceMembers(ctx, {
        workspaceId: inv.workspaceId,
        type: "invoice_paid",
        title: "Invoice marked as paid",
        message: `Invoice ${inv.number} for ${inv.client} is now paid.`,
        link: `/dashboard/invoices`,
      });
      // Auto-create income transaction
      const total = inv.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
      await ctx.runMutation(api.a2e_expenses.create, {
        workspaceId: inv.workspaceId,
        projectId: inv.projectId,
        description: `Paiement facture ${inv.number} — ${inv.client}`,
        amount: total,
        category: "Other",
        date: args.paidDate ?? Date.now(),
        paymentMethod: args.paidMethod ?? "Bank transfer",
        type: "income",
        currency: inv.currency,
        linkedInvoice: args.invoiceId,
      });
      // Update client total paid
      if (inv.linkedClientId) {
        const client = await ctx.db.get(inv.linkedClientId);
        if (client) {
          await ctx.db.patch(inv.linkedClientId, {
            totalPaid: (client.totalPaid ?? 0) + total,
            updatedAt: Date.now(),
          });
        }
      }
    }
    return args.invoiceId;
  },
});

export const remove = mutation({
  args: { invoiceId: v.id("a2e_invoices") },
  handler: async (ctx, args) => {
    const inv = await ctx.db.get(args.invoiceId);
    if (!inv) throw new Error("Invoice not found");
    const { userId } = await assertWorkspaceMember(
      ctx,
      inv.workspaceId,
      "member",
    );
    await ctx.db.delete(args.invoiceId);
    await logActivity(ctx, {
      workspaceId: inv.workspaceId,
      actorId: userId,
      action: "invoice.deleted",
      targetType: "invoice",
      targetId: args.invoiceId,
    });
    return true;
  },
});
