"use client";

import { PomodoroTimer } from "@/components/pomodoro-timer";

/**
 * Focus Timer widget (§3). Reuses the existing `PomodoroTimer` component
 * verbatim — it is fully self-contained (settings persisted to localStorage,
 * `useTranslations("pomodoro")`). The dock/float/close controls live in the
 * widgets-bar panel header, so we pass no `onClose` here.
 */
export function PomodoroWidget() {
  return (
    <div data-testid="widget-pomodoro" className="min-h-0 flex-1">
      <PomodoroTimer />
    </div>
  );
}
