"use client";

import * as React from "react";
import { useWorkspace, useEntitlement, type QuotaDomain } from "@a2e/core";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { btnPrimary, btnOutline } from "@/components/app/common";
import { Crown, CloseCircle } from "iconsax-reactjs";

const DOMAIN_LABELS: Record<QuotaDomain, string> = {
  storageBytes: "Storage",
  maxMembers: "Members",
  maxTasks: "Tasks",
  maxDriveFiles: "Drive files",
  maxEvents: "Events",
  maxContacts: "Contacts",
  maxFileUploadBytes: "File upload size",
  maxCustomRoles: "Custom roles",
  maxFormsResponsesPerMonth: "Form responses / month",
};

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
  const planKey = entitlement?.planKey ?? "free";
  const domain = state.domain;
  const used = state.used ?? 0;
  const limit = state.limit ?? 0;
  const unlimited = limit === -1;

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-(--flux-coral-soft) text-primary">
            <Crown variant="Bulk" size={26} />
          </div>
          <DialogTitle className="text-xl">Upgrade your plan</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm text-muted-foreground">
          {domain && (
            <p>
              You&apos;ve reached the <strong className="text-foreground">{DOMAIN_LABELS[domain]}</strong> limit
              {!unlimited && (
                <> ({used.toLocaleString()} / {limit.toLocaleString()})</>
              )} on the <strong className="text-foreground capitalize">{planKey}</strong> plan.
            </p>
          )}
          <p>Upgrade to a higher plan to unlock more capacity and premium features.</p>
        </div>

        <DialogFooter className="gap-2">
          <button className={btnOutline} onClick={() => onOpenChange(false)}>
            <CloseCircle variant="Bulk" size={16} /> Not now
          </button>
          <a
            className={btnPrimary}
            href="/app/settings"
            onClick={() => onOpenChange(false)}
          >
            <Crown variant="Bulk" size={16} /> View plans
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
