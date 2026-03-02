import {
  ThreadStore,
  DefaultThreadStoreAuth,
} from "@blocknote/core/comments";

export type ConvexMutations = {
  createThread: (args: {
    documentId: string;
    threadId: string;
    commentId: string;
    body: string;
  }) => Promise<any>;
  addComment: (args: {
    documentId: string;
    threadId: string;
    commentId: string;
    body: string;
  }) => Promise<any>;
  updateComment: (args: { commentId: string; body: string }) => Promise<any>;
  deleteComment: (args: { commentId: string }) => Promise<any>;
  deleteThread: (args: { threadId: string }) => Promise<any>;
  resolveThread: (args: { threadId: string }) => Promise<any>;
  unresolveThread: (args: { threadId: string }) => Promise<any>;
  addReaction: (args: { commentId: string; emoji: string }) => Promise<any>;
  deleteReaction: (args: { commentId: string; emoji: string }) => Promise<any>;
};

export class ConvexThreadStore extends ThreadStore {
  private threads: Map<string, any> = new Map();
  private subscribers: Array<(threads: Map<string, any>) => void> = [];
  public mutations: ConvexMutations | null = null;
  public documentId: string;
  public userId: string;

  constructor(userId: string, documentId: string) {
    super(new DefaultThreadStoreAuth(userId, "editor"));
    this.userId = userId;
    this.documentId = documentId;
  }

  updateFromConvexData(
    rawThreads: any[],
    rawComments: any[],
  ) {
    const newMap = new Map<string, any>();

    for (const thread of rawThreads) {
      if (thread.deletedAt) continue;

      const threadComments = rawComments
        .filter((c) => c.threadId === thread.threadId)
        .map((c) => {
          const reactions = c.reactions ? JSON.parse(c.reactions) : [];
          const base = {
            type: "comment" as const,
            id: c.commentId,
            userId: c.userId,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
            reactions: reactions.map((r: any) => ({
              emoji: r.emoji,
              createdAt: new Date(r.createdAt),
              userIds: r.userIds,
            })),
            metadata: {},
          };
          if (c.deletedAt) {
            return { ...base, deletedAt: new Date(c.deletedAt), body: undefined };
          }
          return { ...base, body: this.safeParseBody(c.body) };
        });

      const threadData: any = {
        type: "thread",
        id: thread.threadId,
        createdAt: new Date(thread.createdAt),
        updatedAt: new Date(thread.createdAt),
        comments: threadComments,
        resolved: thread.resolved,
        resolvedUpdatedAt: thread.resolvedAt ? new Date(thread.resolvedAt) : undefined,
        resolvedBy: thread.resolvedBy,
        metadata: {},
      };
      newMap.set(thread.threadId, threadData);
    }

    this.threads = newMap;
    this.notifySubscribers();
  }

  private safeParseBody(raw: string): any {
    try {
      return JSON.parse(raw);
    } catch {
      return [{ type: "paragraph", content: [{ type: "text", text: raw }] }];
    }
  }

  private notifySubscribers() {
    this.subscribers.forEach((cb) => cb(this.threads));
  }

  // ─── ThreadStore implementation ────────────────────────────────────────────

  // Not implementing addThreadToDocument → BlockNote falls back to tiptap setMark
  addThreadToDocument = undefined;

  async createThread(options: {
    initialComment: { body: any; metadata?: any };
    metadata?: any;
  }): Promise<any> {
    const threadId = crypto.randomUUID();
    const commentId = crypto.randomUUID();
    const now = new Date();
    const bodyStr = JSON.stringify(options.initialComment.body);

    this.mutations?.createThread({
      documentId: this.documentId,
      threadId,
      commentId,
      body: bodyStr,
    });

    const comment: any = {
      type: "comment",
      id: commentId,
      userId: this.userId,
      createdAt: now,
      updatedAt: now,
      body: options.initialComment.body,
      reactions: [],
      metadata: {},
    };
    const thread: any = {
      type: "thread",
      id: threadId,
      createdAt: now,
      updatedAt: now,
      comments: [comment],
      resolved: false,
      metadata: {},
    };
    this.threads.set(threadId, thread);
    this.notifySubscribers();
    return thread;
  }

