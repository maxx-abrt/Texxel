"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth/client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Check, ChevronsLeftRight, LogOut, Plus, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useExtensions } from "@/hooks/useExtensions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

export const UserItem = () => {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const t = useTranslations("userItem");
  const tw = useTranslations("workspace");
  const user = session?.user;

  const workspaces = useQuery(api.workspaces.getMyWorkspaces);
  const createWorkspace = useMutation(api.workspaces.create);
  const { activeWorkspaceId, setActiveWorkspaceId } = useWorkspace();
  const { setWorkspaceId } = useExtensions();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const activeWs = (workspaces ?? []).find((w: any) => w?._id === activeWorkspaceId);
  const activeLabel = activeWs?.name ?? tw("personal");

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
  };

  const handleSwitchWorkspace = (wsId: string) => {
    setActiveWorkspaceId(wsId);
    setWorkspaceId(wsId);
    router.push("/documents");
  };

  const handleCreateWorkspace = async () => {
    if (!newName.trim()) return;
    if ((workspaces ?? []).length >= 5) {
      toast.error(tw("maxReached"));
      return;
    }
    try {
      const id = await createWorkspace({ name: newName.trim() });
      toast.success(tw("created"));
      setNewName("");
      setShowCreate(false);
      handleSwitchWorkspace(id);
    } catch {
      toast.error(tw("createFailed"));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <div
          role="button"
          className="group flex w-full items-center px-3.5 py-3 text-sm transition-all duration-200 ease-out hover:bg-foreground/[0.03]"
        >
          <div className="flex max-w-[180px] items-center gap-x-2.5">
            <Avatar className="h-[22px] w-[22px] ring-1 ring-border/30 transition-shadow duration-200 group-hover:ring-border/50">
              <AvatarImage src={user?.image ?? undefined} />
              <AvatarFallback className="text-[10px] font-semibold bg-foreground/[0.06] text-foreground/60">{user?.name?.[0]?.toUpperCase() ?? "U"}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start min-w-0">
              <span className="line-clamp-1 text-start font-medium text-[13px] leading-tight text-foreground/90 transition-colors duration-200 group-hover:text-foreground">
                {user?.name ?? "Texxel"}
              </span>
              <span className="text-[10px] text-muted-foreground/50 leading-tight truncate transition-colors duration-200 group-hover:text-muted-foreground/70">
                {activeLabel}
              </span>
            </div>
          </div>
          <ChevronsLeftRight className="text-muted-foreground/30 ml-2 h-3.5 w-3.5 rotate-90 transition-colors duration-200 group-hover:text-muted-foreground/60" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-80 rounded-xl border-border/50 shadow-lg shadow-black/5"
        align="start"
        alignOffset={11}
        forceMount
      >
        <div className="flex flex-col space-y-3 p-3">
          <p className="text-muted-foreground/60 text-[11px] leading-none font-medium">
            {user?.email}
          </p>
          <div className="flex items-center gap-x-2.5">
            <div className="bg-foreground/[0.04] rounded-lg p-1">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.image ?? undefined} />
                <AvatarFallback className="text-xs font-semibold bg-foreground/[0.06] text-foreground/60">{user?.name?.[0]?.toUpperCase() ?? "U"}</AvatarFallback>
              </Avatar>
            </div>
            <div className="space-y-0.5">
              <p className="line-clamp-1 text-[13px] font-semibold text-foreground/90">
                {user?.name ?? "Texxel"}
              </p>
              <p className="text-[11px] text-muted-foreground/60">{activeLabel}</p>
            </div>
          </div>
        </div>

        {/* Workspace switcher */}
        {(workspaces ?? []).length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/40 mb-1.5">
                {tw("title")}
              </p>
              <div className="space-y-0.5">
                {(workspaces ?? []).filter(Boolean).map((ws: any) => (
                  <button
                    key={ws._id}
                    onClick={() => handleSwitchWorkspace(ws._id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-all duration-200 ease-out",
                      ws._id === activeWorkspaceId
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground/80 hover:bg-foreground/[0.04] hover:text-foreground",
                    )}
                  >
                    <div
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
                      style={{ backgroundColor: ws.color ?? "#6366f1" }}
                    >
                      {ws.icon ?? ws.name[0]?.toUpperCase()}
                    </div>
                    <span className="flex-1 text-left truncate text-xs font-medium">
                      {ws.name}
                      {ws.isPersonal && <span className="text-muted-foreground/50 ml-1">({tw("personal")})</span>}
                    </span>
                    {ws._id === activeWorkspaceId && (
                      <Check className="h-3 w-3 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              {/* Create workspace */}
              {showCreate ? (
                <div className="mt-2 flex items-center gap-1.5">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateWorkspace();
                      if (e.key === "Escape") { setShowCreate(false); setNewName(""); }
                    }}
                    placeholder={tw("namePlaceholder")}
                    className="h-7 text-xs"
                    autoFocus
                  />
                  <button
                    onClick={handleCreateWorkspace}
                    disabled={!newName.trim()}
                    className="shrink-0 rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-1.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground transition-all duration-200 ease-out"
                >
                  <Plus className="h-3 w-3" />
                  {tw("create")}
                  <span className="ml-auto text-[10px] text-muted-foreground/40">
                    {(workspaces ?? []).length}/5
                  </span>
                </button>
              )}
            </div>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          asChild
          className="text-muted-foreground/80 w-full cursor-pointer rounded-lg text-[13px]"
        >
          <button onClick={() => router.push("/account/settings")}>
            <Settings className="text-muted-foreground/60 size-3.5" />
            {t("manageAccount")}
          </button>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="group w-full cursor-pointer rounded-lg text-[13px]">
          <button onClick={handleSignOut}>
            <LogOut className="text-muted-foreground/60 size-3.5" />
            <span className="text-muted-foreground/80 transition-colors duration-200 group-hover:text-foreground">
              {t("logOut")}
            </span>
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
