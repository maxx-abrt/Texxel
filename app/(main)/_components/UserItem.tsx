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
          className="hover:bg-primary/5 flex w-full items-center p-3 text-sm"
        >
          <div className="flex max-w-39 items-center gap-x-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={user?.image ?? undefined} />
              <AvatarFallback>{user?.name?.[0]?.toUpperCase() ?? "U"}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start min-w-0">
              <span className="line-clamp-1 text-start font-medium text-sm leading-tight">
                {user?.name ?? "Texxel"}
              </span>
              <span className="text-[10px] text-muted-foreground leading-tight truncate">
                {activeLabel}
              </span>
            </div>
          </div>
          <ChevronsLeftRight className="text-muted-foreground ml-2 h-4 w-4 rotate-90" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-80"
        align="start"
        alignOffset={11}
        forceMount
      >
        <div className="flex flex-col space-y-3 p-2">
          <p className="text-muted-foreground text-xs leading-none font-medium">
            {user?.email}
          </p>
          <div className="flex items-center gap-x-2">
            <div className="bg-secondary rounded-md p-1">
              <Avatar>
                <AvatarImage src={user?.image ?? undefined} />
                <AvatarFallback>{user?.name?.[0]?.toUpperCase() ?? "U"}</AvatarFallback>
              </Avatar>
            </div>
            <div className="space-y-0.5">
              <p className="line-clamp-1 text-sm font-medium">
                {user?.name ?? "Texxel"}
              </p>
              <p className="text-[11px] text-muted-foreground">{activeLabel}</p>
            </div>
          </div>
        </div>

        {/* Workspace switcher */}
        {(workspaces ?? []).length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1.5">
                {tw("title")}
              </p>
              <div className="space-y-0.5">
                {(workspaces ?? []).filter(Boolean).map((ws: any) => (
                  <button
                    key={ws._id}
                    onClick={() => handleSwitchWorkspace(ws._id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                      ws._id === activeWorkspaceId
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
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
                  className="mt-1.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
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
          className="text-muted-foreground w-full cursor-pointer"
        >
          <button onClick={() => router.push("/account/settings")}>
            <Settings className="text-muted-foreground size-4" />
            {t("manageAccount")}
          </button>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="group w-full cursor-pointer">
          <button onClick={handleSignOut}>
            <LogOut className="text-muted-foreground size-4" />
            <span className="text-muted-foreground transition-colors group-hover:text-black! hover:text-black">
              {t("logOut")}
            </span>
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
