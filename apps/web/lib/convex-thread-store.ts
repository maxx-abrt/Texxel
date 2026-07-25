"use client";

import { DefaultThreadStoreAuth, ThreadStore, type CommentBody, type CommentData, type ThreadData } from "@blocknote/core/comments";

type ServerComment = Omit<CommentData, "createdAt" | "updatedAt" | "deletedAt" | "reactions"> & {
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  reactions: Array<{ emoji: string; createdAt: number; userIds: string[] }>;
};

type ServerThread = Omit<ThreadData, "createdAt" | "updatedAt" | "deletedAt" | "resolvedUpdatedAt" | "comments"> & {
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  resolvedUpdatedAt?: number;
  comments: ServerComment[];
  anchor?: { from?: number; to?: number; referenceText?: string; updatedAt?: number };
};

type Mutations = {
  createThread: (args: any) => Promise<any>;
  addComment: (args: any) => Promise<any>;
  updateComment: (args: any) => Promise<any>;
  deleteComment: (args: any) => Promise<any>;
  deleteThread: (args: any) => Promise<any>;
  setResolved: (args: any) => Promise<any>;
  setReaction: (args: any) => Promise<any>;
};

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function toThread(row: ServerThread): ThreadData {
  return {
    type: "thread",
    id: row.id,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    deletedAt: row.deletedAt ? new Date(row.deletedAt) : undefined,
    resolved: row.resolved,
    resolvedBy: row.resolvedBy,
    resolvedUpdatedAt: row.resolvedUpdatedAt ? new Date(row.resolvedUpdatedAt) : undefined,
    metadata: { ...(row.metadata ?? {}), anchor: row.anchor },
    comments: row.comments.map((comment) => ({
      ...comment,
      type: "comment",
      createdAt: new Date(comment.createdAt),
      updatedAt: new Date(comment.updatedAt),
      deletedAt: comment.deletedAt ? new Date(comment.deletedAt) : undefined,
      reactions: comment.reactions.map((reaction) => ({
        ...reaction,
        createdAt: new Date(reaction.createdAt),
      })),
    })) as CommentData[],
  };
}

export class ConvexThreadStore extends ThreadStore {
  private threads = new Map<string, ThreadData>();
  private subscribers = new Set<(threads: Map<string, ThreadData>) => void>();

  constructor(
    private readonly userId: string,
    private readonly documentId: string,
    private readonly mutations: Mutations,
    role: "comment" | "editor",
  ) {
    super(new DefaultThreadStoreAuth(userId, role));
  }

  public addThreadToDocument = undefined;

  updateFromServer(rows: ServerThread[] | undefined) {
    if (!rows) return;
    this.threads = new Map(rows.filter((row) => !row.deletedAt).map((row) => [row.id, toThread(row)]));
    this.emit();
  }

  private emit() {
    const snapshot = new Map(this.threads);
    this.subscribers.forEach((subscriber) => subscriber(snapshot));
  }

  private setThread(thread: ThreadData) {
    this.threads.set(thread.id, thread);
    this.emit();
  }

  async createThread(options: { initialComment: { body: CommentBody; metadata?: any }; metadata?: any }) {
    if (!this.auth.canCreateThread()) throw new Error("Not authorized");
    const now = new Date();
    const threadId = makeId("thread");
    const commentId = makeId("comment");
    const comment: CommentData = {
      type: "comment",
      id: commentId,
      userId: this.userId,
      body: options.initialComment.body,
      metadata: options.initialComment.metadata ?? {},
      reactions: [],
      createdAt: now,
      updatedAt: now,
    };
    const thread: ThreadData = {
      type: "thread",
      id: threadId,
      createdAt: now,
      updatedAt: now,
      resolved: false,
      metadata: options.metadata ?? {},
      comments: [comment],
    };
    this.setThread(thread);
    try {
      await this.mutations.createThread({
        documentId: this.documentId,
        threadId,
        commentId,
        body: options.initialComment.body,
        metadata: options.metadata,
        commentMetadata: options.initialComment.metadata,
      });
      return thread;
    } catch (error) {
      this.threads.delete(threadId);
      this.emit();
      throw error;
    }
  }

