"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DocumentDownload, DocumentText, Setting4, TickCircle } from "iconsax-reactjs";

function slug(value: string) {
  return (value || "document").normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").toLowerCase().slice(0, 80) || "document";
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  A4: { width: 11906, height: 16838 },
  LETTER: { width: 12240, height: 15840 },
  LEGAL: { width: 12240, height: 20160 },
};

type ExportState = "idle" | "preparing" | "resolving" | "rendering" | "finalizing" | "done" | "error";

export function ExportDialog({
  open,
  onOpenChange,
  editor,
  title,
  locale,
  documentStyle,
  selectedFont,
  onSaveSettings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editor: any;
  title: string;
  locale?: string;
  documentStyle?: any;
  selectedFont?: any;
  onSaveSettings?: (settings: any) => Promise<unknown>;
}) {
  const t = useTranslations("docsExperience.export");
  const appLocale = useLocale();
  const exportLocale = locale ?? (appLocale === "fr" ? "fr-FR" : "en-US");
  const [format, setFormat] = useState<"pdf" | "docx">("pdf");
  const [pageSize, setPageSize] = useState(documentStyle?.pageSize ?? "A4");
  const [margin, setMargin] = useState(documentStyle?.marginTop ?? 48);
  const [includeTitle, setIncludeTitle] = useState(true);
  const [headerEnabled, setHeaderEnabled] = useState(documentStyle?.headerEnabled ?? false);
  const [footerEnabled, setFooterEnabled] = useState(documentStyle?.footerEnabled ?? true);
  const [headerText, setHeaderText] = useState(documentStyle?.headerText ?? title);
  const [footerText, setFooterText] = useState(documentStyle?.footerText ?? "Texxel · {date}");
  const [state, setState] = useState<ExportState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setPageSize(documentStyle?.pageSize ?? "A4");
    setMargin(documentStyle?.marginTop ?? 48);
    setHeaderEnabled(documentStyle?.headerEnabled ?? false);
    setFooterEnabled(documentStyle?.footerEnabled ?? true);
    setHeaderText(documentStyle?.headerText ?? title);
    setFooterText(documentStyle?.footerText ?? "Texxel · {date}");
    setState("idle");
    setProgress(0);
    setError("");
  }, [open, documentStyle, title]);

  const formatDate = () => new Intl.DateTimeFormat(exportLocale, { year: "numeric", month: "short", day: "numeric" }).format(new Date());

  const resolveAsset = async (url: string): Promise<Blob> => {
    if (url.startsWith("data:")) return (await fetch(url)).blob();
    const absolute = new URL(url, window.location.origin);
    if (!["https:", "http:"].includes(absolute.protocol)) throw new Error(t("unsupportedImage"));
    try {
      const response = await fetch(absolute, { credentials: absolute.origin === window.location.origin ? "include" : "omit" });
      if (!response.ok) throw new Error();
      return response.blob();
    } catch {
      throw new Error(t("imageFailed", { host: absolute.hostname }));
    }
  };

  const compatibility = useMemo(() => {
    if (!selectedFont) return t("builtInFonts");
    const fontFormat = String(selectedFont.format).toLowerCase();
    if (format === "pdf" && !["ttf", "woff"].includes(fontFormat)) return t("pdfFontFallback", { family: selectedFont.family, format: fontFormat.toUpperCase() });
    if (format === "docx" && !["ttf", "otf"].includes(fontFormat)) return t("docxFontFallback", { family: selectedFont.family });
    return t("fontEmbedded", { family: selectedFont.family, format: format.toUpperCase() });
  }, [selectedFont, format, t]);

  const blocks = () => includeTitle
    ? [{
        id: "texxel-export-title",
        type: "heading",
        props: { level: 1, textColor: "default", backgroundColor: "default", textAlignment: "left" },
        content: [{ type: "text", text: title, styles: {} }],
        children: [],
      }, ...editor.document]
    : editor.document;

  const doPdf = async () => {
    setState("resolving");
    setProgress(30);
    const [{ PDFExporter, pdfDefaultSchemaMappings }, ReactPDF] = await Promise.all([
      import("@blocknote/xl-pdf-exporter"),
      import("@react-pdf/renderer"),
    ]);
    const mappings: any = {
      ...pdfDefaultSchemaMappings,
      inlineContentMapping: {
        ...pdfDefaultSchemaMappings.inlineContentMapping,
        mention: (content: any) => React.createElement(ReactPDF.Text, { style: { color: "#E65A41", fontWeight: 700 } }, `${content.props.kind === "task" ? "#" : "@"}${content.props.label}`),
      },
    };
    const exporter: any = new PDFExporter(editor.schema, mappings, { resolveFileUrl: resolveAsset });
    const fontFormat = String(selectedFont?.format ?? "").toLowerCase();
    if (selectedFont?.fileUrl && ["ttf", "woff"].includes(fontFormat)) {
      ReactPDF.Font.register({ family: selectedFont.family, src: selectedFont.fileUrl, fontWeight: selectedFont.weight ?? 400, fontStyle: selectedFont.style ?? "normal" });
      exporter.styles.page.fontFamily = selectedFont.family;
    }
    exporter.styles.page.paddingTop = margin;
    exporter.styles.page.paddingRight = margin;
    exporter.styles.page.paddingBottom = Math.max(margin, footerEnabled ? 58 : margin);
    exporter.styles.page.paddingLeft = margin;
    exporter.styles.page.fontSize = (documentStyle?.fontSize ?? 16) * 0.75;
    exporter.styles.page.lineHeight = documentStyle?.lineHeight ?? 1.65;
    const header = headerEnabled ? React.createElement(ReactPDF.Text, { style: { fontSize: 8.5, color: "#746D66" } }, headerText.replace("{title}", title).replace("{date}", formatDate())) : undefined;
    const footer = footerEnabled ? React.createElement(ReactPDF.Text, {
      style: { fontSize: 8.5, color: "#746D66", textAlign: "center" },
      render: ({ pageNumber, totalPages }: any) => `${footerText.replace("{title}", title).replace("{date}", formatDate())}  ·  ${pageNumber} / ${totalPages}`,
    }) : undefined;
    setState("rendering");
    setProgress(58);
    let document: any = await exporter.toReactPDFDocument(blocks(), { header, footer });
    const children = React.Children.map(document.props.children, (child: any) => child ? React.cloneElement(child, { size: pageSize === "LETTER" ? "LETTER" : pageSize === "LEGAL" ? [612, 1008] : "A4" }) : child);
    document = React.cloneElement(document, {}, children);
    setProgress(76);
    const blob = await ReactPDF.pdf(document).toBlob();
    setProgress(92);
    return blob;
  };

  const doDocx = async () => {
    setState("resolving");
    setProgress(30);
    const [{ DOCXExporter, docxDefaultSchemaMappings }, Docx] = await Promise.all([
      import("@blocknote/xl-docx-exporter"),
      import("docx"),
    ]);
    const mappings: any = {
      ...docxDefaultSchemaMappings,
      inlineContentMapping: {
        ...docxDefaultSchemaMappings.inlineContentMapping,
        mention: (content: any) => new Docx.TextRun({ text: `${content.props.kind === "task" ? "#" : "@"}${content.props.label}`, color: "E65A41", bold: true }),
      },
    };
    const exporter: any = new DOCXExporter(editor.schema, mappings, { resolveFileUrl: resolveAsset });
    const family = selectedFont?.family ?? documentStyle?.fontFamily ?? "Inter";
    const documentOptions: any = {
      creator: "Texxel",
      title,
      description: t("descriptionMetadata"),
      styles: { default: { document: { run: { font: family, size: Math.round((documentStyle?.fontSize ?? 16) * 2) } } } },
    };
    const fontFormat = String(selectedFont?.format ?? "").toLowerCase();
    if (selectedFont?.fileUrl && ["ttf", "otf"].includes(fontFormat)) {
      const fontResponse = await fetch(selectedFont.fileUrl);
      if (fontResponse.ok) documentOptions.fonts = [{ name: family, data: new Uint8Array(await fontResponse.arrayBuffer()) }];
    }
    const page = PAGE_SIZES[pageSize] ?? PAGE_SIZES.A4;
    const sectionOptions: any = {
      properties: { page: { size: page, margin: { top: margin * 20, right: margin * 20, bottom: margin * 20, left: margin * 20 } } },
      headers: headerEnabled ? { default: new Docx.Header({ children: [new Docx.Paragraph({ children: [new Docx.TextRun(headerText.replace("{title}", title).replace("{date}", formatDate()))] })] }) } : undefined,
      footers: footerEnabled ? { default: new Docx.Footer({ children: [new Docx.Paragraph({ alignment: Docx.AlignmentType.CENTER, children: [new Docx.TextRun(footerText.replace("{title}", title).replace("{date}", formatDate())), new Docx.TextRun("  ·  "), new Docx.TextRun({ children: [Docx.PageNumber.CURRENT] })] })] }) } : undefined,
    };
    setState("rendering");
    setProgress(62);
    const blob = await exporter.toBlob(blocks(), { locale: exportLocale, documentOptions, sectionOptions });
    setProgress(92);
    return blob;
  };

  const exportNow = async () => {
    if (!editor) return toast.error(t("editorLoading"));
    setState("preparing");
    setProgress(8);
    setError("");
    try {
      await onSaveSettings?.({ pageSize, marginTop: margin, marginRight: margin, marginBottom: margin, marginLeft: margin, headerEnabled, footerEnabled, headerText, footerText });
      setProgress(20);
      const blob = format === "pdf" ? await doPdf() : await doDocx();
      if (blob.size < 1_000) throw new Error(t("emptyFile"));
      setState("finalizing");
      setProgress(96);
      saveBlob(blob, `${slug(title)}.${format}`);
      setProgress(100);
      setState("done");
      toast.success(t("success", { format: format.toUpperCase() }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("failed"));
      setState("error");
      setProgress(0);
    }
  };

  const busy = ["preparing", "resolving", "rendering", "finalizing"].includes(state);
  const stageLabel = state === "preparing" ? t("preparing") : state === "resolving" ? t("resolving") : state === "rendering" ? t("rendering", { format: format.toUpperCase() }) : state === "finalizing" ? t("finalizing") : state === "done" ? t("complete", { format: format.toUpperCase() }) : "";

  return (
    <Dialog open={open} onOpenChange={(value) => !busy && onOpenChange(value)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-xl" data-testid="export-dialog">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2"><DocumentDownload variant="Bulk" size={20} className="text-primary" /> {t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 p-5">
          <section>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("format")}</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["pdf", "docx"] as const).map((item) => (
                <button key={item} type="button" onClick={() => setFormat(item)} className={cn("rounded-xl border p-3 text-left", format === item ? "border-primary bg-[var(--flux-coral-soft)]" : "border-border bg-card hover:bg-muted/40")} data-testid={`export-format-${item}`}>
                  <span className="flex items-center gap-2 text-sm font-semibold"><DocumentText variant="Bulk" size={17} /> {item.toUpperCase()}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{t(item === "pdf" ? "pdfDescription" : "docxDescription")}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Setting4 variant="Bulk" size={16} /> {t("pageSetup")}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-muted-foreground">{t("pageSize")}<select value={pageSize} onChange={(event) => setPageSize(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" data-testid="export-page-size"><option value="A4">A4</option><option value="LETTER">{t("letter")}</option><option value="LEGAL">{t("legal")}</option></select></label>
              <label className="text-xs text-muted-foreground">{t("margins", { margin })}<input type="range" min="24" max="72" step="4" value={margin} onChange={(event) => setMargin(Number(event.target.value))} className="mt-2 w-full accent-[var(--primary)]" data-testid="export-margin" /></label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={includeTitle} onChange={(event) => setIncludeTitle(event.target.checked)} className="accent-[var(--primary)]" data-testid="export-include-title" /> {t("includeTitle")}</label>
          </section>
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <label className="flex items-center justify-between gap-3 text-sm font-semibold"><span>{t("header")}</span><input type="checkbox" checked={headerEnabled} onChange={(event) => setHeaderEnabled(event.target.checked)} className="accent-[var(--primary)]" data-testid="export-header-toggle" /></label>
            {headerEnabled && <input value={headerText} onChange={(event) => setHeaderText(event.target.value)} placeholder="{title}" className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" data-testid="export-header-text" />}
            <div className="border-t border-border" />
            <label className="flex items-center justify-between gap-3 text-sm font-semibold"><span>{t("footer")}</span><input type="checkbox" checked={footerEnabled} onChange={(event) => setFooterEnabled(event.target.checked)} className="accent-[var(--primary)]" data-testid="export-footer-toggle" /></label>
            {footerEnabled && <input value={footerText} onChange={(event) => setFooterText(event.target.value)} placeholder="Texxel · {date}" className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" data-testid="export-footer-text" />}
            <p className="text-[11px] text-muted-foreground">{t("placeholderHint")}</p>
          </section>
          <div className="rounded-xl bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground" data-testid="export-font-compatibility">{compatibility}</div>
          {(busy || state === "done") && (
            <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm" data-testid="export-progress">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-foreground">{stageLabel}</span><span className="tabular-nums text-muted-foreground">{progress}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn("relative h-full rounded-full bg-primary transition-[width] duration-500 ease-out", busy && "after:absolute after:inset-0 after:animate-pulse after:bg-white/25")} style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive" role="alert" data-testid="export-error">{error}</div>}
          {state === "done" && <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800" data-testid="export-success"><TickCircle variant="Bold" size={17} /> {t("downloadReady")}</div>}
          <button type="button" onClick={exportNow} disabled={busy || !editor} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-50" data-testid="export-submit">
            {busy ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> {stageLabel}</> : <><DocumentDownload variant="Bulk" size={18} /> {t("submit", { format: format.toUpperCase() })}</>}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
