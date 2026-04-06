"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useParams, useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ChevronRight,
  ChevronsUp,
  LucideIcon,
  MoreHorizontal,
  Plus,
  Trash,
} from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { ActionTooltip } from "@/components/action-tooltip";
import { useTranslations } from "next-intl";

interface ItemProps {
  id?: Id<"documents">;
  documentIcon?: string;
  active?: boolean;
  expanded?: boolean;
  isSearch?: boolean;
  level?: number;
  onExpand?: () => void;
  label: string;
  onClick?: () => void;
  icon: LucideIcon;
  isNested?: boolean;
}

export const Item = ({
  id,
  label,
  onClick,
  icon: Icon,
  active,
  documentIcon,
  isSearch,
  level = 0,
  onExpand,
  expanded,
  isNested = false,
}: ItemProps) => {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const router = useRouter();
  const params = useParams();
  const t = useTranslations("nav");
  const create = useMutation(api.documents.create);
  const archive = useMutation(api.documents.archive);
  const setParent = useMutation(api.documents.setParent);

  const onArchive = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    event.stopPropagation();
    if (!id) return;
    const promise = archive({ id }).then(() => {
      if (params.documentId === id) {
        router.push("/documents");
      }
    });

    toast.promise(promise, {
      loading: t("movingToTrash"),
      success: t("movedToTrash"),
      error: t("archiveFailed"),
    });
  };

  const handleExpand = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    event.stopPropagation();
    onExpand?.();
  };

  const onCreate = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    event.stopPropagation();
    if (!id) return;

    const promise = create({ title: "Untitled", parentDocument: id }).then(
      (documentId) => {
        if (!expanded) {
          onExpand?.();
        }
        router.push(`/documents/${documentId}`);
      },
    );

    toast.promise(promise, {
      loading: t("creatingNote"),
      success: t("noteCreated"),
      error: t("createNoteFailed"),
    });
  };

  const ChevronIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <div
      onClick={onClick}
      role="button"
      style={{ paddingLeft: level ? `${level * 12 + 12}px` : "12px" }}
      className={cn(
        "group relative flex min-h-[30px] w-full items-center rounded-lg py-1 pr-3 text-[13px] font-medium",
        "text-muted-foreground/80 transition-all duration-200 ease-out",
        "hover:bg-foreground/[0.04] hover:text-foreground",
        active && "bg-foreground/[0.06] text-foreground",
      )}
    >
      {/* Active indicator bar */}
      {active && (
        <div className="absolute left-0.5 top-1/2 -translate-y-1/2 h-3.5 w-[3px] rounded-full bg-primary/70 transition-all duration-300" />
      )}

      {!!id && (
        <div
          role="button"
          className="mr-1 flex h-4 w-4 items-center justify-center rounded-[4px] transition-colors duration-200 hover:bg-foreground/10"
          onClick={handleExpand}
        >
          <ChevronIcon className={cn(
            "h-3 w-3 shrink-0 transition-all duration-200",
            active ? "text-foreground/50" : "text-muted-foreground/40",
          )} />
        </div>
      )}
      {documentIcon ? (
        <div className="mr-1.5 shrink-0 text-[1rem] leading-none">
          {documentIcon}
        </div>
      ) : (
        <Icon className={cn(
          "mr-2 h-[16px] w-[16px] shrink-0 transition-colors duration-200",
          active ? "text-foreground/70" : "text-muted-foreground/60",
        )} />
      )}

      <span className="truncate">{label}</span>
      {isSearch && (
        <kbd className="bg-muted/40 text-muted-foreground/50 pointer-events-none ml-auto inline-flex h-5 items-center gap-1 rounded-md border border-border/30 px-1.5 font-mono text-[.6rem] font-medium select-none">
          <span className="text-[10px]">CTRL</span>K
        </kbd>
      )}
      {!!id && (
        <div className="ml-auto flex items-center gap-x-1">
          <DropdownMenu>
            <DropdownMenuTrigger onClick={(e) => e.stopPropagation()} asChild>
              <div
                role="button"
                className="flex h-5 w-5 items-center justify-center rounded-md opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-foreground/10"
              >
                <MoreHorizontal className="text-muted-foreground/70 h-3.5 w-3.5" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 rounded-xl border-border/50 shadow-lg shadow-black/5"
              align="start"
              side="right"
              forceMount
            >
              <DropdownMenuItem onClick={onArchive} className="rounded-lg text-[13px]">
                <Trash className="mr-2 h-3.5 w-3.5" />
                {t("deleteItem")}
              </DropdownMenuItem>
              {isNested && (
                <DropdownMenuItem
                  className="rounded-lg text-[13px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!id) return;
                    toast.promise(
                      setParent({ id, parentDocument: undefined }),
                      { loading: t("moving"), success: t("movedToRoot"), error: t("moveFailed") },
                    );
                  }}
                >
                  <ChevronsUp className="mr-2 h-3.5 w-3.5" />
                  {t("moveToRoot")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-border/30" />
              <div className="text-muted-foreground/60 px-2 py-1.5 text-[11px]">
                {t("lastEditedBy", { name: user?.name ?? "" })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <ActionTooltip label={t("addSubPage")}>
            <div
              role="button"
              onClick={onCreate}
              className="flex h-5 w-5 items-center justify-center rounded-md opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-foreground/10"
            >
              <Plus className="text-muted-foreground/70 h-3.5 w-3.5" />
            </div>
          </ActionTooltip>
        </div>
      )}
    </div>
  );
};

Item.Skeleton = function ItemSkeleton({ level }: { level?: number }) {
  return (
    <div
      style={{ paddingLeft: level ? `${level * 12 + 25}px` : "12px" }}
      className="flex gap-x-2 py-0.75"
    >
      <Skeleton className="h-4 w-4" />
      <Skeleton className="h-4 w-[30%]" />
    </div>
  );
};
