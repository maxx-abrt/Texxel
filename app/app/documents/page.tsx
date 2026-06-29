"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { useLocale } from "@/components/providers/locale-provider";
import { useTranslations } from "next-intl";
import { getBuiltinTemplates } from "@/lib/doc-templates";
import { PageContainer, PageHeader, EmptyState, btnPrimary, btnOutline, timeAgo, inputBase } from "@/components/app/common";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DocumentText, Add, SearchNormal1, Clock, Star1, Trash, Folder } from "iconsax-reactjs";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useTrashDnd } from "@/components/providers/dnd-trash-provider";

export default function DocumentsPage() {
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace();
  const { locale } = useLocale();
  const t = useTranslations("editor");
  const tc = useTranslations("common");
  const docs = useQuery(
    api.flux_documents.list,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );
  const favorites = useQuery(
    api.flux_documents.listFavorites,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );
  const savedTemplates = useQuery(
    api.flux_docTemplates.list,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );
  const createDoc = useMutation(api.flux_documents.create);
  const removeTemplate = useMutation(api.flux_docTemplates.remove);
  const [q, setQ] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const builtins = getBuiltinTemplates(locale);

  const onNew = async () => {
    if (!activeWorkspaceId) return;
    try {
      const id = await createDoc({ workspaceId: activeWorkspaceId, title: tc("untitled") });
      router.push(`/app/documents/${id}`);
    } catch {
      toast.error(t("createFailed"));
    }
  };

  const createFrom = async (opts: { title: string; icon?: string; content?: string }) => {
    if (!activeWorkspaceId) return;
    try {
      const id = await createDoc({ workspaceId: activeWorkspaceId, title: opts.title, icon: opts.icon, content: opts.content });
      setPickerOpen(false);
      router.push(`/app/documents/${id}`);
    } catch {
      toast.error(t("createFailed"));
    }
  };

  const favIds = new Set((favorites ?? []).map((f: any) => f._id));
  const filtered = (docs ?? [])
    .filter((d: any) => d.title.toLowerCase().includes(q.toLowerCase()))
    .sort((a: any, b: any) => b.updatedAt - a.updatedAt);

  return (
    <PageContainer>
      <PageHeader
        title={t("documentsTitle")}
        subtitle={t("documentsSubtitle")}
        icon={DocumentText}
        testId="documents-header"
        actions={
          <button onClick={() => setPickerOpen(true)} className={btnPrimary} data-testid="new-document-btn">
            <Add variant="Bulk" size={18} /> {t("newDocument")}
          </button>
        }
      />

      <div className="relative mb-5 max-w-md">
        <SearchNormal1 variant="Bulk" size={18} className="absolute left-3 top-2.5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchDocuments")}
          data-testid="documents-search"
          className={cn(inputBase, "pl-10")}
        />
      </div>

      {docs === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={DocumentText}
          title={q ? t("noDocumentsMatch") : t("noDocuments")}
          description={q ? t("tryDifferentKeyword") : t("noDocumentsDesc")}
          testId="documents-empty"
          action={
            !q && (
              <button onClick={onNew} className={btnPrimary} data-testid="empty-new-document">
                <Add variant="Bulk" size={18} /> {t("newDocument")}
              </button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="documents-grid">
          {filtered.map((d: any) => (
            <DraggableDocumentCard key={d._id} doc={d} isFavorite={favIds.has(d._id)} />
          ))}
        </div>
      )}

      {/* Template picker */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-2xl" data-testid="template-picker">
          <DialogHeader><DialogTitle>{t("templateDialogTitle")}</DialogTitle><DialogDescription>{t("templateDialogDesc")}</DialogDescription></DialogHeader>
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2">
            <button onClick={onNew} data-testid="template-blank" className="flex items-start gap-3 rounded-2xl border border-border p-4 text-left transition hover:border-primary hover:shadow-sm">
              <span className="text-2xl">📄</span>
              <span><span className="block font-semibold">{t("blankDocument")}</span><span className="text-xs text-muted-foreground">{t("startFromScratch")}</span></span>
            </button>
            {builtins.map((tpl) => (
              <button key={tpl.id} onClick={() => createFrom({ title: tpl.title, icon: tpl.icon, content: JSON.stringify(tpl.blocks) })} data-testid="template-builtin" className="flex items-start gap-3 rounded-2xl border border-border p-4 text-left transition hover:border-primary hover:shadow-sm">
                <span className="text-2xl">{tpl.icon}</span>
                <span><span className="block font-semibold">{tpl.title}</span><span className="text-xs text-muted-foreground">{tpl.description}</span></span>
              </button>
            ))}
          </div>
          {(savedTemplates ?? []).length > 0 && (
            <div className="mt-2 border-t border-border pt-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">{t("savedTemplates")}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {savedTemplates!.map((tpl: any) => (
                  <div key={tpl._id} className="group flex items-center gap-2 rounded-xl border border-border p-2.5">
                    <button onClick={() => createFrom({ title: tpl.title, icon: tpl.icon, content: tpl.content })} className="flex flex-1 items-center gap-2 text-left" data-testid="template-saved">
                      <span className="text-xl">{tpl.icon ?? "📄"}</span>
                      <span className="truncate text-sm font-medium">{tpl.title}</span>
                    </button>
                    <button onClick={() => removeTemplate({ templateId: tpl._id })} className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"><Trash variant="Bulk" size={15} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function DraggableDocumentCard({ doc, isFavorite }: { doc: any; isFavorite: boolean }) {
  const isFolder = doc.isFolder ?? false;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `documents-${doc._id}`,
    data: { documentId: doc._id, title: doc.title, icon: doc.icon, type: "card" },
  });
  const { trashingIds } = useTrashDnd();
  const isTrashing = trashingIds.has(doc._id);
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const t = useTranslations("editor");
  const tc = useTranslations("common");

  return (
    <div
      data-testid={isFolder ? "folder-card" : "document-card"}
      ref={setNodeRef as any}
      {...attributes}
      {...listeners}
      style={style}
      className={cn(
        "group relative flex flex-col rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-sm",
        isDragging && "z-50 cursor-grabbing opacity-0",
        isTrashing && "pointer-events-none scale-95 opacity-0 transition-all duration-300",
        isFolder && "bg-sidebar-accent/30 hover:bg-sidebar-accent/50",
      )}
    >
      <Link href={`/app/documents/${doc._id}`} className="flex flex-1 flex-col">
        <div className="flex items-start justify-between">
          <span className="text-3xl leading-none">{doc.icon ?? (isFolder ? "\ud83d\udcc1" : "\ud83d\udcc4")}</span>
          {isFavorite && <Star1 variant="Bulk" size={16} className="text-primary" />}
        </div>
        <p className="mt-3 truncate font-semibold group-hover:text-primary">{doc.title || tc("untitled")}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          {isFolder ? (
            <>
              <Folder variant="Bulk" size={12} /> {tc("folder")}
            </>
          ) : (
            <>
              <Clock variant="Bulk" size={12} /> {timeAgo(doc.updatedAt)}
            </>
          )}
        </p>
      </Link>
    </div>
  );
}
