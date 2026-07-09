"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TextareaAutosize from "react-textarea-autosize";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { IconPicker } from "@/components/icon-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { btnGhost, EmptyState, Spinner, timeAgo } from "@/components/app/common";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { encryptContent, decryptContent } from "@/lib/crypto";
import { PresenceAvatars } from "@/components/app/presence-avatars";
import { FontLibraryDialog } from "@/components/app/font-library-dialog";
import { ExportDialog } from "@/components/app/export-dialog";
import { TableOfContents } from "@/components/table-of-contents";
import { ActivityPanel } from "@/components/app/activity-panel";
import { ActionTooltip } from "@/components/action-tooltip";
import { Switch } from "@/components/ui/switch";
import { useTranslations } from "next-intl";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft2,
  Star1,
  Trash,
  More,
  GalleryAdd,
  Global,
  Link21,
  Hashtag,
  Add,
  CloseCircle,
  DocumentText,
  DocumentDownload,
  Copy,
  Lock1,
  People,
  TickCircle,
  Clock,
  Refresh2,
  Setting4,
  ExportSquare,
  MessageText1,
  TextBlock,
  Maximize2,
} from "iconsax-reactjs";

const FluxEditor = dynamic(() => import("@/components/app/flux-editor"), {
  ssr: false,
  loading: () => (
    <div className="space-y-3 px-1 py-6">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-40 w-full" />
    </div>
  ),
});

const TAG_COLORS = ["#e65a41", "#2f7ea6", "#2fbf9b", "#d98324", "#7c5cff", "#e5484d"];

