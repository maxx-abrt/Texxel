"use client";

import { useState } from "react";
import {
  createReactStyleSpec,
  useBlockNoteEditor,
  useComponentsContext,
  useEditorSelectionChange,
} from "@blocknote/react";

/**
 * Native BlockNote inline font-family style (`styles.font`), per
 * https://www.blocknotejs.org/examples/custom-schema/font-style
 * Persisted inside the document JSON, so it travels with the content.
 */
export const FontFamilyStyle = createReactStyleSpec(
  {
    type: "font",
    propSchema: "string",
  },
  {
    render: (props) => (
      <span style={{ fontFamily: props.value }} ref={props.contentRef} />
    ),
  },
);

export interface FontOption {
  family: string;
  sourceType?: string; // "upload" | "google" | undefined (system)
  cssUrl?: string;
  fileUrl?: string;
  weight?: number;
  style?: string;
}

const loadedFonts = new Set<string>();

/** Loads a google (css) or uploaded (FontFace) font into the document, once per family. */
export function ensureFontLoaded(font: FontOption) {
  if (typeof document === "undefined" || loadedFonts.has(font.family)) return;
  if (font.sourceType === "google" && font.cssUrl) {
    const id = `bureau-inline-font-${font.family.replace(/\s+/g, "-").toLowerCase()}`;
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = font.cssUrl;
      document.head.appendChild(link);
    }
    loadedFonts.add(font.family);
    return;
  }
  if (font.sourceType === "upload" && font.fileUrl) {
    loadedFonts.add(font.family);
    const face = new FontFace(font.family, `url(${JSON.stringify(font.fileUrl)})`, {
      weight: String(font.weight ?? 400),
      style: font.style ?? "normal",
    });
    face
      .load()
      .then((loaded) => document.fonts.add(loaded))
      .catch(() => loadedFonts.delete(font.family));
  }
}

/**
 * Formatting-toolbar dropdown listing system fonts plus the workspace's
 * google and uploaded fonts. Selecting one applies the inline `font` style
 * to the current selection; "Default" clears it back to the document font.
 */
export function FontFamilySelect({ fonts }: { fonts: FontOption[] }) {
  const editor = useBlockNoteEditor<any, any, any>();
  const Components = useComponentsContext()!;
  const [, forceRender] = useState(0);
  useEditorSelectionChange(() => forceRender((n) => n + 1), editor);

  const active = (editor.getActiveStyles() as Record<string, unknown>).font as
    | string
    | undefined;

  const seen = new Set<string>();
  const options = fonts.filter((font) => {
    if (!font.family || seen.has(font.family)) return false;
    seen.add(font.family);
    return true;
  });

  const items = [
    {
      text: "Default font",
      isSelected: !active,
      onClick: () => {
        if (active) editor.removeStyles({ font: active } as any);
      },
    },
    ...options.map((font) => ({
      text: font.family,
      isSelected: active === font.family,
      onClick: () => {
        ensureFontLoaded(font);
        editor.addStyles({ font: font.family } as any);
      },
    })),
  ];

  return <Components.FormattingToolbar.Select items={items as any} />;
}
