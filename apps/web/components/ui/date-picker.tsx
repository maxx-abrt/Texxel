"use client";

import * as React from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, getYear, getMonth, setYear, setMonth } from "date-fns";
import { fr as dateFnsFr, enUS as dateFnsEnUS } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  date?: Date;
  onChange: (date?: Date) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePicker({
  date,
  onChange,
  placeholder,
  disabled,
  className,
}: DatePickerProps) {
  const t = useTranslations("ui");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? dateFnsFr : dateFnsEnUS;
  const months = React.useMemo(
    () => Array.from({ length: 12 }, (_, i) => format(new Date(2024, i, 1), "MMM", { locale: dateLocale })),
    [dateLocale],
  );
  const weekdays = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => format(new Date(2024, 0, i), "EEEEEE", { locale: dateLocale })),
    [dateLocale],
  );
  const [open, setOpen] = React.useState(false);
  const [viewDate, setViewDate] = React.useState(date || new Date());

  React.useEffect(() => {
    if (date) setViewDate(date);
  }, [date]);

  const days = React.useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(viewDate)),
        end: endOfWeek(endOfMonth(viewDate)),
      }),
    [viewDate],
  );

  const year = getYear(viewDate);
  const month = getMonth(viewDate);
  const yearOptions = React.useMemo(() => {
    const current = getYear(new Date());
    return Array.from({ length: 21 }, (_, i) => current - 10 + i);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <span>{date ? format(date, "PPP", { locale: dateLocale }) : (placeholder ?? t("pickDate"))}</span>
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="w-64">
          {/* Header */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setViewDate((d) => setMonth(d, getMonth(d) - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={t("previousMonth")}
            >
              ‹
            </button>
            <div className="flex items-center gap-1.5">
              <select
                value={month}
                onChange={(e) => setViewDate((d) => setMonth(d, Number(e.target.value)))}
                className="h-7 rounded-md border border-input bg-background px-1.5 text-xs font-medium outline-none focus:ring-1 focus:ring-ring"
              >
                {months.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => setViewDate((d) => setYear(d, Number(e.target.value)))}
                className="h-7 rounded-md border border-input bg-background px-1.5 text-xs font-medium outline-none focus:ring-1 focus:ring-ring"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setViewDate((d) => setMonth(d, getMonth(d) + 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={t("nextMonth")}
            >
              ›
            </button>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 text-center">
            {weekdays.map((d) => (
              <div key={d} className="py-1 text-[10px] font-medium text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day) => {
              const inMonth = isSameMonth(day, viewDate);
              const selected = date && isSameDay(day, date);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => {
                    onChange(day);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors",
                    !inMonth && "text-muted-foreground/50",
                    selected
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "text-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                onChange(today);
                setViewDate(today);
                setOpen(false);
              }}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Today
            </button>
            {date && (
              <button
                type="button"
                onClick={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
                className="text-xs font-medium text-destructive hover:text-destructive/90"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
