"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/hooks/useSettings";
import { ModeToggle } from "../mode-toggle";
import { useTranslations } from "next-intl";

export const SettingsModal = () => {
  const settings = useSettings();
  const t = useTranslations("settings");
  return (
    <Dialog open={settings.isOpen} onOpenChange={settings.onClose}>
      <DialogTitle hidden>{t("mySettings")}</DialogTitle>
      <DialogContent className="dark:bg-dark">
        <DialogHeader className="border-b pb-3">
          <h2 className="text-lg font-medium">{t("mySettings")}</h2>
        </DialogHeader>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-y-1">
            <Label>{t("appearance.title")}</Label>
            <span className="text-muted-foreground text-[0.8rem]">
              {t("appearance.subtitle")}
            </span>
          </div>
          <ModeToggle />
        </div>
      </DialogContent>
    </Dialog>
  );
};
