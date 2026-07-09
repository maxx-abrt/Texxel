"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Add, DocumentUpload, Global, TextBlock, Trash } from "iconsax-reactjs";

const SYSTEM_FONTS = [
  { family: "Plus Jakarta Sans", tone: "Modern and friendly" },
  { family: "Inter", tone: "Neutral and precise" },
  { family: "Georgia", tone: "Editorial and expressive" },
  { family: "Arial", tone: "Universal and compact" },
];

const MAX_FONT_BYTES = 10 * 1024 * 1024;
const FORMAT_MIME: Record<string, string[]> = {
  woff: ["font/woff", "application/font-woff", "application/octet-stream"],
  woff2: ["font/woff2", "application/font-woff2", "application/octet-stream"],
  ttf: ["font/ttf", "application/x-font-ttf", "application/octet-stream"],
  otf: ["font/otf", "application/x-font-opentype", "application/octet-stream"],
};

function detectFontFormat(bytes: Uint8Array) {
  const signature = String.fromCharCode(...bytes.slice(0, 4));
  if (signature === "wOFF") return "woff";
  if (signature === "wOF2") return "woff2";
  if (signature === "OTTO") return "otf";
  if (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0) return "ttf";
  if (signature === "true") return "ttf";
  return null;
}

function familyFromFile(name: string) {
  return name.replace(/\.(woff2?|ttf|otf)$/i, "").replace(/[-_]+/g, " ").replace(/\b(regular|medium|bold|italic|variable)\b/gi, "").replace(/\s+/g, " ").trim();
}

function exportSupport(format: string) {
  if (format === "ttf") return "PDF + DOCX";
  if (format === "woff") return "PDF";
  if (format === "otf") return "DOCX";
  return "Editor";
}

