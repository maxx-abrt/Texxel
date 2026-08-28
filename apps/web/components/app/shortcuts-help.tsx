"use client";

// Keyboard shortcuts help. Opens with "?" anywhere in the app (except while
// typing) so newcomers discover navigation and power features.
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTranslations } from "next-intl";
import { Keyboard } from "lucide-react";

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || !!t.isContentEditable;
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground shadow-sm">
      {children}
    </kbd>
  );
}

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("shortcuts");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !isTyping(e.target)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const rows: { label: string; keys: React.ReactNode }[] = [
    { label: t("search"), keys: <><Key>⌘</Key> <Key>K</Key></> },
    { label: t("closePanel"), keys: <Key>Esc</Key> },
    { label: t("help"), keys: <Key>?</Key> },
    { label: t("slashMenu"), keys: <Key>/</Key> },
    { label: t("mention"), keys: <Key>@</Key> },
    { label: t("closeTab"), keys: <><Key>⌘</Key> <Key>W</Key></> },
    { label: t("jumpTab"), keys: <><Key>⌘</Key> <Key>1</Key>–<Key>9</Key></> },
    { label: t("openTab"), keys: <><Key>⌘</Key> <Key>Click</Key></> },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm" data-testid="shortcuts-help" aria-describedby={undefined}>
        <DialogTitle className="flex items-center gap-2 text-base">
          <Keyboard size={18} className="text-primary" /> {t("title")}
        </DialogTitle>
        <ul className="mt-1 space-y-2.5">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="flex items-center gap-1">{r.keys}</span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
