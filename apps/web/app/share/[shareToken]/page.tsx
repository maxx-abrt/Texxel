"use client";

import { useParams } from "next/navigation";
import { ShareDocClient } from "@/components/app/share-doc-client";

export default function SharePage() {
  const params = useParams<{ shareToken: string }>();
  return <ShareDocClient shareToken={params.shareToken} />;
}
