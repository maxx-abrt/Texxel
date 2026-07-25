"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { PageContainer, PageHeader, EmptyState, timeAgo } from "@/components/app/common";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash, Refresh, Clock } from "iconsax-reactjs";

function timeUntil(ts: number) {
  const diff = Math.max(0, ts - Date.now());
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

export default function TaskTrashPage() {
  const { activeWorkspaceId } = useWorkspace();
  const trashed = useQuery(api.flux_tasks.getTrash, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const restore = useMutation(api.flux_tasks.restore);
  const remove = useMutation(api.flux_tasks.permanentlyDelete);
  const t = useTranslations("tasksTrash");
  const tc = useTranslations("common");

  return (
    <PageContainer className="max-w-[760px]">
      <PageHeader title={t("title")} subtitle={t("subtitle")} icon={Trash} testId="tasks-trash-header" />

      {trashed === undefined ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : trashed.length === 0 ? (
        <EmptyState icon={Trash} title={t("emptyTitle")} description={t("emptyDesc")} testId="tasks-trash-empty" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card" data-testid="tasks-trash-list">
          {trashed.map((d: any) => (
            <div key={d.binEntry._id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0" data-testid="tasks-trash-item">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.title || tc("untitled")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("deletedAt", { time: timeAgo(d.binEntry.deletedAt) })}
                  <span className="mx-1">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock variant="Bulk" size={11} /> {t("expiresIn", { time: timeUntil(d.binEntry.expiresAt) })}
                  </span>
                </p>
              </div>
              <button
                onClick={() => restore({ binId: d.binEntry._id }).then(() => toast.success(t("restored")))}
                className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-primary hover:bg-muted"
                data-testid="tasks-trash-restore"
              >
                <Refresh variant="Bulk" size={16} /> {t("restore")}
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive" data-testid="tasks-trash-delete">
                    <Trash variant="Bulk" size={16} />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("deletePermanently")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("deletePermanentlyConfirm", { title: d.title || tc("untitled") })}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => remove({ binId: d.binEntry._id }).then(() => toast.success(t("deletedPermanently")))}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      {tc("delete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
