"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { inputBase, btnPrimary, btnOutline, btnGhost } from "@/components/app/common";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Settings2, Trash2 } from "lucide-react";

interface Channel {
  _id: string;
  name: string;
  description?: string;
  visibility?: "public" | "private";
  postPermission?: "all" | "admin" | "moderator";
  archived?: boolean;
  canManage?: boolean;
}

interface ChannelSettingsDialogProps {
  channel: Channel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function ChannelSettingsDialog({ channel, open, onOpenChange, onDeleted }: ChannelSettingsDialogProps) {
  const t = useTranslations("chat");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [postPermission, setPostPermission] = useState<"all" | "admin" | "moderator">("all");
  const [archived, setArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const updateChannel = useMutation(api.flux_chat.updateChannel);
  const deleteChannel = useMutation(api.flux_chat.deleteChannel);

  useEffect(() => {
    if (!channel) return;
    setName(channel.name);
    setDescription(channel.description ?? "");
    setVisibility(channel.visibility ?? "public");
    setPostPermission(channel.postPermission ?? "all");
    setArchived(channel.archived ?? false);
  }, [channel]);

  const submit = async () => {
    if (!channel || !name.trim()) return;
    setBusy(true);
    try {
      await updateChannel({
        channelId: channel._id as any,
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
        postPermission,
        archived,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update channel");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!channel) return;
    if (!confirm(t("deleteChannelConfirm"))) return;
    setBusy(true);
    try {
      await deleteChannel({ channelId: channel._id as any });
      onOpenChange(false);
      onDeleted?.();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete channel");
    } finally {
      setBusy(false);
    }
  };

  if (!channel) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 size={18} /> {t("channelSettings")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("channelName")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputBase} />
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
          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
            <span className="text-sm font-medium">{t("archived")}</span>
            <Switch checked={archived} onCheckedChange={setArchived} />
          </div>
        </div>
        <DialogFooter className="items-center">
          <Button variant="ghost" onClick={handleDelete} className="mr-auto gap-2 text-destructive" disabled={busy}>
            <Trash2 size={16} /> {t("deleteChannel")}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className={btnOutline}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim()} className={btnPrimary}>
            {busy ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
