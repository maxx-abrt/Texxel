"use client";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { authClient } from "@/lib/auth/client";
import { Expand, Globe, MenuIcon, Minimize } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Title } from "./Title";
import { Banner } from "./Banner";
import { Menu } from "./Menu";
import { Button } from "@/components/ui/button";
import { useDocumentUI } from "@/hooks/useDocumentUI";
import { ShareDialog } from "@/components/modals/ShareDialog";

interface NavbarProps {
  isCollapsed: boolean;
  onResetWidth: () => void;
}

function PresenceAvatars({ documentId }: { documentId: Id<"documents"> }) {
  const { data: session } = authClient.useSession();
  const myId = (session?.user as any)?.id ?? "";
  const presence = useQuery(api.documents.getDocumentPresence, { documentId });

  const others = (presence ?? []).filter((p) => p.userId !== myId);
  if (others.length === 0) return null;

  const visible = others.slice(0, 4);
  const extra = others.length - visible.length;

  return (
    <div className="flex items-center -space-x-2 mr-1" title={others.map((p) => p.userName).join(", ")}>
      {visible.map((p) => (
        <div
          key={p.userId}
          className="relative h-7 w-7 rounded-full ring-2 ring-background flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden"
          style={{ backgroundColor: p.userColor }}
          title={p.userName}
        >
          {p.userImage ? (
            <img src={p.userImage} alt={p.userName} className="h-full w-full object-cover" />
          ) : (
            p.userName.charAt(0).toUpperCase()
          )}
        </div>
      ))}
      {extra > 0 && (
        <div className="h-7 w-7 rounded-full ring-2 ring-background bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">
          +{extra}
        </div>
      )}
    </div>
  );
}

export const Navbar = ({ isCollapsed, onResetWidth }: NavbarProps) => {
  const params = useParams();
  const t = useTranslations("editor");
  const { showShare, openShare, closeShare, focusMode, toggleFocusMode } = useDocumentUI();

  // Close share dialog when navigating between documents
  useEffect(() => {
    closeShare();
  }, [params.documentId, closeShare]);

  const document = useQuery(api.documents.getById, {
    documentId: params.documentId as Id<"documents">,
  });

  if (document === undefined) {
    return (
      <nav className="bg-background dark:bg-dark flex w-full items-center justify-between px-3 py-2">
        <Title.Skeleton />
        <div className="flex items-center gap-x-2">
          <Menu.Skeleton />
        </div>
      </nav>
    );
  }

  if (document === null) {
    return null;
  }

  return (
    <>
      <nav className="bg-background dark:bg-dark flex w-full items-center gap-x-2 px-3 py-2 border-b border-border/40">
        {isCollapsed && (
          <button aria-label="Menu">
            <MenuIcon
              onClick={onResetWidth}
              className="text-muted-foreground h-6 w-6"
            />
          </button>
        )}
        <div className="flex w-full items-center justify-between min-w-0">
          <Title initialData={document} />
          <div className="flex items-center gap-x-1 shrink-0">
            <PresenceAvatars documentId={document._id} />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-3 text-sm font-medium hover:bg-accent"
              onClick={openShare}
            >
              {document.isPublished && (
                <Globe className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              )}
              {t("publish")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={toggleFocusMode}
              title={focusMode ? "Exit focus mode" : "Focus mode"}
            >
              {focusMode ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Expand className="h-4 w-4" />
              )}
            </Button>
            <Menu documentId={document._id} />
          </div>
        </div>
      </nav>

      {document.isArchived && <Banner documentId={document._id} />}

      <ShareDialog
        open={showShare}
        onClose={closeShare}
        documentId={document._id}
        document={{
          title: document.title,
          isPublished: document.isPublished,
          collaborationMode: document.collaborationMode,
          sharedTeamId: document.sharedTeamId,
          allowedEditorEmails: document.allowedEditorEmails,
          shareToken: document.shareToken,
          guestCanEdit: document.guestCanEdit,
        }}
      />
    </>
  );
};
