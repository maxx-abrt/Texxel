"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth/client";
import { ChevronsLeftRight, LogOut, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export const UserItem = () => {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const t = useTranslations("userItem");
  const user = session?.user;

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
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
            <span className="line-clamp-1 text-start font-medium">
              {user?.name ?? "Texxel"}
            </span>
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
        <div className="flex flex-col space-y-4 p-2">
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
            <div className="space-y-1">
              <p className="line-clamp-1 text-sm font-medium">
                {user?.name ?? "Texxel"}
              </p>
              <p className="text-[11px] text-muted-foreground">{t("workspace")}</p>
            </div>
          </div>
        </div>
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
