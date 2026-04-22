"use client";

import dynamic from "next/dynamic";
import { useMemo, use, useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronLeft, ChevronRight, MessageCircle, RotateCcw, Sparkles, X } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";

import { Cover } from "@/components/cover";
import { Toolbar } from "@/components/toolbar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
  const locale = useLocale();
  const [editor, setEditor] = useState<any | null>(null);
  const [commentsSidebarEl, setCommentsSidebarEl] = useState<HTMLElement | null>(null);

  const { showComments, toggleComments, showVersionHistory, closeVersionHistory, setExportHandlers, focusMode } = useDocumentUI();
  const { getUIConfig, isEnabled: extEnabled } = useExtensions();
  const uiCfg = getUIConfig();
  const [showAi, setShowAi] = useState(false);
  const [aiCollapsed, setAiCollapsed] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const originalContentRef = useRef<string | undefined>(undefined);
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
      // Don't auto-save while a preview is active
      if (previewContent !== null) return;
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        update({ id: documentId, content });
      }, 800);
      if (editor) setWordCount(computeWordStats(editor));
    },
    [update, documentId, editor, previewContent],
  );

  const handlePreviewContent = useCallback((newContent: string | null) => {
    if (newContent === null) {
      // Clear preview — revert to original
      if (originalContentRef.current !== undefined && editor) {
        try {
          const blocks = JSON.parse(originalContentRef.current ?? "[]");
          editor.replaceBlocks(editor.document, blocks);
        } catch {}
      }
      setPreviewContent(null);
      originalContentRef.current = undefined;
    } else {
      // Start preview — save original first
      if (originalContentRef.current === undefined) {
        originalContentRef.current = document?.content ?? undefined;
      }
      setPreviewContent(newContent);
      if (editor) {
        try {
          const blocks = JSON.parse(newContent);
          editor.replaceBlocks(editor.document, blocks);
        } catch {}
      }
    }
  }, [editor, document?.content]);

  const handleAcceptPreview = useCallback(() => {
    if (previewContent === null) return;
    update({ id: documentId, content: previewContent });
    setPreviewContent(null);
    originalContentRef.current = undefined;
    toast.success(locale === "fr" ? "Modifications appliquées ✓" : "Changes applied ✓");
  }, [previewContent, update, documentId]);

  const handleRevertPreview = useCallback(() => {
    handlePreviewContent(null);
  }, [handlePreviewContent]);

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
        {/* AI preview banner — editorial, soft */}
        {previewContent !== null && (
          <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[color-mix(in_oklch,var(--primary),transparent_75%)] bg-[color-mix(in_oklch,var(--primary),transparent_92%)] backdrop-blur-md px-5 py-2.5 animate-in slide-in-from-top-2 duration-[var(--tx-dur-base)]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-[var(--primary)]/15 animate-ping" />
                <Sparkles className="relative h-3.5 w-3.5 text-[var(--primary)]" />
              </div>
              <span className="tx-overline text-[var(--primary)]">
                {locale === "fr" ? "Aperçu IA" : "AI preview"}
              </span>
              <span className="tx-hairline-v h-4" />
              <span className="text-[12px] text-foreground/75 truncate">
                {locale === "fr" ? "Acceptez pour garder les modifications" : "Accept to keep the changes"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleRevertPreview}
                className="tx-chip tx-pressable"
              >
                <RotateCcw className="h-3 w-3" />
                {locale === "fr" ? "Annuler" : "Revert"}
              </button>
              <button
                onClick={handleAcceptPreview}
                className="tx-chip tx-pressable !text-[var(--primary-foreground)] !bg-[var(--primary)] !border-[var(--primary)]"
              >
                <Check className="h-3 w-3" />
                {locale === "fr" ? "Accepter" : "Accept"}
              </button>
            </div>
          </div>
        )}
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
        {/* Word count footer — editorial, hidden on mobile */}
        {uiCfg.showWordCount !== false && (
          <div className="hidden md:block fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
            <button
              onClick={() => setWordCountExpanded((v) => !v)}
              className={cn(
                "flex items-center gap-2.5 rounded-full border border-border/40 bg-[color-mix(in_oklch,var(--background),transparent_20%)] px-4 py-1.5",
                "text-[11px] text-muted-foreground/60 tabular-nums tx-pressable cursor-pointer select-none",
                "backdrop-blur-md tx-shadow-sm",
                "transition-[background,color,border-color,transform] duration-[var(--tx-dur-fast)]",
                "hover:text-foreground hover:border-border hover:bg-[var(--tx-surface-0)]",
              )}
            >
              <span className="tx-num font-medium">{wordCount.words.toLocaleString()}</span>
              <span className="tx-overline !text-muted-foreground/50">{t("words")}</span>
              {wordCountExpanded && (
                <>
                  <span className="h-3 w-px bg-border/40" />
                  <span className="tx-num">{wordCount.chars.toLocaleString()}</span>
                  <span className="tx-overline !text-muted-foreground/50">{t("chars")}</span>
                  <span className="h-3 w-px bg-border/40" />
                  <span className="tx-num">~{wordCount.readingTime}</span>
                  <span className="tx-overline !text-muted-foreground/50">{t("minRead")}</span>
                </>
              )}
              <ChevronDown
                className={cn(
                  "h-3 w-3 shrink-0 text-muted-foreground/40 transition-transform duration-[var(--tx-dur-fast)]",
                  wordCountExpanded && "rotate-180",
                )}
              />
            </button>
          </div>
        )}
      </div>

      {/* Comments sidebar — portal target (hidden in focus mode) */}
      {showComments && !focusMode && (
        <div className="hidden sm:flex h-full w-72 lg:w-80 shrink-0 flex-col border-l border-border/40 bg-[var(--tx-surface-1)] animate-in slide-in-from-right-4 fade-in duration-[var(--tx-dur-base)]">
          <div className="flex shrink-0 items-center justify-between border-b border-border/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-3.5 w-3.5 text-muted-foreground/50" strokeWidth={1.75} />
              <span className="tx-overline">{t("commentsTitle")}</span>
            </div>
            <button
              onClick={toggleComments}
              className="flex h-6 w-6 items-center justify-center rounded-[var(--tx-radius-sm)] text-muted-foreground/40 transition-all duration-[var(--tx-dur-fast)] hover:bg-foreground/[0.05] hover:text-foreground/80"
              aria-label="Close"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div
            ref={setCommentsSidebarEl as any}
            className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
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

      {/* AI Assistant sidebar — collapsible */}
      {extEnabled("aiAssistant") && showAi && !focusMode && (
        <div className={`hidden sm:flex h-full shrink-0 flex-col border-l bg-background transition-all duration-200 ease-out relative ${
          aiCollapsed ? "w-10" : "w-80"
        }`}>
          {/* Collapse toggle tab */}
          <button
            onClick={() => setAiCollapsed((v) => !v)}
            className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background shadow-sm text-muted-foreground/50 hover:text-foreground hover:border-border transition-all"
            title={aiCollapsed ? "Expand AI" : "Collapse AI"}
          >
            {aiCollapsed ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>

          {aiCollapsed ? (
            /* Collapsed state — just a narrow strip with icon */
            <div className="flex flex-col items-center pt-4 gap-3">
              <button
                onClick={() => setAiCollapsed(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/50 hover:text-primary hover:bg-primary/5 transition-colors"
                title="Expand AI"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <AiAssistantPanel
              onClose={() => { setShowAi(false); if (previewContent !== null) handleRevertPreview(); }}
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
              onPreviewContent={handlePreviewContent}
            />
          )}
        </div>
      )}

      {/* AI Assistant floating toggle */}
      {extEnabled("aiAssistant") && !showAi && !focusMode && (
        <button
          onClick={() => { setShowAi(true); setAiCollapsed(false); }}
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
