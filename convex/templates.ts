import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ─── Template categories ─────────────────────────────────────────────────────

const TEMPLATE_CATEGORY = v.union(
  v.literal("project_management"),
  v.literal("engineering"),
  v.literal("design"),
  v.literal("marketing"),
  v.literal("sales"),
  v.literal("hr"),
  v.literal("education"),
  v.literal("personal"),
  v.literal("startup"),
  v.literal("other"),
);

// ─── Browse marketplace ──────────────────────────────────────────────────────

export const browse = query({
  args: {
    category: v.optional(TEMPLATE_CATEGORY),
    search: v.optional(v.string()),
    sort: v.optional(v.union(v.literal("popular"), v.literal("newest"), v.literal("featured"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let templates;

    if (args.category) {
      templates = await ctx.db
        .query("templates")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .collect();
      templates = templates.filter((t) => t.isPublished);
    } else {
      templates = await ctx.db
        .query("templates")
        .withIndex("by_published", (q) => q.eq("isPublished", true))
        .collect();
    }

    // Search filter
    if (args.search) {
      const q = args.search.toLowerCase();
      templates = templates.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          (t.tags ?? []).some((tag) => tag.toLowerCase().includes(q)),
      );
    }

    // Sort
    const sort = args.sort ?? "popular";
    if (sort === "popular") {
      templates.sort((a, b) => b.usageCount - a.usageCount);
    } else if (sort === "newest") {
      templates.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sort === "featured") {
      templates.sort((a, b) => {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return b.usageCount - a.usageCount;
      });
    }

    const limit = args.limit ?? 50;
    return templates.slice(0, limit);
  },
});

export const getFeatured = query({
  args: {},
  handler: async (ctx) => {
    const templates = await ctx.db
      .query("templates")
      .withIndex("by_published", (q) => q.eq("isPublished", true))
      .collect();
    return templates
      .filter((t) => t.isFeatured)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 8);
  },
});

export const getById = query({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getMyTemplates = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;
    return await ctx.db
      .query("templates")
      .withIndex("by_author", (q) => q.eq("authorId", userId))
      .collect();
  },
});

// ─── Check if user liked a template ──────────────────────────────────────────

export const isLiked = query({
  args: { templateId: v.id("templates") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    const userId = identity.subject;
    const like = await ctx.db
      .query("templateLikes")
      .withIndex("by_template_user", (q) =>
        q.eq("templateId", args.templateId).eq("userId", userId),
      )
      .first();
    return !!like;
  },
});

// ─── Create / publish template ───────────────────────────────────────────────

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    longDescription: v.optional(v.string()),
    category: TEMPLATE_CATEGORY,
    coverImage: v.optional(v.string()),
    previewImages: v.optional(v.array(v.string())),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    includeTasks: v.boolean(),
    includeDocuments: v.boolean(),
    includeProject: v.boolean(),
    tasksData: v.optional(v.string()),
    documentsData: v.optional(v.string()),
    projectData: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isPublished: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Get author info
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const now = Date.now();
    return await ctx.db.insert("templates", {
      ...args,
      isPublished: args.isPublished ?? false,
      authorId: userId,
      authorName: profile?.name ?? identity.name ?? "Anonymous",
      authorImage: profile?.image ?? identity.pictureUrl ?? undefined,
      usageCount: 0,
      likesCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("templates"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    longDescription: v.optional(v.string()),
    category: v.optional(TEMPLATE_CATEGORY),
    coverImage: v.optional(v.string()),
    previewImages: v.optional(v.array(v.string())),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    includeTasks: v.optional(v.boolean()),
    includeDocuments: v.optional(v.boolean()),
    includeProject: v.optional(v.boolean()),
    tasksData: v.optional(v.string()),
    documentsData: v.optional(v.string()),
    projectData: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isPublished: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const template = await ctx.db.get(args.id);
    if (!template) throw new Error("Template not found");
    if (template.authorId !== identity.subject) throw new Error("Not authorized");

    const { id, ...patch } = args;
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const template = await ctx.db.get(args.id);
    if (!template) throw new Error("Template not found");
    if (template.authorId !== identity.subject) throw new Error("Not authorized");

    // Delete all likes
    const likes = await ctx.db
      .query("templateLikes")
      .withIndex("by_template", (q) => q.eq("templateId", args.id))
      .collect();
    for (const like of likes) {
      await ctx.db.delete(like._id);
    }

    await ctx.db.delete(args.id);
  },
});

