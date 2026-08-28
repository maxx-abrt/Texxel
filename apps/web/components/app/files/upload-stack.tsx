"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { CheckCircle2, AlertCircle, X, RotateCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UploadItem } from "./use-file-uploads";

function formatBytes(bytes?: number): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : value >= 100 ? 0 : 1)} ${units[i]}`;
}

/**
 * Stacked mini upload cards, bottom-right (Huly `uploader` plugin pattern).
 * Each card shows file name, size, a progress bar, and a cancel / retry /
 * dismiss control depending on status. Done/error cards auto-dismiss after
 * a short delay; the user can also dismiss manually.
 *
 * Rendered `fixed` so it floats above the workbench content and never
 * re-flows the page. Stacks vertically with the newest at the bottom.
 */
export function UploadStack({
  items,
  onCancel,
  onDismiss,
  onRetry,
}: {
  items: UploadItem[];
  onCancel: (id: string) => void;
  onDismiss: (id: string) => void;
  onRetry?: (item: UploadItem) => void;
}) {
  const t = useTranslations("files.upload");

  // Auto-dismiss done/error cards after 6s.
  React.useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const it of items) {
      if (it.status === "done" || it.status === "error") {
        timers.push(setTimeout(() => onDismiss(it.id), 6000));
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [items, onDismiss]);

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label={t("stackLabel")}
      data-testid="upload-stack"
      className="pointer-events-none fixed bottom-4 right-4 z-[var(--z-toast,70)] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {items.map((it) => (
          <UploadCard
            key={it.id}
            item={it}
            onCancel={onCancel}
            onDismiss={onDismiss}
            onRetry={onRetry}
            t={t}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function UploadCard({
  item,
  onCancel,
  onDismiss,
  onRetry,
  t,
}: {
  item: UploadItem;
  onCancel: (id: string) => void;
  onDismiss: (id: string) => void;
  onRetry?: (item: UploadItem) => void;
  t: (k: any, vars?: any) => string;
}) {
  const isUploading = item.status === "uploading";
  const isDone = item.status === "done";
  const isError = item.status === "error";
  const isCancelled = item.status === "cancelled";

  const statusLabel = isUploading
    ? t("statusUploading", { pct: item.progress })
    : isDone
      ? t("statusDone")
      : isError
        ? t("statusError")
        : isCancelled
          ? t("statusCancelled")
          : "";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      data-testid="upload-card"
      data-upload-id={item.id}
      data-upload-status={item.status}
      className="pointer-events-auto overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--elev-2)]"
    >
      <div className="flex items-start gap-3 p-3">
        <span
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            isDone
              ? "bg-[var(--flux-coral-soft)] text-primary"
              : isError
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground",
          )}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isDone ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : isError ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground" title={item.name}>
            {item.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(item.size)} · {statusLabel}
          </p>

          {(isUploading || isDone) && (
            <div
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={item.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("progressLabel", { name: item.name })}
              data-testid="upload-progress"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-200",
                  isDone ? "bg-primary" : "bg-primary/80",
                )}
                style={{ width: `${item.progress}%` }}
              />
            </div>
          )}
          {isError && item.error && (
            <p className="mt-1 text-xs text-destructive" data-testid="upload-error">
              {item.error === "quota" ? t("errorQuota") : t("errorGeneric")}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isError && onRetry && (
            <button
              onClick={() => onRetry(item)}
              aria-label={t("retry")}
              title={t("retry")}
              data-testid="upload-retry"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          )}
          {isUploading ? (
            <button
              onClick={() => onCancel(item.id)}
              aria-label={t("cancel")}
              title={t("cancel")}
              data-testid="upload-cancel"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={() => onDismiss(item.id)}
              aria-label={t("dismiss")}
              title={t("dismiss")}
              data-testid="upload-dismiss"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
