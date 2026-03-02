"use client";

import { useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { authClient } from "@/lib/auth/client";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
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
import { Download, FileText, FileType2, History, MessageSquare, MoreHorizontal, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentUI } from "@/hooks/useDocumentUI";

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
  const t = useTranslations("editor");
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const { toggleComments, toggleVersionHistory, showComments, showVersionHistory, exportHandlers } = useDocumentUI();

  const archive = useMutation(api.documents.archive);
  const doc = useQuery(api.documents.getById, { documentId });

  const onArchive = () => {
    const promise = archive({ id: documentId });
    toast.promise(promise, {
      loading: t("menuTrashLoading"),
      success: t("menuTrashSuccess"),
      error: t("menuTrashFailed"),
    });
    router.push("/documents");
  };

  const onExportMarkdown = () => {
    if (!doc) return;
    let blocks: any[] = [];
    try { blocks = JSON.parse(doc.content ?? "[]"); } catch {}
    const md = `# ${doc.title || "Untitled"}\n\n${blocksToMarkdown(blocks)}`;
    downloadBlob(md, `${doc.title || "note"}.md`, "text/markdown;charset=utf-8");
    toast.success(t("exportSuccess"));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52" align="end" alignOffset={8}>
        <DropdownMenuItem onClick={toggleComments}>
          <MessageSquare className={`mr-2 h-4 w-4 ${showComments ? "text-primary" : ""}`} />
          <span>{t("menuComments")}</span>
          {showComments && <span className="ml-auto text-[10px] text-primary font-medium">{t("menuOpen")}</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleVersionHistory}>
          <History className={`mr-2 h-4 w-4 ${showVersionHistory ? "text-primary" : ""}`} />
          <span>{t("menuVersionHistory")}</span>
          {showVersionHistory && <span className="ml-auto text-[10px] text-primary font-medium">{t("menuOpen")}</span>}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Download className="mr-2 h-4 w-4" />
            {t("menuExport")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem
              onClick={() => exportHandlers.pdf?.()}
              disabled={!exportHandlers.pdf}
            >
              <FileType2 className="mr-2 h-4 w-4 text-red-500" />
              {t("menuExportPdf")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => exportHandlers.docx?.()}
              disabled={!exportHandlers.docx}
            >
              <FileType2 className="mr-2 h-4 w-4 text-blue-500" />
              {t("menuExportWord")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportMarkdown} disabled={!doc}>
              <FileText className="mr-2 h-4 w-4" />
              {t("menuExportMarkdown")}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onArchive} className="text-destructive focus:text-destructive">
          <Trash className="mr-2 h-4 w-4" />
          {t("menuTrash")}
        </DropdownMenuItem>
        {user?.name && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-[10px] text-muted-foreground">
              {t("menuEditedBy", { name: user.name })}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

Menu.Skeleton = function MenuSkeleton() {
  return <Skeleton className="h-8 w-8" />;
};
