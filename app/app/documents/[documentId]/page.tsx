"use client";

import { useParams } from "next/navigation";
import { DocumentView } from "@/components/app/document-view";
import { Id } from "@/convex/_generated/dataModel";

export default function DocumentPage() {
  const params = useParams<{ documentId: string }>();
  return <DocumentView documentId={params.documentId as Id<"flux_documents">} />;
}
