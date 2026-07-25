"use client";

import * as React from "react";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { timeAgo } from "@/components/app/common";
import { Messages2, Send2, TickCircle, Trash, ArchiveTick } from "iconsax-reactjs";

export type CommentMember = {
  userId: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Highlight @mentions that match a known member name/email. */
function highlightMentions(content: string, members: CommentMember[]): React.ReactNode {
  const names = members
    .map((m) => m.name || m.email || "")
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!names.length) return content;
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp("@(" + escaped.join("|") + ")", "g");
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) parts.push(content.slice(last, m.index));
    parts.push(
      <span
        key={m.index}
        className="rounded bg-[var(--flux-coral-soft)] px-1 font-medium text-primary"
      >
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < content.length) parts.push(content.slice(last));
  return parts;
}

export function DocumentComments({
  documentId,
  members,
  meId,
}: {
  documentId: Id<"flux_documents">;
  members: CommentMember[];
  meId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const comments = useQuery(api.flux_comments.listForDocument, { documentId });
  const add = useMutation(api.flux_comments.add);
  const setResolved = useMutation(api.flux_comments.setResolved);
  const remove = useMutation(api.flux_comments.remove);

  const openCount = (comments ?? []).filter((c: any) => !c.resolved).length;
  const list = (comments ?? []).filter((c: any) =>
    tab === "open" ? !c.resolved : c.resolved,
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
          data-testid="doc-comments-btn"
          title="Comments"
        >
          <Messages2 variant="Bulk" size={18} />
          {openCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
              data-testid="doc-comments-count"
            >
              {openCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-md"
        data-testid="comments-panel"
      >
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Messages2 variant="Bulk" size={18} className="text-primary" /> Comments
          </SheetTitle>
          <SheetDescription className="sr-only">
            Discuss this document with your team. Mention people with @.
          </SheetDescription>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border px-4 py-2">
          {(["open", "resolved"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              data-testid={`comments-tab-${t}`}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
                tab === t
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              {t}
              {t === "open" && openCount > 0 ? ` · ${openCount}` : ""}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-3" data-testid="comments-list">
          {comments === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground"
              data-testid="comments-empty"
            >
              <Messages2 variant="Bulk" size={40} className="mb-2 opacity-40" />
              {tab === "open"
                ? "No comments yet. Start the conversation."
                : "No resolved comments."}
            </div>
          ) : (
            <ul className="space-y-4">
              {list.map((c: any) => {
                const isAuthor = String(c.userId) === String(meId);
                return (
                  <li key={c._id} className="group" data-testid="comment-item">
                    <div className="flex items-start gap-2.5">
                      <Avatar size="sm" className="mt-0.5">
                        {c.author?.image ? <AvatarImage src={c.author.image} alt="" /> : null}
                        <AvatarFallback className="text-[10px]">
                          {initials(c.author?.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">
                            {c.author?.name ?? "Member"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {timeAgo(c.createdAt)}
                          </span>
                          {c.resolved && (
                            <span className="rounded-full bg-[var(--flux-coral-soft)] px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              Resolved
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">
                          {highlightMentions(c.content, members)}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-xs opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() =>
                              setResolved({ commentId: c._id, resolved: !c.resolved })
                            }
                            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                            data-testid="comment-resolve"
                          >
                            {c.resolved ? (
                              <>
                                <TickCircle variant="Bulk" size={14} /> Reopen
                              </>
                            ) : (
                              <>
                                <ArchiveTick variant="Bulk" size={14} /> Resolve
                              </>
                            )}
                          </button>
                          {isAuthor && (
                            <button
                              onClick={() => remove({ commentId: c._id })}
                              className="flex items-center gap-1 text-muted-foreground hover:text-destructive"
                              data-testid="comment-delete"
                            >
                              <Trash variant="Bulk" size={14} /> Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Composer */}
        <Composer
          members={members}
          onSubmit={async (content, mentionedUserIds) => {
            try {
              await add({
                documentId,
                content,
                mentionedUserIds: mentionedUserIds as any,
              });
              setTab("open");
            } catch {
              toast.error("Could not post comment");
            }
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

function Composer({
  members,
  onSubmit,
}: {
  members: CommentMember[];
  onSubmit: (content: string, mentionedUserIds: string[]) => Promise<void> | void;
}) {
  const [value, setValue] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pickedRef = useRef<Record<string, string>>({});
  const taRef = useRef<HTMLTextAreaElement>(null);

  const matches = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return members
      .filter((m) => (m.name || m.email || "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, members]);

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setValue(v);
    const caret = e.target.selectionStart ?? v.length;
    const before = v.slice(0, caret);
    const match = before.match(/@([\p{L}\w'’.\- ]*)$/u);
    // Only treat as an active mention query if the token is short (no newline).
    setQuery(match && !match[1].includes("\n") ? match[1].trimStart() : null);
  };

  const pick = (m: CommentMember) => {
    const name = m.name || m.email || "Member";
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? value.length;
    const before = value.slice(0, caret).replace(/@([\p{L}\w'’.\- ]*)$/u, "@" + name + " ");
    const after = value.slice(caret);
    const next = before + after;
    setValue(next);
    pickedRef.current[m.userId] = name;
    setQuery(null);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = before.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const submit = async () => {
    const content = value.trim();
    if (!content) return;
    const mentioned = Object.entries(pickedRef.current)
      .filter(([, name]) => content.includes("@" + name))
      .map(([uid]) => uid);
    setBusy(true);
    try {
      await onSubmit(content, mentioned);
      setValue("");
      pickedRef.current = {};
      setQuery(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative border-t border-border p-3">
      {matches.length > 0 && (
        <div
          className="absolute bottom-full left-3 right-3 mb-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg"
          data-testid="mention-dropdown"
        >
          {matches.map((m) => (
            <button
              key={m.userId}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(m);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
              data-testid="mention-option"
            >
              <Avatar size="sm">
                {m.image ? <AvatarImage src={m.image} alt="" /> : null}
                <AvatarFallback className="text-[10px]">
                  {initials(m.name || m.email)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{m.name ?? m.email}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={taRef}
          value={value}
          onChange={onChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder="Add a comment… use @ to mention"
          data-testid="comment-input"
          className="flex-1 resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={submit}
          disabled={busy || !value.trim()}
          data-testid="comment-submit"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          title="Send (⌘/Ctrl + Enter)"
        >
          <Send2 variant="Bulk" size={18} />
        </button>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Press ⌘/Ctrl + Enter to send
      </p>
    </div>
  );
}

export default DocumentComments;