export function FontLibraryDialog({
  open,
  onOpenChange,
  workspaceId,
  documentId,
  documentStyle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: Id<"workspaces">;
  documentId: Id<"flux_documents">;
  documentStyle?: any;
}) {
  const fonts = useQuery(api.flux_fonts.list, { workspaceId });
  const generateUploadUrl = useMutation(api.flux_files.generateUploadUrl);
  const createUploaded = useMutation(api.flux_fonts.createUploaded);
  const createGoogle = useMutation(api.flux_fonts.createGoogle);
  const removeFont = useMutation(api.flux_fonts.remove);
  const setDocumentStyle = useMutation(api.flux_fonts.setDocumentStyle);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"library" | "upload" | "google">("library");
  const [busy, setBusy] = useState(false);
  const [googleUrl, setGoogleUrl] = useState("");
  const [googlePreviewFamily, setGooglePreviewFamily] = useState("");
  const currentFamily = documentStyle?.fontFamily ?? "Plus Jakarta Sans";

  const customFonts = useMemo(() => fonts ?? [], [fonts]);

  const apply = async (font?: any, family?: string) => {
    setBusy(true);
    try {
      await setDocumentStyle({
        documentId,
        fontId: font?._id,
        fontFamily: family ?? font?.family ?? "Plus Jakarta Sans",
        fontSize: documentStyle?.fontSize ?? 16,
        lineHeight: documentStyle?.lineHeight ?? 1.65,
        pageSize: documentStyle?.pageSize ?? "A4",
        marginTop: documentStyle?.marginTop ?? 48,
        marginRight: documentStyle?.marginRight ?? 48,
        marginBottom: documentStyle?.marginBottom ?? 56,
        marginLeft: documentStyle?.marginLeft ?? 48,
        headerEnabled: documentStyle?.headerEnabled ?? false,
        footerEnabled: documentStyle?.footerEnabled ?? true,
        headerText: documentStyle?.headerText,
        footerText: documentStyle?.footerText,
      });
      toast.success(`${family ?? font?.family} applied to this document`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not apply font");
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    if (file.size > MAX_FONT_BYTES) return toast.error("Font file must be 10 MB or smaller");
    const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const format = detectFontFormat(bytes);
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!format || extension !== format) return toast.error("Font signature does not match a supported WOFF, WOFF2, TTF, or OTF file");
    if (file.type && !FORMAT_MIME[format].includes(file.type)) return toast.error("The font MIME type does not match its format");
    const family = familyFromFile(file.name);
    if (family.length < 2) return toast.error("Rename the file with a clear font family name");

    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type || `font/${format}` }, body: file });
      if (!response.ok) throw new Error("Font upload failed");
      const { storageId } = await response.json();
      const fontId = await createUploaded({
        workspaceId,
        storageId,
        family,
        fileName: file.name,
        format,
        mimeType: file.type || `font/${format}`,
        size: file.size,
        weight: /bold/i.test(file.name) ? 700 : 400,
        style: /italic/i.test(file.name) ? "italic" : "normal",
      });
      await setDocumentStyle({ documentId, fontId, fontFamily: family });
      toast.success(`${family} uploaded and applied`);
      setTab("library");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import font");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const importGoogle = async () => {
    setBusy(true);
    try {
      const fontId = await createGoogle({ workspaceId, cssUrl: googleUrl.trim() });
      const parsed = new URL(googleUrl.trim());
      const family = (parsed.searchParams.get("family") ?? "Google Font").split(":")[0].replace(/\+/g, " ");
      await setDocumentStyle({ documentId, fontId, fontFamily: family });
      toast.success(`${family} imported and applied`);
      setGoogleUrl("");
      setGooglePreviewFamily("");
      setTab("library");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import Google Font");
    } finally {
      setBusy(false);
    }
  };

  const previewGoogle = () => {
    try {
      const url = new URL(googleUrl.trim());
      if (url.protocol !== "https:" || url.hostname !== "fonts.googleapis.com" || !url.pathname.startsWith("/css")) throw new Error();
      const family = (url.searchParams.get("family") ?? "").split(":")[0].replace(/\+/g, " ");
      if (!family) throw new Error();
      const id = "texxel-font-preview-link";
      document.getElementById(id)?.remove();
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = url.toString();
      document.head.appendChild(link);
      setGooglePreviewFamily(family);
    } catch {
      toast.error("Paste a fonts.googleapis.com CSS URL containing a family");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-2xl" data-testid="font-library-dialog">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2"><TextBlock variant="Bulk" size={20} className="text-primary" /> Document typography</DialogTitle>
          <DialogDescription>Build a reusable workspace font library and keep editor and exports visually consistent.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 border-b border-border px-4 py-2">
          {(["library", "upload", "google"] as const).map((item) => (
            <button key={item} type="button" onClick={() => setTab(item)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold capitalize", tab === item ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60")} data-testid={`font-tab-${item}`}>{item}</button>
          ))}
        </div>

        <div className="max-h-[64vh] overflow-y-auto p-5">
          {tab === "library" && (
            <div className="space-y-6">
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Built-in</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SYSTEM_FONTS.map((font) => (
                    <button key={font.family} type="button" disabled={busy} onClick={() => apply(undefined, font.family)} className={cn("rounded-xl border p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/40", currentFamily === font.family ? "border-primary bg-[var(--flux-coral-soft)]" : "border-border bg-card")} data-testid={`font-system-${font.family.replace(/\s+/g, "-").toLowerCase()}`}>
                      <span className="block text-lg" style={{ fontFamily: font.family }}>{font.family}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{font.tone}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workspace fonts</p>
                  <button type="button" onClick={() => setTab("upload")} className="flex items-center gap-1 text-xs font-semibold text-primary" data-testid="font-add-shortcut"><Add size={14} /> Add font</button>
                </div>
                {fonts === undefined ? (
                  <div className="grid gap-2 sm:grid-cols-2">{[0, 1].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>
                ) : customFonts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
                    <TextBlock variant="Bulk" size={28} className="mx-auto text-muted-foreground/50" />
                    <p className="mt-2 text-sm font-medium">No custom fonts yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">Upload a font file or import a Google Fonts URL.</p>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {customFonts.map((font: any) => (
                      <div key={font._id} className={cn("group rounded-xl border p-3", currentFamily === font.family ? "border-primary bg-[var(--flux-coral-soft)]" : "border-border bg-card")} data-testid="font-library-item">
                        {font.sourceType === "google" && font.cssUrl ? <link rel="stylesheet" href={font.cssUrl} /> : null}
                        <div className="flex items-start gap-2">
                          <button type="button" disabled={busy} onClick={() => apply(font)} className="min-w-0 flex-1 text-left" data-testid="font-apply">
                            <span className="block truncate text-lg" style={{ fontFamily: font.family }}>{font.family}</span>
                            <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              {font.sourceType === "google" ? <Global size={12} /> : <DocumentUpload size={12} />}
                              {font.sourceType === "google" ? "Google Fonts" : String(font.format).toUpperCase()}
                              <span className="rounded bg-muted px-1.5 py-0.5">{exportSupport(font.format)}</span>
                            </span>
                          </button>
                          <button type="button" onClick={() => removeFont({ fontId: font._id }).then(() => toast.success("Font removed")).catch((error) => toast.error(error.message))} className="rounded-lg p-1.5 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100" data-testid="font-delete" aria-label={`Delete ${font.family}`}><Trash size={15} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {tab === "upload" && (
            <div className="space-y-4">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="flex min-h-56 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 text-center hover:border-primary/50 hover:bg-muted/40 disabled:opacity-60" data-testid="font-upload-dropzone">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--flux-coral-soft)] text-primary"><DocumentUpload variant="Bulk" size={24} /></span>
                <span className="mt-3 text-sm font-semibold">{busy ? "Uploading font…" : "Choose a font file"}</span>
                <span className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">WOFF, WOFF2, TTF, or OTF · up to 10 MB. The actual file signature is checked, not only the extension.</span>
              </button>
              <input ref={fileRef} type="file" accept=".woff,.woff2,.ttf,.otf,font/woff,font/woff2,font/ttf,font/otf" className="hidden" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])} data-testid="font-upload-input" />
              <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground"><strong className="text-foreground">Export compatibility:</strong> TTF works best across PDF and DOCX. WOFF is optimized for PDF; OTF for DOCX. WOFF2 is excellent in the editor but may fall back in exported files.</div>
            </div>
          )}

          {tab === "google" && (
            <div className="space-y-4">
              <div>
                <label htmlFor="google-font-url" className="text-sm font-semibold">Google Fonts CSS URL</label>
                <p className="mt-1 text-xs text-muted-foreground">Open a family on fonts.google.com, select styles, then paste its fonts.googleapis.com CSS link.</p>
                <div className="mt-3 flex gap-2">
                  <input id="google-font-url" value={googleUrl} onChange={(event) => setGoogleUrl(event.target.value)} placeholder="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600&display=swap" className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring" data-testid="google-font-url" />
                  <button type="button" onClick={previewGoogle} className="rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted" data-testid="google-font-preview">Preview</button>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live preview</p>
                <p className="mt-4 text-3xl leading-tight" style={{ fontFamily: googlePreviewFamily || "var(--font-sans)" }}>{googlePreviewFamily ? "Make every document feel intentional." : "Paste a valid URL to preview the family."}</p>
                {googlePreviewFamily && <p className="mt-2 text-sm text-muted-foreground" style={{ fontFamily: googlePreviewFamily }}>Aa Bb Cc · 0123456789 · The quick brown fox jumps over the lazy dog.</p>}
              </div>
              <button type="button" onClick={importGoogle} disabled={busy || !googlePreviewFamily} className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50" data-testid="google-font-import">{busy ? "Importing…" : "Import and apply font"}</button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
