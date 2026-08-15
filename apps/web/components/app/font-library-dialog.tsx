"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useResolvedFonts } from "@/hooks/use-resolved-fonts";
import { useUpload } from "@a2e/core";
import { useCoreWorkspaceId } from "@/hooks/use-core-workspace-id";
import { coreFlags } from "@/lib/core-flags";
import { useQuotaGuard } from "@/hooks/use-quota-guard";
import { UpgradeDialog } from "@/components/app/upgrade-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Add, DocumentUpload, Global, TextBlock, Trash } from "iconsax-reactjs";

const SYSTEM_FONTS = [
  { family: "Plus Jakarta Sans", toneKey: "toneModern" },
  { family: "Inter", toneKey: "toneNeutral" },
  { family: "Georgia", toneKey: "toneEditorial" },
  { family: "Arial", toneKey: "toneUniversal" },
];

const MAX_FONT_BYTES = 10 * 1024 * 1024;

// Phase A: when enabled, new font uploads go to the shared A2E Core drive.
const USE_CORE_DRIVE = process.env.NEXT_PUBLIC_A2E_DRIVE === "1";
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

function exportSupport(format: string, editorLabel: string) {
  if (format === "ttf") return "PDF + DOCX";
  if (format === "woff") return "PDF";
  if (format === "otf") return "DOCX";
  return editorLabel;
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
  const t = useTranslations("docsExperience.fonts");
  const fonts = useResolvedFonts(workspaceId);
  const coreWorkspaceId = useCoreWorkspaceId();
  const coreUpload = useUpload();
  const storageQuota = useQuotaGuard("storageBytes");
  const fileSizeQuota = useQuotaGuard("maxFileUploadBytes");
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false);
  const [quotaDialogData, setQuotaDialogData] = useState<{ domain: any; used: number; limit: number } | undefined>(undefined);
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
      toast.success(t("applied", { family: family ?? font?.family ?? "Plus Jakarta Sans" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("applyFailed"));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    if (file.size > MAX_FONT_BYTES) return toast.error(t("maxSize"));
    const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const format = detectFontFormat(bytes);
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!format || extension !== format) return toast.error(t("signatureMismatch"));
    if (file.type && !FORMAT_MIME[format].includes(file.type)) return toast.error(t("mimeMismatch"));
    const family = familyFromFile(file.name);
    if (family.length < 2) return toast.error(t("rename"));

    setBusy(true);
    try {
      let storageId: Id<"_storage"> | undefined;
      let coreFileId: string | undefined;
      if (USE_CORE_DRIVE && coreWorkspaceId) {
        if (coreFlags.quotas) {
          if (!fileSizeQuota.guard()) { setBusy(false); return; }
          if (!storageQuota.guard()) { setBusy(false); return; }
        }
        const uploadFn = () => coreUpload.upload({
          workspaceId: coreWorkspaceId as any,
          file,
          sourceApp: "bureau",
          linkedTo: { app: "bureau", type: "font", id: workspaceId as string },
        });
        const result = coreFlags.quotas ? await storageQuota.catchQuota(uploadFn) : await uploadFn();
        if (!result) { setBusy(false); return; }
        coreFileId = result.fileId as string;
      } else {
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type || `font/${format}` }, body: file });
        if (!response.ok) throw new Error("Font upload failed");
        storageId = (await response.json()).storageId;
      }
      const fontId = await createUploaded({
        workspaceId,
        storageId,
        coreFileId,
        family,
        fileName: file.name,
        format,
        mimeType: file.type || `font/${format}`,
        size: file.size,
        weight: /bold/i.test(file.name) ? 700 : 400,
        style: /italic/i.test(file.name) ? "italic" : "normal",
      });
      await setDocumentStyle({ documentId, fontId, fontFamily: family });
      toast.success(t("uploaded", { family }));
      setTab("library");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("importFailed"));
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
      toast.success(t("googleImported", { family }));
      setGoogleUrl("");
      setGooglePreviewFamily("");
      setTab("library");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("googleFailed"));
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
      const id = "bureau-font-preview-link";
      document.getElementById(id)?.remove();
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = url.toString();
      document.head.appendChild(link);
      setGooglePreviewFamily(family);
    } catch {
      toast.error(t("googleInvalid"));
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-2xl" data-testid="font-library-dialog">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2"><TextBlock variant="Bulk" size={20} className="text-primary" /> {t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 border-b border-border px-4 py-2">
          {(["library", "upload", "google"] as const).map((item) => (
            <button key={item} type="button" onClick={() => setTab(item)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", tab === item ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60")} data-testid={`font-tab-${item}`}>{t(item === "library" ? "tabLibrary" : item === "upload" ? "tabUpload" : "tabGoogle")}</button>
          ))}
        </div>

        <div className="max-h-[64vh] overflow-y-auto p-5">
          {tab === "library" && (
            <div className="space-y-6">
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("builtIn")}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SYSTEM_FONTS.map((font) => (
                    <button key={font.family} type="button" disabled={busy} onClick={() => apply(undefined, font.family)} className={cn("rounded-xl border p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/40", currentFamily === font.family ? "border-primary bg-[var(--flux-coral-soft)]" : "border-border bg-card")} data-testid={`font-system-${font.family.replace(/\s+/g, "-").toLowerCase()}`}>
                      <span className="block text-lg" style={{ fontFamily: font.family }}>{font.family}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{t(font.toneKey as any)}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("workspaceFonts")}</p>
                  <button type="button" onClick={() => setTab("upload")} className="flex items-center gap-1 text-xs font-semibold text-primary" data-testid="font-add-shortcut"><Add size={14} /> {t("addFont")}</button>
                </div>
                {fonts === undefined ? (
                  <div className="grid gap-2 sm:grid-cols-2">{[0, 1].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>
                ) : customFonts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
                    <TextBlock variant="Bulk" size={28} className="mx-auto text-muted-foreground/50" />
                    <p className="mt-2 text-sm font-medium">{t("emptyTitle")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t("emptyDescription")}</p>
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
                              {font.sourceType === "google" ? t("googleSource") : String(font.format).toUpperCase()}
                              <span className="rounded bg-muted px-1.5 py-0.5">{exportSupport(font.format, t("supportEditor"))}</span>
                            </span>
                          </button>
                          <button type="button" onClick={() => removeFont({ fontId: font._id }).then(() => toast.success(t("removed"))).catch((error) => toast.error(error.message))} className="rounded-lg p-1.5 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100" data-testid="font-delete" aria-label={t("deleteAria", { family: font.family })}><Trash size={15} /></button>
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
                <span className="mt-3 text-sm font-semibold">{busy ? t("uploading") : t("chooseFile")}</span>
                <span className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{t("uploadHelp")}</span>
              </button>
              <input ref={fileRef} type="file" accept=".woff,.woff2,.ttf,.otf,font/woff,font/woff2,font/ttf,font/otf" className="hidden" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])} data-testid="font-upload-input" />
              <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground"><strong className="text-foreground">{t("compatibilityTitle")}</strong> {t("compatibilityDescription")}</div>
            </div>
          )}

          {tab === "google" && (
            <div className="space-y-4">
              <div>
                <label htmlFor="google-font-url" className="text-sm font-semibold">{t("googleUrl")}</label>
                <p className="mt-1 text-xs text-muted-foreground">{t("googleHelp")}</p>
                <div className="mt-3 flex gap-2">
                  <input id="google-font-url" value={googleUrl} onChange={(event) => setGoogleUrl(event.target.value)} placeholder="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600&display=swap" className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring" data-testid="google-font-url" />
                  <button type="button" onClick={previewGoogle} className="rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted" data-testid="google-font-preview">{t("preview")}</button>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("livePreview")}</p>
                <p className="mt-4 text-3xl leading-tight" style={{ fontFamily: googlePreviewFamily || "var(--font-sans)" }}>{googlePreviewFamily ? t("previewReady") : t("previewEmpty")}</p>
                {googlePreviewFamily && <p className="mt-2 text-sm text-muted-foreground" style={{ fontFamily: googlePreviewFamily }}>{t("previewSample")}</p>}
              </div>
              <button type="button" onClick={importGoogle} disabled={busy || !googlePreviewFamily} className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50" data-testid="google-font-import">{busy ? t("importing") : t("importApply")}</button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {coreFlags.quotas && (
      <UpgradeDialog
        state={{ open: quotaDialogOpen, ...quotaDialogData }}
        onOpenChange={setQuotaDialogOpen}
      />
    )}
    </>
  );
}
