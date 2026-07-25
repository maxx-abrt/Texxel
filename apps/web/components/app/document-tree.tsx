"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Add,
  DocumentText,
  Folder as FolderIcon,
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
import {
  Tree,
  Folder,
  File,
} from "@/components/ui/file-tree";

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
  const children = useMemo(
    () => docs.filter((d) => (d.parentId ?? null) === parentId),
    [docs, parentId],
  );

  if (children.length === 0) return null;

  if (level === 0) {
    return (
      <Tree
        controlledExpandedItems={Array.from(openIds)}
        onExpandedChange={(items) => {
          const currentSet = openIds;
          const newSet = new Set(items);
          for (const id of currentSet) {
            if (!newSet.has(id)) onToggleOpen(id, false);
          }
          for (const id of newSet) {
            if (!currentSet.has(id)) onToggleOpen(id, true);
          }
        }}
        initialSelectedId={activeId ?? undefined}
      >
        {children.map((doc) => (
          <DocumentTreeNode
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
      </Tree>
    );
  }

  return (
    <>
      {children.map((doc) => (
        <DocumentTreeNode
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
    </>
  );
}

function DocumentTreeNode({
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
  const hasChildren = useMemo(
    () => docs.some((d) => d.parentId === doc._id),
    [docs, doc._id],
  );
  const isFolderNode = doc.isFolder ?? false;
  const isOpen = openIds.has(String(doc._id));
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

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `tree-${doc._id}`,
    data: {
      documentId: doc._id,
      isFolder: isFolderNode,
      title: doc.title,
      icon: doc.icon,
      type: "tree",
    },
    disabled: editing,
  });

  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `tree-${doc._id}`,
    data: { documentId: doc._id, isFolder: isFolderNode },
  });

  const isTrashing = trashingIds.has(doc._id);

  const setRefs = (el: HTMLDivElement | null) => {
    setDragRef(el as any);
    setDropRef(el as any);
  };

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const addChild = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!activeWorkspaceId) return;
    const id = await createDoc({
      workspaceId: activeWorkspaceId,
      title: "Untitled",
      parentId: doc._id as Id<"flux_documents">,
    });
    onToggleOpen(String(doc._id), true);
    router.push(`/app/documents/${id}`);
  };

  const addFolder = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!activeWorkspaceId) return;
    await createFolder({
      workspaceId: activeWorkspaceId,
      parentId: doc._id as Id<"flux_documents">,
    });
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
      await navigator.clipboard.writeText(
        `${window.location.origin}/app/documents/${doc._id}`,
      );
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

  const dragStyle = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const canExpand = isFolderNode || hasChildren;

  const triggerProps: React.HTMLAttributes<HTMLDivElement> = {
    ...attributes,
    ...listeners,
    style: {
      ...dragStyle,
      ...(isDragging ? { opacity: 0 } : {}),
      ...(isTrashing
        ? {
            pointerEvents: "none" as const,
            transform: "scale(0.8) translateY(8px)",
            opacity: 0,
            transition: "all 350ms cubic-bezier(0.36, 0, 0.66, -0.56)",
          }
        : {}),
    },
    onContextMenu: (e) => {
      e.preventDefault();
      setMenuOpen(true);
    },
  };

  const triggerClassName = cn(
    isOver && !isDragging && "tx-drop-into bg-primary/[0.07] ring-1 ring-primary/30",
  );

  const renderIcon = () => {
    if (doc.icon) {
      return <span className="shrink-0 text-[13px]">{doc.icon}</span>;
    }
    if (isFolderNode) {
      return isOpen ? (
        <FolderOpen variant="Bulk" size={16} className="shrink-0 text-primary/80" />
      ) : (
        <FolderIcon variant="Bulk" size={16} className="shrink-0 text-primary/70" />
      );
    }
    return (
      <DocumentText variant="Bulk" size={15} className="shrink-0 text-muted-foreground" />
    );
  };

  const renderLabel = () => {
    if (editing) {
      return (
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
      );
    }
    return (
      <>
        <Link
          href={`/app/documents/${doc._id}`}
          onClick={onNavigate}
          data-testid="doc-tree-item"
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 truncate"
        >
          <span className={cn("truncate", isFolderNode && "font-medium")}>
            {doc.title || tc("untitled")}
          </span>
        </Link>
        {isFavorite && (
          <Star1 variant="Bold" size={11} className="shrink-0 text-primary/70" />
        )}
      </>
    );
  };

  const renderActions = () => (
    <div
      className={cn(
        "hidden items-center gap-0.5 group-hover:flex",
        menuOpen && "flex",
      )}
    >
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
        <DropdownMenuContent
          align="start"
          side="right"
          className="w-52"
          onPointerDown={stop}
          onClick={stop}
        >
          <DropdownMenuItem
            onClick={startRename}
            className="gap-2"
            data-testid="tree-action-rename"
          >
            <Edit2 variant="Bulk" size={15} /> {t("rename")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => toggleFavorite({ documentId: doc._id })}
            className="gap-2"
            data-testid="tree-action-favorite"
          >
            <Star1
              variant={isFavorite ? "Bold" : "Bulk"}
              size={15}
              className={isFavorite ? "text-primary" : undefined}
            />
            {isFavorite ? t("favoriteRemove") : t("favoriteAdd")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onDuplicate}
            className="gap-2"
            data-testid="tree-action-duplicate"
          >
            <Copy variant="Bulk" size={15} /> {t("duplicate")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onCopyLink}
            className="gap-2"
            data-testid="tree-action-copylink"
          >
            <Link21 variant="Bulk" size={15} /> {t("copyLink")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => addChild()}
            className="gap-2"
            data-testid="tree-action-newpage"
          >
            <Add variant="Bulk" size={15} /> {t("newPage")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => addFolder()}
            className="gap-2"
            data-testid="tree-action-newfolder"
          >
            <FolderIcon variant="Bulk" size={15} /> {t("newFolder")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onTrash}
            className="gap-2 text-destructive"
            data-testid="tree-action-trash"
          >
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
  );

  if (canExpand) {
    return (
      <Folder
        value={String(doc._id)}
        element={
          <>
            {renderIcon()}
            {renderLabel()}
            {renderActions()}
          </>
        }
        isSelect={isActive}
        triggerRef={setRefs}
        triggerProps={{ ...triggerProps, className: triggerClassName }}
      >
        {isOpen && (
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
      </Folder>
    );
  }

  return (
    <File
      value={String(doc._id)}
      isSelect={isActive}
      ref={setRefs}
      {...triggerProps}
      className={triggerClassName}
      fileIcon={renderIcon()}
    >
      {renderLabel()}
      {renderActions()}
    </File>
  );
}
