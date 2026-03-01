"use client";

import { useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { authClient } from "@/lib/auth/client";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileCode, FileText, MoreHorizontal, Printer, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface MenuProps {
  documentId: Id<"documents">;
}

function inlinesToText(content: any[]): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((inline: any) => {
      if (inline.type === "link") {
        const lt = inlinesToText(inline.content ?? []);
        return `[${lt}](${inline.href ?? ""})`;
      }
      let t = inline.text ?? "";
      if (inline.styles?.bold) t = `**${t}**`;
      if (inline.styles?.italic) t = `*${t}*`;
      if (inline.styles?.code) t = `\`${t}\``;
      if (inline.styles?.strikethrough) t = `~~${t}~~`;
      if (inline.styles?.underline) t = `<u>${t}</u>`;
      return t;
    })
    .join("");
}

function blockToMarkdown(block: any, depth = 0): string {
  const indent = "  ".repeat(depth);
  const text = inlinesToText(block.content ?? []);
  const childMd = (block.children ?? [])
    .map((c: any) => blockToMarkdown(c, depth + 1))
    .join("\n");

  let line = "";
  switch (block.type) {
    case "heading":
      line = "#".repeat(Math.min(block.props?.level ?? 1, 6)) + " " + text;
      break;
    case "bulletListItem":
      line = indent + "- " + text;
      break;
    case "numberedListItem":
      line = indent + "1. " + text;
      break;
    case "checkListItem":
      line = indent + (block.props?.checked ? "- [x] " : "- [ ] ") + text;
      break;
    case "codeBlock":
      line = "```" + (block.props?.language ?? "") + "\n" + text + "\n```";
      break;
    case "table": {
      const rows = block.content?.rows ?? [];
      const lines = rows.map((row: any, i: number) => {
        const cells = (row.cells ?? [])
          .map((c: any[]) => inlinesToText(c))
          .join(" | ");
        const sep =
          i === 0
            ? "\n" + (row.cells ?? []).map(() => "---").join(" | ")
            : "";
        return "| " + cells + " |" + sep;
      });
      line = lines.join("\n");
      break;
    }
    case "divider":
      line = "---";
      break;
    default:
      line = text;
  }
  return [line, childMd].filter(Boolean).join("\n");
}

function blocksToMarkdown(blocks: any[]): string {
  if (!Array.isArray(blocks)) return "";
  return blocks.map((b) => blockToMarkdown(b)).join("\n\n");
}

function blockToHtml(block: any): string {
  const text = inlinesToText(block.content ?? [])
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  switch (block.type) {
    case "heading":
      return `<h${block.props?.level ?? 1}>${text}</h${block.props?.level ?? 1}>`;
    case "bulletListItem":
      return `<li>${text}</li>`;
    case "numberedListItem":
      return `<li>${text}</li>`;
    case "paragraph":
      return `<p>${text || "&nbsp;"}</p>`;
    case "codeBlock":
      return `<pre><code class="language-${block.props?.language ?? ""}">${text}</code></pre>`;
    case "table": {
      const rows = (block.content?.rows ?? [])
        .map(
          (row: any, i: number) =>
            `<tr>${(row.cells ?? []).map((c: any[]) => i === 0 ? `<th>${inlinesToText(c)}</th>` : `<td>${inlinesToText(c)}</td>`).join("")}</tr>`,
        )
        .join("");
      return `<table><tbody>${rows}</tbody></table>`;
    }
    case "divider":
      return "<hr>";
    case "checkListItem":
      return `<p><input type="checkbox" ${block.props?.checked ? "checked" : ""} disabled> ${text}</p>`;
    default:
      return `<p>${text || "&nbsp;"}</p>`;
  }
}

