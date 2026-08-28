"use client";

import * as React from "react";
import { useCoreAction, useCoreMutation, coreApi } from "@a2e/core";
import type { Id, EntityRef } from "@a2e/core";
import { toCoreError } from "@a2e/core";
import { coreFlags } from "@/lib/core-flags";
import { useQuotaGuard } from "@/hooks/use-quota-guard";

export type UploadStatus = "uploading" | "done" | "error" | "cancelled";

export interface UploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  contentType: string;
  progress: number;
  status: UploadStatus;
  error?: string;
  /** Core drive file id once presign resolves; used to clean up on cancel. */
  fileId?: Id<"drive_files">;
}

export interface EnqueueOptions {
  workspaceId: Id<"workspaces">;
  folderId?: Id<"drive_folders">;
  linkedTo?: EntityRef;
  sourceApp?: string;
}

/**
 * Per-file XHR PUT to the presigned B2 URL with progress + abort.
 * Mirrors `putWithProgress` from `@a2e/core` drive.ts but exposes an AbortSignal.
 */
function putWithAbort(
  url: string,
  body: Blob,
  contentType: string,
  signal: AbortSignal,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", contentType);
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed with status ${xhr.status}`));
    xhr.onerror = () => reject(new Error("Upload failed: network error"));
    signal.addEventListener("abort", () => {
      xhr.abort();
      reject(new DOMException("Aborted", "AbortError"));
    });
    xhr.send(body);
  });
}

/**
 * Manages a stack of concurrent file uploads to the shared A2E Core drive.
 * Calls `drive.presignUpload` directly (file row is created at presign time),
 * then PUTs the bytes with per-file progress + cancel. On cancel, the empty
 * file row is removed via `drive.removeFile` so the list stays clean.
 *
 * Quotas: when `coreFlags.quotas` is on, each file is size-guarded and the
 * PUT is wrapped with `catchQuota` so a QuotaExceededError surfaces the
 * upgrade dialog instead of a raw alert.
 */
export function useFileUploads() {
  const presign = useCoreAction(coreApi.drive.presignUpload);
  const removeFile = useCoreMutation(coreApi.drive.removeFile);
  const storageQuota = useQuotaGuard("storageBytes");
  const fileSizeQuota = useQuotaGuard("maxFileUploadBytes");

  const [items, setItems] = React.useState<UploadItem[]>([]);
  const controllersRef = React.useRef(new Map<string, AbortController>());

  const updateItem = React.useCallback(
    (id: string, patch: Partial<UploadItem>) => {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    },
    [],
  );

  const cancel = React.useCallback(
    async (id: string) => {
      const ctrl = controllersRef.current.get(id);
      if (ctrl) ctrl.abort();
      controllersRef.current.delete(id);
      // Clean up the empty file row created at presign time, if any.
      setItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, status: "cancelled", progress: it.progress } : it,
        ),
      );
      const item = items.find((it) => it.id === id);
      if (item?.fileId) {
        try {
          await removeFile({ fileId: item.fileId });
        } catch {
          // Best-effort cleanup; the row may already be gone.
        }
      }
    },
    [items, removeFile],
  );

  const clear = React.useCallback(() => {
    // Abort any in-flight uploads before clearing state.
    for (const ctrl of controllersRef.current.values()) ctrl.abort();
    controllersRef.current.clear();
    setItems([]);
  }, []);

  const dismiss = React.useCallback((id: string) => {
    // Only dismiss non-uploading cards; uploading cards must be cancelled.
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const enqueue = React.useCallback(
    async (files: File[], opts: EnqueueOptions) => {
      if (!files.length) return;
      const sourceApp = opts.sourceApp ?? "bureau";
      for (const file of files) {
        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `up-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const item: UploadItem = {
          id,
          file,
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
          progress: 0,
          status: "uploading",
        };
        setItems((prev) => [...prev, item]);
        const ctrl = new AbortController();
        controllersRef.current.set(id, ctrl);

        // Quota pre-checks (core drive only).
        if (coreFlags.quotas) {
          if (!fileSizeQuota.guard() || !storageQuota.guard()) {
            controllersRef.current.delete(id);
            updateItem(id, { status: "error", error: "quota" });
            continue;
          }
        }

        try {
          const presigned = await presign({
            workspaceId: opts.workspaceId,
            name: file.name,
            size: file.size,
            contentType: item.contentType,
            folderId: opts.folderId,
            sourceApp,
            linkedTo: opts.linkedTo,
          });
          updateItem(id, { fileId: presigned.fileId, progress: 1 });

          const put = () =>
            putWithAbort(
              presigned.uploadUrl,
              file,
              item.contentType,
              ctrl.signal,
              (pct) => updateItem(id, { progress: pct }),
            );

          if (coreFlags.quotas) {
            const result = await storageQuota.catchQuota(put);
            if (result === undefined) {
              // Quota exceeded mid-upload — clean up the row.
              try {
                await removeFile({ fileId: presigned.fileId });
              } catch {
                /* ignore */
              }
              updateItem(id, { status: "error", error: "quota" });
              controllersRef.current.delete(id);
              continue;
            }
          } else {
            await put();
          }
          updateItem(id, { status: "done", progress: 100 });
        } catch (raw) {
          if (raw instanceof DOMException && raw.name === "AbortError") {
            // Already marked cancelled above.
            continue;
          }
          const err = toCoreError(raw);
          updateItem(id, { status: "error", error: err.message });
        } finally {
          controllersRef.current.delete(id);
        }
      }
    },
    [presign, removeFile, storageQuota, fileSizeQuota, updateItem],
  );

  const retry = React.useCallback(
    (item: UploadItem, opts: EnqueueOptions) => {
      // Drop the failed/cancelled card and re-enqueue the same file.
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      void enqueue([item.file], opts);
    },
    [enqueue],
  );

  return {
    items,
    enqueue,
    cancel,
    clear,
    dismiss,
    retry,
    /** Quota dialog state for the storage domain (render <UpgradeDialog/>). */
    storageQuotaDialog: storageQuota.dialogState,
    setStorageQuotaDialog: storageQuota.setDialogState,
    /** Quota dialog state for the per-file size domain. */
    fileSizeQuotaDialog: fileSizeQuota.dialogState,
    setFileSizeQuotaDialog: fileSizeQuota.setDialogState,
  };
}
