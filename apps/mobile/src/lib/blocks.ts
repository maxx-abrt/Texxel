/**
 * BlockNote ⇄ native block bridge.
 *
 * `flux_documents.content` stores the BlockNote 0.47 document as a JSON string.
 * The mobile editor works on a flattened, RN-friendly shape and writes the
 * exact same JSON back, preserving every prop and any block type the phone
 * cannot render (tables, images, charts…) so a mobile edit never destroys work
 * done on the web.
 */

export type BlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletListItem"
  | "numberedListItem"
  | "checkListItem"
  | "quote"
  | "codeBlock"
  | "divider"
  | "unsupported";

export type NativeBlock = {
  id: string;
  type: BlockType;
  text: string;
  checked: boolean;
  language?: string;
  /** Original BlockNote node — kept verbatim for lossless round-tripping. */
  raw: BlockNoteBlock;
  /** Text as it was when parsed; used to detect edits. */
  originalText: string;
};

export type BlockNoteBlock = {
  id?: string;
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: BlockNoteBlock[];
};

const DEFAULT_PROPS = {
  textColor: "default",
  backgroundColor: "default",
  textAlignment: "left",
} as const;

export function newBlockId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  let out = "";
  for (const node of content) {
    if (!node || typeof node !== "object") continue;
    const n = node as Record<string, unknown>;
    if (n.type === "text" && typeof n.text === "string") out += n.text;
    else if (n.type === "link") out += extractText(n.content);
    else if (typeof n.text === "string") out += n.text;
  }
  return out;
}

function toBlockType(raw: BlockNoteBlock): BlockType {
  switch (raw.type) {
    case "paragraph":
      return "paragraph";
    case "heading": {
      const level = Number((raw.props as { level?: number } | undefined)?.level ?? 1);
      return level >= 3 ? "heading3" : level === 2 ? "heading2" : "heading1";
    }
    case "bulletListItem":
      return "bulletListItem";
    case "numberedListItem":
      return "numberedListItem";
    case "checkListItem":
      return "checkListItem";
    case "quote":
      return "quote";
    case "codeBlock":
      return "codeBlock";
    case "divider":
      return "divider";
    default:
      return "unsupported";
  }
}

export function parseDocument(content?: string | null): NativeBlock[] {
  if (!content) return [makeBlock("paragraph")];
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Legacy plain-text documents.
    return content
      .split("\n")
      .map((line) => makeBlock("paragraph", line))
      .slice(0, 500);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return [makeBlock("paragraph")];

  return (parsed as BlockNoteBlock[]).map((raw) => {
    const type = toBlockType(raw);
    const text = type === "divider" || type === "unsupported" ? "" : extractText(raw.content);
    return {
      id: raw.id ?? newBlockId(),
      type,
      text,
      checked: Boolean((raw.props as { checked?: boolean } | undefined)?.checked),
      language: (raw.props as { language?: string } | undefined)?.language,
      raw,
      originalText: text,
    };
  });
}

export function makeBlock(type: BlockType, text = ""): NativeBlock {
  const id = newBlockId();
  return {
    id,
    type,
    text,
    checked: false,
    raw: { id, type: "paragraph", props: { ...DEFAULT_PROPS }, content: [], children: [] },
    originalText: "\u0000never",
  };
}

function inlineContent(text: string): unknown[] {
  if (!text) return [];
  return [{ type: "text", text, styles: {} }];
}

function serializeBlock(block: NativeBlock): BlockNoteBlock {
  const base: BlockNoteBlock = {
    ...block.raw,
    id: block.id,
    children: block.raw.children ?? [],
  };
  const props: Record<string, unknown> = { ...DEFAULT_PROPS, ...(block.raw.props ?? {}) };
  const textUnchanged = block.text === block.originalText;

  switch (block.type) {
    case "heading1":
    case "heading2":
    case "heading3":
      base.type = "heading";
      props.level = block.type === "heading1" ? 1 : block.type === "heading2" ? 2 : 3;
      break;
    case "checkListItem":
      base.type = "checkListItem";
      props.checked = block.checked;
      break;
    case "codeBlock":
      base.type = "codeBlock";
      props.language = block.language ?? "text";
      break;
    case "divider":
      base.type = "divider";
      base.content = undefined;
      base.props = props;
      return base;
    case "unsupported":
      return block.raw;
    default:
      base.type = block.type;
  }

  base.props = props;
  base.content = textUnchanged && Array.isArray(block.raw.content) ? block.raw.content : inlineContent(block.text);
  return base;
}

export function serializeDocument(blocks: NativeBlock[]): string {
  return JSON.stringify(blocks.map(serializeBlock));
}

/** Short preview line shown in document lists. */
export function excerptOf(content?: string | null, limit = 120): string {
  const blocks = parseDocument(content);
  const text = blocks
    .filter((b) => b.type !== "divider" && b.text.trim().length > 0)
    .map((b) => b.text.trim())
    .join(" · ");
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

export function wordCount(content?: string | null): number {
  const blocks = parseDocument(content);
  return blocks.reduce((sum, b) => sum + (b.text.trim() ? b.text.trim().split(/\s+/).length : 0), 0);
}

/** Labels are translation keys — resolved by the editor at render time. */
export const BLOCK_MENU: { type: BlockType; label: string; hint: string }[] = [
  { type: "paragraph", label: "block.text", hint: "block.textHint" },
  { type: "heading1", label: "block.h1", hint: "block.h1Hint" },
  { type: "heading2", label: "block.h2", hint: "block.h2Hint" },
  { type: "heading3", label: "block.h3", hint: "block.h3Hint" },
  { type: "bulletListItem", label: "block.bulleted", hint: "block.bulletedHint" },
  { type: "numberedListItem", label: "block.numbered", hint: "block.numberedHint" },
  { type: "checkListItem", label: "block.todo", hint: "block.todoHint" },
  { type: "quote", label: "block.quote", hint: "block.quoteHint" },
  { type: "codeBlock", label: "block.code", hint: "block.codeHint" },
  { type: "divider", label: "block.divider", hint: "block.dividerHint" },
];