// ─── Like / unlike ───────────────────────────────────────────────────────────

export const toggleLike = mutation({
  args: { templateId: v.id("templates") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const existing = await ctx.db
      .query("templateLikes")
      .withIndex("by_template_user", (q) =>
        q.eq("templateId", args.templateId).eq("userId", userId),
      )
      .first();

    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found");

    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(args.templateId, {
        likesCount: Math.max(0, template.likesCount - 1),
      });
      return false;
    } else {
      await ctx.db.insert("templateLikes", {
        templateId: args.templateId,
        userId,
        createdAt: Date.now(),
      });
      await ctx.db.patch(args.templateId, {
        likesCount: template.likesCount + 1,
      });
      return true;
    }
  },
});

// ─── Use template (instantiate into user's workspace) ────────────────────────

export const useTemplate = mutation({
  args: { templateId: v.id("templates") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found");

    const results: {
      projectId?: Id<"projects">;
      taskIds: Id<"tasks">[];
      documentIds: Id<"documents">[];
      databaseIds: Id<"databases">[];
    } = { taskIds: [], documentIds: [], databaseIds: [] };

    const now = Date.now();

    // Create project if included
    if (template.includeProject && template.projectData) {
      try {
        const projectInfo = JSON.parse(template.projectData);
        results.projectId = await ctx.db.insert("projects", {
          name: projectInfo.name ?? template.title,
          description: projectInfo.description ?? template.description,
          icon: projectInfo.icon ?? template.icon,
          color: projectInfo.color ?? template.color ?? "#6366f1",
          status: "active",
          ownerId: userId,
          createdAt: now,
        });
      } catch {
        // Fallback: create a simple project
        results.projectId = await ctx.db.insert("projects", {
          name: template.title,
          description: template.description,
          status: "active",
          ownerId: userId,
          createdAt: now,
        });
      }
    }

    // Create tasks if included
    if (template.includeTasks && template.tasksData) {
      try {
        const tasks = JSON.parse(template.tasksData) as any[];
        for (const task of tasks) {
          const taskId = await ctx.db.insert("tasks", {
            title: task.title ?? "Untitled task",
            description: task.description,
            status: task.status ?? "todo",
            priority: task.priority ?? "none",
            projectId: results.projectId,
            createdBy: userId,
            labels: task.labels,
            order: task.order,
            createdAt: now,
            updatedAt: now,
          });
          results.taskIds.push(taskId);
        }
      } catch {
        // Skip malformed task data
      }
    }

    // Create documents if included
    if (template.includeDocuments && template.documentsData) {
      try {
        const docs = JSON.parse(template.documentsData) as any[];
        for (const doc of docs) {
          const docId = await ctx.db.insert("documents", {
            title: doc.title ?? "Untitled",
            content: doc.content,
            icon: doc.icon,
            userId,
            isArchived: false,
            isPublished: false,
            projectId: results.projectId,
          });
          results.documentIds.push(docId);
        }
      } catch {
        // Skip malformed document data
      }
    }

    // Create databases if included
    if (template.includeDatabases && template.databasesData) {
      try {
        const dbs = JSON.parse(template.databasesData) as any[];
        for (const db of dbs) {
          const dbId = await ctx.db.insert("databases", {
            title: db.title ?? "Untitled Database",
            description: db.description,
            icon: db.icon,
            color: db.color,
            columns: db.columns ?? "[]",
            ownerId: userId,
            projectId: results.projectId,
            createdAt: now,
            updatedAt: now,
          });
          results.databaseIds.push(dbId);

          // Insert pre-filled rows if any
          if (Array.isArray(db.rows)) {
            for (const row of db.rows) {
              await ctx.db.insert("databaseRows", {
                databaseId: dbId,
                cells: typeof row.cells === "string" ? row.cells : JSON.stringify(row.cells ?? {}),
                order: row.order,
                createdBy: userId,
                createdAt: now,
                updatedAt: now,
              });
            }
          }
        }
      } catch {
        // Skip malformed database data
      }
    }

    // Increment usage count
    await ctx.db.patch(args.templateId, {
      usageCount: template.usageCount + 1,
    });

    return results;
  },
});
