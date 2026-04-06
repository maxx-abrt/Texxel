"use client";

import {
  BlockNoteSchema,
  defaultBlockSpecs,
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
  getDefaultReactSlashMenuItems,
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
import { ColorChipSpec, DateChipSpec, BadgeChipSpec, ProgressChipSpec, EventChipSpec, PlaceChipSpec, RefChipSpec, buildChipMenuItems, buildChipSlashMenuItems } from "@/components/chips";
import { ChartBlockSpec, buildChartSlashMenuItems } from "@/components/chart-block";
import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";

// BlockNote's hosted dev PartyKit server — no separate server needed
const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "blocknote-dev.yousefed.partykit.dev";

export interface TeamMember {
  userId: string;
  userName: string;
  userEmail: string;
  userImage?: string;
}

export interface CollabUser {
  name: string;
  color: string;
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
  /** When set, enables Yjs real-time collaboration for this room. */
  collabUser?: CollabUser;
  collabRoom?: string;
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
  blockSpecs: {
    ...defaultBlockSpecs,
    chart: ChartBlockSpec(),
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    mention: MentionSpec,
    colorChip: ColorChipSpec,
    dateChip: DateChipSpec,
    badgeChip: BadgeChipSpec,
    progressChip: ProgressChipSpec,
    eventChip: EventChipSpec,
    placeChip: PlaceChipSpec,
    refChip: RefChipSpec,
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
  collabUser,
  collabRoom,
}: EditorProps) => {
  const { resolvedTheme } = useTheme();
  const { edgestore } = useEdgeStore();
  const coverImage = useCoverImage();
  const contentLoadedRef = useRef(false);
  const teamMembersRef = useRef(teamMembers);
  teamMembersRef.current = teamMembers;
  const locale = useLocale();
  const t = useTranslations("editor");
  const tChips = useTranslations("chips");

  const dictionary = useMemo(
    () => locales[locale as keyof typeof locales] ?? locales.en,
    [locale],
  );

  // ── Yjs collaboration objects (created once per mount) ──────────────────
  const isCollab = Boolean(collabRoom && collabUser);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<YPartyKitProvider | null>(null);

  if (isCollab && !ydocRef.current) {
    ydocRef.current = new Y.Doc();
  }
  if (isCollab && ydocRef.current && !providerRef.current) {
    providerRef.current = new YPartyKitProvider(
      PARTYKIT_HOST,
      // prefix the room so it doesn't clash with other BlockNote apps using the same server
      `a2e-doc-${collabRoom}`,
      ydocRef.current,
      { connect: true },
    );
  }

  // Cleanup Yjs objects on unmount
  useEffect(() => {
    return () => {
      providerRef.current?.destroy();
      providerRef.current = null;
      ydocRef.current?.destroy();
      ydocRef.current = null;
    };
  }, []);

  // ── Convex comments ─────────────────────────────────────────────────────
  const threadData = useQuery(
    api.comments.getDocumentThreads,
    documentId ? { documentId } : "skip",
  );

  const createThreadMutation = useMutation(api.comments.createThread);
  const addCommentMutation = useMutation(api.comments.addComment);
  const updateCommentMutation = useMutation(api.comments.updateComment);
  const deleteCommentMutation = useMutation(api.comments.deleteComment);
  const deleteThreadMutation = useMutation(api.comments.deleteThread);
  const resolveThreadMutation = useMutation(api.comments.resolveThread);
  const unresolveThreadMutation = useMutation(api.comments.unresolveThread);
  const addReactionMutation = useMutation(api.comments.addReaction);
  const deleteReactionMutation = useMutation(api.comments.deleteReaction);

  const threadStore = useMemo(
    () => new ConvexThreadStore(userId, documentId ?? "unknown"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, documentId],
  );

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

  useEffect(() => {
    if (threadData) {
      threadStore.updateFromConvexData(threadData.threads, threadData.comments);
    }
  }, [threadData, threadStore]);

  const resolveUsers = useCallback(async (userIds: string[]) => {
    return userIds.map((id) => {
      const member = teamMembersRef.current.find((m) => m.userId === id);
      return {
        id,
        username: member?.userName ?? id.slice(0, 8),
        avatarUrl: member?.userImage ?? "",
      };
    });
  }, []);

  const handleUpload = async (file: File) => {
    const res = await edgestore.publicFiles.upload({ file });
    return res.url;
  };

  // ── Build useCreateBlockNote options ────────────────────────────────────
  const collabOptions = isCollab && ydocRef.current && providerRef.current && collabUser
    ? {
        provider: providerRef.current,
        fragment: ydocRef.current.getXmlFragment("document-store"),
        user: collabUser,
      }
    : undefined;

  const editor = useCreateBlockNote({
    schema: editorSchema,
    uploadFile: handleUpload,
    dictionary,
    extensions: documentId
      ? [CommentsExtension({ threadStore, resolveUsers })]
      : [],
    // When collaboration is active, Yjs manages the document
    ...(collabOptions ? { collaboration: collabOptions } : {}),
  });

  // ── Seed Yjs doc with Convex content when the room is empty ────────────
  useEffect(() => {
    if (!isCollab || !providerRef.current || !ydocRef.current) return;
    if (!initialContent) return;

    const provider = providerRef.current;
    const ydoc = ydocRef.current;
    let seeded = false;

    const trySeed = () => {
      if (seeded) return;
      const fragment = ydoc.getXmlFragment("document-store");
      // Only seed if the Yjs shared state is genuinely empty (first user in the room)
      if (fragment.length === 0) {
        const blocks = safeParseBlocks(initialContent);
        if (blocks && blocks.length > 0) {
          seeded = true;
          // Small delay to let BlockNote finish its own Yjs init
          setTimeout(() => {
            try { editor.replaceBlocks(editor.document, blocks); } catch {}
          }, 80);
        }
      } else {
        seeded = true; // room already has content — skip seeding
      }
    };

    const handleSync = (synced: boolean) => { if (synced) trySeed(); };
    provider.on("sync", handleSync);

    // If provider already synced before this effect ran, call trySeed immediately
    if ((provider as any).synced) trySeed();

    return () => { provider.off("sync", handleSync); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCollab, editor]);

  // ── Non-collaborative: load initial content once ────────────────────────
  useEffect(() => {
    if (isCollab) return; // Yjs handles content
    if (contentLoadedRef.current) return;
    if (!initialContent) return;
    const blocks = safeParseBlocks(initialContent);
    if (!blocks) return;
    const id = setTimeout(() => {
      try {
        editor.replaceBlocks(editor.document, blocks);
        contentLoadedRef.current = true;
      } catch {}
    }, 0);
    return () => clearTimeout(id);
  }, [initialContent, editor, isCollab]);

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

  const allSelectedRef = useRef(false);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "a") {
      allSelectedRef.current = true;
      return;
    }
    if (allSelectedRef.current && (e.key === "Delete" || e.key === "Backspace")) {
      e.preventDefault();
      e.stopPropagation();
      allSelectedRef.current = false;
      const empty = [{ type: "paragraph" as const, content: [] }];
      editor.replaceBlocks(editor.document, empty);
      setTimeout(() => {
        try { editor.setTextCursorPosition(editor.document[0], "start"); } catch {}
      }, 0);
      return;
    }
    allSelectedRef.current = false;
  }, [editor]);

  return (
    <div
      className="relative flex-1 shrink-0"
      onDropCapture={handleCapture}
      onDragOverCapture={handleCapture}
      onKeyDown={handleKeyDown}
    >
      <BlockNoteView
        editable={editable !== false && !coverImage.isOpen}
        editor={editor}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        onChange={handleEditorChange}
        className="wrap-break-word"
        slashMenu={false}
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
        {/* Primary / slash menu — default blocks + smart chips */}
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) => {
            const defaults = getDefaultReactSlashMenuItems(editor);
            const chartItems = buildChartSlashMenuItems(editor, (key) => {
              try { return tChips(key as any); } catch { return key; }
            });
            const chipItems = buildChipSlashMenuItems(editor, (key) => {
              try { return tChips(key as any); } catch { return key; }
            });
            const all = [...defaults, ...chartItems, ...chipItems];
            if (!query) return all;
            const q = query.toLowerCase();
            return all.filter(
              (item: any) =>
                item.title?.toLowerCase().includes(q) ||
                (item.aliases ?? []).some((a: string) => a.toLowerCase().includes(q)),
            );
          }}
        />
        {/* Smart chips — type ~ as secondary trigger */}
        <SuggestionMenuController
          triggerCharacter="~"
          getItems={async (query) => buildChipMenuItems(editor, query) as any[]}
        />
        {documentId && showCommentsSidebar && (
          commentsSidebarContainer
            ? createPortal(
                <div className="min-w-0 h-full overflow-x-hidden overflow-y-auto [&_.bn-threads-sidebar]:max-w-full! [&_.bn-thread]:max-w-full!">
                  <ThreadsSidebar filter="open" sort="position" />
                </div>,
                commentsSidebarContainer,
              )
            : <div className="fixed right-0 top-[41px] bottom-0 z-40 flex w-72 lg:w-80 flex-col border-l border-border/50 bg-background/98 backdrop-blur-sm shadow-[-1px_0_12px_0_rgba(0,0,0,.04)]">
                <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">{t("commentsTitle")}</span>
                  {onCommentsSidebarClose && (
                    <button
                      onClick={onCommentsSidebarClose}
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground/40 transition-all duration-200 ease-out hover:bg-foreground/[0.06] hover:text-foreground/70"
                      aria-label={t("commentsTitle")}
                    >
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                        <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                </div>
                <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto [&_.bn-threads-sidebar]:max-w-full! [&_.bn-thread]:max-w-full!">
                  <ThreadsSidebar filter="open" sort="position" />
                </div>
              </div>
        )}
      </BlockNoteView>
    </div>
  );
};

export default Editor;
