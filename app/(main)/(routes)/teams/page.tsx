"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowRight, Crown, Plus, Shield, User as UserIcon, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const roleConfig = {
  owner: { label: "Owner", icon: Crown, color: "text-amber-500 bg-amber-500/10" },
  admin: { label: "Admin", icon: Shield, color: "text-blue-500 bg-blue-500/10" },
  member: { label: "Member", icon: UserIcon, color: "text-slate-500 bg-slate-500/10" },
};

export default function TeamsPage() {
  const t = useTranslations("teams");
  const tc = useTranslations("common");
  const router = useRouter();
  const teams = useQuery(api.teams.getMyTeams);
  const createTeam = useMutation(api.teams.create);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setIsCreating(true);
    try {
      const id = await createTeam({
        name: name.trim(),
        slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        description: description.trim() || undefined,
      });
      toast.success(t("created"));
      setName("");
      setSlug("");
      setDescription("");
      setShowCreate(false);
      router.push(`/teams/${id}`);
    } catch (err: any) {
      toast.error(err.message ?? t("createFailed"));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-8 md:px-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {(teams ?? []).length} {(teams ?? []).length !== 1 ? "équipes" : "équipe"}
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1.5 h-8">
            <Plus className="h-3.5 w-3.5" />
            {t("newTeam")}
          </Button>
        </div>

        {(teams ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold">{t("empty.title")}</h3>
            <p className="text-muted-foreground mt-1 text-sm max-w-xs">{t("empty.description")}</p>
            <Button onClick={() => setShowCreate(true)} size="sm" className="mt-4 gap-1.5 h-8">
              <Plus className="h-3.5 w-3.5" /> {t("createTeam")}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {(teams ?? []).map((team: any) => {
              const roleCfg = roleConfig[team.role as keyof typeof roleConfig] ?? roleConfig.member;
              return (
                <div
                  key={team._id}
                  onClick={() => router.push(`/teams/${team._id}`)}
                  className="group flex items-center gap-4 rounded-xl border p-4 cursor-pointer hover:border-primary/20 hover:shadow-sm transition-all"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-lg font-bold text-primary shrink-0">
                    {team.icon ?? team.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                        {team.name}
                      </h3>
                      <span className="text-[11px] text-muted-foreground font-mono">/{team.slug}</span>
                    </div>
                    {team.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{team.description}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className={cn("h-6 text-[10px] gap-1 shrink-0 font-medium", roleCfg.color)}>
                    <roleCfg.icon className="h-3 w-3" />
                    {t(`roles.${team.role}` as any)}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/50 transition-colors shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="text-sm font-semibold">{t("createTeam")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="px-5 pt-4 pb-3 space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{t("teamName")}</label>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                  }}
                  placeholder="Acme Inc."
                  autoFocus
                  required
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{t("slug")}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/</span>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="acme-inc"
                    required
                    className="h-9 pl-6 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {t("description")} <span className="normal-case">({tc("optional")})</span>
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("descriptionPlaceholder")}
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-muted/20">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)} className="h-8 text-xs">
                {tc("cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={isCreating || !name.trim() || !slug.trim()} className="h-8 text-xs">
                {isCreating ? t("creating") : t("createTeam")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
