/**
 * Notion HTML Import Parser
 * Converts Notion-exported HTML files into BlockNote-compatible JSON blocks.
 * Supports headings, paragraphs, lists, code blocks, quotes, dividers, and tables.
 */

export interface ImportedPage {
  title: string;
  icon?: string;
  content: string; // BlockNote JSON string
  children: ImportedPage[];
}

interface BlockNoteBlock {
  id: string;
  type: string;
  props: Record<string, unknown>;
  content: BlockNoteInline[] | TableContent;
  children: BlockNoteBlock[];
}

interface BlockNoteInline {
  type: "text" | "link";
  text?: string;
  href?: string;
  styles?: Record<string, boolean | string>;
  content?: BlockNoteInline[];
}

type TableContent = { type: "tableContent"; rows: { cells: BlockNoteInline[][] }[] };

let _idCounter = 0;
function uid(): string {
  return `import-${++_idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

function textBlock(text: string, styles: Record<string, boolean | string> = {}): BlockNoteBlock {
  return {
    id: uid(),
    type: "paragraph",
    props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
    content: text ? [{ type: "text", text, styles }] : [],
    children: [],
  };
}

function headingBlock(text: string, level: number): BlockNoteBlock {
  return {
    id: uid(),
    type: "heading",
    props: { textColor: "default", backgroundColor: "default", textAlignment: "left", level: Math.min(level, 3) },
    content: text ? [{ type: "text", text, styles: {} }] : [],
    children: [],
  };
}

function bulletListItem(text: string): BlockNoteBlock {
  return {
    id: uid(),
    type: "bulletListItem",
    props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
    content: text ? [{ type: "text", text, styles: {} }] : [],
    children: [],
  };
}

function numberedListItem(text: string): BlockNoteBlock {
  return {
    id: uid(),
    type: "numberedListItem",
    props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
    content: text ? [{ type: "text", text, styles: {} }] : [],
    children: [],
  };
}

function codeBlock(text: string, language = ""): BlockNoteBlock {
  return {
    id: uid(),
    type: "codeBlock",
    props: { language },
    content: [{ type: "text", text, styles: {} }],
    children: [],
  };
}

function quoteBlock(text: string): BlockNoteBlock {
  return {
    id: uid(),
    type: "paragraph",
    props: { textColor: "default", backgroundColor: "gray", textAlignment: "left" },
    content: text ? [{ type: "text", text, styles: { italic: true } }] : [],
    children: [],
  };
}

function dividerBlock(): BlockNoteBlock {
  return {
    id: uid(),
    type: "paragraph",
    props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
    content: [{ type: "text", text: "───────────", styles: { textColor: "gray" } as Record<string, boolean | string> }],
    children: [],
  };
}

function getTextContent(el: Element): string {
  return (el.textContent ?? "").trim();
}

function parseInlineContent(el: Element): BlockNoteInline[] {
  const inlines: BlockNoteInline[] = [];

  el.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      // Text node
      const text = node.textContent ?? "";
      if (text) inlines.push({ type: "text", text, styles: {} });
    } else if (node.nodeType === 1) {
      const child = node as Element;
      const tag = child.tagName.toLowerCase();
      const text = child.textContent ?? "";

      if (tag === "a") {
        const href = child.getAttribute("href") ?? "";
        inlines.push({ type: "link", href, content: [{ type: "text", text, styles: {} }] });
      } else if (tag === "strong" || tag === "b") {
        inlines.push({ type: "text", text, styles: { bold: true } });
      } else if (tag === "em" || tag === "i") {
        inlines.push({ type: "text", text, styles: { italic: true } });
      } else if (tag === "code") {
        inlines.push({ type: "text", text, styles: { code: true } });
      } else if (tag === "u") {
        inlines.push({ type: "text", text, styles: { underline: true } });
      } else if (tag === "s" || tag === "del" || tag === "strike") {
        inlines.push({ type: "text", text, styles: { strikethrough: true } });
      } else if (tag === "mark") {
        inlines.push({ type: "text", text, styles: { backgroundColor: "yellow" } });
      } else if (tag === "br") {
        inlines.push({ type: "text", text: "\n", styles: {} });
      } else {
        // Recurse for unknown tags
        if (text) inlines.push({ type: "text", text, styles: {} });
      }
    }
  });

  return inlines;
}

function parseElement(el: Element): BlockNoteBlock[] {
  const tag = el.tagName.toLowerCase();
  const blocks: BlockNoteBlock[] = [];

  switch (tag) {
    case "h1":
      blocks.push(headingBlock(getTextContent(el), 1));
      break;
    case "h2":
      blocks.push(headingBlock(getTextContent(el), 2));
      break;
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      blocks.push(headingBlock(getTextContent(el), 3));
      break;
    case "p": {
      const block: BlockNoteBlock = {
        id: uid(),
        type: "paragraph",
        props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
        content: parseInlineContent(el),
        children: [],
      };
      blocks.push(block);
      break;
    }
    case "ul":
      el.querySelectorAll(":scope > li").forEach((li) => {
        blocks.push(bulletListItem(getTextContent(li)));
      });
      break;
    case "ol":
      el.querySelectorAll(":scope > li").forEach((li) => {
        blocks.push(numberedListItem(getTextContent(li)));
      });
      break;
    case "pre": {
      const codeEl = el.querySelector("code");
      const lang = codeEl?.className?.replace("language-", "") ?? "";
      blocks.push(codeBlock(getTextContent(el), lang));
      break;
    }
    case "blockquote":
      blocks.push(quoteBlock(getTextContent(el)));
      break;
    case "hr":
      blocks.push(dividerBlock());
      break;
    case "table": {
      const rows = Array.from(el.querySelectorAll("tr")).map((tr) => ({
        cells: Array.from(tr.querySelectorAll("td, th")).map((cell) =>
          parseInlineContent(cell),
        ),
      }));
      if (rows.length > 0 && rows[0].cells.length > 0) {
        blocks.push({
          id: uid(),
          type: "table",
          props: {},
          content: { type: "tableContent", rows } as TableContent,
          children: [],
        });
      }
      break;
    }
    case "div":
    case "article":
    case "section":
    case "main":
    case "body":
      // Recurse into container elements
      el.childNodes.forEach((child) => {
        if (child.nodeType === 1) {
          blocks.push(...parseElement(child as Element));
        } else if (child.nodeType === 3) {
          const text = (child.textContent ?? "").trim();
          if (text) blocks.push(textBlock(text));
        }
      });
      break;
    case "figure": {
      // Notion wraps images in figure
      const img = el.querySelector("img");
      if (img) {
        const src = img.getAttribute("src") ?? "";
        const alt = img.getAttribute("alt") ?? "";
        blocks.push(textBlock(`[Image: ${alt || src}]`));
      }
      const caption = el.querySelector("figcaption");
      if (caption) {
        blocks.push(textBlock(getTextContent(caption)));
      }
      break;
    }
    case "img": {
      const src = el.getAttribute("src") ?? "";
      const alt = el.getAttribute("alt") ?? "";
      blocks.push(textBlock(`[Image: ${alt || src}]`));
      break;
    }
    case "details": {
      const summary = el.querySelector("summary");
      if (summary) {
        blocks.push(headingBlock(`▸ ${getTextContent(summary)}`, 3));
      }
      el.childNodes.forEach((child) => {
        if (child.nodeType === 1 && (child as Element).tagName.toLowerCase() !== "summary") {
          blocks.push(...parseElement(child as Element));
        }
      });
      break;
    }
    default: {
      // For unknown elements, try to extract text
      const text = getTextContent(el);
      if (text) blocks.push(textBlock(text));
      break;
    }
  }

  return blocks;
}

/**
 * Parse a single Notion HTML file and return blocks.
 */
export function parseNotionHtml(html: string): { title: string; blocks: BlockNoteBlock[] } {
  _idCounter = 0;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Extract title from <title> or first <h1>
  let title = doc.querySelector("title")?.textContent?.trim() ?? "";
  const firstH1 = doc.querySelector("h1");
  if (!title && firstH1) {
    title = getTextContent(firstH1);
  }

  // Clean up Notion-specific title prefix (e.g., "Page Name 3f4a...")
  title = title.replace(/\s+[a-f0-9]{32}$/i, "").trim();
  if (!title) title = "Imported Note";

  // Parse body content
  const body = doc.body;
  const blocks: BlockNoteBlock[] = [];

  if (body) {
    // Notion exports wrap content in an <article> with class "page"
    const article = body.querySelector("article") ?? body;

    // Skip the first h1 if it matches the title (avoid duplication)
    let skipFirstH1 = false;
    const articleH1 = article.querySelector("h1");
    if (articleH1 && getTextContent(articleH1) === title) {
      skipFirstH1 = true;
    }

    article.childNodes.forEach((child) => {
      if (child.nodeType === 1) {
        const el = child as Element;
        if (skipFirstH1 && el.tagName.toLowerCase() === "h1" && getTextContent(el) === title) {
          skipFirstH1 = false; // Only skip once
          return;
        }
        blocks.push(...parseElement(el));
      }
    });
  }

  // Ensure there's at least one block
  if (blocks.length === 0) {
    blocks.push(textBlock(""));
  }

  return { title, blocks };
}

/**
 * Parse a Notion HTML export (potentially with subpages from a ZIP).
 * For now, handles a single HTML file. ZIP support can be added.
 */
export function parseNotionExport(files: File[]): Promise<ImportedPage[]> {
  return Promise.all(
    files.map(async (file) => {
      const html = await file.text();
      const { title, blocks } = parseNotionHtml(html);
      return {
        title,
        content: JSON.stringify(blocks),
        children: [],
      };
    }),
  );
}
