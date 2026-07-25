"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { inputBase, btnPrimary, btnOutline } from "@/components/app/common";
import { useTranslations } from "next-intl";
import { Hash } from "lucide-react";

interface ChannelCreateDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChannelCreateDialog({ workspaceId, open, onOpenChange }: ChannelCreateDialogProps) {
  const t = useTranslations("chat");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [postPermission, setPostPermission] = useState<"all" | "admin" | "moderator">("all");
  const [type, setType] = useState<"custom" | "workspace">("custom");
  const [busy, setBusy] = useState(false);
  const createChannel = useMutation(api.flux_chat.createChannel);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createChannel({
        workspaceId: workspaceId as any,
        name: name.trim(),
        type,
        visibility,
        postPermission,
        description: description.trim() || undefined,
      });
      onOpenChange(false);
      setName("");
      setDescription("");
      setVisibility("public");
      setPostPermission("all");
      setType("custom");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash size={18} /> {t("createChannel")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("channelName")}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("channelNamePlaceholder")}
              className={inputBase}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("description")}</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              className={inputBase}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("visibility")}</label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">{t("visibilityPublic")}</SelectItem>
                <SelectItem value="private">{t("visibilityPrivate")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("postPermission")}</label>
            <Select value={postPermission} onValueChange={(v) => setPostPermission(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("postAll")}</SelectItem>
                <SelectItem value="admin">{t("postAdmin")}</SelectItem>
                <SelectItem value="moderator">{t("postModerator")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className={btnOutline}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim()} className={btnPrimary}>
            {busy ? t("creating") : t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
