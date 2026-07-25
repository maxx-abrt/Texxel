"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { inputBase } from "@/components/app/common";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Users, X } from "lucide-react";

interface ChannelMembersDialogProps {
  channelId: string | null;
  workspaceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChannelMembersDialog({ channelId, workspaceId, open, onOpenChange }: ChannelMembersDialogProps) {
  const t = useTranslations("chat");
  const members = useQuery(
    api.flux_chat.listChannelMembers,
    channelId ? { channelId: channelId as any } : "skip",
  );
  const wsMembers = useQuery(
    api.workspaces.listMembers,
    workspaceId ? { workspaceId: workspaceId as any } : "skip",
  );
  const addMember = useMutation(api.flux_chat.addChannelMember);
  const removeMember = useMutation(api.flux_chat.removeChannelMember);
  const updateRole = useMutation(api.flux_chat.updateChannelMemberRole);
  const [search, setSearch] = useState("");

  const memberIds = useMemo(() => new Set((members ?? []).map((m: any) => m.userId)), [members]);
  const candidates = useMemo(() => {
    if (!wsMembers) return [];
    return (wsMembers as any[]).filter((m) => !memberIds.has(m._id) && (m.name ?? m.email).toLowerCase().includes(search.toLowerCase()));
  }, [wsMembers, memberIds, search]);

  const handleAdd = async (userId: string) => {
    if (!channelId) return;
    try {
      await addMember({ channelId: channelId as any, userId: userId as any, role: "poster" });
      toast.success(t("memberAdded"));
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add member");
    }
  };

  const handleRemove = async (userId: string) => {
    if (!channelId) return;
    try {
      await removeMember({ channelId: channelId as any, userId: userId as any });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to remove member");
    }
  };

  const handleRoleChange = async (userId: string, role: "viewer" | "poster" | "moderator") => {
    if (!channelId) return;
    try {
      await updateRole({ channelId: channelId as any, userId: userId as any, role });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update role");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users size={18} /> {t("channelMembers")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("addMemberPlaceholder")}
            className={inputBase}
          />
          {search && candidates.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-lg border border-border bg-muted/30 p-1">
              {candidates.map((m: any) => (
                <button
                  key={m._id}
                  onClick={() => handleAdd(m._id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={m.image} />
                    <AvatarFallback>{(m.name ?? m.email ?? "U").charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm">{m.name ?? m.email}</span>
                </button>
              ))}
            </div>
          )}
          <div className="max-h-60 overflow-y-auto space-y-1">
            {(members ?? []).map((m: any) => (
              <div key={m.userId} className="flex items-center gap-2 rounded-lg border border-border px-2 py-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={m.image} />
                  <AvatarFallback>{(m.name ?? m.email ?? "U").charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{m.email}</p>
                </div>
                <Select
                  value={m.role}
                  onValueChange={(v) => handleRoleChange(m.userId, v as any)}
                >
                  <SelectTrigger className="h-7 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">{t("roleViewer")}</SelectItem>
                    <SelectItem value="poster">{t("rolePoster")}</SelectItem>
                    <SelectItem value="moderator">{t("roleModerator")}</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={() => handleRemove(m.userId)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
