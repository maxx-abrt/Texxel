"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { useTranslations } from "next-intl";
import { PageContainer, PageHeader, EmptyState, btnPrimary, btnOutline, timeAgo, inputBase } from "@/components/app/common";
import { TemplatePickerDialog } from "@/components/app/template-picker-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DocumentText, Add, SearchNormal1, Clock, Star1, Folder } from "iconsax-reactjs";
import { Upload } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useTrashDnd } from "@/components/providers/dnd-trash-provider";

export default function DocumentsPage() {
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace();
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
  const createDoc = useMutation(api.flux_documents.create);
  const [q, setQ] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"templates" | "import">("templates");

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

  const openPicker = (tab: "templates" | "import" = "templates") => {
    setPickerTab(tab);
    setPickerOpen(true);
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
          <div className="flex items-center gap-2">
            <button onClick={() => openPicker("import")} className={btnOutline} data-testid="import-document-btn">
              <Upload variant="Bulk" size={18} /> {t("importTab")}
            </button>
            <button onClick={() => openPicker("templates")} className={btnPrimary} data-testid="new-document-btn">
              <Add variant="Bulk" size={18} /> {t("newDocument")}
            </button>
          </div>
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

      {/* Template picker (shared) */}
      <TemplatePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={createFrom}
        initialTab={pickerTab}
      />
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
        isTrashing && "pointer-events-none scale-80 translate-y-2 opacity-0 transition-all duration-350",
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