  async addComment(options: {
    comment: { body: any; metadata?: any };
    threadId: string;
  }): Promise<any> {
    const commentId = crypto.randomUUID();
    const now = new Date();
    const bodyStr = JSON.stringify(options.comment.body);

    this.mutations?.addComment({
      documentId: this.documentId,
      threadId: options.threadId,
      commentId,
      body: bodyStr,
    });

    const comment: any = {
      type: "comment",
      id: commentId,
      userId: this.userId,
      createdAt: now,
      updatedAt: now,
      body: options.comment.body,
      reactions: [],
      metadata: {},
    };
    const thread = this.threads.get(options.threadId);
    if (thread) {
      thread.comments = [...thread.comments, comment];
      thread.updatedAt = now;
      this.notifySubscribers();
    }
    return comment;
  }

  async updateComment(options: {
    comment: { body: any; metadata?: any };
    threadId: string;
    commentId: string;
  }): Promise<void> {
    this.mutations?.updateComment({
      commentId: options.commentId,
      body: JSON.stringify(options.comment.body),
    });

    const thread = this.threads.get(options.threadId);
    if (thread) {
      thread.comments = thread.comments.map((c: any) =>
        c.id === options.commentId
          ? { ...c, body: options.comment.body, updatedAt: new Date() }
          : c,
      );
      this.notifySubscribers();
    }
  }

  async deleteComment(options: {
    threadId: string;
    commentId: string;
  }): Promise<void> {
    this.mutations?.deleteComment({ commentId: options.commentId });

    const thread = this.threads.get(options.threadId);
    if (thread) {
      thread.comments = thread.comments.map((c: any) =>
        c.id === options.commentId
          ? { ...c, deletedAt: new Date(), body: undefined }
          : c,
      );
      this.notifySubscribers();
    }
  }

  async deleteThread(options: { threadId: string }): Promise<void> {
    this.mutations?.deleteThread({ threadId: options.threadId });
    this.threads.delete(options.threadId);
    this.notifySubscribers();
  }

  async resolveThread(options: { threadId: string }): Promise<void> {
    this.mutations?.resolveThread({ threadId: options.threadId });

    const thread = this.threads.get(options.threadId);
    if (thread) {
      thread.resolved = true;
      thread.resolvedBy = this.userId;
      thread.resolvedUpdatedAt = new Date();
      this.notifySubscribers();
    }
  }

  async unresolveThread(options: { threadId: string }): Promise<void> {
    this.mutations?.unresolveThread({ threadId: options.threadId });

    const thread = this.threads.get(options.threadId);
    if (thread) {
      thread.resolved = false;
      thread.resolvedBy = undefined;
      thread.resolvedUpdatedAt = undefined;
      this.notifySubscribers();
    }
  }

  async addReaction(options: {
    threadId: string;
    commentId: string;
    emoji: string;
  }): Promise<void> {
    this.mutations?.addReaction({
      commentId: options.commentId,
      emoji: options.emoji,
    });

    const thread = this.threads.get(options.threadId);
    if (thread) {
      thread.comments = thread.comments.map((c: any) => {
        if (c.id !== options.commentId) return c;
        const reactions = [...c.reactions];
        const existing = reactions.find((r: any) => r.emoji === options.emoji);
        if (existing) {
          if (!existing.userIds.includes(this.userId))
            existing.userIds.push(this.userId);
        } else {
          reactions.push({
            emoji: options.emoji,
            userIds: [this.userId],
            createdAt: new Date(),
          });
        }
        return { ...c, reactions };
      });
      this.notifySubscribers();
    }
  }

  async deleteReaction(options: {
    threadId: string;
    commentId: string;
    emoji: string;
  }): Promise<void> {
    this.mutations?.deleteReaction({
      commentId: options.commentId,
      emoji: options.emoji,
    });

    const thread = this.threads.get(options.threadId);
    if (thread) {
      thread.comments = thread.comments.map((c: any) => {
        if (c.id !== options.commentId) return c;
        const reactions = c.reactions
          .map((r: any) =>
            r.emoji === options.emoji
              ? { ...r, userIds: r.userIds.filter((id: string) => id !== this.userId) }
              : r,
          )
          .filter((r: any) => r.userIds.length > 0);
        return { ...c, reactions };
      });
      this.notifySubscribers();
    }
  }

  getThread(threadId: string): any {
    return this.threads.get(threadId);
  }

  getThreads(): Map<string, any> {
    return this.threads;
  }

  subscribe(cb: (threads: Map<string, any>) => void): () => void {
    this.subscribers.push(cb);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== cb);
    };
  }
}
