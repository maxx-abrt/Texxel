"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowRight2,
  Add,
  DocumentText,
  Folder,
  FolderOpen,
  More,
  Edit2,
  Copy,
  Star1,
  Link21,
  Trash,
} from "iconsax-reactjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useTrashDnd } from "@/components/providers/dnd-trash-provider";
import { Id } from "@/convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type Doc = {
  _id: Id<"flux_documents">;
  title: string;
  icon?: string;
  parentId?: Id<"flux_documents">;
  isFolder?: boolean;
};

export type TreeSharedProps = {
  activeId?: string | null;
  favoriteIds?: Set<string>;
  openIds: Set<string>;
  onToggleOpen: (id: string, open: boolean) => void;
};

export function DocumentTree({
  docs,
  parentId,
  onNavigate,
  onCreateChild,
  level,
  activeId,
  favoriteIds,
  openIds,
  onToggleOpen,
}: {
  docs: Doc[];
  parentId: Id<"flux_documents"> | null;
  onNavigate: () => void;
  onCreateChild: (parentId?: Id<"flux_documents">) => void | Promise<void>;
  level: number;
} & TreeSharedProps) {
  const children = useMemo(() => docs.filter((d) => (d.parentId ?? null) === parentId), [docs, parentId]);
  if (children.length === 0) return null;
  return (
    <div className={cn("relative", level > 0 && "tx-tree-expand")}>
      {children.map((doc) => (
        <TreeNode
          key={doc._id}
          doc={doc}
          docs={docs}
          onNavigate={onNavigate}
          onCreateChild={onCreateChild}
          level={level}
          activeId={activeId}
          favoriteIds={favoriteIds}
          openIds={openIds}
          onToggleOpen={onToggleOpen}
        />
      ))}
    </div>
  );
}

