import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import {
  assertWorkspaceAdmin,
  assertWorkspaceMember,
  requireUserId,
  logActivity,
  notifyWorkspaceMembers,
} from "./lib/auth";
import { assertPermission } from "./flux_roles";

function makeToken() {
  const a = Math.random().toString(36).slice(2);
  const b = Math.random().toString(36).slice(2);
  return `${a}${b}`.replace(/[^a-z0-9]/gi, "");
}

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    return ctx.db
      .query("invitations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
  },
});

export const invite = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertPermission(ctx, args.workspaceId, "invites:manage");
    const token = makeToken();
    const now = Date.now();
    const id = await ctx.db.insert("invitations", {
      email: args.email.toLowerCase().trim(),
      workspaceId: args.workspaceId,
      role: args.role,
      token,
      status: "pending",
      invitedBy: userId,
      expiresAt: now + 7 * 24 * 60 * 60 * 1000,
      createdAt: now,
    });
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      actorId: userId,
      action: "invitation.sent",
      targetType: "invitation",
      targetId: id,
      metadata: { email: args.email, role: args.role },
    });
    return { id, token };
  },
});

export const sendInviteEmail = action({
  args: {
    workspaceId: v.id("workspaces"),
    invitedByUserId: v.id("users"),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
    token: v.string(),
    inviteUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM ?? "noreply@association2e.org";
    if (!apiKey) {
      throw new Error("Missing RESEND_API_KEY environment variable");
    }

    const [workspace, inviter] = await Promise.all([
      ctx.runQuery(api.workspaces.get, { workspaceId: args.workspaceId }),
      ctx.runQuery(api.users.get, { userId: args.invitedByUserId }),
    ]);
    if (!workspace) throw new Error("Workspace not found");

    const locale = (workspace as any).locale ?? "en";
    const copy = INVITE_COPY[locale] ?? INVITE_COPY.en;
    const subject = copy.subject.replace("{workspace}", workspace.name);
    const workspaceName = workspace.name;
    const inviterName = inviter?.name ?? inviter?.email ?? copy.someone;
    const roleLabel = copy.roles[args.role] ?? args.role;

    const html = buildInviteEmailHtml({
      workspaceName,
      inviterName,
      roleLabel,
      inviteUrl: args.inviteUrl,
      cta: copy.cta,
      preview: copy.preview.replace("{workspace}", workspaceName),
      fallback: copy.fallback,
      footer: copy.footer,
    });
    const text = buildInviteEmailText({
      workspaceName,
      inviterName,
      roleLabel,
      inviteUrl: args.inviteUrl,
      cta: copy.cta,
      preview: copy.preview.replace("{workspace}", workspaceName),
      fallback: copy.fallback,
      footer: copy.footer,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: args.email,
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend error (${res.status}): ${body}`);
    }
    return { sent: true };
  },
});

const INVITE_COPY: Record<string, {
  subject: string;
  preview: string;
  cta: string;
  fallback: string;
  footer: string;
  someone: string;
  roles: Record<string, string>;
}> = {
  en: {
    subject: "You've been invited to join {workspace}",
    preview: "Join {workspace} and start collaborating with your team.",
    cta: "Accept invitation",
    fallback: "If the button doesn't work, copy and paste this link into your browser:",
    footer: "You received this email because you were invited to a workspace.",
    someone: "Someone",
    roles: { admin: "Admin", member: "Member", viewer: "Viewer" },
  },
  fr: {
    subject: "Vous avez été invité à rejoindre {workspace}",
    preview: "Rejoignez {workspace} et commencez à collaborer avec votre équipe.",
    cta: "Accepter l'invitation",
    fallback: "Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :",
    footer: "Vous avez reçu cet email car vous avez été invité à rejoindre un espace de travail.",
    someone: "Quelqu'un",
    roles: { admin: "Administrateur", member: "Membre", viewer: "Lecteur" },
  },
};

function buildInviteEmailHtml(opts: {
  workspaceName: string;
  inviterName: string;
  roleLabel: string;
  inviteUrl: string;
  cta: string;
  preview: string;
  fallback: string;
  footer: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(opts.workspaceName)} invitation</title>
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    body { margin: 0; padding: 0; background-color: #fafaf7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
    @media (prefers-color-scheme: dark) {
      body { background-color: #0a0a0b; }
      .container { background-color: #111113 !important; box-shadow: 0 1px 3px rgba(0,0,0,0.3) !important; }
      .logo, .title, .role, .cta { color: #fafafa !important; }
      .subtitle, .fallback, .footer { color: #9ca3af !important; }
      .pill { background-color: #17181b !important; border-color: #1f2024 !important; }
      .divider { background-color: #1f2024 !important; }
      .fallback a { color: #9ca3af !important; }
    }
    .container { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 24px; padding: 48px 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .logo { font-size: 22px; font-weight: 700; color: #0a0a0a; margin-bottom: 8px; text-align: center; letter-spacing: -0.02em; }
    .title { font-size: 18px; font-weight: 600; color: #0a0a0a; margin-bottom: 8px; text-align: center; line-height: 1.3; }
    .subtitle { font-size: 14px; color: #6b7280; margin-bottom: 32px; text-align: center; line-height: 1.5; }
    .pill { display: inline-block; background: #f4f4f1; border: 1px solid #e7e7e1; border-radius: 999px; padding: 6px 14px; font-size: 12px; font-weight: 500; color: #0a0a0a; margin-bottom: 24px; }
    .divider { height: 1px; background: #e7e7e1; margin: 32px 0; }
    .cta { display: block; width: 100%; background: #0a0a0a; color: #ffffff; text-decoration: none; text-align: center; padding: 15px 0; border-radius: 12px; font-size: 15px; font-weight: 600; margin-bottom: 16px; }
    .fallback { font-size: 13px; color: #6b7280; text-align: center; line-height: 1.5; }
    .fallback a { color: #6b7280; text-decoration: underline; word-break: break-all; }
    .footer { margin-top: 32px; font-size: 12px; color: #6b7280; text-align: center; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">${escapeHtml(opts.workspaceName)}</div>
    <div class="title">${escapeHtml(opts.inviterName)} invited you to join</div>
    <div style="text-align: center;"><span class="pill">${escapeHtml(opts.roleLabel)}</span></div>
    <div class="subtitle">${escapeHtml(opts.preview)}</div>
    <a href="${escapeHtml(opts.inviteUrl)}" class="cta">${escapeHtml(opts.cta)}</a>
    <div class="divider"></div>
    <div class="fallback">
      ${escapeHtml(opts.fallback)}<br/>
      <a href="${escapeHtml(opts.inviteUrl)}">${escapeHtml(opts.inviteUrl)}</a>
    </div>
    <div class="footer">${escapeHtml(opts.footer)}</div>
  </div>
</body>
</html>`;
}

function buildInviteEmailText(opts: {
  workspaceName: string;
  inviterName: string;
  roleLabel: string;
  inviteUrl: string;
  cta: string;
  preview: string;
  fallback: string;
  footer: string;
}): string {
  return `${opts.inviterName} invited you to join ${opts.workspaceName} as ${opts.roleLabel}.\n\n${opts.preview}\n\n${opts.cta}: ${opts.inviteUrl}\n\n${opts.fallback}\n${opts.inviteUrl}\n\n${opts.footer}`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export const revoke = mutation({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, args) => {
    const inv = await ctx.db.get(args.invitationId);
    if (!inv) throw new Error("Invitation not found");
    const { userId } = await assertPermission(ctx, inv.workspaceId, "invites:manage");
    await ctx.db.patch(args.invitationId, { status: "revoked" });
    await logActivity(ctx, {
      workspaceId: inv.workspaceId,
      actorId: userId,
      action: "invitation.revoked",
      targetType: "invitation",
      targetId: args.invitationId,
    });
    return true;
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const inv = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!inv) return null;
    const w = await ctx.db.get(inv.workspaceId);
    return {
      ...inv,
      workspace: w ? { name: w.name, slug: w.slug, avatar: w.avatar } : null,
    };
  },
});

export const accept = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const inv = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!inv) throw new Error("Invitation not found");
    if (inv.status !== "pending") throw new Error("Invitation no longer valid");
    if (inv.expiresAt < Date.now()) {
      await ctx.db.patch(inv._id, { status: "expired" });
      throw new Error("Invitation expired");
    }
    // Make sure email matches the invited email (optional safety).
    const user: any = await ctx.db.get(userId);
    if (user?.email && inv.email && user.email.toLowerCase() !== inv.email) {
      // We still allow, but log this. Some companies want to enforce.
    }
    // Insert membership if not already a member.
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", userId).eq("workspaceId", inv.workspaceId),
      )
      .unique();
    if (!existing) {
      await ctx.db.insert("memberships", {
        userId,
        workspaceId: inv.workspaceId,
        role: inv.role,
        joinedAt: Date.now(),
      });
    }
    await ctx.db.patch(inv._id, { status: "accepted" });
    await logActivity(ctx, {
      workspaceId: inv.workspaceId,
      actorId: userId,
      action: "invitation.accepted",
      targetType: "invitation",
      targetId: inv._id,
    });
    await notifyWorkspaceMembers(ctx, {
      workspaceId: inv.workspaceId,
      type: "member_joined",
      title: "New team member",
      message: `${user?.name ?? user?.email ?? "A new member"} joined the workspace.`,
      exceptUserId: userId,
    });
    return inv.workspaceId;
  },
});
