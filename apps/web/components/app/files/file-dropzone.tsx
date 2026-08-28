"use client";

import * as React from "react";
import { useDropzone } from "react-dropzone";
import { useTranslations } from "next-intl";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Generalized multi-file dropzone (any type) that wraps page content.
 * Shows a full-page coral overlay when files are dragged over it, and calls
 * `onFiles` on drop. Built on `react-dropzone` (already a dep); the existing
 * `single-image-dropzone.tsx` stays as-is for single-image avatar/cover flows.
 *
 * The overlay is `absolute` within a `relative` parent, so consumers should
 * wrap the scrollable page region (not the whole viewport) — this keeps the
 * drop target aligned to the content the user is looking at.
 */
export function FileDropzone({
  onFiles,
  disabled,
  className,
  children,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("files.upload");
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    // No accept filter — any file type is welcome on the file manager.
    multiple: true,
    disabled,
    noClick: true,
    noKeyboard: true,
    onDrop: (accepted) => {
      if (accepted.length) onFiles(accepted);
    },
  });

  return (
    <div
      {...getRootProps({
        className: cn("relative", className),
      })}
      data-testid="files-dropzone"
    >
      <input {...getInputProps()} aria-label={t("dropHere")} />
      {children}
      {isDragActive && !disabled && (
        <div
          aria-live="polite"
          data-testid="files-dropzone-overlay"
          className={cn(
            "pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed bg-background/80 backdrop-blur-sm",
            isDragReject ? "border-destructive" : "border-primary",
          )}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--flux-coral-soft)] text-primary">
              <UploadCloud className="h-8 w-8" />
            </span>
            <p className="font-display text-lg font-semibold text-foreground">
              {isDragReject ? t("dropReject") : t("dropActive")}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">{t("dropHint")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
