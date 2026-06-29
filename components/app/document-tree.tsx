"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ArrowRight2, Add, DocumentText, Folder } from "iconsax-reactjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useTrashDnd } from "@/components/providers/dnd-trash-provider";
import { Id } from "@/convex/_generated/dataModel";

type Doc = {
  _id: Id<"flux_documents">;
  title: string;
  icon?: string;
  parentId?: Id<"flux_documents">;
  isFolder?: boolean;
};

export function DocumentTree({
  docs,
  parentId,
  onNavigate,
  onCreateChild,
  level,
}: {
  docs: Doc[];
  parentId: Id<"flux_documents"> | null;
  onNavigate: () => void;
  onCreateChild: (parentId?: Id<"flux_documents">) => void | Promise<void>;
  level: number;
}) {
  const children = useMemo(() => docs.filter((d) => (d.parentId ?? null) === parentId), [docs, parentId]);
  if (children.length === 0) return null;
  return (
    <div className="relative">
      {children.map((doc) => (
        <TreeNode
          key={doc._id}
          doc={doc}
          docs={docs}
          onNavigate={onNavigate}
          onCreateChild={onCreateChild}
          level={level}
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
}: {
  doc: Doc;
  docs: Doc[];
  onNavigate: () => void;
  onCreateChild: (parentId?: Id<"flux_documents">) => void | Promise<void>;
  level: number;
}) {
  const hasChildren = useMemo(() => docs.some((d) => d.parentId === doc._id), [docs, doc._id]);
  const isFolder = doc.isFolder ?? false;
  const [open, setOpen] = useState(hasChildren);
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace();
  const createDoc = useMutation(api.flux_documents.create);
  const createFolder = useMutation(api.flux_documents.createFolder);
  const { trashingIds } = useTrashDnd();

  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: `tree-${doc._id}`,
    data: { documentId: doc._id, isFolder, title: doc.title, icon: doc.icon, type: "tree" },
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

  const addChild = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeWorkspaceId) return;
    const id = await createDoc({ workspaceId: activeWorkspaceId, title: "Untitled", parentId: doc._id as Id<"flux_documents"> });
    setOpen(true);
    router.push(`/app/documents/${id}`);
  };

  const addFolder = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeWorkspaceId) return;
    await createFolder({ workspaceId: activeWorkspaceId, parentId: doc._id as Id<"flux_documents"> });
    setOpen(true);
  };

  const style = {
    paddingLeft: `${level * 12 + 4}px`,
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
        className={cn(
          "group relative flex items-center gap-1 rounded-lg pr-1 text-sm transition-colors",
          "hover:bg-sidebar-accent",
          isDragging && "z-50 cursor-grabbing opacity-0",
          isTrashing && "pointer-events-none scale-95 opacity-0 transition-all duration-300",
          isOver && !isDragging && "bg-primary/10 ring-1 ring-primary/40",
        )}
      >
        {isOver && !isDragging && (
          <span className="pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l-lg bg-primary" />
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            setOpen((o) => !o);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-border",
            !canExpand && "invisible",
          )}
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
          {isFolder && !doc.icon && <Folder variant="Bulk" size={15} className="shrink-0 text-muted-foreground" />}
          <span className={cn("truncate", isFolder && "font-medium")}>{doc.title || "Untitled"}</span>
        </Link>
        <div className="hidden items-center gap-0.5 group-hover:flex">
          <button
            onClick={addFolder}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-border"
            title="New folder"
            data-testid="tree-new-folder"
          >
            <Folder variant="Bulk" size={13} />
          </button>
          <button
            onClick={addChild}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-border"
            title="New page"
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
            />
          )}
        </div>
      </div>
    </div>
  );
}
