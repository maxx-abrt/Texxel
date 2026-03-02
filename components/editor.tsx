"use client";

import {
  BlockNoteSchema,
  defaultInlineContentSpecs,
  PartialBlock,
} from "@blocknote/core";
import * as locales from "@blocknote/core/locales";
import { CommentsExtension } from "@blocknote/core/comments";
import {
  useCreateBlockNote,
  SuggestionMenuController,
  createReactInlineContentSpec,
  ThreadsSidebar,
} from "@blocknote/react";
import { useCoverImage } from "@/hooks/useCoverImage";
import { BlockNoteView } from "@blocknote/mantine";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import { useEdgeStore } from "@/lib/edgestore";
import "@blocknote/core/style.css";
import "@blocknote/mantine/style.css";
import { useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ConvexThreadStore } from "@/lib/ConvexThreadStore";

export interface TeamMember {
  userId: string;
  userName: string;
  userEmail: string;
  userImage?: string;
}

interface EditorProps {
  documentId?: Id<"documents">;
  onChange: (value: string) => void;
  initialContent?: string;
  editable?: boolean;
  onEditorReady?: (editor: any) => void;
  teamMembers?: TeamMember[];
  showCommentsSidebar?: boolean;
  onCommentsSidebarClose?: () => void;
  commentsSidebarContainer?: HTMLElement | null;
  userId?: string;
}

const MentionSpec = createReactInlineContentSpec(
  {
    type: "mention" as const,
    propSchema: {
      user: { default: "" },
      userId: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ inlineContent }) => (
      <span
        className="inline-flex items-center rounded bg-primary/10 px-1 py-0.5 text-primary text-[0.85em] font-medium cursor-default"
        data-user-id={inlineContent.props.userId}
      >
        @{inlineContent.props.user}
      </span>
    ),
  },
);

const editorSchema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    mention: MentionSpec,
  },
});

function safeParseBlocks(raw?: string): PartialBlock[] | undefined {
  if (!raw || !raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return undefined;
    const valid = parsed.every(
      (b: any) => b && typeof b === "object" && typeof b.type === "string",
    );
    return valid ? (parsed as PartialBlock[]) : undefined;
  } catch {
    return undefined;
  }
}