function TreeNode({
  doc,
  docs,
  onNavigate,
  onCreateChild,
  level,
  activeId,
  favoriteIds,
  openIds,
  onToggleOpen,
}: {
  doc: Doc;
  docs: Doc[];
  onNavigate: () => void;
  onCreateChild: (parentId?: Id<"flux_documents">) => void | Promise<void>;
  level: number;
} & TreeSharedProps) {
  const hasChildren = useMemo(() => docs.some((d) => d.parentId === doc._id), [docs, doc._id]);
  const isFolder = doc.isFolder ?? false;
  const open = openIds.has(String(doc._id));
  const isActive = activeId === String(doc._id);
  const isFavorite = favoriteIds?.has(String(doc._id)) ?? false;
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace();
  const t = useTranslations("tree");
  const tc = useTranslations("common");
  const createDoc = useMutation(api.flux_documents.create);
  const createFolder = useMutation(api.flux_documents.createFolder);
  const update = useMutation(api.flux_documents.update);
  const duplicateFn = useMutation(api.flux_documents.duplicate);
  const toggleFavorite = useMutation(api.flux_documents.toggleFavorite);
  const archive = useMutation(api.flux_documents.archive);
  const { trashingIds } = useTrashDnd();

  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(doc.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: `tree-${doc._id}`,
    data: { documentId: doc._id, isFolder, title: doc.title, icon: doc.icon, type: "tree" },
    disabled: editing,
  });

  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `tree-${doc._id}`,
    data: { documentId: doc._id, isFolder },
  });

  const isTrashing = trashingIds.has(doc._id);

  const setRefs = (el: HTMLDivElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const addChild = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!activeWorkspaceId) return;
    const id = await createDoc({ workspaceId: activeWorkspaceId, title: "Untitled", parentId: doc._id as Id<"flux_documents"> });
    onToggleOpen(String(doc._id), true);
    router.push(`/app/documents/${id}`);
  };

  const addFolder = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!activeWorkspaceId) return;
    await createFolder({ workspaceId: activeWorkspaceId, parentId: doc._id as Id<"flux_documents"> });
    onToggleOpen(String(doc._id), true);
  };

  const startRename = () => {
    setDraft(doc.title);
    setEditing(true);
    setMenuOpen(false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const commitRename = async () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== doc.title) {
      try {
        await update({ documentId: doc._id, title: next });
      } catch {
        toast.error(tc("createFailed"));
      }
    }
  };

  const onDuplicate = async () => {
    try {
      const newId = await duplicateFn({ documentId: doc._id });
      toast.success(t("duplicated"));
      router.push(`/app/documents/${newId}`);
    } catch {
      toast.error(tc("createFailed"));
    }
  };

  const onCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/app/documents/${doc._id}`);
      toast.success(t("linkCopied"));
    } catch {
      /* clipboard denied */
    }
  };

  const onTrash = async () => {
    try {
      await archive({ documentId: doc._id });
      toast.success(t("trashed"));
      if (isActive) router.push("/app/documents");
    } catch {
      toast.error(tc("createFailed"));
    }
  };

  const style = {
    paddingLeft: `${level * 20 + 8}px`,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
  };

  const canExpand = isFolder || hasChildren;

  return (
    <div>
      <div
        ref={setRefs}
        {...attributes}
        {...listeners}
        style={style}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpen(true);
        }}
        className={cn(
          "group relative flex min-h-[32px] items-center gap-1 rounded-lg pr-1 text-[13.5px] transition-colors",
          "hover:bg-sidebar-accent",
          isActive && "bg-sidebar-accent font-semibold text-sidebar-accent-foreground",
          isDragging && "z-50 cursor-grabbing opacity-0",
          isTrashing && "pointer-events-none scale-95 opacity-0 transition-all duration-300",
          isOver && !isDragging && "tx-drop-into bg-primary/[0.07]",
        )}
        data-active={isActive || undefined}
      >
        {Array.from({ length: level }).map((_, i) => (
          <span
            key={i}
            aria-hidden
            className="tx-tree-guide pointer-events-none absolute inset-y-1 w-0.5 rounded-full"
            style={{ left: `${i * 20 + 16}px` }}
          />
        ))}
        {isActive && (
          <span className="pointer-events-none absolute inset-y-1 left-0 w-[3px] rounded-full bg-primary" data-testid="tree-active-indicator" />
        )}
        {isOver && !isDragging && (
          <span className="pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l-lg bg-primary" />
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            onToggleOpen(String(doc._id), !open);
          }}
          onPointerDown={stop}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-border",
            !canExpand && "invisible",
          )}
          data-testid="tree-expand"
        >
          {canExpand ? (
            <ArrowRight2
              variant="Bulk"
              size={14}
              className={cn("transition-transform duration-200", open && "rotate-90")}
            />
          ) : (
            <span className="h-1 w-1 rounded-full bg-transparent" />
          )}
        </button>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPointerDown={stop}
            onClick={stop}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditing(false);
            }}
            onBlur={commitRename}
            className="my-0.5 min-w-0 flex-1 rounded-md border border-primary/50 bg-background px-1.5 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
            data-testid="tree-rename-input"
          />
        ) : (
          <Link
            href={`/app/documents/${doc._id}`}
            onClick={onNavigate}
            data-testid="doc-tree-item"
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5"
          >
            <span className="w-4 text-center text-[13px]">{doc.icon ?? ""}</span>
            {!doc.icon && !isFolder && (
              <DocumentText variant="Bulk" size={15} className="shrink-0 text-muted-foreground" />
            )}
            {isFolder && !doc.icon && (open
              ? <FolderOpen variant="Bulk" size={16} className="shrink-0 text-primary/80" />
              : <Folder variant="Bulk" size={16} className="shrink-0 text-primary/70" />)}
            <span className={cn("truncate", isFolder && "font-medium")}>{doc.title || tc("untitled")}</span>
            {isFavorite && <Star1 variant="Bold" size={11} className="shrink-0 text-primary/70" />}
          </Link>
        )}
        <div className={cn("hidden items-center gap-0.5 group-hover:flex", menuOpen && "flex")}>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                onPointerDown={stop}
                onClick={stop}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-border"
                title={t("actions")}
                data-testid="tree-more"
              >
                <More variant="Bulk" size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right" className="w-52" onPointerDown={stop} onClick={stop}>
              <DropdownMenuItem onClick={startRename} className="gap-2" data-testid="tree-action-rename">
                <Edit2 variant="Bulk" size={15} /> {t("rename")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleFavorite({ documentId: doc._id })} className="gap-2" data-testid="tree-action-favorite">
                <Star1 variant={isFavorite ? "Bold" : "Bulk"} size={15} className={isFavorite ? "text-primary" : undefined} />
                {isFavorite ? t("favoriteRemove") : t("favoriteAdd")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate} className="gap-2" data-testid="tree-action-duplicate">
                <Copy variant="Bulk" size={15} /> {t("duplicate")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCopyLink} className="gap-2" data-testid="tree-action-copylink">
                <Link21 variant="Bulk" size={15} /> {t("copyLink")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => addChild()} className="gap-2" data-testid="tree-action-newpage">
                <Add variant="Bulk" size={15} /> {t("newPage")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addFolder()} className="gap-2" data-testid="tree-action-newfolder">
                <Folder variant="Bulk" size={15} /> {t("newFolder")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onTrash} className="gap-2 text-destructive" data-testid="tree-action-trash">
                <Trash variant="Bulk" size={15} /> {t("trash")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={addChild}
            onPointerDown={stop}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-border"
            title={t("newPage")}
            data-testid="tree-new-page"
          >
            <Add variant="Bulk" size={14} />
          </button>
        </div>
      </div>
      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          {open && (
            <DocumentTree
              docs={docs}
              parentId={doc._id}
              onNavigate={onNavigate}
              onCreateChild={onCreateChild}
              level={level + 1}
              activeId={activeId}
              favoriteIds={favoriteIds}
              openIds={openIds}
              onToggleOpen={onToggleOpen}
            />
          )}
        </div>
      </div>
    </div>
  );
}
