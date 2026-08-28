"use client";

import { useRef } from "react";
import { useLinkedFiles, useFileUrl } from "@a2e/core";
import type { DriveFileDoc, EntityRef, Id } from "@a2e/core";
import { useCoreWorkspaceId } from "@/hooks/use-core-workspace-id";
import { coreFlags } from "@/lib/core-flags";
import { useFileUploads } from "@/components/app/files/use-file-uploads";
import { useActiveDocumentId } from "./use-active-document";
import { UpgradeDialog } from "@/components/app/upgrade-dialog";
import { useTranslations } from "next-intl";
import { DocumentText, DocumentUpload, Paperclip2, DocumentDownload } from "iconsax-reactjs";
import { cn } from "@/lib/utils";

/** Human-readable file size (B/KB/MB/GB) — mirrors the files page helper. */
function formatBytes(bytes?: number): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : value >= 100 ? 0 : 1)} ${units[i]}`;
}

/** A single attachment chip: type icon + name + size + open/download. */
function AttachmentChip({ file }: { file: DriveFileDoc }) {
  const t = useTranslations("filesWidget");
  const url = useFileUrl(file._id as Id<"drive_files">, "view");
  const isImage = (file.contentType ?? "").startsWith("image/");
  return (
    <li
      data-testid="widget-files-chip"
      className="group flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-2 transition-colors hover:bg-muted/40"
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          isImage ? "bg-[var(--flux-coral-soft)] text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {isImage && url ? (
          <img
            src={url}
            alt=""
            className="h-full w-full rounded-lg object-cover"
            loading="lazy"
          />
        ) : (
          <DocumentText variant="Bulk" size={16} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">{formatBytes(file.size)}</p>
      </div>
      <a
        href={url ?? "#"}
        target="_blank"
        rel="noreferrer"
        aria-label={t("open", { name: file.name })}
        title={t("open", { name: file.name })}
        data-testid="widget-files-chip-open"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <DocumentDownload variant="Bulk" size={15} />
      </a>
    </li>
  );
}

/**
 * Files widget (§3, §14.6): lists files attached to the currently-open
 * document via the shared A2E Core drive (`useLinkedFiles` over
 * `drive_files.linkedTo = { app: "bureau", type: "document", id }`).
 * Attachments render as chips with type icon + size. New files can be
 * uploaded directly into the widget (presigned with `linkedTo` so they
 * attach on upload). When no document is open, or the core drive is
 * unavailable, renders a designed empty state.
 */
export function FilesWidget() {
  const t = useTranslations("filesWidget");
  const tWidget = useTranslations("widgets");
  const documentId = useActiveDocumentId();
  const coreWsId = useCoreWorkspaceId();
  const driveEnabled = coreFlags.drive;

  const target: EntityRef | null =
    documentId && coreWsId
      ? { app: "bureau", type: "document", id: String(documentId) }
      : null;

  const files = useLinkedFiles(
    driveEnabled ? (coreWsId as Id<"workspaces"> | null) : null,
    target,
  );

  const uploads = useFileUploads();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || !fileList.length || !coreWsId || !documentId) return;
    void uploads.enqueue(Array.from(fileList), {
      workspaceId: coreWsId as Id<"workspaces">,
      sourceApp: "bureau",
      linkedTo: { app: "bureau", type: "document", id: String(documentId) },
    });
  };

  const activeUploads = uploads.items.filter((it) => it.status === "uploading");

  // No document open — designed empty state.
  if (!documentId) {
    return (
      <div
        data-testid="widget-files-empty"
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center"
      >
        <Paperclip2 variant="Bulk" size={32} className="opacity-40 text-muted-foreground" />
        <p className="text-sm font-medium">{tWidget("filesNoDoc")}</p>
        <p className="text-xs text-muted-foreground">{tWidget("filesNoDocHint")}</p>
      </div>
    );
  }

  // Core drive unavailable — fallback empty state (no crash).
  if (!driveEnabled || !coreWsId) {
    return (
      <div
        data-testid="widget-files-unavailable"
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center"
      >
        <Paperclip2 variant="Bulk" size={32} className="opacity-40 text-muted-foreground" />
        <p className="text-sm font-medium">{t("unavailable")}</p>
        <p className="text-xs text-muted-foreground">{t("unavailableHint")}</p>
      </div>
    );
  }

  const list = files ?? [];

  return (
    <div data-testid="widget-files" className="flex min-h-0 flex-1 flex-col">
      {/* Header row: count + upload button */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("count", { count: list.length })}
        </span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label={t("uploadButton")}
          title={t("uploadButton")}
          data-testid="widget-files-upload"
          disabled={activeUploads.length > 0}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_92%,black)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <DocumentUpload variant="Bold" size={14} />
          {t("uploadButton")}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          data-testid="widget-files-input"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {files === undefined ? (
          <ul className="space-y-2" data-testid="widget-files-skeleton">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
            ))}
          </ul>
        ) : list.length === 0 && activeUploads.length === 0 ? (
          <div
            data-testid="widget-files-empty-list"
            className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground"
          >
            <Paperclip2 variant="Bulk" size={32} className="mb-2 opacity-40" />
            {t("empty")}
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((f) => (
              <AttachmentChip key={f._id} file={f} />
            ))}
          </ul>
        )}

        {/* Inline upload progress (compact) */}
        {activeUploads.length > 0 && (
          <ul className="mt-3 space-y-1.5" data-testid="widget-files-uploading">
            {activeUploads.map((it) => (
              <li
                key={it.id}
                className="rounded-xl border border-border bg-card px-2.5 py-2"
                data-testid="widget-files-uploading-item"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium" title={it.name}>
                    {it.name}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{it.progress}%</span>
                </div>
                <div
                  className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={it.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={it.name}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-150"
                    style={{ width: `${it.progress}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

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
    </div>
  );
}
