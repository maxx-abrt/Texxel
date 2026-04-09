"use client";

import { useState, useMemo } from "react";
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
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowRight, Crown, Lock, Plus, Shield, User as UserIcon, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/hooks/useWorkspace";

const MAX_TEAMS = 5;

const roleConfig = {
  owner: { icon: Crown, color: "text-amber-500 bg-amber-500/10" },
  admin: { icon: Shield, color: "text-blue-500 bg-blue-500/10" },
  member: { icon: UserIcon, color: "text-slate-500 bg-slate-500/10" },
};

export default function TeamsPage() {
  const t = useTranslations("teams");
  const tc = useTranslations("common");
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace();
  const wsId = activeWorkspaceId as any;
  const teams = useQuery(api.teams.getMyTeams, { workspaceId: wsId });
  const createTeam = useMutation(api.teams.create);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Count teams where user is owner to enforce limit
  const ownedCount = useMemo(
    () => (teams ?? []).filter((t: any) => t.role === "owner").length,
    [teams],
  );
  const atLimit = ownedCount >= MAX_TEAMS;

  const resetForm = () => { setName(""); setSlug(""); setDescription(""); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    if (atLimit) { toast.error(t("limitReached")); return; }
    setIsCreating(true);
    try {
      const id = await createTeam({
        name: name.trim(),
        slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        description: description.trim() || undefined,
        workspaceId: wsId,
      });
      toast.success(t("created"));
      resetForm();
      setShowCreate(false);
      router.push(`/teams/${id}`);
    } catch (err: any) {
      toast.error(err.message === "Team limit reached" ? t("limitReached") : (err.message ?? t("createFailed")));
    } finally {
      setIsCreating(false);
    }
  };

  const teamList = teams ?? [];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-8 md:px-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {teamList.length} / {MAX_TEAMS} {t("teamsOwned")}
            </p>
          </div>
          <Button
            onClick={() => { if (atLimit) { toast.error(t("limitReached")); return; } setShowCreate(true); }}
            size="sm"
            className="gap-1.5 h-8"
            disabled={teams === undefined}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("newTeam")}
          </Button>
        </div>

        {/* Limit progress bar */}
        <div className="mb-8 mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-muted-foreground">{t("teamSlots")}</span>
            <span className={cn("text-[11px] font-medium tabular-nums", atLimit ? "text-red-500" : "text-muted-foreground")}>
              {ownedCount}/{MAX_TEAMS}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                ownedCount >= MAX_TEAMS ? "bg-red-500" : ownedCount >= MAX_TEAMS - 1 ? "bg-amber-500" : "bg-primary",
              )}
              style={{ width: `${(ownedCount / MAX_TEAMS) * 100}%` }}
            />
          </div>
          {atLimit && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-red-500">
              <Lock className="h-3 w-3" />
              {t("limitReachedDesc")}
            </p>
          )}
        </div>

        {/* Team list */}
        {teamList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary/20 to-primary/5">
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
            {teamList.map((team: any) => {
              const roleCfg = roleConfig[team.role as keyof typeof roleConfig] ?? roleConfig.member;
              return (
                <div
                  key={team._id}
                  onClick={() => router.push(`/teams/${team._id}`)}
                  className="group flex items-center gap-4 rounded-xl border bg-card p-4 cursor-pointer hover:border-primary/20 hover:shadow-sm transition-all"
                >
                  {/* Icon */}
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white shrink-0 shadow-sm"
                    style={{
                      background: team.iconGradientTo
                        ? `linear-gradient(135deg, ${team.iconColor ?? "#f76c5e"}, ${team.iconGradientTo})`
                        : `linear-gradient(135deg, ${team.iconColor ?? "#f76c5e"}cc, ${team.iconColor ?? "#f76c5e"})`,
                    }}
                  >
                    {team.icon ?? team.name[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                        {team.name}
                      </h3>
                      <span className="text-[11px] text-muted-foreground/60 font-mono">/{team.slug}</span>
                    </div>
                    {team.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{team.description}</p>
                    )}
                  </div>

                  {/* Role badge */}
                  <Badge variant="secondary" className={cn("h-6 text-[10px] gap-1 shrink-0 font-medium border-0", roleCfg.color)}>
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

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!o) resetForm(); setShowCreate(o); }}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-base font-semibold">{t("createTeam")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="px-6 pt-5 pb-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("teamName")}</label>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                  }}
                  placeholder="Acme Inc."
                  autoFocus
                  required
                  className="h-10 text-sm font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("slug")}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono select-none">/</span>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="acme-inc"
                    required
                    className="h-10 pl-7 font-mono text-sm"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground/60">{t("slugHint")}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("description")} <span className="normal-case opacity-60">({tc("optional")})</span>
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
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-muted/20">
              <Button type="button" variant="ghost" size="sm" onClick={() => { resetForm(); setShowCreate(false); }}>
                {tc("cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={isCreating || !name.trim() || !slug.trim()}>
                {isCreating ? t("creating") : t("createTeam")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
