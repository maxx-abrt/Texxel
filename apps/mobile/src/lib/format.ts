/** Small, dependency-free formatting helpers.
 *
 * Locale + copy are injected by the i18n provider through `configureFormat`,
 * so every date string follows the language the user picked in Settings. */

const DAY_MS = 86_400_000;

let LOCALE = "fr-FR";
let T: (key: string) => string = (key) => key;

/** Called by `<I18nProvider>` whenever the active language changes. */
export function configureFormat(locale: string, translate: (key: string) => string): void {
  LOCALE = locale;
  T = translate;
}

export function startOfDay(input: number | Date): number {
  const d = new Date(input);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" });
}

export function weekdayShort(ts: number): string {
  return new Date(ts).toLocaleDateString(LOCALE, { weekday: "short" });
}

/** "9 AM" / "09" — the hour ruler in the day timeline. */
export function hourLabel(hour: number): string {
  return new Date(0, 0, 0, hour).toLocaleTimeString(LOCALE, { hour: "numeric" });
}

export function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString(LOCALE, { weekday: "short", day: "numeric", month: "short" });
}

export function formatLongDate(ts: number): string {
  return new Date(ts).toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" });
}

/** "Today", "Tomorrow", "Yesterday", "Mon 12" — the label used on task cards. */
export function relativeDay(ts?: number | null): string {
  if (!ts) return T("common.noDate");
  const today = startOfDay(Date.now());
  const target = startOfDay(ts);
  const diff = Math.round((target - today) / DAY_MS);
  if (diff === 0) return T("common.today");
  if (diff === 1) return T("common.tomorrow");
  if (diff === -1) return T("common.yesterday");
  if (diff > 1 && diff < 7) return new Date(ts).toLocaleDateString(LOCALE, { weekday: "long" });
  return new Date(ts).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
}

/** "2m", "4h", "Yesterday", "12 Mar" — used for edited-at / notification stamps. */
export function timeAgo(ts?: number | null): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  if (diff < 60_000) return T("common.now");
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < DAY_MS) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 2 * DAY_MS) return T("common.yesterday");
  if (diff < 7 * DAY_MS) return `${Math.floor(diff / DAY_MS)}d`;
  return new Date(ts).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return T("greeting.morning");
  if (h < 18) return T("greeting.afternoon");
  return T("greeting.evening");
}
