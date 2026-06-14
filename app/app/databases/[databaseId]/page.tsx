"use client";

import { useParams } from "next/navigation";
import { DatabaseView } from "@/components/app/database-view";
import { Id } from "@/convex/_generated/dataModel";

export default function DatabaseDetailPage() {
  const params = useParams<{ databaseId: string }>();
  return <DatabaseView databaseId={params.databaseId as Id<"flux_databases">} />;
}
