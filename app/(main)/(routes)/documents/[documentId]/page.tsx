"use client";

import dynamic from "next/dynamic";
import { useMemo, use, useState, useCallback, useRef, useEffect } from "react";
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
import { useDocumentUI } from "@/hooks/useDocumentUI";
import type { TeamMember, CollabUser } from "@/components/editor";

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
  const t = useTranslations("editor");
  const [editor, setEditor] = useState<any | null>(null);
  const [commentsSidebarEl, setCommentsSidebarEl] = useState<HTMLElement | null>(null);

  const { showComments, toggleComments, showVersionHistory, closeVersionHistory, setExportHandlers } = useDocumentUI();

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
    },
    [update, documentId],
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
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-base font-semibold text-muted-foreground">{t("notFound")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto pb-40 min-w-0">
        <Cover url={document.coverImage} />
        <div className="relative mx-auto md:max-w-3xl lg:max-w-4xl">
          <Toolbar initialData={document} />
          <Editor
            documentId={documentId}
            onChange={onChange}
            initialContent={document.content}
            onEditorReady={setEditor}
            teamMembers={teamMembers}
            showCommentsSidebar={showComments}
            onCommentsSidebarClose={toggleComments}
            commentsSidebarContainer={commentsSidebarEl}
            userId={myProfile?.userId}
            collabUser={collabUser}
            collabRoom={documentId}
          />
          <TableOfContents editor={editor} />
        </div>
      </div>

      {/* Comments sidebar — portal target */}
      {showComments && (
        <div className="flex h-full w-72 shrink-0 flex-col border-l bg-background">
          <div className="flex shrink-0 items-center justify-between border-b bg-background/95 px-3 py-2.5 backdrop-blur-sm">
            <span className="text-sm font-semibold tracking-tight">{t("commentsTitle")}</span>
            <button
              onClick={toggleComments}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Close comments"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <div
            ref={setCommentsSidebarEl as any}
            className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
          />
        </div>
      )}

      {/* Version History sidebar */}
      {showVersionHistory && (
        <VersionHistoryPanel
          documentId={documentId}
          onClose={closeVersionHistory}
          onRestore={() => window.location.reload()}
        />
      )}
    </div>
  );
};
export default DocumentIdPage;
