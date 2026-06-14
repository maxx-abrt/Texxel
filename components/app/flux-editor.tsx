"use client";

import { useCallback } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import type { PartialBlock } from "@blocknote/core";
import "@blocknote/mantine/style.css";
import { useTheme } from "next-themes";
import { useConvex, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

function parseContent(content?: string): PartialBlock[] | undefined {
  if (!content || !content.trim()) return undefined;
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as PartialBlock[];
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fresh BlockNote editor backed by Convex Storage for uploads and persisting
 * content as JSON into flux_documents.content. (Replaces the legacy EdgeStore
 * editor entirely.)
 */
export default function FluxEditor({
  initialContent,
  editable = true,
  onChange,
}: {
  initialContent?: string;
  editable?: boolean;
  onChange?: (value: string) => void;
}) {
  const { resolvedTheme } = useTheme();
  const convex = useConvex();
  const generateUploadUrl = useMutation(api.flux_files.generateUploadUrl);

  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      const postUrl = await generateUploadUrl();
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = await res.json();
      const url = await convex.query(api.flux_files.getUrl, { storageId });
      return (url as string) ?? "";
    },
    [convex, generateUploadUrl],
  );

  const editor = useCreateBlockNote({
    initialContent: parseContent(initialContent),
    uploadFile,
  });

  return (
    <div data-testid="document-editor" className="flux-editor">
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        onChange={() => onChange?.(JSON.stringify(editor.document))}
      />
    </div>
  );
}
