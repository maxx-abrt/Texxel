"use client";

import dynamic from "next/dynamic";
import { useMemo, use, useState, useCallback, useRef } from "react";

import { Cover } from "@/components/cover";
import { Toolbar } from "@/components/toolbar";
import { Skeleton } from "@/components/ui/skeleton";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PenLine, Lock, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const GUEST_COLORS = [
  "#f76c5e", "#7c3aed", "#2563eb", "#0d9488",
  "#d97706", "#db2777", "#65a30d", "#ea580c",
];

interface DocumentIdPageProps {
  params: Promise<{
    documentId: Id<"documents">;
  }>;
}

const DocumentIdPage = ({ params }: DocumentIdPageProps) => {
  const { documentId } = use(params);
  const t = useTranslations("editor");

  const Editor = useMemo(
    () => dynamic(() => import("@/components/editor"), { ssr: false }),
    [],
  );

  const document = useQuery(api.documents.getById, { documentId });
  const updatePublic = useMutation(api.documents.updateContentPublic);

  const [guestName, setGuestName] = useState("");
  const [guestColor, setGuestColor] = useState(GUEST_COLORS[0]);
  const [guestConfirmed, setGuestConfirmed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isEditable = document?.collaborationMode === "open" ||
    document?.collaborationMode === "restricted";

  const onGuestChange = useCallback((content: string) => {
    if (!guestConfirmed) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updatePublic({ id: documentId, content }).catch(console.error);
    }, 400);
  }, [guestConfirmed, updatePublic, documentId]);

  if (document === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <Cover.Skeleton />
        <div className="mx-auto mt-10 max-w-2xl px-6 md:max-w-3xl lg:max-w-4xl">
          <div className="space-y-4 pt-4">
            <Skeleton className="h-14 w-1/2" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </div>
      </div>
    );
  }

  if (document === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <p className="text-lg font-semibold">{t("notAvailable")}</p>
          <p className="text-sm text-muted-foreground max-w-xs">{t("notAvailableDesc")}</p>
        </div>
      </div>
    );
  }

  // Guest identity gate for editable docs
  if (isEditable && !guestConfirmed) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-xl space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <PenLine className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-base">{t("guestJoinTitle")}</h2>
                <p className="text-xs text-muted-foreground">{document.title}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{t("guestJoinDesc")}</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gname" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[1.5px]">{t("guestName")}</Label>
              <Input
                id="gname"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && guestName.trim() && setGuestConfirmed(true)}
                placeholder="e.g. Alex"
                autoFocus
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[1.5px]">{t("guestColor")}</Label>
              <div className="flex flex-wrap gap-2">
                {GUEST_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setGuestColor(c)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-all hover:scale-110",
                      guestColor === c ? "border-foreground scale-110" : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <Button
            className="w-full"
            disabled={!guestName.trim()}
            onClick={() => setGuestConfirmed(true)}
          >
            {t("guestJoin")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-40 bg-background">
      {/* Guest badge when editing */}
      {isEditable && guestConfirmed && (
        <div className="fixed top-3 right-4 z-50 flex items-center gap-2 rounded-full border bg-card/90 backdrop-blur-sm px-3 py-1.5 text-xs shadow-lg">
          <span className="h-2.5 w-2.5 rounded-full ring-2 ring-background" style={{ backgroundColor: guestColor }} />
          <span className="font-medium">{guestName}</span>
          <span className="text-muted-foreground">· {t("guestEditing")}</span>
        </div>
      )}

      {/* Read-only banner */}
      {!isEditable && (
        <div className="flex items-center justify-center gap-2 border-b bg-muted/40 py-2 text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          {t("readOnlyBanner")}
        </div>
      )}

      <Cover preview url={document.coverImage} />
      <div className="mx-auto px-4 md:max-w-3xl lg:max-w-4xl">
        <Toolbar preview initialData={document} />
        <Editor
          editable={isEditable && guestConfirmed}
          onChange={isEditable ? onGuestChange : () => {}}
          initialContent={document.content}
        />
      </div>
    </div>
  );
};
export default DocumentIdPage;
