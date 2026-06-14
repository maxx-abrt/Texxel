"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight2 } from "iconsax-reactjs";

const FluxEditor = dynamic(() => import("@/components/app/flux-editor"), { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> });

export default function SharePage() {
  const params = useParams<{ shareToken: string }>();
  const doc = useQuery(api.flux_documents.getPublic, { shareToken: params.shareToken });

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/85 px-6 py-3 backdrop-blur">
        <Link href="/" className="text-xl font-extrabold tracking-tight">flux<span className="text-primary">.</span></Link>
        <Link href="/auth" className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Make your own <ArrowRight2 variant="Bulk" size={16} /></Link>
      </nav>

      {doc === undefined ? (
        <div className="mx-auto max-w-[820px] px-6 py-12"><Skeleton className="h-10 w-2/3" /><Skeleton className="mt-6 h-64 w-full" /></div>
      ) : doc === null ? (
        <div className="mx-auto max-w-[820px] px-6 py-24 text-center">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-4 font-display text-2xl font-bold">This page is not available</h1>
          <p className="mt-2 text-muted-foreground">The link may be private or no longer exists.</p>
        </div>
      ) : (
        <article className="mx-auto max-w-[820px] px-6 py-12">
          {doc.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={doc.coverImage} alt="cover" className="mb-6 h-56 w-full rounded-2xl object-cover" />
          )}
          {doc.icon && <div className="text-6xl">{doc.icon}</div>}
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">{doc.title || "Untitled"}</h1>
          <div className="mt-6"><FluxEditor initialContent={doc.content} editable={false} /></div>
        </article>
      )}
    </div>
  );
}
