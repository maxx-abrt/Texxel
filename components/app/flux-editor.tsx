"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTheme } from "next-themes";
import { useMutation } from "convex/react";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLocale } from "@/components/providers/locale-provider";
import {
  BlockNoteSchema,
  defaultInlineContentSpecs,
  type PartialBlock,
} from "@blocknote/core";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import * as locales from "@blocknote/core/locales";
import {
  useCreateBlockNote,
  createReactInlineContentSpec,
  SuggestionMenuController,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

export type Mentionable = { id: string; label: string; kind: "user" | "task" | "project"; userId?: string };

// Custom @mention inline content rendered as a styled chip.
const Mention = createReactInlineContentSpec(
  {
    type: "mention",
    propSchema: {
      id: { default: "" },
      label: { default: "" },
      kind: { default: "user" },
    },
    content: "none",
  },
  {
    render: (props) => {
      const kind = props.inlineContent.props.kind;
      const color =
        kind === "task" ? "#2f7ea6" : kind === "project" ? "#7c5cff" : "var(--flux-coral)";
      return (
        <span
          className="mention-chip"
          style={{
            backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)`,
            color,
            padding: "1px 6px",
            borderRadius: "6px",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
          data-mention-kind={kind}
          data-mention-id={props.inlineContent.props.id}
        >
          {kind === "task" ? "#" : "@"}
          {props.inlineContent.props.label}
        </span>
      );
    },
  },
);

const schema = BlockNoteSchema.create({
  inlineContentSpecs: { ...defaultInlineContentSpecs, mention: Mention },
});

/** Extract mentioned user ids from a BlockNote document. */
export function extractMentionUserIds(doc: any[]): string[] {
  const ids: string[] = [];
  const walk = (blocks: any[]) => {
    for (const b of blocks ?? []) {
      const content = b.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type === "mention" && c?.props?.kind === "user" && c?.props?.id) {
            ids.push(c.props.id);
          }
        }
      }
      if (b.children) walk(b.children);
    }
  };
  walk(doc);
  return Array.from(new Set(ids));
}

interface FluxEditorProps {
  initialContent?: string;
  editable?: boolean;
  onChange?: (content: string) => void;
  onMentions?: (userIds: string[]) => void;
  mentionables?: Mentionable[];
  onEditorReady?: (editor: any) => void;
}

export function FluxEditor({
  initialContent,
  editable = true,
  onChange,
  onMentions,
  mentionables = [],
  onEditorReady,
}: FluxEditorProps) {
  const { resolvedTheme } = useTheme();
  const { locale } = useLocale();
  const convex = useConvex();
  const generateUploadUrl = useMutation(api.flux_files.generateUploadUrl);

  const parsed = useMemo<PartialBlock[] | undefined>(() => {
    if (!initialContent) return undefined;
    try {
      const p = JSON.parse(initialContent);
      return Array.isArray(p) && p.length ? p : undefined;
    } catch {
      return undefined;
    }
  }, [initialContent]);

  const dictionary = (locales as any)[locale] ?? (locales as any).en;

  const editor = useCreateBlockNote({
    schema,
    initialContent: parsed,
    dictionary,
    uploadFile: async (file: File) => {
      const url = await generateUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await res.json();
      const publicUrl = await convex.query(api.flux_files.getUrl, { storageId });
      return publicUrl ?? "";
    },
  });

  // Notify the parent after render (calling during render triggers React's
  // "cannot update a component while rendering another" error).
  const readyRef = useRef(onEditorReady);
  readyRef.current = onEditorReady;
  useEffect(() => {
    readyRef.current?.(editor);
  }, [editor]);

  return (
    <BlockNoteView
      editor={editor}
      editable={editable}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      onChange={() => {
        if (onChange) onChange(JSON.stringify(editor.document));
        if (onMentions) onMentions(extractMentionUserIds(editor.document as any[]));
      }}
    >
      {editable && (
        <SuggestionMenuController
          triggerCharacter={"@"}
          getItems={async (query) =>
            filterSuggestionItems(
              mentionables.map((m) => ({
                title: m.label,
                subtext: m.kind,
                onItemClick: () => {
                  editor.insertInlineContent([
                    { type: "mention", props: { id: m.id, label: m.label, kind: m.kind } } as any,
                    " ",
                  ]);
                },
              })),
              query,
            )
          }
        />
      )}
    </BlockNoteView>
  );
}

export default FluxEditor;
