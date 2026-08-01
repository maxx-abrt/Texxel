import type { EventDoc, EventOccurrence } from "./types"

const DAY_MS = 86_400_000
const MAX_OCCURRENCES = 1000

function sameDayOfMonth(base: Date, monthOffset: number): Date {
  const d = new Date(base.getTime())
  d.setMonth(d.getMonth() + monthOffset)
  return d
}

/** Nth (1-4) or last weekday of the month containing `base`, shifted by `monthOffset`. */
function positionalMonthDay(base: Date, monthOffset: number, position: string): Date {
  const target = new Date(base.getTime())
  target.setDate(1)
  target.setMonth(target.getMonth() + monthOffset)
  const weekday = base.getDay()

  if (position === "last") {
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0)
    while (last.getDay() !== weekday) last.setDate(last.getDate() - 1)
    last.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), base.getMilliseconds())
    return last
  }

  const nth = { first: 1, second: 2, third: 3, fourth: 4 }[position] ?? 1
  const first = new Date(target.getTime())
  while (first.getDay() !== weekday) first.setDate(first.getDate() + 1)
  first.setDate(first.getDate() + (nth - 1) * 7)
  first.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), base.getMilliseconds())
  return first
}

function occurrence(event: EventDoc, start: number, isInstance: boolean): EventOccurrence {
  const duration = event.end != null ? event.end - event.start : undefined
  return {
    ...event,
    occurrenceStart: start,
    occurrenceEnd: duration != null ? start + duration : undefined,
    isRecurringInstance: isInstance,
  }
}

/**
 * Expands recurring events into concrete occurrences overlapping [rangeStart, rangeEnd].
 * Pure & client-side by design — the core stores only the rule.
 */
export function expandEvents(
  events: EventDoc[] | undefined,
  rangeStart: number,
  rangeEnd: number,
): EventOccurrence[] {
  if (!events) return []
  const out: EventOccurrence[] = []

  for (const event of events) {
    const freq = event.recurrenceFreq ?? "none"
    const duration = event.end != null ? Math.max(0, event.end - event.start) : 0

    if (freq === "none") {
      if (event.start <= rangeEnd && event.start + duration >= rangeStart) out.push(occurrence(event, event.start, false))
      continue
    }

    const interval = Math.max(1, event.recurrenceInterval ?? 1)
    const until = event.recurrenceUntil ?? rangeEnd
    const exceptions = new Set(event.recurrenceExceptions ?? [])
    const maxCount = event.recurrenceEndAfter ?? MAX_OCCURRENCES
    const base = new Date(event.start)
    let emitted = 0

    const push = (start: number): boolean => {
      if (start > until || emitted >= maxCount || out.length >= MAX_OCCURRENCES) return false
      emitted += 1
      if (!exceptions.has(start) && start <= rangeEnd && start + duration >= rangeStart) {
        out.push(occurrence(event, start, start !== event.start))
      }
      return true
    }

    if (freq === "daily") {
      for (let step = 0; ; step += 1) {
        const start = event.start + step * interval * DAY_MS
        if (!push(start)) break
      }
      continue
    }

    if (freq === "weekly") {
      const days = event.recurrenceDaysOfWeek?.length ? [...event.recurrenceDaysOfWeek].sort() : [base.getDay()]
      // Start from the Sunday of the first week, then walk `interval` weeks at a time.
      const weekStart = new Date(base.getTime())
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      for (let week = 0; ; week += 1) {
        const weekBase = weekStart.getTime() + week * interval * 7 * DAY_MS
        if (weekBase > until && weekBase > rangeEnd) break
        let stop = false
        for (const day of days) {
          const candidate = new Date(weekBase + day * DAY_MS)
          candidate.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), base.getMilliseconds())
          const start = candidate.getTime()
          if (start < event.start) continue
          if (!push(start)) {
            stop = true
            break
          }
        }
        if (stop) break
      }
      continue
    }

    // monthly
    const position = event.recurrenceMonthlyPosition ?? "same_day"
    for (let month = 0; ; month += interval) {
      const date = position === "same_day" ? sameDayOfMonth(base, month) : positionalMonthDay(base, month, position)
      const start = date.getTime()
      if (start < event.start) continue
      if (!push(start)) break
    }
  }

  return out.sort((x, y) => x.occurrenceStart - y.occurrenceStart)
}
