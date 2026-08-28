"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { timeAgo } from "@/components/app/common";
import { useActiveDocumentId } from "./use-active-document";
import { Messages2, Send2, Trash, ArchiveTick } from "iconsax-reactjs";

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/**
 * Comments widget (§3): shows open comment threads for the currently-open
 * document, reusing `flux_comments.listForDocument` + `add`/`setResolved`/
 * `remove` mutations (same data layer as `DocumentComments`). When no
 * document is open, renders a designed empty state. The current-entity
 * context is derived from the route via `useActiveDocumentId` until a later
 * milestone wires a dedicated entity context.
 */
export function CommentsWidget() {
  const t = useTranslations("comments");
  const tWidget = useTranslations("widgets");
  const { me } = useWorkspace();
  const documentId = useActiveDocumentId();

  const comments = useQuery(
    api.flux_comments.listForDocument,
    documentId ? { documentId } : "skip",
  );
  const add = useMutation(api.flux_comments.add);
  const setResolved = useMutation(api.flux_comments.setResolved);
  const remove = useMutation(api.flux_comments.remove);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const meId = me?._id ?? null;
  const open = (comments ?? []).filter((c: any) => !c.resolved);

  const submit = async () => {
    const content = value.trim();
    if (!content || !documentId || busy) return;
    setBusy(true);
    try {
      await add({ documentId, content, mentionedUserIds: [] as any });
      setValue("");
    } catch {
      toast.error(t("postFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (!documentId) {
    return (
      <div
        data-testid="widget-comments-empty"
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center"
      >
        <Messages2 variant="Bulk" size={32} className="opacity-40 text-muted-foreground" />
        <p className="text-sm font-medium">{tWidget("commentsNoDoc")}</p>
        <p className="text-xs text-muted-foreground">{tWidget("commentsNoDocHint")}</p>
      </div>
    );
  }

  if (comments === undefined) {
    return (
      <div data-testid="widget-comments" className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div data-testid="widget-comments" className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {open.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
            <Messages2 variant="Bulk" size={32} className="mb-2 opacity-40" />
            {t("noOpen")}
          </div>
        ) : (
          <ul className="space-y-3">
            {open.map((c: any) => {
              const isAuthor = String(c.userId) === String(meId);
              return (
                <li key={c._id} data-testid="widget-comments-item" className="group">
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
                          {c.author?.name ?? t("member")}
                        </span>
                        <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap wrap-break-word text-sm">
                        {c.content}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-xs opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() =>
                            setResolved({ commentId: c._id, resolved: !c.resolved })
                          }
                          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                          data-testid="widget-comments-resolve"
                        >
                          <ArchiveTick variant="Bulk" size={14} /> {t("resolve")}
                        </button>
                        {isAuthor && (
                          <button
                            onClick={() => remove({ commentId: c._id })}
                            className="flex items-center gap-1 text-muted-foreground hover:text-destructive"
                            data-testid="widget-comments-delete"
                          >
                            <Trash variant="Bulk" size={14} /> {t("delete")}
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
      <div className="flex items-end gap-2 border-t border-sidebar-border p-3">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder={t("addPlaceholder")}
          data-testid="widget-comments-input"
          className="flex-1 resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={submit}
          disabled={busy || !value.trim()}
          data-testid="widget-comments-submit"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          title={t("sendTitle")}
        >
          <Send2 variant="Bulk" size={18} />
        </button>
      </div>
    </div>
  );
}
