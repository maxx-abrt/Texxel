"use client";

import dynamic from "next/dynamic";
import { useMemo, use, useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MessageCircle, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Cover } from "@/components/cover";
import { Toolbar } from "@/components/toolbar";
import { Skeleton } from "@/components/ui/skeleton";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { TableOfContents } from "@/components/table-of-contents";
import { VersionHistoryPanel } from "@/components/version-history-panel";
import { AiAssistantPanel } from "@/components/ai-assistant";
import { useDocumentUI } from "@/hooks/useDocumentUI";
import { useExtensions } from "@/hooks/useExtensions";
import type { TeamMember, CollabUser } from "@/components/editor";

const EDITOR_WIDTH_CLASS: Record<string, string> = {
  default: "md:max-w-3xl lg:max-w-4xl",
  wide: "md:max-w-4xl lg:max-w-5xl",
  full: "max-w-full px-6",
};

function computeWordStats(editor: any): { words: number; chars: number; readingTime: number } {
  try {
    const getText = (blocks: any[]): string =>
      blocks.map((b) => {
        const inline = Array.isArray(b.content) ? b.content.map((i: any) => i.text ?? "").join("") : "";
        const children = Array.isArray(b.children) ? getText(b.children) : "";
        return [inline, children].filter(Boolean).join(" ");
      }).join(" ");
    const text = getText(editor.document ?? []);
    const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
    const chars = text.replace(/\s/g, "").length;
    return { words, chars, readingTime: Math.max(1, Math.ceil(words / 200)) };
  } catch {
    return { words: 0, chars: 0, readingTime: 0 };
  }
}

// Stable user presence colors (also used for Yjs cursors)
const PRESENCE_COLORS = [
  "#ef4444","#f97316","#eab308","#22c55e",
  "#06b6d4","#6366f1","#ec4899","#8b5cf6",
];

interface DocumentIdPageProps {
  params: Promise<{ documentId: Id<"documents"> }>;
}

