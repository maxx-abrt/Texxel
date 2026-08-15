"use client";

import * as React from "react";
import { useWorkspace, useEntitlement, type QuotaDomain } from "@a2e/core";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { btnPrimary, btnOutline } from "@/components/app/common";
import { Crown, CloseCircle } from "iconsax-reactjs";

export interface UpgradeDialogState {
  open: boolean;
  domain?: QuotaDomain;
  used?: number;
  limit?: number;
}

interface UpgradeDialogProps {
  state: UpgradeDialogState;
  onOpenChange: (open: boolean) => void;
}

/**
 * Upgrade prompt shown when a quota pre-check fails or when a
 * QuotaExceededError is caught. Displays the current plan, the exhausted
 * limit, and an upgrade CTA.
 */
export function UpgradeDialog({ state, onOpenChange }: UpgradeDialogProps) {
  const { activeWorkspaceId } = useWorkspace();
  const entitlement = useEntitlement(activeWorkspaceId);
  const t = useTranslations("upgrade");
  const planKey = entitlement?.planKey ?? "free";
  const domain = state.domain;
  const used = state.used ?? 0;
  const limit = state.limit ?? 0;
  const unlimited = limit === -1;
  const domainLabel = domain ? t(`domain.${domain}` as any) : "";

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-(--flux-coral-soft) text-primary">
            <Crown variant="Bulk" size={26} />
          </div>
          <DialogTitle className="text-xl">{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm text-muted-foreground">
          {domain && (
            <p>
              {unlimited
                ? t("limitReachedUnlimited", { domain: domainLabel, plan: planKey })
                : t("limitReached", { domain: domainLabel, used: used.toLocaleString(), limit: limit.toLocaleString(), plan: planKey })}
            </p>
          )}
          <p>{t("upgradeDesc")}</p>
        </div>

        <DialogFooter className="gap-2">
          <button className={btnOutline} onClick={() => onOpenChange(false)}>
            <CloseCircle variant="Bulk" size={16} /> {t("notNow")}
          </button>
          <a
            className={btnPrimary}
            href="/app/settings"
            onClick={() => onOpenChange(false)}
          >
            <Crown variant="Bulk" size={16} /> {t("viewPlans")}
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