function blocksToHtml(blocks: any[]): string {
  if (!Array.isArray(blocks)) return "";
  return blocks.map((b) => blockToHtml(b)).join("\n");
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const Menu = ({ documentId }: MenuProps) => {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const user = session?.user;

  const archive = useMutation(api.documents.archive);
  const doc = useQuery(api.documents.getById, { documentId });

  const onArchive = () => {
    const promise = archive({ id: documentId });
    toast.promise(promise, {
      loading: "Moving to trash...",
      success: "Note moved to trash!",
      error: "Failed to archive note.",
    });
    router.push("/documents");
  };

  const getBlocks = (): any[] => {
    try {
      return JSON.parse(doc?.content ?? "[]");
    } catch {
      return [];
    }
  };

  const onExportMarkdown = () => {
    if (!doc) return;
    const blocks = getBlocks();
    const md = `# ${doc.title || "Untitled"}\n\n${blocksToMarkdown(blocks)}`;
    downloadBlob(md, `${doc.title || "note"}.md`, "text/markdown;charset=utf-8");
    toast.success("Exported as Markdown");
  };

  const onExportHtml = () => {
    if (!doc) return;
    const blocks = getBlocks();
    const body = blocksToHtml(blocks);
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${doc.title || "Untitled"}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 48px auto; padding: 0 24px; line-height: 1.6; color: #111; }
  h1,h2,h3,h4,h5,h6 { font-weight: 700; margin-top: 2em; margin-bottom: 0.5em; }
  h1 { font-size: 2em; border-bottom: 2px solid #eee; padding-bottom: 0.3em; }
  p { margin: 0.75em 0; }
  pre { background: #f4f4f4; border-radius: 6px; padding: 16px; overflow-x: auto; }
  code { font-family: 'Fira Code', monospace; font-size: 0.9em; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f8f8f8; font-weight: 600; }
  hr { border: none; border-top: 2px solid #eee; margin: 2em 0; }
  ul, ol { padding-left: 1.5em; }
  li { margin: 0.3em 0; }
</style>
</head>
<body>
<h1>${doc.title || "Untitled"}</h1>
${body}
</body>
</html>`;
    downloadBlob(html, `${doc.title || "note"}.html`, "text/html;charset=utf-8");
    toast.success("Exported as HTML");
  };

  const onExportPdf = () => {
    if (!doc) return;
    const blocks = getBlocks();
    const body = blocksToHtml(blocks);
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${doc.title || "Untitled"}</title>
<style>
  @page { margin: 2cm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12pt; line-height: 1.7; color: #111; }
  h1 { font-size: 22pt; font-weight: 800; border-bottom: 2px solid #ddd; padding-bottom: 6pt; margin-bottom: 18pt; margin-top: 0; }
  h2 { font-size: 16pt; font-weight: 700; margin-top: 24pt; margin-bottom: 8pt; }
  h3 { font-size: 13pt; font-weight: 600; margin-top: 18pt; margin-bottom: 6pt; }
  p { margin: 6pt 0; orphans: 3; widows: 3; }
  pre { background: #f6f6f6; border-radius: 4pt; padding: 10pt; font-size: 9pt; page-break-inside: avoid; overflow-wrap: break-word; }
  code { font-family: 'Courier New', monospace; font-size: 9pt; }
  table { border-collapse: collapse; width: 100%; margin: 12pt 0; page-break-inside: avoid; }
  th, td { border: 1pt solid #ccc; padding: 6pt 10pt; text-align: left; }
  th { background: #f0f0f0; font-weight: 600; }
  hr { border: none; border-top: 1pt solid #ddd; margin: 18pt 0; }
  ul, ol { padding-left: 18pt; margin: 6pt 0; }
  li { margin: 3pt 0; }
  a { color: #4f46e5; text-decoration: underline; }
</style>
</head>
<body>
<h1>${doc.title || "Untitled"}</h1>
${body}
</body>
</html>`;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      toast.error("Please allow pop-ups to export PDF");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 400);
    toast.success("Print dialog opened — save as PDF");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" alignOffset={8}>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Download className="mr-2 h-4 w-4" />
            Export
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={onExportPdf} disabled={!doc}>
              <Printer className="mr-2 h-4 w-4" />
              PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportHtml} disabled={!doc}>
              <FileCode className="mr-2 h-4 w-4" />
              HTML
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportMarkdown} disabled={!doc}>
              <FileText className="mr-2 h-4 w-4" />
              Markdown
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onArchive} className="text-destructive focus:text-destructive">
          <Trash className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="text-muted-foreground p-2 text-xs">
          Last edited by {user?.name}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

Menu.Skeleton = function MenuSkeleton() {
  return <Skeleton className="h-8 w-8" />;
};