const Editor = ({
  documentId,
  onChange,
  initialContent,
  editable,
  onEditorReady,
  teamMembers = [],
  showCommentsSidebar,
  onCommentsSidebarClose,
  commentsSidebarContainer,
  userId = "anonymous",
}: EditorProps) => {
  const { resolvedTheme } = useTheme();
  const { edgestore } = useEdgeStore();
  const coverImage = useCoverImage();
  const contentLoadedRef = useRef(false);
  const teamMembersRef = useRef(teamMembers);
  teamMembersRef.current = teamMembers;
  const locale = useLocale();
  const t = useTranslations("editor");

  const dictionary = useMemo(
    () => locales[locale as keyof typeof locales] ?? locales.en,
    [locale],
  );

  // Convex thread data (only when documentId is provided)
  const threadData = useQuery(
    api.comments.getDocumentThreads,
    documentId ? { documentId } : "skip",
  );

  // Convex mutations for thread operations
  const createThreadMutation = useMutation(api.comments.createThread);
  const addCommentMutation = useMutation(api.comments.addComment);
  const updateCommentMutation = useMutation(api.comments.updateComment);
  const deleteCommentMutation = useMutation(api.comments.deleteComment);
  const deleteThreadMutation = useMutation(api.comments.deleteThread);
  const resolveThreadMutation = useMutation(api.comments.resolveThread);
  const unresolveThreadMutation = useMutation(api.comments.unresolveThread);
  const addReactionMutation = useMutation(api.comments.addReaction);
  const deleteReactionMutation = useMutation(api.comments.deleteReaction);

  // Stable ConvexThreadStore — created once per documentId+userId
  const threadStore = useMemo(
    () => new ConvexThreadStore(userId, documentId ?? "unknown"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, documentId],
  );

  // Wire up mutations after store is created (stable refs from useMutation)
  useEffect(() => {
    threadStore.mutations = {
      createThread: (args) => createThreadMutation(args as any),
      addComment: (args) => addCommentMutation(args as any),
      updateComment: (args) => updateCommentMutation(args),
      deleteComment: (args) => deleteCommentMutation(args),
      deleteThread: (args) => deleteThreadMutation(args),
      resolveThread: (args) => resolveThreadMutation(args),
      unresolveThread: (args) => unresolveThreadMutation(args),
      addReaction: (args) => addReactionMutation(args),
      deleteReaction: (args) => deleteReactionMutation(args),
    };
  }, [
    threadStore,
    createThreadMutation,
    addCommentMutation,
    updateCommentMutation,
    deleteCommentMutation,
    deleteThreadMutation,
    resolveThreadMutation,
    unresolveThreadMutation,
    addReactionMutation,
    deleteReactionMutation,
  ]);

  // Sync Convex thread data into the store
  useEffect(() => {
    if (threadData) {
      threadStore.updateFromConvexData(threadData.threads, threadData.comments);
    }
  }, [threadData, threadStore]);

  // Stable resolveUsers that always reads latest teamMembers via ref
  const resolveUsers = useCallback(async (userIds: string[]) => {
    return userIds.map((id) => {
      const member = teamMembersRef.current.find((m) => m.userId === id);
      return {
        id,
        username: member?.userName ?? id.slice(0, 8),
        avatarUrl: member?.userImage ?? "",
      };
    });
  }, []); // empty deps — reads from ref

  const handleUpload = async (file: File) => {
    const res = await edgestore.publicFiles.upload({ file });
    return res.url;
  };

  const editor = useCreateBlockNote({
    schema: editorSchema,
    uploadFile: handleUpload,
    dictionary,
    extensions: documentId
      ? [
          CommentsExtension({
            threadStore,
            resolveUsers,
          }),
        ]
      : [],
  });

  useEffect(() => {
    if (contentLoadedRef.current) return;
    if (!initialContent) return;
    const blocks = safeParseBlocks(initialContent);
    if (!blocks) return;
    // Defer to avoid flushSync-inside-lifecycle (React constraint with ProseMirror)
    const id = setTimeout(() => {
      try {
        editor.replaceBlocks(editor.document, blocks);
        contentLoadedRef.current = true;
      } catch {
        // Graceful fallback
      }
    }, 0);
    return () => clearTimeout(id);
  }, [initialContent, editor]);

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
  }, [editor, onEditorReady]);

  const handleEditorChange = useCallback(() => {
    onChange(JSON.stringify(editor.document));
  }, [editor, onChange]);

  const handleCapture = (e: React.DragEvent) => {
    if (coverImage.isOpen) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div
      className="relative flex-1 shrink-0"
      onDropCapture={handleCapture}
      onDragOverCapture={handleCapture}
    >
      <BlockNoteView
        editable={editable !== false && !coverImage.isOpen}
        editor={editor}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        onChange={handleEditorChange}
        className="wrap-break-word"
      >
        <SuggestionMenuController
          triggerCharacter="@"
          getItems={async (query) => {
            const q = query.toLowerCase();
            return teamMembers
              .filter(
                (m) =>
                  m.userName.toLowerCase().includes(q) ||
                  m.userEmail.toLowerCase().includes(q),
              )
              .map((m) => ({
                title: m.userName,
                subtext: m.userEmail,
                onItemClick: () => {
                  (editor as any).insertInlineContent([
                    {
                      type: "mention",
                      props: { user: m.userName, userId: m.userId },
                    },
                    " ",
                  ]);
                },
              }));
          }}
        />
        {documentId && showCommentsSidebar && (
          commentsSidebarContainer
            ? createPortal(
                <div className="min-w-0 h-full overflow-x-hidden overflow-y-auto [&_.bn-thread-sidebar]:max-w-full! [&_.bn-thread-sidebar-item]:max-w-full! [&_.bn-thread]:max-w-full!">
                  <ThreadsSidebar filter="open" sort="position" />
                </div>,
                commentsSidebarContainer,
              )
            : <div className="fixed right-0 top-[41px] bottom-0 z-40 flex w-72 flex-col border-l bg-background">
                <div className="flex shrink-0 items-center justify-between border-b bg-background/95 px-3 py-2.5 backdrop-blur-sm">
                  <span className="text-sm font-semibold tracking-tight">{t("commentsTitle")}</span>
                  {onCommentsSidebarClose && (
                    <button
                      onClick={onCommentsSidebarClose}
                      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label="Close comments"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                </div>
                <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto [&_.bn-thread-sidebar]:max-w-full! [&_.bn-thread-sidebar-item]:max-w-full! [&_.bn-thread]:max-w-full!">
                  <ThreadsSidebar filter="open" sort="position" />
                </div>
              </div>
        )}
      </BlockNoteView>
    </div>
  );
};

export default Editor;
