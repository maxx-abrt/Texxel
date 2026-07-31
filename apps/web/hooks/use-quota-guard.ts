"use client";

import * as React from "react";
import { useQuota, QuotaExceededError, type QuotaDomain, type QuotaState } from "@a2e/core";
import { useWorkspace } from "@a2e/core";
import type { UpgradeDialogState } from "@/components/app/upgrade-dialog";

/**
 * Quota pre-check guard. Wraps `useQuota` and exposes:
 *  - `quota`: the raw QuotaState for the domain
 *  - `guard()`: returns `true` if the action is allowed, `false` + opens the
 *    upgrade dialog if the limit is reached
 *  - `catchQuota()`: wraps a promise, catches QuotaExceededError and opens
 *    the dialog with the error's domain/used/limit
 *  - `dialogState` + `setDialogState`: for rendering <UpgradeDialog />
 */
export function useQuotaGuard(domain: QuotaDomain) {
  const { activeWorkspaceId } = useWorkspace();
  const quota = useQuota(activeWorkspaceId, domain);
  const [dialogState, setDialogState] = React.useState<UpgradeDialogState>({ open: false });

  const guard = React.useCallback((): boolean => {
    if (quota.upgradeRequired) {
      setDialogState({
        open: true,
        domain,
        used: quota.used,
        limit: quota.limit,
      });
      return false;
    }
    return true;
  }, [quota, domain]);

  const catchQuota = React.useCallback(
    async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await fn();
      } catch (err) {
        if (err instanceof QuotaExceededError) {
          setDialogState({
            open: true,
            domain: err.domain as QuotaDomain,
            used: err.used,
            limit: err.limit,
          });
          return undefined;
        }
        throw err;
      }
    },
    [],
  );

  return { quota, guard, catchQuota, dialogState, setDialogState };
}
