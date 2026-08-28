"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { DocumentDownload, Convert, Trash, CloseCircle } from "iconsax-reactjs";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkActionsBarProps {
  count: number;
  /** True while a zip download is in flight (disables actions, shows spinner). */
  downloading: boolean;
  /** Progress label for the in-flight download (e.g. "Zipping 3 files…"). */
  downloadLabel?: string;
  onDownload: () => void;
  onMove: () => void;
  onDelete: () => void;
  onClear: () => void;
}

/**
 * Floating bulk-action bar shown when one or more files are selected in the
 * Files manager. Mirrors Huly's drive bulk-action toolbar: count on the left,
 * Download / Move / Delete actions, and a clear-selection control.
 *
 * Rendered `fixed` above the upload stack (bottom-right, offset up so the two
 * never overlap) and animated in/out with Framer Motion on the standard ease.
 */
export function BulkActionsBar({
  count,
  downloading,
  downloadLabel,
  onDownload,
  onMove,
  onDelete,
  onClear,
}: BulkActionsBarProps) {
  const t = useTranslations("files.bulk");

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1.5 shadow-lg elev-2 md:left-auto md:right-4 md:translate-x-0"
          data-testid="files-bulk-bar"
        >
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary"
            data-testid="files-bulk-count"
          >
            {t("selected", { count })}
          </span>

          <div className="mx-0.5 h-5 w-px bg-border" />

          <button
            onClick={onDownload}
            disabled={downloading}
            aria-label={t("download")}
            data-testid="files-bulk-download"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {downloading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <DocumentDownload variant="Bold" size={16} />
            )}
            <span className="hidden sm:inline">{downloading && downloadLabel ? downloadLabel : t("download")}</span>
          </button>

          <button
            onClick={onMove}
            disabled={downloading}
            aria-label={t("move")}
            data-testid="files-bulk-move"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Convert variant="Bold" size={16} />
            <span className="hidden sm:inline">{t("move")}</span>
          </button>

          <button
            onClick={onDelete}
            disabled={downloading}
            aria-label={t("delete")}
            data-testid="files-bulk-delete"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash variant="Bold" size={16} />
            <span className="hidden sm:inline">{t("delete")}</span>
          </button>

          <div className="mx-0.5 h-5 w-px bg-border" />

          <button
            onClick={onClear}
            aria-label={t("clear")}
            data-testid="files-bulk-clear"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CloseCircle variant="Bold" size={18} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
