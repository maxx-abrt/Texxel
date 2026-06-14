"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ArrowRight2, Add, DocumentText } from "iconsax-reactjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";

type Doc = {
  _id: string;
  title: string;
  icon?: string;
  parentId?: string;
};

export function DocumentTree({
  docs,
  parentId,
  onNavigate,
  onCreateChild,
  level,
}: {
  docs: Doc[];
  parentId: string | null;
  onNavigate: () => void;
  onCreateChild: (parentId?: string) => void;
  level: number;
}) {
  const children = docs.filter((d) => (d.parentId ?? null) === parentId);
  if (children.length === 0) return null;
  return (
    <div>
      {children.map((doc) => (
        <TreeNode key={doc._id} doc={doc} docs={docs} onNavigate={onNavigate} onCreateChild={onCreateChild} level={level} />
      ))}
    </div>
  );
}

function TreeNode({ doc, docs, onNavigate, onCreateChild, level }: any) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const hasChildren = docs.some((d: Doc) => d.parentId === doc._id);
  const createDoc = useMutation(api.flux_documents.create);
  const { activeWorkspaceId } = useWorkspace();

  const addChild = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeWorkspaceId) return;
    const id = await createDoc({ workspaceId: activeWorkspaceId, title: "Untitled", parentId: doc._id });
    setOpen(true);
    router.push(`/app/documents/${id}`);
  };

  return (
    <div>
      <div
        className="group flex items-center gap-1 rounded-lg pr-1 text-sm hover:bg-sidebar-accent"
        style={{ paddingLeft: `${level * 12 + 4}px` }}
      >
        <button
          onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-border"
        >
          {hasChildren ? (
            <ArrowRight2 variant="Bulk" size={14} className={cn("transition-transform", open && "rotate-90")} />
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
          {!doc.icon && <DocumentText variant="Bulk" size={15} className="shrink-0 text-muted-foreground" />}
          <span className="truncate">{doc.title || "Untitled"}</span>
        </Link>
        <button onClick={addChild} className="hidden h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-border group-hover:flex">
          <Add variant="Bulk" size={14} />
        </button>
      </div>
      {open && (
        <DocumentTree docs={docs} parentId={doc._id} onNavigate={onNavigate} onCreateChild={onCreateChild} level={level + 1} />
      )}
    </div>
  );
}