export function DocumentView({ documentId }: { documentId: Id<"flux_documents"> }) {
  const router = useRouter();
  const convex = useConvex();
  const te = useTranslations("editor");
  const tDocs = useTranslations("docsExperience");
  const { activeWorkspaceId, me } = useWorkspace();
  const doc = useQuery(api.flux_documents.get, { documentId });
  const favorites = useQuery(
    api.flux_documents.listFavorites,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );

  const update = useMutation(api.flux_documents.update);
  const removeIcon = useMutation(api.flux_documents.removeIcon);
  const removeCover = useMutation(api.flux_documents.removeCover);
  const archive = useMutation(api.flux_documents.archive);
  const toggleFavorite = useMutation(api.flux_documents.toggleFavorite);
  const setPublished = useMutation(api.flux_documents.setPublished);
  const generateUploadUrl = useMutation(api.flux_files.generateUploadUrl);
  const processMentions = useMutation(api.flux_documents.processMentions);
  const saveAsTemplate = useMutation(api.flux_docTemplates.saveAsTemplate);
  const saveVersionFn = useMutation(api.flux_documents.saveVersion);
  const restoreVersionFn = useMutation(api.flux_documents.restoreVersion);
  const setLock = useMutation(api.flux_documents.setLock);
  const duplicateFn = useMutation(api.flux_documents.duplicate);
  const setDocumentStyle = useMutation(api.flux_fonts.setDocumentStyle);
  const documentStyle = useQuery(api.flux_fonts.getDocumentStyle, { documentId });
  const workspaceFonts = useQuery(api.flux_fonts.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const openCommentCount = useQuery(api.flux_commentThreads.countOpen, { documentId });

  // Toolbar customization + breadcrumb + word count.
  const prefs = useQuery(api.flux_userPrefs.get);
  const updatePrefs = useMutation(api.flux_userPrefs.update);
  const parentDoc = useQuery(
    api.flux_documents.get,
    doc?.parentId ? { documentId: doc.parentId } : "skip",
  );
  const wordCount = useMemo(() => {
    try {
      const blocks = doc?.content ? JSON.parse(doc.content) : [];
      let text = "";
      const walk = (bs: any[]) => {
        for (const b of bs ?? []) {
          for (const c of b?.content ?? []) if (typeof c?.text === "string") text += c.text + " ";
          if (b?.children?.length) walk(b.children);
        }
      };
      walk(blocks);
      return (text.trim().match(/\S+/g) ?? []).length;
    } catch {
      return 0;
    }
  }, [doc?.content]);

  // Data for @mentions + permissions.
  const wsMembers = useQuery(api.workspaces.listMembers, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const wsTasks = useQuery(api.flux_tasks.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const wsProjects = useQuery(api.projects.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");

  const mentionables = useMemo(() => {
    const out: any[] = [];
    for (const m of wsMembers ?? []) out.push({ id: m.userId, userId: m.userId, label: m.name ?? m.email ?? "User", kind: "user", image: m.image });
    for (const t of (wsTasks ?? []).slice(0, 100)) out.push({ id: t._id, label: t.title, kind: "task" });
    for (const p of wsProjects ?? []) out.push({ id: p._id, label: p.name, kind: "project" });
    return out;
  }, [wsMembers, wsTasks, wsProjects]);
  const myMembership = (wsMembers ?? []).find((member: any) => String(member.userId) === String(me?._id));
  const commentRole: "comment" | "editor" = myMembership?.role === "owner" || myMembership?.role === "admin" ? "editor" : "comment";
  const selectedFont = (workspaceFonts ?? []).find((font: any) => String(font._id) === String(documentStyle?.fontId));

  const editorRef = useRef<any>(null);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const mentionTimer = useRef<any>(null);

  const versions = useQuery(api.flux_documents.listVersions, { documentId });
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [fontLibraryOpen, setFontLibraryOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [historyTab, setHistoryTab] = useState<"versions" | "activity">("versions");
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [passphraseInput, setPassphraseInput] = useState("");
  const [passphraseHintInput, setPassphraseHintInput] = useState("");
  const [unlockInput, setUnlockInput] = useState("");
  const [lockError, setLockError] = useState("");
  const [lockLoading, setLockLoading] = useState(false);
  const [unlockedContent, setUnlockedContent] = useState<string | null>(null);
  const [currentPassphrase, setCurrentPassphrase] = useState<string | null>(null);
  const editingTimer = useRef<any>(null);
  const titleTimer = useRef<any>(null);
  const contentTimer = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const loadedId = useRef<string | null>(null);

  useEffect(() => {
    if (doc && loadedId.current !== doc._id) {
      setTitle(doc.title || "");
      loadedId.current = doc._id;
    }
  }, [doc]);

  useEffect(() => {
    setFocusMode(sessionStorage.getItem("texxel-doc-focus-mode") === "true");
  }, []);

  useEffect(() => {
    sessionStorage.setItem("texxel-doc-focus-mode", String(focusMode));
    document.documentElement.toggleAttribute("data-doc-focus", focusMode);
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && focusMode) setFocusMode(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onEscape);
      if (focusMode) document.documentElement.removeAttribute("data-doc-focus");
    };
  }, [focusMode]);

  const saveTitle = useCallback(
    (value: string) => {
      setTitle(value);
      if (titleTimer.current) clearTimeout(titleTimer.current);
      setSaving(true);
      titleTimer.current = setTimeout(async () => {
        try {
          await update({ documentId, title: value || "Untitled" });
        } finally {
          setSaving(false);
        }
      }, 500);
    },
    [documentId, update],
  );

  const saveContent = useCallback(
    (content: string) => {
      setIsEditing(true);
      if (editingTimer.current) clearTimeout(editingTimer.current);
      editingTimer.current = setTimeout(() => setIsEditing(false), 8000);
      if (contentTimer.current) clearTimeout(contentTimer.current);
      setSaving(true);
      contentTimer.current = setTimeout(async () => {
        try {
          if (doc?.isLocked && currentPassphrase && doc.passphraseSalt && doc.lockIv) {
            const { ciphertext, salt, iv } = await encryptContent(content, currentPassphrase);
            await update({ documentId, content: ciphertext });
            await setLock({ documentId, isLocked: true, passphraseSalt: salt, lockIv: iv, passphraseHint: doc.passphraseHint });
          } else {
            await update({ documentId, content });
          }
        } finally {
          setSaving(false);
        }
      }, 700);
    },
    [documentId, update, doc, currentPassphrase, setLock],
  );

  const onUploadCover = async (file: File) => {
    try {
      const postUrl = await generateUploadUrl();
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await res.json();
      const url = await convex.query(api.flux_files.getUrl, { storageId });
      await update({ documentId, coverImage: url as string });
      toast.success("Cover updated");
    } catch {
      toast.error("Could not upload cover");
    }
  };

  const downloadBlob = (text: string, filename: string, type: string) => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportMarkdown = async () => {
    try {
      const ed = editorRef.current;
      if (!ed) return toast.error("Editor not ready");
      const md = await ed.blocksToMarkdownLossy(ed.document);
      const front = `# ${title || te("untitled")}\n\n`;
      downloadBlob(front + md, `${(title || "document").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`, "text/markdown");
      toast.success("Exported Markdown");
    } catch {
      toast.error("Export failed");
    }
  };

  const openExport = () => {
    if (!editorRef.current) return toast.error("Editor is still loading");
    setExportOpen(true);
  };

  const onSaveTemplate = async () => {
    if (!activeWorkspaceId) return;
    const ed = editorRef.current;
    await saveAsTemplate({
      workspaceId: activeWorkspaceId,
      title: title || te("untitled"),
      content: ed ? JSON.stringify(ed.document) : doc?.content,
      icon: doc?.icon,
      category: "custom",
    });
    toast.success("Saved as template");
  };

  const onArchive = async () => {
    await archive({ documentId });
    toast.success("Moved to trash");
    router.push("/app/documents");
  };

  const onTogglePublish = async () => {
    if (!doc) return;
    const token = await setPublished({ documentId, isPublished: !doc.isPublished });
    if (!doc.isPublished && token) {
      const url = `${window.location.origin}/share/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Published \u2014 share link copied");
      } catch {
        toast.success("Published");
      }
    } else {
      toast.success("Made private");
    }
  };

  const copyShareLink = async () => {
    if (!doc?.shareToken) return;
    const url = `${window.location.origin}/share/${doc.shareToken}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  if (doc === undefined) {
    return (
      <div className="mx-auto max-w-[860px] px-6 py-10">
        <Skeleton className="mb-4 h-10 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="mt-8 h-64 w-full" />
      </div>
    );
  }
  if (doc === null) {
    return (
      <div className="mx-auto max-w-[860px] px-6 py-20">
        <EmptyState
          icon={DocumentText}
          title="Document not found"
          description="It may have been deleted or moved to trash."
          action={
            <button onClick={() => router.push("/app/documents")} className={btnGhost}>
              <ArrowLeft2 variant="Bulk" size={16} /> Back to documents
            </button>
          }
        />
      </div>
    );
  }

  if (doc.isFolder) {
    return <FolderView doc={doc} documentId={documentId} />;
  }

  const isFavorite = !!favorites?.some((f: any) => f._id === doc._id);
  const hiddenTools: string[] = (prefs as any)?.docToolbarHidden ?? [];
  const showTool = (key: string) => !hiddenTools.includes(key);
  const toggleTool = (key: string) => {
    const next = hiddenTools.includes(key) ? hiddenTools.filter((k) => k !== key) : [...hiddenTools, key];
    updatePrefs({ docToolbarHidden: next });
  };
  const onDuplicate = async () => {
    const newId = await duplicateFn({ documentId });
    toast.success(te("duplicated"));
    router.push(`/app/documents/${newId}`);
  };

  return (
    <div className={cn("min-h-full pb-32", focusMode && "fixed inset-0 z-[70] overflow-y-auto bg-background pb-24")} data-testid="document-view" data-focus-mode={focusMode}>
      {/* Toolbar */}
      <div className={cn("sticky top-0 z-40 flex items-center gap-1 border-b border-border bg-background/85 px-3 py-2 backdrop-blur md:px-6", focusMode && "mx-auto max-w-[1180px] rounded-b-2xl border-x bg-card/95 shadow-sm")}>
        <ActionTooltip label={te("tooltipBack")} side="bottom">
          <button onClick={() => router.push("/app/documents")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" data-testid="doc-back" aria-label={te("tooltipBack")}>
            <ArrowLeft2 variant="Bulk" size={18} />
          </button>
        </ActionTooltip>
        {/* Breadcrumb */}
        <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          {parentDoc && (
            <>
              <Link
                href={`/app/documents/${parentDoc._id}`}
                className="hidden max-w-32 items-center gap-1 truncate rounded-md px-1 py-0.5 hover:bg-muted hover:text-foreground sm:flex"
                data-testid="doc-breadcrumb-parent"
              >
                <span>{parentDoc.icon ?? "\ud83d\udcc1"}</span>
                <span className="truncate">{parentDoc.title || te("untitled")}</span>
              </Link>
              <span className="hidden text-muted-foreground/50 sm:inline">/</span>
            </>
          )}
          <span className="w-5 text-center">{doc.icon ?? "\ud83d\udcc4"}</span>
          <span className="truncate font-medium text-foreground">{title || te("untitled")}</span>
        </span>
        <span className="ml-2 flex shrink-0 items-center gap-1 text-xs text-muted-foreground" data-testid="doc-save-state">
          {saving ? (
            <><Spinner className="h-3 w-3" /> {te("savingShort")}</>
          ) : (
            te("saved")
          )}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <PresenceAvatars documentId={documentId} meId={me?._id} editing={isEditing} />
          {showTool("comments") && (
            <ActionTooltip label={tDocs("comments.title")} side="bottom">
              <button
                type="button"
                onClick={() => setCommentsOpen(true)}
                className={cn("relative flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted", commentsOpen ? "bg-muted text-foreground" : "text-muted-foreground")}
                data-testid="doc-comments-btn"
                aria-label={tDocs("comments.open")}
              >
                <MessageText1 variant="Bulk" size={18} />
                {!!openCommentCount && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground" data-testid="doc-comments-count">{openCommentCount > 9 ? "9+" : openCommentCount}</span>
                )}
              </button>
            </ActionTooltip>
          )}
          {showTool("star") && (
            <ActionTooltip label={isFavorite ? te("tooltipFavoriteRemove") : te("tooltipFavoriteAdd")} side="bottom">
              <button onClick={() => toggleFavorite({ documentId })} className={cn("flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted", isFavorite ? "text-primary" : "text-muted-foreground")} data-testid="doc-favorite" aria-label={isFavorite ? te("tooltipFavoriteRemove") : te("tooltipFavoriteAdd")}>
                <Star1 variant={isFavorite ? "Bold" : "Bulk"} size={18} />
              </button>
            </ActionTooltip>
          )}
          {showTool("lock") && (
            <ActionTooltip label={doc.isLocked ? te("tooltipLocked") : te("tooltipLock")} side="bottom">
              <button
                onClick={() => { setPassphraseInput(""); setPassphraseHintInput(doc.passphraseHint ?? ""); setLockError(""); setLockDialogOpen(true); }}
                className={cn("flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted", doc.isLocked ? "text-primary" : "text-muted-foreground")}
                data-testid="doc-lock-btn"
                aria-label={doc.isLocked ? te("tooltipLocked") : te("tooltipLock")}
              >
                <Lock1 variant="Bulk" size={18} />
              </button>
            </ActionTooltip>
          )}
          <ActionTooltip label={focusMode ? tDocs("focus.exit") : tDocs("focus.enter")} side="bottom">
            <button
              type="button"
              onClick={() => setFocusMode((value) => !value)}
              className={cn("flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted", focusMode ? "bg-[var(--flux-coral-soft)] text-primary" : "text-muted-foreground")}
              data-testid="doc-focus-mode"
              aria-label={focusMode ? tDocs("focus.exit") : tDocs("focus.enter")}
            >
              <Maximize2 variant="Bulk" size={17} className={cn("transition-transform", focusMode && "rotate-180")} />
            </button>
          </ActionTooltip>
          <button
            type="button"
            onClick={openExport}
            className="hidden h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold text-foreground hover:bg-muted sm:flex"
            data-testid="doc-export-open"
          >
            <DocumentDownload variant="Bulk" size={15} /> {tDocs("export.open")}
          </button>
          <ShareMenu
            doc={doc}
            documentId={documentId}
            update={update}
            onTogglePublish={onTogglePublish}
            members={wsMembers ?? []}
            te={te}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" data-testid="doc-more" aria-label={te("tooltipMore")} title={te("tooltipMore")}>
                <More variant="Bulk" size={18} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem onClick={() => fileRef.current?.click()} className="gap-2">
                <GalleryAdd variant="Bulk" size={16} /> {doc.coverImage ? te("changeCover") : te("addCover")}
              </DropdownMenuItem>
              {doc.coverImage && (
                <DropdownMenuItem onClick={() => removeCover({ documentId })} className="gap-2">
                  <CloseCircle variant="Bulk" size={16} /> {te("removeCover")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => saveVersionFn({ documentId }).then(() => toast.success(te("vhSavedToast")))} className="gap-2" data-testid="doc-save-version">
                <Clock variant="Bulk" size={16} /> {te("saveVersion")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setHistoryOpen(true)} className="gap-2" data-testid="doc-history">
                <Refresh2 variant="Bulk" size={16} /> {te("versionHistory")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDuplicate} className="gap-2" data-testid="doc-duplicate">
                <Copy variant="Bulk" size={16} /> {te("duplicate")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFontLibraryOpen(true)} className="gap-2" data-testid="doc-font-library">
                <TextBlock variant="Bulk" size={16} /> {tDocs("fonts.menu")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportMarkdown} className="gap-2" data-testid="doc-export-md">
                <DocumentDownload variant="Bulk" size={16} /> {te("menuExportMarkdown")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openExport} className="gap-2" data-testid="doc-export-pdf">
                <DocumentDownload variant="Bulk" size={16} /> {tDocs("export.menu")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSaveTemplate} className="gap-2" data-testid="doc-save-template">
                <DocumentText variant="Bulk" size={16} /> {te("saveAsTemplate")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2" data-testid="doc-toolbar-customize">
                  <Setting4 variant="Bulk" size={16} /> {te("toolbarCustomize")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48">
                  <DropdownMenuCheckboxItem checked={showTool("star")} onCheckedChange={() => toggleTool("star")} onSelect={(e: Event) => e.preventDefault()} data-testid="toolbar-toggle-star">
                    {te("toolbarStar")}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={showTool("lock")} onCheckedChange={() => toggleTool("lock")} onSelect={(e: Event) => e.preventDefault()} data-testid="toolbar-toggle-lock">
                    {te("toolbarLock")}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={showTool("comments")} onCheckedChange={() => toggleTool("comments")} onSelect={(e: Event) => e.preventDefault()} data-testid="toolbar-toggle-comments">
                    {te("toolbarComments")}
                  </DropdownMenuCheckboxItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onArchive} className="gap-2 text-destructive" data-testid="doc-archive">
                <Trash variant="Bulk" size={16} /> {te("menuTrash")}
              </DropdownMenuItem>
              <div className="border-t border-border px-2 py-1.5 text-[11px] text-muted-foreground" data-testid="doc-word-count">
                {te("wordCount", { count: wordCount })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUploadCover(f);
          e.target.value = "";
        }}
      />

      {/* Cover */}
      {doc.coverImage && (
        <div className="group relative h-44 w-full overflow-hidden bg-muted md:h-60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={doc.coverImage} alt="cover" className="h-full w-full object-cover" />
          <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <button onClick={() => fileRef.current?.click()} className="rounded-lg bg-background/90 px-2.5 py-1 text-xs font-medium backdrop-blur hover:bg-background">Change</button>
            <button onClick={() => removeCover({ documentId })} className="rounded-lg bg-background/90 px-2.5 py-1 text-xs font-medium backdrop-blur hover:bg-background">Remove</button>
          </div>
        </div>
      )}

      <div
        className={cn("mx-auto px-5 transition-[margin,max-width,padding] duration-200 md:px-12", focusMode ? "max-w-[980px] pt-12 md:px-20" : "max-w-[860px]", doc.coverImage && !focusMode ? "pt-4" : !focusMode ? "pt-10" : "", commentsOpen && !focusMode && "lg:mr-[380px] lg:ml-auto", commentsOpen && focusMode && "lg:mr-[380px] lg:max-w-[920px]")}
        style={{ fontFamily: documentStyle?.fontFamily ? `"${documentStyle.fontFamily}", var(--font-sans)` : undefined }}
      >
        {/* Icon */}
        <div className="group/icon relative">
          {doc.icon ? (
            <IconPicker asChild onChange={(icon) => update({ documentId, icon })}>
              <button className="text-6xl leading-none" data-testid="document-emoji-icon">{doc.icon}</button>
            </IconPicker>
          ) : (
            <IconPicker asChild onChange={(icon) => update({ documentId, icon })}>
              <button className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover/icon:opacity-100" data-testid="document-add-icon">
                <Add variant="Bulk" size={16} /> {te("addIcon")}
              </button>
            </IconPicker>
          )}
        </div>

        {/* Title */}
        <TextareaAutosize
          value={title}
          onChange={(e) => saveTitle(e.target.value)}
          placeholder={te("untitled")}
          data-testid="document-title"
          className="mt-2 w-full resize-none bg-transparent font-display text-4xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/50"
        />

        {/* Tags */}
        <TagRow documentId={documentId} />

        {/* Editor — locked overlay or decrypted content */}
        {doc.isLocked && unlockedContent === null ? (
          <div className="mt-8 flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-12 text-center" data-testid="doc-locked-overlay">
            <Lock1 variant="Bulk" size={36} className="text-primary" />
            <h3 className="mt-3 text-lg font-semibold">This document is locked</h3>
            {doc.passphraseHint && (
              <p className="mt-1 text-sm text-muted-foreground">Hint: {doc.passphraseHint}</p>
            )}
            <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
              <input
                type="password"
                value={unlockInput}
                onChange={(e) => { setUnlockInput(e.target.value); setLockError(""); }}
                onKeyDown={async (e) => {
                  if (e.key !== "Enter" || !unlockInput.trim()) return;
                  setLockLoading(true);
                  setLockError("");
                  try {
                    const plain = await decryptContent(doc.content ?? "", unlockInput, doc.passphraseSalt!, doc.lockIv!);
                    setUnlockedContent(plain);
                    setCurrentPassphrase(unlockInput);
                    setUnlockInput("");
                  } catch {
                    setLockError("Wrong passphrase.");
                  } finally {
                    setLockLoading(false);
                  }
                }}
                placeholder="Enter passphrase…"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                data-testid="unlock-input"
                autoFocus
              />
              {lockError && <p className="text-xs text-destructive">{lockError}</p>}
              <button
                disabled={lockLoading || !unlockInput.trim()}
                onClick={async () => {
                  setLockLoading(true);
                  setLockError("");
                  try {
                    const plain = await decryptContent(doc.content ?? "", unlockInput, doc.passphraseSalt!, doc.lockIv!);
                    setUnlockedContent(plain);
                    setCurrentPassphrase(unlockInput);
                    setUnlockInput("");
                  } catch {
                    setLockError("Wrong passphrase.");
                  } finally {
                    setLockLoading(false);
                  }
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                data-testid="unlock-btn"
              >
                {lockLoading ? <><Spinner className="h-4 w-4" /> Unlocking…</> : <><Lock1 variant="Bulk" size={16} /> Unlock</>}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 doc-print-area">
            <FluxEditor
              key={`${doc._id}-${!!unlockedContent}`}
              documentId={documentId}
              userId={me?._id}
              commentRole={commentRole}
              commentsOpen={commentsOpen}
              focusMode={focusMode}
              onCommentsOpenChange={setCommentsOpen}
              initialContent={unlockedContent ?? doc.content}
              editable
              onChange={saveContent}
              mentionables={mentionables}
              documentStyle={documentStyle}
              selectedFont={selectedFont}
              onEditorReady={(ed: any) => { editorRef.current = ed; setEditorInstance(ed); }}
              onMentions={(ids: string[]) => {
                if (!ids.length) return;
                if (mentionTimer.current) clearTimeout(mentionTimer.current);
                mentionTimer.current = setTimeout(() => { processMentions({ documentId, userIds: ids as any }).catch(() => {}); }, 1500);
              }}
            />
            <TableOfContents editor={editorInstance} />
          </div>
        )}
      </div>

      {focusMode && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-[75] -translate-x-1/2 rounded-full border border-border bg-card/95 px-4 py-2 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur" data-testid="focus-mode-hint">
          {tDocs("focus.hint")}
        </div>
      )}

      {activeWorkspaceId && (
        <FontLibraryDialog
          open={fontLibraryOpen}
          onOpenChange={setFontLibraryOpen}
          workspaceId={activeWorkspaceId}
          documentId={documentId}
          documentStyle={documentStyle}
        />
      )}
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        editor={editorInstance}
        title={title || te("untitled")}
        documentStyle={documentStyle}
        selectedFont={selectedFont}
        onSaveSettings={async (settings) => {
          await setDocumentStyle({
            documentId,
            fontId: documentStyle?.fontId,
            fontFamily: documentStyle?.fontFamily ?? "Plus Jakarta Sans",
            fontSize: documentStyle?.fontSize ?? 16,
            lineHeight: documentStyle?.lineHeight ?? 1.65,
            ...settings,
          });
        }}
      />

      {/* Lock management dialog */}
      {lockDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" data-testid="lock-dialog-overlay">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
              <Lock1 variant="Bulk" size={20} className="text-primary" />
              {doc.isLocked ? "Manage lock" : "Secure document"}
            </h2>
            <p className="mb-5 text-sm text-muted-foreground">
              {doc.isLocked ? "The document content is encrypted. Remove the lock or keep it secured." : "Content is encrypted client-side with AES-256-GCM. The passphrase never leaves your browser."}
            </p>

            {!doc.isLocked && (
              <div className="space-y-3">
                <input
                  type="password"
                  value={passphraseInput}
                  onChange={(e) => setPassphraseInput(e.target.value)}
                  placeholder="Choose a passphrase…"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  data-testid="lock-passphrase-input"
                  autoFocus
                />
                <input
                  type="text"
                  value={passphraseHintInput}
                  onChange={(e) => setPassphraseHintInput(e.target.value)}
                  placeholder="Hint (optional, stored in plaintext)…"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  data-testid="lock-hint-input"
                />
                {lockError && <p className="text-xs text-destructive">{lockError}</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setLockDialogOpen(false)}
                    className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
                  >Cancel</button>
                  <button
                    disabled={lockLoading || !passphraseInput.trim()}
                    onClick={async () => {
                      setLockLoading(true);
                      setLockError("");
                      try {
                        const ed = editorRef.current;
                        const plainContent = ed ? JSON.stringify(ed.document) : doc.content ?? "";
                        const { ciphertext, salt, iv } = await encryptContent(plainContent, passphraseInput);
                        await update({ documentId, content: ciphertext });
                        await setLock({ documentId, isLocked: true, passphraseSalt: salt, lockIv: iv, passphraseHint: passphraseHintInput.trim() || undefined });
                        setCurrentPassphrase(passphraseInput);
                        setUnlockedContent(plainContent);
                        setLockDialogOpen(false);
                        toast.success("Document locked");
                      } catch {
                        setLockError("Encryption failed. Please try again.");
                      } finally {
                        setLockLoading(false);
                      }
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                    data-testid="confirm-lock-btn"
                  >
                    {lockLoading ? <Spinner className="h-4 w-4" /> : <Lock1 variant="Bulk" size={16} />} Lock document
                  </button>
                </div>
              </div>
            )}

            {doc.isLocked && (
              <div className="space-y-3">
                {lockError && <p className="text-xs text-destructive">{lockError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => setLockDialogOpen(false)}
                    className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
                  >Close</button>
                  <button
                    disabled={lockLoading || !currentPassphrase}
                    onClick={async () => {
                      if (!currentPassphrase) return;
                      setLockLoading(true);
                      try {
                        const plain = unlockedContent ?? await decryptContent(doc.content ?? "", currentPassphrase, doc.passphraseSalt!, doc.lockIv!);
                        await update({ documentId, content: plain });
                        await setLock({ documentId, isLocked: false });
                        setUnlockedContent(null);
                        setCurrentPassphrase(null);
                        setLockDialogOpen(false);
                        toast.success("Lock removed");
                      } catch {
                        setLockError("Could not remove lock.");
                      } finally {
                        setLockLoading(false);
                      }
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
                    data-testid="remove-lock-btn"
                  >
                    {lockLoading ? <Spinner className="h-4 w-4" /> : <Lock1 variant="Bulk" size={16} />} Remove lock
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="right" className="w-[360px] sm:w-[420px] overflow-y-auto" data-testid="doc-history-panel">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Clock variant="Bulk" size={18} className="text-primary" /> History
            </SheetTitle>
          </SheetHeader>
          <div className="mt-3 flex rounded-full border border-border bg-muted/40 p-0.5">
            <button onClick={() => setHistoryTab("versions")} className={cn("flex-1 rounded-full py-1 text-xs font-medium transition", historyTab === "versions" ? "bg-card shadow-sm" : "text-muted-foreground")}>Versions</button>
            <button onClick={() => setHistoryTab("activity")} className={cn("flex-1 rounded-full py-1 text-xs font-medium transition", historyTab === "activity" ? "bg-card shadow-sm" : "text-muted-foreground")}>Activity</button>
          </div>
          {historyTab === "versions" ? (
            <div className="mt-4 space-y-2">
              {versions === undefined ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
                ))
              ) : versions.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No saved versions yet.<br />Use "Save version" to snapshot the current state.</p>
              ) : (
                versions.map((ver: any) => (
                  <div key={ver._id} className="flex items-start justify-between rounded-xl border border-border bg-card p-3 gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{ver.title || "Untitled"}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(ver.savedAt)} · {ver.savedByName}</p>
                    </div>
                    <button
                      onClick={async () => {
                        await restoreVersionFn({ versionId: ver._id });
                        setHistoryOpen(false);
                        toast.success("Version restored");
                      }}
                      className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-muted"
                      data-testid="restore-version-btn"
                    >
                      <Refresh2 variant="Bulk" size={14} /> Restore
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="mt-4">
              <ActivityPanel targetType="flux_document" targetId={documentId} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FolderView({ doc, documentId }: { doc: any; documentId: Id<"flux_documents"> }) {
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace();
  const children = useQuery(
    api.flux_documents.listChildren,
    activeWorkspaceId ? { documentId } : "skip",
  );
  const createDoc = useMutation(api.flux_documents.create);
  const update = useMutation(api.flux_documents.update);
  const [title, setTitle] = useState(doc.title || "");
  const titleTimer = useRef<any>(null);

  const onAddPage = async () => {
    if (!activeWorkspaceId) return;
    try {
      const id = await createDoc({ workspaceId: activeWorkspaceId, title: "Untitled", parentId: documentId });
      router.push(`/app/documents/${id}`);
    } catch {
      toast.error("Could not create document");
    }
  };

  const saveTitle = (value: string) => {
    setTitle(value);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(async () => {
      try {
        await update({ documentId, title: value });
      } catch {
        toast.error("Could not save title");
      }
    }, 500);
  };

  return (
    <div className="min-h-full pb-32" data-testid="folder-view">
      <div className="mx-auto max-w-[860px] px-5 pt-10 md:px-12">
        <IconPicker asChild onChange={(icon: string) => update({ documentId, icon })}>
          <button className="text-6xl leading-none" data-testid="folder-emoji-icon">
            {doc.icon ?? "📁"}
          </button>
        </IconPicker>
        <TextareaAutosize
          value={title}
          onChange={(e) => saveTitle(e.target.value)}
          placeholder="Untitled"
          data-testid="folder-title"
          className="mt-2 w-full resize-none bg-transparent font-display text-4xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/50"
        />

        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contents</h3>
            <button onClick={onAddPage} className={cn(btnGhost, "text-xs")} data-testid="folder-add-page">
              <Add variant="Bulk" size={14} /> New page
            </button>
          </div>
          {children === undefined ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : children.length === 0 ? (
            <EmptyState
              icon={DocumentText}
              title="Empty folder"
              description="Add pages to this folder to keep them organized."
              action={
                <button onClick={onAddPage} className={cn(btnGhost, "text-xs")} data-testid="folder-empty-add">
                  <Add variant="Bulk" size={14} /> New page
                </button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {children.map((child: any) => (
                <Link
                  key={child._id}
                  href={`/app/documents/${child._id}`}
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary hover:shadow-sm"
                  data-testid="folder-child-card"
                >
                  <span className="text-2xl">{child.icon ?? (child.isFolder ? "📁" : "📄")}</span>
                  <span className="min-w-0 flex-1 truncate font-medium group-hover:text-primary">{child.title || "Untitled"}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TagRow({ documentId }: { documentId: Id<"flux_documents"> }) {
  const { activeWorkspaceId } = useWorkspace();
  const docTags = useQuery(api.flux_tags.getForDocument, { documentId });
  const allTags = useQuery(
    api.flux_tags.list,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );
  const createTag = useMutation(api.flux_tags.create);
  const assign = useMutation(api.flux_tags.assignToDocument);
  const unassign = useMutation(api.flux_tags.removeFromDocument);
  const [name, setName] = useState("");

  const assigned = new Set((docTags ?? []).map((t: any) => t._id));
  const available = (allTags ?? []).filter((t: any) => !assigned.has(t._id));

  const onCreate = async () => {
    if (!name.trim() || !activeWorkspaceId) return;
    const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    const tagId = await createTag({ workspaceId: activeWorkspaceId, name: name.trim(), color });
    await assign({ documentId, tagId });
    setName("");
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5" data-testid="document-tags">
      {(docTags ?? []).map((t: any) => (
        <span
          key={t._id}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ backgroundColor: `${t.color ?? "#e65a41"}1f`, color: t.color ?? "#e65a41" }}
          data-testid="document-tag-chip"
        >
          <Hashtag variant="Bulk" size={12} /> {t.name}
          <button onClick={() => unassign({ documentId, tagId: t._id })} className="ml-0.5 opacity-70 hover:opacity-100">
            <CloseCircle variant="Bulk" size={13} />
          </button>
        </span>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted" data-testid="document-add-tag">
            <Add variant="Bulk" size={13} /> Tag
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <div className="flex items-center gap-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onCreate()}
              placeholder="Create or find a tag…"
              className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              data-testid="tag-input"
            />
            <button onClick={onCreate} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Add variant="Bulk" size={16} />
            </button>
          </div>
          {available.length > 0 && (
            <div className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
              {available.map((t: any) => (
                <button
                  key={t._id}
                  onClick={() => assign({ documentId, tagId: t._id })}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color ?? "#e65a41" }} />
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}


/** Unified Share menu (Notion-style): access control + public link + guest
 *  editing in one place, behind a single prominent button. */
function ShareMenu({ doc, documentId, update, onTogglePublish, members, te }: any) {
  const visibility = doc.visibility ?? "workspace";
  const access: string[] = doc.accessUserIds ?? [];
  const setVis = (v: string) => update({ documentId, visibility: v });
  const toggleUser = (uid: string) => {
    const next = access.includes(uid) ? access.filter((x) => x !== uid) : [...access, uid];
    update({ documentId, accessUserIds: next });
  };
  const shareUrl = typeof window !== "undefined" && doc.shareToken ? `${window.location.origin}/share/${doc.shareToken}` : "";
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const VisIcon = visibility === "private" ? Lock1 : visibility === "custom" ? People : Global;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors",
            doc.isPublished
              ? "bg-primary text-primary-foreground hover:opacity-90"
              : "border border-border text-foreground hover:bg-muted",
          )}
          data-testid="doc-share"
        >
          <ExportSquare variant="Bulk" size={14} /> {te("share")}
          {doc.isPublished && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-emerald-300" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0" data-testid="doc-share-menu">
        {/* Access */}
        <div className="p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <VisIcon variant="Bulk" size={13} /> {te("accessTitle")}
          </p>
          {[
            { key: "workspace", label: te("accessWorkspace"), icon: Global },
            { key: "private", label: te("accessPrivate"), icon: Lock1 },
            { key: "custom", label: te("accessCustom"), icon: People },
          ].map((o) => (
            <button key={o.key} onClick={() => setVis(o.key)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted" data-testid={`doc-vis-${o.key}`}>
              <o.icon variant="Bulk" size={16} className="text-muted-foreground" />
              <span className="flex-1">{o.label}</span>
              {visibility === o.key && <TickCircle variant="Bold" size={16} className="text-primary" />}
            </button>
          ))}
          {visibility === "custom" && (
            <div className="mt-2 border-t border-border pt-2">
              <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">{te("accessGrant")}</p>
              <div className="max-h-40 space-y-0.5 overflow-y-auto">
                {members.map((m: any) => (
                  <button key={m.userId} onClick={() => toggleUser(m.userId)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted">
                    <span className={cn("flex h-4 w-4 items-center justify-center rounded border", access.includes(m.userId) ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{access.includes(m.userId) && <TickCircle variant="Bold" size={11} />}</span>
                    <span className="flex-1 truncate">{m.name ?? m.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Public link */}
        <div className="border-t border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{te("publishToWeb")}</p>
              <p className="text-xs text-muted-foreground">{doc.isPublished ? te("publishedDesc") : te("publicDesc")}</p>
            </div>
            <Switch checked={!!doc.isPublished} onCheckedChange={onTogglePublish} data-testid="doc-publish-switch" />
          </div>
          {doc.isPublished && (
            <>
              {shareUrl && (
                <div className="mt-3 flex items-center gap-1.5">
                  <input readOnly value={shareUrl} className="h-8 w-full truncate rounded-lg border border-border bg-muted px-2 text-xs outline-none" data-testid="doc-share-url" onFocus={(e) => e.target.select()} />
                  <button onClick={copy} className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-semibold text-primary-foreground" data-testid="doc-share-copy">
                    {copied ? <TickCircle variant="Bold" size={14} /> : <Copy variant="Bulk" size={14} />}
                    {copied ? te("copied") : te("copyLink")}
                  </button>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                <div>
                  <p className="text-sm font-medium">{te("allowGuestEdit")}</p>
                  <p className="text-xs text-muted-foreground">{doc.isLocked ? te("lockedNoGuestEdit") : te("allowGuestEditDesc")}</p>
                </div>
                <Switch
                  checked={!!doc.allowGuestEdit && !doc.isLocked}
                  disabled={!!doc.isLocked}
                  onCheckedChange={(v) => update({ documentId, allowGuestEdit: v })}
                  data-testid="doc-guest-edit-toggle"
                />
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
