"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useFiles, useFolders, useFileUrl, useMembers, useDriveMutations } from "@a2e/core";
import type { DriveFileDoc, DriveFolderDoc, EntityRef, Id, UserSummary } from "@a2e/core";
import { useCoreWorkspaceId } from "@/hooks/use-core-workspace-id";
import { coreFlags } from "@/lib/core-flags";
import { usePersistedState } from "@/hooks/use-sidebar-prefs";
import { PageContainer, PageHeader, EmptyState, timeAgo } from "@/components/app/common";
import { UpgradeDialog } from "@/components/app/upgrade-dialog";
import { FileDropzone } from "@/components/app/files/file-dropzone";
import { UploadStack } from "@/components/app/files/upload-stack";
import { useFileUploads } from "@/components/app/files/use-file-uploads";
import { BulkActionsBar } from "@/components/app/files/bulk-actions-bar";
import { MoveDialog } from "@/components/app/files/move-dialog";
import { useBulkDownload } from "@/components/app/files/use-bulk-download";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { FolderOpen, Folder, DocumentText, Grid2, RowVertical, DocumentUpload, TickSquare } from "iconsax-reactjs";

type ViewMode = "grid" | "list";

interface Crumb {
  id: string | undefined;
  name: string;
}

/** Human-readable file size (B/KB/MB/GB). */
function formatBytes(bytes?: number): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : value >= 100 ? 0 : 1)} ${units[i]}`;
}

/** Localized label for the `linkedTo.type` of a drive file. */
function attachedLabel(linkedTo: EntityRef | undefined, t: (k: string) => string): string {
  if (!linkedTo) return t("attached.unattached");
  const key = `attached.${linkedTo.type}`;
  const fallback = linkedTo.type;
  // next-intl returns the key path when missing; fall back to the raw type.
  const label = t(key as any);
  return label === key ? fallback : label;
}

export default function FilesPage() {
  const coreWsId = useCoreWorkspaceId();
  const t = useTranslations("files");
  const tu = useTranslations("files.upload");
  const tb = useTranslations("files.bulk");
  const tc = useTranslations("common");
  const [viewMode, setViewMode] = usePersistedState<ViewMode>("bureau-files-view", "grid");
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: undefined, name: t("root") }]);

  const currentFolderId = crumbs[crumbs.length - 1]?.id;
  const driveEnabled = coreFlags.drive;

  const files = useFiles(driveEnabled ? (coreWsId as Id<"workspaces"> | null) : null, currentFolderId as Id<"drive_folders"> | undefined);
  const folders = useFolders(driveEnabled ? (coreWsId as Id<"workspaces"> | null) : null, currentFolderId as Id<"drive_folders"> | undefined);
  const members = useMembers(driveEnabled ? (coreWsId as Id<"workspaces"> | null) : null);
  const drive = useDriveMutations();

  const uploads = useFileUploads();
  const bulkDownload = useBulkDownload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Multi-select state (files only; folders are navigation) ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Clear selection whenever the viewed folder changes so stale ids never
  // survive a navigation into another folder.
  const currentFolderKey = currentFolderId ?? "root";
  const prevFolderRef = useRef(currentFolderKey);
  if (prevFolderRef.current !== currentFolderKey) {
    prevFolderRef.current = currentFolderKey;
    if (selectedIds.size > 0) setSelectedIds(new Set());
  }

  const selectedFiles = useMemo(() => {
    if (!files || selectedIds.size === 0) return [];
    return files.filter((f) => selectedIds.has(f._id as string));
  }, [files, selectedIds]);

  const allVisibleSelected = !!files && files.length > 0 && files.every((f) => selectedIds.has(f._id as string));

  const toggleSelect = useCallback((id: string, opts: { additive?: boolean; range?: boolean; lastId?: string | null } = {}) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (opts.range && opts.lastId && files) {
        const ids = files.map((f) => f._id as string);
        const a = ids.indexOf(opts.lastId);
        const b = ids.indexOf(id);
        if (a !== -1 && b !== -1) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) next.add(ids[i]);
          return next;
        }
      }
      if (opts.additive) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else {
        if (next.size === 1 && next.has(id)) next.clear();
        else { next.clear(); next.add(id); }
      }
      return next;
    });
  }, [files]);

  const lastClickedRef = useRef<string | null>(null);

  const selectAll = useCallback(() => {
    if (!files) return;
    setSelectedIds(new Set(files.map((f) => f._id as string)));
  }, [files]);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // --- Bulk actions ---
  const handleBulkDownload = useCallback(async () => {
    if (!selectedFiles.length) return;
    const { failed } = await bulkDownload.download(selectedFiles);
    if (failed > 0) {
      if (failed === selectedFiles.length) toast.error(tb("downloadSingleFailed"));
      else toast.error(tb("downloadFailed", { count: failed }));
    }
    bulkDownload.reset();
  }, [selectedFiles, bulkDownload, tb]);

  const handleBulkMove = useCallback(
    async (targetFolderId: Id<"drive_folders"> | undefined) => {
      if (!selectedFiles.length) return;
      let failed = 0;
      for (const f of selectedFiles) {
        try {
          await drive.moveFile({ fileId: f._id as Id<"drive_files">, folderId: targetFolderId });
        } catch {
          failed++;
        }
      }
      const targetName = targetFolderId
        ? (folders?.find((fo) => fo._id === targetFolderId)?.name ?? tb("moveTo"))
        : tb("moveRoot");
      if (failed > 0 && failed === selectedFiles.length) {
        toast.error(tb("moveFailed", { count: failed }));
      } else {
        toast.success(tb("moved", { count: selectedFiles.length - failed, name: targetName }));
        clearSelection();
      }
    },
    [selectedFiles, drive, folders, tb, clearSelection],
  );

  const handleBulkDelete = useCallback(async () => {
    if (!selectedFiles.length) return;
    const ids = selectedFiles.map((f) => f._id as Id<"drive_files">);
    let failed = 0;
    for (const id of ids) {
      try {
        await drive.removeFile({ fileId: id });
      } catch {
        failed++;
      }
    }
    if (failed > 0 && failed === ids.length) {
      toast.error(tb("deleteFailed", { count: failed }));
    } else {
      toast.success(tb("deleted", { count: ids.length - failed }), {
        action: {
          label: tb("undo"),
          onClick: async () => {
            for (const id of ids) {
              try { await drive.restoreFile({ fileId: id }); } catch { /* best-effort */ }
            }
          },
        },
      });
      clearSelection();
    }
  }, [selectedFiles, drive, tb, clearSelection]);

  const downloading = bulkDownload.phase === "fetching" || bulkDownload.phase === "zipping";
  const downloadLabel =
    bulkDownload.phase === "zipping"
      ? tb("downloadZipping", { count: bulkDownload.total })
      : bulkDownload.phase === "fetching"
        ? tb("downloadZipping", { count: bulkDownload.total })
        : undefined;

  const uploadOpts = useMemo(
    () => ({
      workspaceId: coreWsId as Id<"workspaces">,
      folderId: currentFolderId as Id<"drive_folders"> | undefined,
      sourceApp: "bureau",
    }),
    [coreWsId, currentFolderId],
  );

  const handleFiles = (fileList: File[] | FileList | null) => {
    if (!fileList || !coreWsId) return;
    const arr = Array.from(fileList);
    if (!arr.length) return;
    void uploads.enqueue(arr, uploadOpts);
  };

  const handleRetry = (item: (typeof uploads.items)[number]) => {
    void uploads.retry(item, uploadOpts);
  };

  const userMap = useMemo(() => {
    const m = new Map<string, UserSummary>();
    for (const mem of members ?? []) {
      if (mem.user) m.set(mem.userId as string, mem.user);
    }
    return m;
  }, [members]);

  const loading = files === undefined || folders === undefined;
  const isEmpty = !loading && (files?.length ?? 0) === 0 && (folders?.length ?? 0) === 0;

  const openFolder = (folder: DriveFolderDoc) => {
    setCrumbs((prev) => [...prev, { id: folder._id as string, name: folder.name }]);
  };
  const navigateTo = (idx: number) => {
    setCrumbs((prev) => prev.slice(0, idx + 1));
  };

  const resolveUser = (userId: string | undefined): string => {
    if (!userId) return t("unknownUser");
    const u = userMap.get(userId);
    return u?.name ?? u?.email ?? t("unknownUser");
  };

  // --- Fallback: core drive disabled or workspace not linked ---
  if (!driveEnabled || !coreWsId) {
    return (
      <PageContainer>
        <PageHeader title={t("title")} subtitle={t("subtitle")} icon={FolderOpen} testId="files-header" />
        <EmptyState
          icon={FolderOpen}
          title={t("empty")}
          description={!driveEnabled ? t("coreUnavailable") : t("notLinked")}
          testId="files-unavailable"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        icon={FolderOpen}
        testId="files-header"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label={tu("uploadButton")}
              data-testid="files-upload-button"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_92%,black)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <DocumentUpload variant="Bold" size={16} />
              <span className="hidden sm:inline">{tu("uploadButton")}</span>
            </button>
            <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1" data-testid="files-view-toggle">
              <button
                onClick={() => setViewMode("grid")}
                aria-pressed={viewMode === "grid"}
                aria-label={t("viewGrid")}
                data-testid="files-view-grid"
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Grid2 variant="Bulk" size={18} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                aria-pressed={viewMode === "list"}
                aria-label={t("viewList")}
                data-testid="files-view-list"
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <RowVertical variant="Bulk" size={18} />
              </button>
            </div>
          </div>
        }
      />

      {/* Hidden file input backing the Upload button (multi-file, any type). */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        data-testid="files-upload-input"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <FileDropzone onFiles={(f) => handleFiles(f)}>
        {/* Breadcrumb */}
        <nav aria-label={t("root")} className="mb-4 flex flex-wrap items-center gap-1 text-sm" data-testid="files-breadcrumb">
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={`${c.id ?? "root"}-${i}`} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground">/</span>}
                {isLast ? (
                  <span className="font-semibold text-foreground" data-testid="files-crumb-current">
                    {c.name}
                  </span>
                ) : (
                  <button
                    onClick={() => navigateTo(i)}
                    className="rounded-md px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    data-testid={`files-crumb-${i}`}
                  >
                    {c.name}
                  </button>
                )}
              </span>
            );
          })}
        </nav>

        {loading ? (
          viewMode === "grid" ? (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" data-testid="files-grid-skeleton">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card" data-testid="files-list-skeleton">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse border-b border-border bg-muted/40 last:border-b-0" />
              ))}
            </div>
          )
        ) : isEmpty ? (
          <EmptyState
            icon={FolderOpen}
            title={currentFolderId ? t("emptyFolder") : t("empty")}
            description={currentFolderId ? t("emptyFolderDesc") : t("emptyDesc")}
            testId="files-empty"
          />
        ) : viewMode === "grid" ? (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" data-testid="files-grid">
            {folders?.map((f) => (
              <FolderCard key={f._id} folder={f} onOpen={openFolder} t={t} />
            ))}
            {files?.map((f) => (
              <FileCard
                key={f._id}
                file={f}
                resolveUser={resolveUser}
                attachedLabelFor={attachedLabel}
                t={t}
                selected={selectedIds.has(f._id as string)}
                onSelect={(e) => {
                  const id = f._id as string;
                  toggleSelect(id, {
                    additive: e.metaKey || e.ctrlKey,
                    range: e.shiftKey,
                    lastId: lastClickedRef.current,
                  });
                  lastClickedRef.current = id;
                }}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card" data-testid="files-list">
            <div className="grid grid-cols-[2.5rem_2fr_1fr_1.5fr_1.5fr_1fr] items-center gap-3 border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground" data-testid="files-list-header">
              <SelectCheckbox
                checked={allVisibleSelected}
                indeterminate={!!files && selectedIds.size > 0 && !allVisibleSelected}
                onClick={allVisibleSelected ? clearSelection : selectAll}
                ariaLabel={allVisibleSelected ? tb("selectNone") : tb("selectAll")}
                testId="files-select-all"
              />
              <span>{t("column.name")}</span>
              <span>{t("column.size")}</span>
              <span>{t("column.attachedTo")}</span>
              <span>{t("column.uploadedBy")}</span>
              <span>{t("column.date")}</span>
            </div>
            <div className="divide-y divide-border">
              {folders?.map((f) => (
                <FolderRow key={f._id} folder={f} onOpen={openFolder} t={t} />
              ))}
              {files?.map((f) => (
                <FileRow
                  key={f._id}
                  file={f}
                  resolveUser={resolveUser}
                  attachedLabelFor={attachedLabel}
                  t={t}
                  selected={selectedIds.has(f._id as string)}
                  onSelect={(e) => {
                    const id = f._id as string;
                    toggleSelect(id, {
                      additive: e.metaKey || e.ctrlKey,
                      range: e.shiftKey,
                      lastId: lastClickedRef.current,
                    });
                    lastClickedRef.current = id;
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </FileDropzone>

      <UploadStack
        items={uploads.items}
        onCancel={uploads.cancel}
        onDismiss={uploads.dismiss}
        onRetry={handleRetry}
      />

      {coreFlags.quotas && (
        <>
          <UpgradeDialog
            state={uploads.storageQuotaDialog}
            onOpenChange={(open) => uploads.setStorageQuotaDialog((prev) => ({ ...prev, open }))}
          />
          <UpgradeDialog
            state={uploads.fileSizeQuotaDialog}
            onOpenChange={(open) => uploads.setFileSizeQuotaDialog((prev) => ({ ...prev, open }))}
          />
        </>
      )}

      <BulkActionsBar
        count={selectedIds.size}
        downloading={downloading}
        downloadLabel={downloadLabel}
        onDownload={handleBulkDownload}
        onMove={() => setMoveOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        onClear={clearSelection}
      />

      <MoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        currentFolderId={currentFolderId}
        count={selectedFiles.length}
        onConfirm={handleBulkMove}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent data-testid="files-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{tb("deleteConfirmTitle", { count: selectedFiles.length })}</AlertDialogTitle>
            <AlertDialogDescription>{tb("deleteConfirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="files-delete-cancel">{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
              data-testid="files-delete-confirm"
            >
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

// ---------------------------------------------------------------------------
// Folder components
// ---------------------------------------------------------------------------

function FolderCard({
  folder,
  onOpen,
  t,
}: {
  folder: DriveFolderDoc;
  onOpen: (f: DriveFolderDoc) => void;
  t: (k: any) => string;
}) {
  return (
    <button
      onClick={() => onOpen(folder)}
      aria-label={t("openFolder")}
      data-testid="files-folder-card"
      className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-sm"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--flux-coral-soft)] text-primary">
        <Folder variant="Bulk" size={22} />
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold group-hover:text-primary">{folder.name}</p>
        <p className="text-xs text-muted-foreground">{timeAgo(folder.createdAt)}</p>
      </div>
    </button>
  );
}

function FolderRow({
  folder,
  onOpen,
  t,
}: {
  folder: DriveFolderDoc;
  onOpen: (f: DriveFolderDoc) => void;
  t: (k: any) => string;
}) {
  return (
    <button
      onClick={() => onOpen(folder)}
      aria-label={t("openFolder")}
      data-testid="files-folder-row"
      className="grid w-full grid-cols-[2fr_1fr_1.5fr_1.5fr_1fr] items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/40"
    >
      <span className="flex items-center gap-2 truncate font-medium">
        <Folder variant="Bulk" size={18} className="shrink-0 text-primary" />
        <span className="truncate">{folder.name}</span>
      </span>
      <span className="text-muted-foreground">—</span>
      <span className="text-muted-foreground">—</span>
      <span className="text-muted-foreground">—</span>
      <span className="text-muted-foreground">{timeAgo(folder.createdAt)}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// File components
// ---------------------------------------------------------------------------

/** Small design-token checkbox used for file selection (no Radix dependency). */
function SelectCheckbox({
  checked,
  indeterminate,
  onClick,
  ariaLabel,
  testId,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onClick: (e: React.MouseEvent) => void;
  ariaLabel: string;
  testId: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={ariaLabel}
      data-testid={testId}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick(e);
      }}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked || indeterminate
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-transparent hover:border-primary/60",
        className,
      )}
    >
      {indeterminate ? (
        <span className="h-0.5 w-2.5 rounded-full bg-primary-foreground" />
      ) : (
        <TickSquare variant="Bold" size={14} className={checked ? "" : "opacity-0"} />
      )}
    </button>
  );
}

function FileCard({
  file,
  resolveUser,
  attachedLabelFor,
  t,
  selected,
  onSelect,
}: {
  file: DriveFileDoc;
  resolveUser: (id: string | undefined) => string;
  attachedLabelFor: (linkedTo: EntityRef | undefined, t: (k: any) => string) => string;
  t: (k: any) => string;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
}) {
  const url = useFileUrl(file._id as Id<"drive_files">, "view");
  const isImage = (file.contentType ?? "").startsWith("image/");
  return (
    <div
      data-testid="files-file-card"
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-sm",
        selected ? "border-primary ring-2 ring-primary/30" : "border-border",
      )}
    >
      <div className="absolute left-2 top-2 z-10">
        <SelectCheckbox
          checked={selected}
          onClick={onSelect}
          ariaLabel={file.name}
          testId="files-file-card-select"
        />
      </div>
      <a
        href={url ?? "#"}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) {
            e.preventDefault();
            onSelect(e);
          }
        }}
        className="flex flex-1 flex-col"
      >
        <div className="flex h-24 items-center justify-center overflow-hidden bg-muted/40">
          {isImage && url ? (
            <img src={url} alt={file.name} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <DocumentText variant="Bulk" size={28} className="text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-1 p-3">
          <p className="truncate text-sm font-semibold group-hover:text-primary" title={file.name}>
            {file.name}
          </p>
          <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
          <p className="truncate text-xs text-muted-foreground">{attachedLabelFor(file.linkedTo, t)}</p>
          <p className="truncate text-xs text-muted-foreground">{resolveUser(file.createdBy as string)}</p>
          <p className="text-xs text-muted-foreground">{timeAgo(file.createdAt)}</p>
        </div>
      </a>
    </div>
  );
}

function FileRow({
  file,
  resolveUser,
  attachedLabelFor,
  t,
  selected,
  onSelect,
}: {
  file: DriveFileDoc;
  resolveUser: (id: string | undefined) => string;
  attachedLabelFor: (linkedTo: EntityRef | undefined, t: (k: any) => string) => string;
  t: (k: any) => string;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
}) {
  const url = useFileUrl(file._id as Id<"drive_files">, "view");
  const isImage = (file.contentType ?? "").startsWith("image/");
  return (
    <div
      data-testid="files-file-row"
      className={cn(
        "grid grid-cols-[2.5rem_2fr_1fr_1.5fr_1.5fr_1fr] items-center gap-3 px-4 py-2.5 text-sm transition-colors",
        selected ? "bg-primary/10" : "hover:bg-muted/40",
      )}
    >
      <SelectCheckbox
        checked={selected}
        onClick={onSelect}
        ariaLabel={file.name}
        testId="files-file-row-select"
      />
      <a
        href={url ?? "#"}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) {
            e.preventDefault();
            onSelect(e);
          }
        }}
        className="flex items-center gap-2 truncate"
      >
        {isImage && url ? (
          <img src={url} alt={file.name} className="h-8 w-8 shrink-0 rounded-md object-cover" loading="lazy" />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <DocumentText variant="Bulk" size={16} />
          </span>
        )}
        <span className="truncate font-medium" title={file.name}>
          {file.name}
        </span>
      </a>
      <span className="text-muted-foreground tabular-nums">{formatBytes(file.size)}</span>
      <span className="truncate text-muted-foreground">{attachedLabelFor(file.linkedTo, t)}</span>
      <span className="truncate text-muted-foreground">{resolveUser(file.createdBy as string)}</span>
      <span className="text-muted-foreground">{timeAgo(file.createdAt)}</span>
    </div>
  );
}
