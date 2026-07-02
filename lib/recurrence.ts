import {
  addDays,
  addMonths,
  getDay,
  getDate,
  getYear,
  getMonth,
  startOfDay,
  startOfWeek,
} from "date-fns";

export type RecurrenceFreq = "none" | "daily" | "weekly" | "monthly";

export type RecurrenceConfig = {
  freq: RecurrenceFreq;
  interval: number;
  daysOfWeek?: number[];
  monthlyPosition?: "same_day" | "first" | "second" | "third" | "fourth" | "last";
  endAfter?: number;
  until?: number;
  exceptions?: number[];
};

const DAY_MS = 86_400_000;

function toConfig(event: any): RecurrenceConfig {
  const legacy: string | undefined = event.recurrence;
  let freq: RecurrenceFreq = "none";
  let interval = 1;
  if (event.recurrenceFreq) {
    freq = event.recurrenceFreq;
    interval = event.recurrenceInterval ?? 1;
  } else if (legacy && legacy !== "none") {
    if (legacy === "daily") freq = "daily";
    else if (legacy === "weekly") freq = "weekly";
    else if (legacy === "biweekly") {
      freq = "weekly";
      interval = 2;
    } else if (legacy === "monthly") freq = "monthly";
  }
  return {
    freq,
    interval,
    daysOfWeek: event.recurrenceDaysOfWeek,
    monthlyPosition: event.recurrenceMonthlyPosition,
    endAfter: event.recurrenceEndAfter,
    until: event.recurrenceUntil,
    exceptions: event.recurrenceExceptions,
  };
}

function isException(t: number, exceptions: number[] | undefined): boolean {
  return (exceptions ?? []).some((x) => Math.abs(x - t) < DAY_MS / 2);
}

function getNthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  position: "first" | "second" | "third" | "fourth" | "last",
): Date | null {
  const firstDay = new Date(year, month, 1);
  const firstWeekday = getDay(firstDay);
  const firstOffset = (weekday - firstWeekday + 7) % 7;
  let date = 1 + firstOffset;
  if (position === "last") {
    const lastDay = new Date(year, month + 1, 0);
    const lastWeekday = getDay(lastDay);
    const lastOffset = (lastWeekday - weekday + 7) % 7;
    date = getDate(lastDay) - lastOffset;
  } else {
    const n = { first: 0, second: 1, third: 2, fourth: 3 }[position];
    date += 7 * n;
  }
  const candidate = new Date(year, month, date);
  if (getMonth(candidate) !== month) return null;
  return startOfDay(candidate);
}

function weeklyDays(config: RecurrenceConfig, startDate: Date): number[] {
  const days = config.daysOfWeek?.length
    ? Array.from(new Set(config.daysOfWeek)).sort((a, b) => a - b)
    : [getDay(startDate)];
  return days;
}

function nextWeeklyOccurrences(
  event: any,
  config: RecurrenceConfig,
  rangeStart: number,
  rangeEnd: number,
): any[] {
  const startTime = event.start;
  const startDate = new Date(startTime);
  const startDayOfWeek = getDay(startDate);
  const anchor = startOfWeek(startDate, { weekStartsOn: 1 }); // Monday anchor
  const days = weeklyDays(config, startDate);
  const dur = (event.end ?? event.start) - event.start;
  const out: any[] = [];
  let occurrenceCount = 0;
  let weekOffset = 0;
  const maxWeeks = 5000;
  const exceptions = config.exceptions;
  const interval = Math.max(1, config.interval ?? 1);

  while (weekOffset < maxWeeks) {
    const weekAnchor = addDays(anchor, weekOffset * 7 * interval);
    for (const day of days) {
      const diff = (day - getDay(weekAnchor) + 7) % 7;
      const occ = addDays(weekAnchor, diff);
      const occTime = occ.getTime();
      if (occTime < startTime) continue;
      if (occTime >= rangeEnd) return out;
      if (config.until !== undefined && occTime > config.until) return out;
      if (isException(occTime, exceptions)) continue;
      occurrenceCount++;
      if (occTime + dur >= rangeStart) {
        out.push({
          ...event,
          start: occTime,
          end: occTime + dur,
          _occId: `${event._id}_${occTime}`,
          _recurring: true,
          _occurrenceStart: occTime,
        });
      }
      if (config.endAfter !== undefined && occurrenceCount >= config.endAfter) {
        return out;
      }
    }
    weekOffset++;
  }
  return out;
}

