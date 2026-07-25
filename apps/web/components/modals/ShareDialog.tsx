"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Check,
  Copy,
  Globe,
  Lock,
  Users,
  X,
  Link2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  documentId: Id<"documents">;
  document: {
    title: string;
    isPublished: boolean;
    collaborationMode?: string;
    sharedTeamId?: Id<"teams">;
    allowedEditorEmails?: string[];
    shareToken?: string;
    guestCanEdit?: boolean;
  };
}
 
type CollabMode = "view_only" | "open" | "restricted";

export function ShareDialog({ open, onClose, documentId, document }: ShareDialogProps) {
  const t = useTranslations("editor");
  const tc = useTranslations("common");

  const updateSharing = useMutation(api.documents.updateSharing);
  const generateToken = useMutation(api.documents.generateShareToken);
  const revokeToken = useMutation(api.documents.revokeShareToken);
  const myTeams = useQuery(api.teams.getMyTeams, {});

  const [isPublished, setIsPublished] = useState(document.isPublished);
  const [collabMode, setCollabMode] = useState<CollabMode | "none">(
    (document.collaborationMode as CollabMode) ?? "none",
  );
  const [sharedTeamId, setSharedTeamId] = useState<string>(document.sharedTeamId ?? "none");
  const [emailInput, setEmailInput] = useState("");
  const [allowedEmails, setAllowedEmails] = useState<string[]>(document.allowedEditorEmails ?? []);
  const [shareToken, setShareToken] = useState<string | undefined>(document.shareToken);
  const [guestCanEdit, setGuestCanEdit] = useState<boolean>(document.guestCanEdit ?? true);
  const [copiedPublic, setCopiedPublic] = useState(false);
  const [copiedGuest, setCopiedGuest] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setIsPublished(document.isPublished);
    setCollabMode((document.collaborationMode as CollabMode) ?? "none");
    setSharedTeamId(document.sharedTeamId ?? "none");
    setAllowedEmails(document.allowedEditorEmails ?? []);
    setShareToken(document.shareToken);
    setGuestCanEdit(document.guestCanEdit ?? true);
  }, [document]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = `${origin}/preview/${documentId}`;
  const guestUrl = shareToken ? `${origin}/shared/${shareToken}` : "";

  const copy = (url: string, type: "public" | "guest") => {
    navigator.clipboard.writeText(url);
    if (type === "public") {
      setCopiedPublic(true);
      setTimeout(() => setCopiedPublic(false), 2000);
    } else {
      setCopiedGuest(true);
      setTimeout(() => setCopiedGuest(false), 2000);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSharing({
        id: documentId,
        isPublished,
        collaborationMode: collabMode === "none" ? undefined : collabMode,
        sharedTeamId:
          sharedTeamId && sharedTeamId !== "none"
            ? (sharedTeamId as Id<"teams">)
            : undefined,
        allowedEditorEmails: allowedEmails.length > 0 ? allowedEmails : undefined,
      });
      toast.success(t("sharingSuccess"));
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? t("sharingFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateToken = async () => {
    setIsGenerating(true);
    try {
      const token = await generateToken({ id: documentId, guestCanEdit });
      setShareToken(token);
      toast.success(t("guestLinkCreated"));
    } catch (err: any) {
      toast.error(err.message ?? t("sharingFailed"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleGuestEdit = async (val: boolean) => {
    setGuestCanEdit(val);
    if (shareToken) {
      try {
        await updateSharing({ id: documentId, guestCanEdit: val });
      } catch {}
    }
  };

  const handleRevokeToken = async () => {
    try {
      await revokeToken({ id: documentId });
      setShareToken(undefined);
      toast.success(t("guestLinkRevoked"));
    } catch (err: any) {
      toast.error(err.message ?? t("sharingFailed"));
    }
  };

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    if (!allowedEmails.includes(email)) setAllowedEmails((p) => [...p, email]);
    setEmailInput("");
  };

  const removeEmail = (email: string) =>
    setAllowedEmails((p) => p.filter((e) => e !== email));

  const visibilityOptions = [
    { value: "private", label: t("private"), icon: Lock },
    { value: "public", label: t("public"), icon: Globe },
    { value: "team", label: t("teamOnly"), icon: Users },
  ];

  const currentVisibility =
    sharedTeamId !== "none" ? "team" : isPublished ? "public" : "private";

  const handleVisibility = (v: string) => {
    if (v === "private") {
      setIsPublished(false);
      setSharedTeamId("none");
    } else if (v === "public") {
      setIsPublished(true);
      setSharedTeamId("none");
    } else {
      setIsPublished(true);
      if (sharedTeamId === "none" && (myTeams ?? []).length > 0) {
        setSharedTeamId((myTeams as any[])[0]._id);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle className="text-base font-semibold">{t("share")}</DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-4 space-y-5 overflow-y-auto flex-1">

          {/* Visibility tabs */}
          <div className="grid grid-cols-3 gap-1 rounded-xl border p-1 bg-muted/30">
            {visibilityOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleVisibility(value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg py-2.5 text-xs font-medium transition-all",
                  currentVisibility === value
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Team select (only in team mode) */}
          {currentVisibility === "team" && (myTeams ?? []).length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("shareWithTeam")}</Label>
              <Select value={sharedTeamId} onValueChange={setSharedTeamId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(myTeams ?? []).map((team: any) => (
                    <SelectItem key={team._id} value={team._id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Public link */}
          {isPublished && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("publicLink")}</Label>
              <div className="flex gap-2">
                <Input
                  value={publicUrl}
                  readOnly
                  className="h-8 text-xs font-mono bg-muted/50 flex-1 min-w-0"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 gap-1.5 text-xs"
                  onClick={() => copy(publicUrl, "public")}
                >
                  {copiedPublic ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedPublic ? t("copied") : t("copyLink")}
                </Button>
              </div>
            </div>
          )}

          {/* Editing access (only when public) */}
          {isPublished && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("collaborative")}</Label>
              <Select value={collabMode} onValueChange={(v) => setCollabMode(v as any)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("sharingModes.none")}</SelectItem>
                  <SelectItem value="open">{t("sharingModes.open")}</SelectItem>
                  <SelectItem value="restricted">{t("sharingModes.restricted")}</SelectItem>
                </SelectContent>
              </Select>

              {collabMode === "restricted" && (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    <Input
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
                      placeholder="email@example.com"
                      className="h-8 text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 text-xs"
                      onClick={addEmail}
                    >
                      {t("addEmail")}
                    </Button>
                  </div>
                  {allowedEmails.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {allowedEmails.map((e) => (
                        <Badge key={e} variant="secondary" className="gap-1 pr-1 text-xs">
                          {e}
                          <button
                            type="button"
                            onClick={() => removeEmail(e)}
                            className="ml-0.5 rounded-sm hover:text-destructive"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Guest link */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Link2 className="h-3 w-3" />
                {t("guestLink")}
              </Label>
              {shareToken && (
                <button
                  type="button"
                  onClick={() => handleToggleGuestEdit(!guestCanEdit)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                    guestCanEdit
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", guestCanEdit ? "bg-emerald-500" : "bg-muted-foreground")} />
                  {guestCanEdit ? t("canEdit") : t("viewOnly")}
                </button>
              )}
            </div>
            {shareToken ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={guestUrl}
                    readOnly
                    className="h-8 text-xs font-mono bg-muted/50 flex-1 min-w-0"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5 text-xs"
                    onClick={() => copy(guestUrl, "guest")}
                  >
                    {copiedGuest ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedGuest ? t("copied") : t("copyLink")}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-muted-foreground"
                    onClick={handleGenerateToken}
                    disabled={isGenerating}
                  >
                    <RefreshCw className="h-3 w-3" />
                    {t("regenerateLink")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                    onClick={handleRevokeToken}
                  >
                    <Trash2 className="h-3 w-3" />
                    {t("revokeLink")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs w-full"
                onClick={handleGenerateToken}
                disabled={isGenerating}
              >
                <Link2 className="h-3.5 w-3.5" />
                {isGenerating ? tc("loading") : t("createGuestLink")}
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t shrink-0">
          <Button variant="ghost" size="sm" className="text-xs" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button size="sm" className="text-xs" onClick={handleSave} disabled={isSaving}>
            {isSaving ? tc("loading") : tc("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
