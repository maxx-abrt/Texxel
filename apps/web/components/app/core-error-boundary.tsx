"use client";

import * as React from "react";
import { disableCoreModules, resetCoreModules } from "@/lib/core-flags";
import { btnOutline } from "@/components/app/common";
import { CloseCircle, Refresh2 } from "iconsax-reactjs";

/**
 * Last line of defence around the shared-data layer.
 *
 * Convex `useQuery` throws during render when the server rejects a call, so a
 * single failing A2E Core query (expired token, workspace not linked yet, core
 * deploy in flight…) used to replace the whole page with Next's "This page
 * couldn't load". Here we catch it, switch core OFF for this tab
 * (`disableCoreModules`) and re-render the subtree: every view falls back to its
 * local Convex data and the user only sees a discreet banner.
 */
type State = { error: Error | null; degraded: boolean };

export class CoreErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null, degraded: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Degrade to local data for the rest of the session, then retry the render.
    disableCoreModules("all");
    console.warn("[a2e-core] shared backend call failed — falling back to local data", error);
    this.setState({ error: null, degraded: true });
  }

  private retry = () => {
    resetCoreModules();
    this.setState({ error: null, degraded: false });
  };

  render() {
    return (
      <>
        {this.state.degraded && <DegradedBanner onRetry={this.retry} />}
        {this.props.children}
      </>
    );
  }
}

function DegradedBanner({ onRetry }: { onRetry: () => void }) {
  const [hidden, setHidden] = React.useState(false);
  if (hidden) return null;
  return (
    <div
      className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100"
      data-testid="core-degraded-banner"
      role="status"
    >
      <span className="flex-1">
        Espace partagé A2E indisponible — affichage des données locales de cet espace de travail.
      </span>
      <button onClick={onRetry} className={btnOutline} data-testid="core-degraded-retry">
        <Refresh2 variant="Bulk" size={14} /> Réessayer
      </button>
      <button
        onClick={() => setHidden(true)}
        className="text-amber-900/60 hover:text-amber-900 dark:text-amber-100/60 dark:hover:text-amber-100"
        aria-label="Fermer"
        data-testid="core-degraded-dismiss"
      >
        <CloseCircle variant="Bulk" size={16} />
      </button>
    </div>
  );
}
