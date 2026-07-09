"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useMutation, useQuery, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useLocale } from "@/components/providers/locale-provider";
import {
  BlockNoteSchema,
  defaultInlineContentSpecs,
  type PartialBlock,
} from "@blocknote/core";
import { CommentsExtension } from "@blocknote/core/comments";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import * as locales from "@blocknote/core/locales";
import {
  BlockNoteViewEditor,
  FloatingComposerController,
  ThreadsSidebar,
  useCreateBlockNote,
  createReactInlineContentSpec,
  SuggestionMenuController,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { ConvexThreadStore } from "@/lib/convex-thread-store";
import { cn } from "@/lib/utils";
import { MessageText1 } from "iconsax-reactjs";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

export type Mentionable = { id: string; label: string; kind: "user" | "task" | "project"; userId?: string; image?: string };

const Mention = createReactInlineContentSpec(
  {
    type: "mention",
    propSchema: {
      id: { default: "" },
      label: { default: "" },
      kind: { default: "user" },
    },
    content: "none",
  },
  {
    render: (props) => {
      const kind = props.inlineContent.props.kind;
      const color = kind === "task" ? "#2f7ea6" : kind === "project" ? "#7c5cff" : "var(--flux-coral)";
      return (
        <span
          className="mention-chip"
          style={{
            backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)`,
            color,
            padding: "1px 6px",
            borderRadius: "6px",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
          data-mention-kind={kind}
          data-mention-id={props.inlineContent.props.id}
        >
          {kind === "task" ? "#" : "@"}{props.inlineContent.props.label}
        </span>
      );
    },
  },
);

export const fluxEditorSchema = BlockNoteSchema.create({
  inlineContentSpecs: { ...defaultInlineContentSpecs, mention: Mention },
});

export function extractMentionUserIds(doc: any[]): string[] {
  const ids: string[] = [];
  const walk = (blocks: any[]) => {
    for (const block of blocks ?? []) {
      if (Array.isArray(block.content)) {
        for (const item of block.content) {
          if (item?.type === "mention" && item?.props?.kind === "user" && item?.props?.id) ids.push(item.props.id);
        }
      }
      if (block.children) walk(block.children);
    }
  };
  walk(doc);
  return Array.from(new Set(ids));
}

function scanAnchors(editor: any) {
  const doc = editor?._tiptapEditor?.state?.doc;
  if (!doc) return [];
  const anchors = new Map<string, { threadId: string; from: number; to: number; referenceText: string }>();
  doc.descendants((node: any, pos: number) => {
    for (const mark of node.marks ?? []) {
      if (mark.type?.name !== "comment" || !mark.attrs?.threadId) continue;
      const threadId = String(mark.attrs.threadId);
      const from = pos;
      const to = pos + node.nodeSize;
      const current = anchors.get(threadId);
      anchors.set(threadId, {
        threadId,
        from: Math.min(current?.from ?? from, from),
        to: Math.max(current?.to ?? to, to),
        referenceText: "",
      });
    }
  });
  return Array.from(anchors.values()).map((anchor) => ({
    ...anchor,
    referenceText: doc.textBetween(anchor.from, anchor.to, " ").slice(0, 500),
  }));
}

function rehydrateAnchors(editor: any, rows: any[]) {
  const tiptap = editor?._tiptapEditor;
  const state = tiptap?.state;
  const commentMark = state?.schema?.marks?.comment;
  if (!state || !commentMark) return;
  const existing = new Set<string>();
  state.doc.descendants((node: any) => {
    for (const mark of node.marks ?? []) if (mark.type?.name === "comment" && mark.attrs?.threadId) existing.add(String(mark.attrs.threadId));
  });
  const tr = state.tr;
  let changed = false;
  for (const row of rows ?? []) {
    const from = row?.anchor?.from;
    const to = row?.anchor?.to;
    if (existing.has(row.id) || typeof from !== "number" || typeof to !== "number") continue;
    const safeFrom = Math.max(1, Math.min(Math.floor(from), tr.doc.content.size - 1));
    const safeTo = Math.max(safeFrom + 1, Math.min(Math.floor(to), tr.doc.content.size));
    if (safeTo <= safeFrom) continue;
    tr.addMark(safeFrom, safeTo, commentMark.create({ threadId: row.id, orphan: !!row.resolved }));
    changed = true;
  }
  if (changed) tiptap.view.dispatch(tr);
}

function useDocumentFont(font?: any) {
  useEffect(() => {
    if (!font) return;
    if (font.sourceType === "google" && font.cssUrl) {
      const id = `texxel-google-font-${font._id}`;
      if (document.getElementById(id)) return;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = font.cssUrl;
      document.head.appendChild(link);
      return;
    }
    if (font.sourceType === "upload" && font.fileUrl) {
      const face = new FontFace(font.family, `url(${JSON.stringify(font.fileUrl)})`, {
        weight: String(font.weight ?? 400),
        style: font.style ?? "normal",
      });
      face.load().then((loaded) => document.fonts.add(loaded)).catch(() => undefined);
    }
  }, [font]);
}

interface FluxEditorProps {
  documentId?: Id<"flux_documents">;
  userId?: string;
  commentRole?: "comment" | "editor";
  commentsOpen?: boolean;
  onCommentsOpenChange?: (open: boolean) => void;
  initialContent?: string;
  editable?: boolean;
  onChange?: (content: string) => void;
  onMentions?: (userIds: string[]) => void;
  mentionables?: Mentionable[];
  onEditorReady?: (editor: any) => void;
  documentStyle?: any;
  selectedFont?: any;
}

export function FluxEditor({
  documentId,
  userId,
  commentRole = "comment",
  commentsOpen = false,
  onCommentsOpenChange,
  initialContent,
  editable = true,
  onChange,
  onMentions,
  mentionables = [],
  onEditorReady,
  documentStyle,
  selectedFont,
}: FluxEditorProps) {
  const { resolvedTheme } = useTheme();
  const { locale } = useLocale();
  const convex = useConvex();
  const generateUploadUrl = useMutation(api.flux_files.generateUploadUrl);
  const createThread = useMutation(api.flux_commentThreads.createThread);
  const addComment = useMutation(api.flux_commentThreads.addComment);
  const updateComment = useMutation(api.flux_commentThreads.updateComment);
  const deleteComment = useMutation(api.flux_commentThreads.deleteComment);
  const deleteThread = useMutation(api.flux_commentThreads.deleteThread);
  const setResolved = useMutation(api.flux_commentThreads.setResolved);
  const setReaction = useMutation(api.flux_commentThreads.setReaction);
  const syncAnchors = useMutation(api.flux_commentThreads.syncAnchors);
  const threadRows = useQuery(api.flux_commentThreads.listForDocument, documentId ? { documentId } : "skip");
  const [commentFilter, setCommentFilter] = useState<"open" | "resolved" | "all">("open");
  const [commentSort, setCommentSort] = useState<"position" | "recent-activity" | "oldest">("position");
  const anchorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useDocumentFont(selectedFont);

  const parsed = useMemo<PartialBlock[] | undefined>(() => {
    if (!initialContent) return undefined;
    try {
      const value = JSON.parse(initialContent);
      return Array.isArray(value) && value.length ? value : undefined;
    } catch {
      return undefined;
    }
  }, [initialContent]);

  const dictionary = (locales as any)[locale] ?? (locales as any).en;
  const members = useMemo(() => mentionables.filter((item) => item.kind === "user"), [mentionables]);
  const threadStore = useMemo(() => {
    if (!documentId || !userId) return null;
    return new ConvexThreadStore(userId, documentId, {
      createThread,
      addComment,
      updateComment,
      deleteComment,
      deleteThread,
      setResolved,
      setReaction,
    }, commentRole);
  }, [documentId, userId, commentRole, createThread, addComment, updateComment, deleteComment, deleteThread, setResolved, setReaction]);

  const resolveUsers = useCallback(async (ids: string[]) => ids.map((id) => {
    const member = members.find((item) => String(item.id) === String(id) || String(item.userId) === String(id));
    return { id, username: member?.label ?? "Workspace member", avatarUrl: member?.image ?? "" };
  }), [members]);

  const editor = useCreateBlockNote({
    schema: fluxEditorSchema,
    initialContent: parsed,
    dictionary,
    extensions: threadStore ? [CommentsExtension({ threadStore, resolveUsers })] : [],
    uploadFile: async (file: File) => {
      const url = await generateUploadUrl();
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      if (!response.ok) throw new Error("Upload failed");
      const { storageId } = await response.json();
      const publicUrl = await convex.query(api.flux_files.getUrl, { storageId });
      if (!publicUrl) throw new Error("Could not resolve uploaded file");
      return publicUrl;
    },
  }, [threadStore]);

  useEffect(() => threadStore?.updateFromServer(threadRows as any), [threadRows, threadStore]);
  useEffect(() => {
    if (!threadRows?.length) return;
    const id = window.setTimeout(() => rehydrateAnchors(editor, threadRows as any[]), 80);
    return () => window.clearTimeout(id);
  }, [editor, threadRows]);

  const readyRef = useRef(onEditorReady);
  readyRef.current = onEditorReady;
  useEffect(() => readyRef.current?.(editor), [editor]);

  const handleChange = useCallback(() => {
    onChange?.(JSON.stringify(editor.document));
    onMentions?.(extractMentionUserIds(editor.document as any[]));
    if (documentId && threadStore) {
      if (anchorTimer.current) clearTimeout(anchorTimer.current);
      anchorTimer.current = setTimeout(() => {
        const anchors = scanAnchors(editor);
        if (anchors.length) syncAnchors({ documentId, anchors }).catch(() => undefined);
      }, 700);
    }
  }, [editor, onChange, onMentions, documentId, threadStore, syncAnchors]);

  const fontFamily = documentStyle?.fontFamily || selectedFont?.family || "Plus Jakarta Sans";
  const fontSize = documentStyle?.fontSize ?? 16;
  const lineHeight = documentStyle?.lineHeight ?? 1.65;
  const openCount = (threadRows ?? []).filter((row: any) => !row.resolved && !row.deletedAt).length;

  return (
    <div
      className="flux-editor relative"
      style={{ "--doc-font-family": `"${fontFamily}", var(--font-sans)`, "--doc-font-size": `${fontSize}px`, "--doc-line-height": lineHeight } as React.CSSProperties}
      data-testid="flux-editor"
    >
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        onChange={handleChange}
        renderEditor={false}
        comments={false}
      >
        <BlockNoteViewEditor />
        {editable && (
          <SuggestionMenuController
            triggerCharacter="@"
            getItems={async (query) => filterSuggestionItems(mentionables.map((item) => ({
              title: item.label,
              subtext: item.kind,
              onItemClick: () => editor.insertInlineContent([
                { type: "mention", props: { id: item.id, label: item.label, kind: item.kind } } as any,
                " ",
              ]),
            })), query)}
          />
        )}
        {threadStore && editable && <FloatingComposerController />}

        {commentsOpen && threadStore && (
          <>
            <button
              type="button"
              aria-label="Close comments"
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] lg:hidden"
              onClick={() => onCommentsOpenChange?.(false)}
              data-testid="comments-backdrop"
            />
            <aside className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-background shadow-2xl sm:w-[390px] lg:top-[49px] lg:z-30 lg:w-[360px] lg:shadow-[-12px_0_35px_rgba(49,48,46,0.08)]" data-testid="comments-sidebar">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--flux-coral-soft)] text-primary"><MessageText1 variant="Bulk" size={18} /></span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold">Comments</h2>
                  <p className="text-xs text-muted-foreground">{openCount ? `${openCount} open thread${openCount === 1 ? "" : "s"}` : "All caught up"}</p>
                </div>
                <button type="button" onClick={() => onCommentsOpenChange?.(false)} className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" data-testid="comments-close">Close</button>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
                <div className="flex rounded-lg bg-muted p-0.5">
                  {(["open", "resolved", "all"] as const).map((filter) => (
                    <button key={filter} type="button" onClick={() => setCommentFilter(filter)} className={cn("rounded-md px-2.5 py-1 text-xs font-medium capitalize", commentFilter === filter ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")} data-testid={`comments-filter-${filter}`}>{filter}</button>
                  ))}
                </div>
                <select value={commentSort} onChange={(event) => setCommentSort(event.target.value as any)} className="ml-auto h-8 rounded-lg border border-border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-ring" data-testid="comments-sort">
                  <option value="position">By position</option>
                  <option value="recent-activity">Recent</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 [&_.bn-threads-sidebar]:max-w-full! [&_.bn-thread]:rounded-xl! [&_.bn-thread]:border! [&_.bn-thread]:border-border! [&_.bn-thread]:bg-card! [&_.bn-thread]:shadow-none!">
                <ThreadsSidebar filter={commentFilter} sort={commentSort} maxCommentsBeforeCollapse={4} />
              </div>
              <div className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">Select text, then choose Comment in the formatting toolbar. Type @name to notify teammates.</div>
            </aside>
          </>
        )}
      </BlockNoteView>
    </div>
  );
}

export default FluxEditor;