function nextMonthlyOccurrences(
  event: any,
  config: RecurrenceConfig,
  rangeStart: number,
  rangeEnd: number,
): any[] {
  const startTime = event.start;
  const startDate = new Date(startTime);
  const dur = (event.end ?? event.start) - event.start;
  const interval = Math.max(1, config.interval ?? 1);
  const position = config.monthlyPosition ?? "same_day";
  const out: any[] = [];
  let occurrenceCount = 0;
  let monthOffset = 0;
  const maxMonths = 1200;
  const exceptions = config.exceptions;
  const startDay = getDay(startDate);

  while (monthOffset < maxMonths) {
    const monthBase = addMonths(startDate, monthOffset * interval);
    const year = getYear(monthBase);
    const month = getMonth(monthBase);
    let occ: Date;
    if (position === "same_day") {
      occ = startOfDay(new Date(year, month, getDate(startDate)));
    } else {
      const candidate = getNthWeekdayOfMonth(year, month, startDay, position);
      if (!candidate) {
        monthOffset++;
        continue;
      }
      occ = candidate;
    }
    const occTime = occ.getTime() + (startTime - startOfDay(startDate).getTime());
    if (occTime < startTime) {
      monthOffset++;
      continue;
    }
    if (occTime >= rangeEnd) return out;
    if (config.until !== undefined && occTime > config.until) return out;
    if (isException(occTime, exceptions)) {
      monthOffset++;
      continue;
    }
    occurrenceCount++;
    if (occTime + dur >= rangeStart) {
      out.push({
        ...event,
        start: occTime,
        end: occTime + dur,
        _occId: `${event._id}_${occTime}`,
        _recurring: true,
        _occurrenceStart: occTime,
      });
    }
    if (config.endAfter !== undefined && occurrenceCount >= config.endAfter) {
      return out;
    }
    monthOffset++;
  }
  return out;
}

function nextDailyOccurrences(
  event: any,
  config: RecurrenceConfig,
  rangeStart: number,
  rangeEnd: number,
): any[] {
  const startTime = event.start;
  const dur = (event.end ?? event.start) - event.start;
  const interval = Math.max(1, config.interval ?? 1);
  const out: any[] = [];
  let occurrenceCount = 0;
  let i = 0;
  const maxDays = 2000;
  const exceptions = config.exceptions;

  while (i < maxDays) {
    const occTime = startTime + i * interval * DAY_MS;
    if (occTime >= rangeEnd) return out;
    if (config.until !== undefined && occTime > config.until) return out;
    if (!isException(occTime, exceptions)) {
      occurrenceCount++;
      if (occTime + dur >= rangeStart) {
        out.push({
          ...event,
          start: occTime,
          end: occTime + dur,
          _occId: `${event._id}_${occTime}`,
          _recurring: true,
          _occurrenceStart: occTime,
        });
      }
      if (config.endAfter !== undefined && occurrenceCount >= config.endAfter) {
        return out;
      }
    }
    i++;
  }
  return out;
}

export function expandEvents(
  events: any[],
  rangeStart: number,
  rangeEnd: number,
): any[] {
  const out: any[] = [];
  for (const e of events) {
    const config = toConfig(e);
    const dur = (e.end ?? e.start) - e.start;
    if (config.freq === "none") {
      if (e.start < rangeEnd && e.start + dur >= rangeStart) {
        out.push(e);
      }
      continue;
    }
    if (config.freq === "daily") {
      out.push(...nextDailyOccurrences(e, config, rangeStart, rangeEnd));
    } else if (config.freq === "weekly") {
      out.push(...nextWeeklyOccurrences(e, config, rangeStart, rangeEnd));
    } else if (config.freq === "monthly") {
      out.push(...nextMonthlyOccurrences(e, config, rangeStart, rangeEnd));
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

export function formatRecurrenceLabel(config: RecurrenceConfig, t: any): string {
  if (config.freq === "none") return t?.("recurrence.none") ?? "Does not repeat";
  if (config.freq === "daily") return t?.("recurrence.daily") ?? "Daily";
  if (config.freq === "weekly") {
    if (config.daysOfWeek?.length) {
      return t?.("recurrence.weeklyOn", { days: config.daysOfWeek.join(", ") }) ?? "Weekly";
    }
    return t?.("recurrence.weekly") ?? "Weekly";
  }
  if (config.freq === "monthly") return t?.("recurrence.monthly") ?? "Monthly";
  return "";
}
