"use client";

import { ActivityFeed } from "@/components/app/activity-feed";

/**
 * Activity widget (§3). Reuses the self-contained `ActivityFeed` component
 * verbatim — it already subscribes to local + core activities, renders an
 * empty state, and uses `useTranslations("activity")`. We just give it a
 * tighter limit and a scroll container sized for the widget panel.
 */
export function ActivityWidget() {
  return (
    <div
      data-testid="widget-activity"
      className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
    >
      <ActivityFeed limit={25} />
    </div>
  );
}
