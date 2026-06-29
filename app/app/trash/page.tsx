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
import { Trash, Refresh } from "iconsax-reactjs";

export default function TrashPage() {
  const { activeWorkspaceId } = useWorkspace();
  const trashed = useQuery(api.flux_documents.getTrash, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const restore = useMutation(api.flux_documents.restore);
  const remove = useMutation(api.flux_documents.remove);
  const t = useTranslations("trash");
  const tc = useTranslations("common");

  return (
    <PageContainer className="max-w-[760px]">
      <PageHeader title={t("title")} subtitle={t("subtitle")} icon={Trash} testId="trash-header" />

      {trashed === undefined ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : trashed.length === 0 ? (
        <EmptyState icon={Trash} title={t("emptyTitle")} description={t("emptyDesc")} testId="trash-empty" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card" data-testid="trash-list">
          {trashed.map((d: any) => (
            <div key={d._id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0" data-testid="trash-item">
              <span className="text-xl">{d.icon ?? "\ud83d\udcc4"}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{d.title || tc("untitled")}</p><p className="text-xs text-muted-foreground">{t("deletedAt", { time: timeAgo(d.updatedAt) })}</p></div>
              <button onClick={() => restore({ documentId: d._id }).then(() => toast.success(t("restored")))} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-primary hover:bg-muted" data-testid="trash-restore"><Refresh variant="Bulk" size={16} /> {t("restore")}</button>
              <AlertDialog>
                <AlertDialogTrigger asChild><button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive" data-testid="trash-delete"><Trash variant="Bulk" size={16} /></button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>{t("deletePermanently")}</AlertDialogTitle><AlertDialogDescription>{t("deletePermanentlyConfirm", { title: d.title || tc("untitled") })}</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove({ documentId: d._id }).then(() => toast.success(t("deletedPermanently")))} className="bg-destructive text-white hover:bg-destructive/90">{tc("delete")}</AlertDialogAction>
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
