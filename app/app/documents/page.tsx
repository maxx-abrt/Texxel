"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { PageContainer, PageHeader, EmptyState, btnPrimary, timeAgo, inputBase } from "@/components/app/common";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DocumentText, Add, SearchNormal1, Clock, Star1 } from "iconsax-reactjs";

export default function DocumentsPage() {
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace();
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

  const onNew = async () => {
    if (!activeWorkspaceId) return;
    try {
      const id = await createDoc({ workspaceId: activeWorkspaceId, title: "Untitled" });
      router.push(`/app/documents/${id}`);
    } catch {
      toast.error("Could not create document");
    }
  };

  const favIds = new Set((favorites ?? []).map((f: any) => f._id));
  const filtered = (docs ?? [])
    .filter((d: any) => d.title.toLowerCase().includes(q.toLowerCase()))
    .sort((a: any, b: any) => b.updatedAt - a.updatedAt);

  return (
    <PageContainer>
      <PageHeader
        title="Documents"
        subtitle="All your notes, docs and pages"
        icon={DocumentText}
        testId="documents-header"
        actions={
          <button onClick={onNew} className={btnPrimary} data-testid="new-document-btn">
            <Add variant="Bulk" size={18} /> New document
          </button>
        }
      />

      <div className="relative mb-5 max-w-md">
        <SearchNormal1 variant="Bulk" size={18} className="absolute left-3 top-2.5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search documents…"
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
          title={q ? "No documents match your search" : "No documents yet"}
          description={q ? "Try a different keyword." : "Create your first document to get started."}
          testId="documents-empty"
          action={
            !q && (
              <button onClick={onNew} className={btnPrimary} data-testid="empty-new-document">
                <Add variant="Bulk" size={18} /> New document
              </button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="documents-grid">
          {filtered.map((d: any) => (
            <Link
              key={d._id}
              href={`/app/documents/${d._id}`}
              data-testid="document-card"
              className="group relative flex flex-col rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <span className="text-3xl leading-none">{d.icon ?? "\ud83d\udcc4"}</span>
                {favIds.has(d._id) && <Star1 variant="Bulk" size={16} className="text-primary" />}
              </div>
              <p className="mt-3 truncate font-semibold group-hover:text-primary">{d.title || "Untitled"}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock variant="Bulk" size={12} /> {timeAgo(d.updatedAt)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
