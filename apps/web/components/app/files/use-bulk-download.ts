"use client";

import * as React from "react";
import JSZip from "jszip";
import { useCoreAction, coreApi } from "@a2e/core";
import type { DriveFileDoc, Id } from "@a2e/core";

/**
 * Bulk download helper for the Files manager.
 *
 * - Single file: resolves a presigned download URL and triggers a direct
 *   browser download (no zip overhead).
 * - Multiple files: resolves each presigned download URL, fetches the bytes,
 *   zips them client-side with JSZip, and triggers one `.zip` download.
 *
 * Progress is exposed as `phase` ("idle" | "fetching" | "zipping" | "done" |
 * "error") and `completed`/`total` counts so the caller can show a status.
 * Files that fail to fetch are skipped (not fatal); the caller is told how
 * many failed via the returned `{ failed }` count so it can toast.
 */
export function useBulkDownload() {
  const presignDownload = useCoreAction(coreApi.drive.presignDownload);
  const [phase, setPhase] = React.useState<"idle" | "fetching" | "zipping" | "done" | "error">("idle");
  const [completed, setCompleted] = React.useState(0);
  const [total, setTotal] = React.useState(0);

  const triggerBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on the next tick so the download has started.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadOne = React.useCallback(
    async (file: DriveFileDoc): Promise<boolean> => {
      try {
        const { url } = await presignDownload({ fileId: file._id as Id<"drive_files"> });
        const res = await fetch(url);
        if (!res.ok) return false;
        const blob = await res.blob();
        triggerBlob(blob, file.name);
        return true;
      } catch {
        return false;
      }
    },
    [presignDownload],
  );

  const downloadZip = React.useCallback(
    async (files: DriveFileDoc[]): Promise<{ failed: number }> => {
      setPhase("fetching");
      setTotal(files.length);
      setCompleted(0);
      const zip = new JSZip();
      let failed = 0;
      // De-duplicate names inside the zip by appending a counter on collision.
      const usedNames = new Set<string>();
      for (const file of files) {
        try {
          const { url } = await presignDownload({ fileId: file._id as Id<"drive_files"> });
          const res = await fetch(url);
          if (!res.ok) {
            failed++;
            setCompleted((c) => c + 1);
            continue;
          }
          const blob = await res.blob();
          let name = file.name || `file-${file._id}`;
          let n = 1;
          while (usedNames.has(name)) {
            const dot = file.name.lastIndexOf(".");
            if (dot > 0) {
              name = `${file.name.slice(0, dot)} (${n})${file.name.slice(dot)}`;
            } else {
              name = `${file.name} (${n})`;
            }
            n++;
          }
          usedNames.add(name);
          zip.file(name, blob);
          setCompleted((c) => c + 1);
        } catch {
          failed++;
          setCompleted((c) => c + 1);
        }
      }
      if (failed === files.length) {
        setPhase("error");
        return { failed };
      }
      setPhase("zipping");
      const zipped = await zip.generateAsync({ type: "blob" });
      const stamp = new Date().toISOString().slice(0, 10);
      triggerBlob(zipped, `bureau-files-${stamp}.zip`);
      setPhase("done");
      return { failed };
    },
    [presignDownload],
  );

  const download = React.useCallback(
    async (files: DriveFileDoc[]): Promise<{ failed: number }> => {
      if (!files.length) return { failed: 0 };
      if (files.length === 1) {
        setPhase("fetching");
        setTotal(1);
        setCompleted(0);
        const ok = await downloadOne(files[0]);
        setCompleted(1);
        setPhase(ok ? "done" : "error");
        return { failed: ok ? 0 : 1 };
      }
      return downloadZip(files);
    },
    [downloadOne, downloadZip],
  );

  const reset = React.useCallback(() => {
    setPhase("idle");
    setCompleted(0);
    setTotal(0);
  }, []);

  return { download, phase, completed, total, reset };
}
