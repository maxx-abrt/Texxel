"use client";

import * as React from "react";
import { useFolders } from "@a2e/core";
import type { DriveFolderDoc, Id } from "@a2e/core";
import { useCoreWorkspaceId } from "@/hooks/use-core-workspace-id";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { btnOutline, btnPrimary } from "@/components/app/common";
import { useTranslations } from "next-intl";
import { Folder, FolderOpen, ArrowRight } from "iconsax-reactjs";
import { cn } from "@/lib/utils";

interface Crumb {
  id: string | undefined;
  name: string;
}

interface MoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Folder the selected files currently live in (excluded as a pick target hint). */
  currentFolderId: string | undefined;
  /** Count of files being moved (for the description copy). */
  count: number;
  onConfirm: (targetFolderId: Id<"drive_folders"> | undefined) => void;
}

/**
 * Folder picker dialog for the bulk Move action.
 *
 * Breadcrumb-style navigation: starts at the workspace root, lists subfolders
 * of the current location, and lets the user drill into a folder before
 * choosing "Move here". Reuses the same `useFolders` query as the Files page
 * so the data is consistent and Convex dedupes the subscription.
 */
export function MoveDialog({ open, onOpenChange, currentFolderId, count, onConfirm }: MoveDialogProps) {
  const coreWsId = useCoreWorkspaceId();
  const t = useTranslations("files.bulk");
  const tc = useTranslations("common");
  const [crumbs, setCrumbs] = React.useState<Crumb[]>([{ id: undefined, name: t("moveRoot") }]);

  // Reset to root each time the dialog opens.
  React.useEffect(() => {
    if (open) setCrumbs([{ id: undefined, name: t("moveRoot") }]);
  }, [open, t]);

  const currentId = crumbs[crumbs.length - 1]?.id as Id<"drive_folders"> | undefined;
  const folders = useFolders(
    coreWsId ? (coreWsId as Id<"workspaces">) : null,
    currentId,
  );

  const openFolder = (folder: DriveFolderDoc) => {
    setCrumbs((prev) => [...prev, { id: folder._id as string, name: folder.name }]);
  };
  const navigateTo = (idx: number) => {
    setCrumbs((prev) => prev.slice(0, idx + 1));
  };

  const isCurrent = currentId === currentFolderId;

  const handleConfirm = () => {
    onConfirm(currentId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="files-move-dialog">
        <DialogHeader>
          <DialogTitle>{t("moveTo")}</DialogTitle>
          <DialogDescription>{t("moveDialogDesc", { count })}</DialogDescription>
        </DialogHeader>

        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1 text-sm" data-testid="files-move-breadcrumb">
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={`${c.id ?? "root"}-${i}`} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground">/</span>}
                {isLast ? (
                  <span className="font-semibold text-foreground" data-testid="files-move-crumb-current">
                    {c.name}
                  </span>
                ) : (
                  <button
                    onClick={() => navigateTo(i)}
                    className="rounded-md px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    data-testid={`files-move-crumb-${i}`}
                  >
                    {c.name}
                  </button>
                )}
              </span>
            );
          })}
        </nav>

        {/* Folder list */}
        <div className="max-h-64 overflow-y-auto rounded-xl border border-border bg-card" data-testid="files-move-list">
          {!folders ? (
            <div className="space-y-1 p-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : folders.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground" data-testid="files-move-empty">
              {t("noFolders")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {folders.map((f) => (
                <li key={f._id}>
                  <button
                    onClick={() => openFolder(f)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/40"
                    data-testid="files-move-folder"
                  >
                    <Folder variant="Bulk" size={18} className="shrink-0 text-primary" />
                    <span className="truncate">{f.name}</span>
                    <ArrowRight variant="Bulk" size={14} className="ml-auto shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2">
          {isCurrent && (
            <span
              className="mr-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              data-testid="files-move-current-hint"
            >
              <FolderOpen variant="Bulk" size={14} />
              {t("moveCurrent")}
            </span>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={btnOutline}
            data-testid="files-move-cancel"
          >
            {tc("cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={btnPrimary}
            data-testid="files-move-confirm"
          >
            {t("moveHere")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