const DocumentIdPage = ({ params }: DocumentIdPageProps) => {
  const { documentId } = use(params);
  const router = useRouter();
  const t = useTranslations("editor");
  const [editor, setEditor] = useState<any | null>(null);
  const [commentsSidebarEl, setCommentsSidebarEl] = useState<HTMLElement | null>(null);

  const { showComments, toggleComments, showVersionHistory, closeVersionHistory, setExportHandlers, focusMode } = useDocumentUI();
  const { getUIConfig, isEnabled: extEnabled } = useExtensions();
  const uiCfg = getUIConfig();
  const [showAi, setShowAi] = useState(false);
  const [wordCount, setWordCount] = useState({ words: 0, chars: 0, readingTime: 0 });
  const [wordCountExpanded, setWordCountExpanded] = useState(false);

  const Editor = useMemo(
    () => dynamic(() => import("@/components/editor"), { ssr: false }),
    [],
  );

  const document = useQuery(api.documents.getById, { documentId });
  const myProfile = useQuery(api.userProfiles.getMyProfile);
  const allTeamMembers = useQuery(api.teams.getAllMyTeamMembers);

  const teamMembers: TeamMember[] = useMemo(
    () =>
      (allTeamMembers ?? []).map((m: any) => ({
        userId: m.userId,
        userName: m.userName,
        userEmail: m.userEmail,
        userImage: m.userImage,
      })),
    [allTeamMembers],
  );

  const update = useMutation(api.documents.update);
  const saveVersion = useMutation(api.documents.saveVersion);
  const updatePresence = useMutation(api.documents.updatePresence);
  const removePresence = useMutation(api.documents.removePresence);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Stable color derived from userId — also used as Yjs cursor color
  const myColor = useMemo(() => {
    const id = myProfile?.userId ?? "";
    const idx = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return PRESENCE_COLORS[idx % PRESENCE_COLORS.length];
  }, [myProfile?.userId]);

  // collabUser drives both Yjs cursors and the Convex presence avatars
  const collabUser = useMemo<CollabUser | undefined>(() => {
    if (!myProfile) return undefined;
    return {
      name: myProfile.name ?? myProfile.email ?? "User",
      color: myColor,
    };
  }, [myProfile, myColor]);

  const onChange = useCallback(
    (content: string) => {
      clearTimeout(debounceRef.current);
      // Save to Convex every 800 ms (Yjs handles real-time; Convex is for persistence)
      debounceRef.current = setTimeout(() => {
        update({ id: documentId, content });
      }, 800);
      // Update word count on each change
      if (editor) setWordCount(computeWordStats(editor));
    },
    [update, documentId, editor],
  );

  // Register native BlockNote export handlers
  useEffect(() => {
    if (!editor || !document) return;
    const docTitle = document.title || "Untitled";

    const handlePdf = async () => {
      const tid = toast.loading(t("pdfGenerate"));
      try {
        const [{ PDFExporter, pdfDefaultSchemaMappings }, { pdf }] = await Promise.all([
          import("@blocknote/xl-pdf-exporter"),
          import("@react-pdf/renderer"),
        ]);
        const exporter = new PDFExporter(editor.schema as any, pdfDefaultSchemaMappings as any);
        const pdfDoc = await exporter.toReactPDFDocument(editor.document);
        const blob = await pdf(pdfDoc).toBlob();
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement("a");
        a.href = url; a.download = `${docTitle}.pdf`; a.click();
        URL.revokeObjectURL(url);
        toast.success(t("pdfSuccess"), { id: tid });
      } catch (err: any) {
        toast.error(t("pdfFailed"), { id: tid });
      }
    };

    const handleDocx = async () => {
      const tid = toast.loading(t("docxGenerate"));
      try {
        const [{ DOCXExporter, docxDefaultSchemaMappings }, { Packer }] = await Promise.all([
          import("@blocknote/xl-docx-exporter"),
          import("docx"),
        ]);
        const exporter = new DOCXExporter(editor.schema as any, docxDefaultSchemaMappings as any);
        const docxDoc = await exporter.toDocxJsDocument(editor.document);
        const blob = await Packer.toBlob(docxDoc);
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement("a");
        a.href = url; a.download = `${docTitle}.docx`; a.click();
        URL.revokeObjectURL(url);
        toast.success(t("docxSuccess"), { id: tid });
      } catch (err: any) {
        toast.error(t("docxFailed"), { id: tid });
      }
    };

    setExportHandlers({ pdf: handlePdf, docx: handleDocx });
    return () => setExportHandlers({ pdf: null, docx: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, document?.title]);

  // Compute initial word count when editor mounts
  useEffect(() => {
    if (!editor) return;
    // Small delay to let BlockNote finish seeding content
    const id = setTimeout(() => setWordCount(computeWordStats(editor)), 300);
    return () => clearTimeout(id);
  }, [editor]);

  // Auto-save a version every 5 minutes while document is open
  useEffect(() => {
    if (!document) return;
    const id = setInterval(() => {
      saveVersion({ documentId }).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [documentId, document, saveVersion]);

  // Presence heartbeat: broadcast every 15s, clean up on unmount
  useEffect(() => {
    if (!myProfile || !document) return;
    const userName = myProfile.name ?? myProfile.email ?? "User";
    const userImage = myProfile.image ?? undefined;

    const broadcast = () => {
      updatePresence({ documentId, userName, userColor: myColor, userImage }).catch(() => {});
    };
    broadcast();
    const id = setInterval(broadcast, 15_000);
    return () => {
      clearInterval(id);
      removePresence({ documentId }).catch(() => {});
    };
  }, [documentId, myProfile, myColor, updatePresence, removePresence, document]);

  if (document === undefined) {
    return (
      <div>
        <Cover.Skeleton />
        <div className="mx-auto mt-10 md:max-w-3xl lg:max-w-4xl">
          <div className="space-y-4 pt-4 pl-8">
            <Skeleton className="h-14 w-1/2" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </div>
      </div>
    );
  }

  if (document === null) {
    router.replace("/documents");
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto pb-40 min-w-0 relative">
        <Cover url={document.coverImage} />
        <div className={`relative mx-auto transition-all duration-300 ${
          focusMode ? "max-w-2xl px-8" : (EDITOR_WIDTH_CLASS[uiCfg.editorWidth] ?? EDITOR_WIDTH_CLASS.default)
        }`}>
          <Toolbar initialData={document} />
          <Editor
            documentId={documentId}
            onChange={onChange}
            initialContent={document.content}
            onEditorReady={setEditor}
            teamMembers={teamMembers}
            showCommentsSidebar={showComments && !focusMode}
            onCommentsSidebarClose={toggleComments}
            commentsSidebarContainer={commentsSidebarEl}
            userId={myProfile?.userId}
            collabUser={collabUser}
            collabRoom={documentId}
          />
          {!focusMode && <TableOfContents editor={editor} />}
        </div>
        {/* Word count footer — hidden on mobile, respects showWordCount setting */}
        {uiCfg.showWordCount !== false && <div className="hidden md:block fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
          <button
            onClick={() => setWordCountExpanded((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-border/50 bg-background/85 px-3.5 py-1.5 shadow-sm backdrop-blur-sm text-[11px] text-muted-foreground/60 tabular-nums transition-all hover:text-muted-foreground hover:border-border cursor-pointer select-none"
          >
            <span className="font-medium">{wordCount.words.toLocaleString()} {t("words")}</span>
            {wordCountExpanded && (
              <>
                <span className="h-3 w-px bg-border/50" />
                <span>{wordCount.chars.toLocaleString()} {t("chars")}</span>
                <span className="h-3 w-px bg-border/50" />
                <span>~{wordCount.readingTime} {t("minRead")}</span>
              </>
            )}
            <ChevronDown
              className={`h-3 w-3 shrink-0 transition-transform duration-200 ${
                wordCountExpanded ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>}
      </div>

      {/* Comments sidebar — portal target (hidden in focus mode) */}
      {showComments && !focusMode && (
        <div className="hidden sm:flex h-full w-72 lg:w-80 shrink-0 flex-col border-l bg-background">
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="text-xs font-semibold tracking-wide text-muted-foreground/80">{t("commentsTitle")}</span>
            </div>
            <button
              onClick={toggleComments}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div
            ref={setCommentsSidebarEl as any}
            className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-0 [&_.bn-thread-sidebar-item]:border-b [&_.bn-thread-sidebar-item]:border-border/30 [&_.bn-thread-sidebar-item]:px-4 [&_.bn-thread-sidebar-item]:py-3 [&_.bn-thread-sidebar-item]:transition-colors [&_.bn-thread-sidebar-item:hover]:bg-accent/30"
          />
        </div>
      )}

      {/* Version History sidebar (hidden in focus mode) */}
      {showVersionHistory && !focusMode && (
        <VersionHistoryPanel
          documentId={documentId}
          onClose={closeVersionHistory}
          onRestore={() => window.location.reload()}
        />
      )}

      {/* AI Assistant sidebar */}
      {extEnabled("aiAssistant") && showAi && !focusMode && (
        <div className="hidden sm:flex h-full w-80 shrink-0 flex-col border-l bg-background">
          <AiAssistantPanel
            onClose={() => setShowAi(false)}
            documentContext={{
              id: documentId,
              title: document.title,
              content: document.content,
            }}
            onDocumentContentReplace={(newContent) => {
              update({ id: documentId, content: newContent });
              if (editor) {
                try {
                  const blocks = JSON.parse(newContent);
                  editor.replaceBlocks(editor.document, blocks);
                } catch {}
              }
            }}
          />
        </div>
      )}

      {/* AI Assistant floating toggle */}
      {extEnabled("aiAssistant") && !showAi && !focusMode && (
        <button
          onClick={() => setShowAi(true)}
          className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 hover:shadow-xl sm:hidden md:flex"
          title="A2E AI"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};
export default DocumentIdPage;