  async addComment(options: { comment: { body: CommentBody; metadata?: any }; threadId: string }) {
    const thread = this.getThread(options.threadId);
    if (!this.auth.canAddComment(thread)) throw new Error("Not authorized");
    const now = new Date();
    const comment: CommentData = {
      type: "comment",
      id: makeId("comment"),
      userId: this.userId,
      body: options.comment.body,
      metadata: options.comment.metadata ?? {},
      reactions: [],
      createdAt: now,
      updatedAt: now,
    };
    this.setThread({ ...thread, comments: [...thread.comments, comment], updatedAt: now });
    await this.mutations.addComment({
      documentId: this.documentId,
      threadId: options.threadId,
      commentId: comment.id,
      body: options.comment.body,
      metadata: options.comment.metadata,
    });
    return comment;
  }

  async updateComment(options: { comment: { body: CommentBody; metadata?: any }; threadId: string; commentId: string }) {
    const thread = this.getThread(options.threadId);
    const comment = thread.comments.find((item) => item.id === options.commentId);
    if (!comment || !this.auth.canUpdateComment(comment)) throw new Error("Not authorized");
    const now = new Date();
    this.setThread({
      ...thread,
      updatedAt: now,
      comments: thread.comments.map((item) => item.id === options.commentId ? { ...item, body: options.comment.body, metadata: options.comment.metadata ?? {}, updatedAt: now } as CommentData : item),
    });
    await this.mutations.updateComment({ documentId: this.documentId, ...options });
  }

  async deleteComment(options: { threadId: string; commentId: string }) {
    const thread = this.getThread(options.threadId);
    const comment = thread.comments.find((item) => item.id === options.commentId);
    if (!comment || !this.auth.canDeleteComment(comment)) throw new Error("Not authorized");
    const now = new Date();
    this.setThread({
      ...thread,
      updatedAt: now,
      comments: thread.comments.map((item) => item.id === options.commentId ? { ...item, body: undefined, deletedAt: now, updatedAt: now } as CommentData : item),
    });
    await this.mutations.deleteComment({ documentId: this.documentId, ...options });
  }

  async deleteThread(options: { threadId: string }) {
    const thread = this.getThread(options.threadId);
    if (!this.auth.canDeleteThread(thread)) throw new Error("Not authorized");
    this.threads.delete(options.threadId);
    this.emit();
    await this.mutations.deleteThread({ documentId: this.documentId, ...options });
  }

  async resolveThread(options: { threadId: string }) {
    const thread = this.getThread(options.threadId);
    if (!this.auth.canResolveThread(thread)) throw new Error("Not authorized");
    const now = new Date();
    this.setThread({ ...thread, resolved: true, resolvedBy: this.userId, resolvedUpdatedAt: now, updatedAt: now });
    await this.mutations.setResolved({ documentId: this.documentId, threadId: options.threadId, resolved: true });
  }

  async unresolveThread(options: { threadId: string }) {
    const thread = this.getThread(options.threadId);
    if (!this.auth.canUnresolveThread(thread)) throw new Error("Not authorized");
    const now = new Date();
    this.setThread({ ...thread, resolved: false, resolvedBy: this.userId, resolvedUpdatedAt: now, updatedAt: now });
    await this.mutations.setResolved({ documentId: this.documentId, threadId: options.threadId, resolved: false });
  }

  async addReaction(options: { threadId: string; commentId: string; emoji: string }) {
    const thread = this.getThread(options.threadId);
    const comment = thread.comments.find((item) => item.id === options.commentId);
    if (!comment || !this.auth.canAddReaction(comment, options.emoji)) throw new Error("Not authorized");
    await this.mutations.setReaction({ documentId: this.documentId, ...options, active: true });
  }

  async deleteReaction(options: { threadId: string; commentId: string; emoji: string }) {
    const thread = this.getThread(options.threadId);
    const comment = thread.comments.find((item) => item.id === options.commentId);
    if (!comment || !this.auth.canDeleteReaction(comment, options.emoji)) throw new Error("Not authorized");
    await this.mutations.setReaction({ documentId: this.documentId, ...options, active: false });
  }

  getThread(threadId: string) {
    const thread = this.threads.get(threadId);
    if (!thread) throw new Error("Thread not found");
    return thread;
  }

  getThreads() {
    return new Map(this.threads);
  }

  subscribe(callback: (threads: Map<string, ThreadData>) => void) {
    this.subscribers.add(callback);
    callback(this.getThreads());
    return () => this.subscribers.delete(callback);
  }
}
