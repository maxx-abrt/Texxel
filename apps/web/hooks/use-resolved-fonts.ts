"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCoreAction, coreApi } from "@a2e/core";

/**
 * Wraps flux_fonts.list and resolves a presigned core-drive URL for fonts
 * uploaded through the A2E Core drive (coreFileId set, no legacy storageId).
 * Legacy fonts keep the fileUrl resolved server-side from Convex storage.
 */
export function useResolvedFonts(workspaceId: Id<"workspaces"> | null | undefined) {
  const fonts = useQuery(api.flux_fonts.list, workspaceId ? { workspaceId } : "skip");
  const presignView = useCoreAction(coreApi.drive.presignView);
  const [coreUrls, setCoreUrls] = useState<Record<string, string>>({});

  const missing = useMemo(
    () =>
      (fonts ?? []).filter(
        (f: any) => f.coreFileId && !f.fileUrl && !f.deletedAt && !coreUrls[f._id as string],
      ),
    [fonts, coreUrls],
  );

  useEffect(() => {
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      const resolved: Record<string, string> = {};
      for (const f of missing) {
        try {
          const { url } = await presignView({ fileId: f.coreFileId as any });
          resolved[f._id as string] = url;
        } catch {
          // Leave unresolved: font falls back to no fileUrl, same as a missing legacy file.
        }
      }
      if (!cancelled && Object.keys(resolved).length) {
        setCoreUrls((prev) => ({ ...prev, ...resolved }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [missing, presignView]);

  return useMemo(
    () =>
      fonts?.map((f: any) =>
        f.coreFileId && !f.fileUrl && coreUrls[f._id as string]
          ? { ...f, fileUrl: coreUrls[f._id as string] }
          : f,
      ),
    [fonts, coreUrls],
  );
}
