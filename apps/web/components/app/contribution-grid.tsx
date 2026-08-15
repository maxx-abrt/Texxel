"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;
const WEEKS = 53;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function level(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

const LEVEL_CLASS = [
  "bg-muted",
  "bg-primary/25",
  "bg-primary/50",
  "bg-primary/75",
  "bg-primary",
];

export function ContributionGrid({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("contribution");
  const data = useQuery(api.activities.heatmap, {
    workspaceId: workspaceId as Id<"workspaces">,
    days: 364,
    mineOnly: true,
  });

  const { weeks, monthLabels, total } = useMemo(() => {
    const counts = data?.counts ?? {};
    // Anchor the grid to end today; start at the Sunday WEEKS-1 weeks back.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = today.getTime();
    const start = end - (WEEKS * 7 - 1) * DAY_MS;
    const startDate = new Date(start);
    // Align to the start of week (Sunday).
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const grid: { date: string; count: number; ts: number }[][] = [];
    const labels: { week: number; label: string }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < WEEKS; w++) {
      const col: { date: string; count: number; ts: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const ts = startDate.getTime() + (w * 7 + d) * DAY_MS;
        const dt = new Date(ts);
        const key = dt.toISOString().slice(0, 10);
        col.push({ date: key, count: counts[key] ?? 0, ts });
        if (d === 0) {
          const m = dt.getMonth();
          if (m !== lastMonth && dt.getTime() <= end) {
            labels.push({ week: w, label: MONTHS[m] });
            lastMonth = m;
          }
        }
      }
      grid.push(col);
    }
    return { weeks: grid, monthLabels: labels, total: data?.total ?? 0 };
  }, [data]);

  return (
    <div className="rounded-2xl border border-border bg-card p-5" data-testid="contribution-grid">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">{t("yourActivity")}</h3>
        <span className="text-xs text-muted-foreground">
          {t("contributionsThisYear", { count: total })}
        </span>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="inline-block min-w-full">
          {/* Month labels */}
          <div className="relative mb-1 ml-7 h-3.5">
            {monthLabels.map((m) => (
              <span
                key={`${m.week}-${m.label}`}
                className="absolute text-[10px] text-muted-foreground"
                style={{ left: `${m.week * 14}px` }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex gap-[3px]">
            {/* Weekday labels */}
            <div className="mr-1 flex flex-col gap-[3px] text-[9px] text-muted-foreground">
              {["", t("weekdayMon"), "", t("weekdayWed"), "", t("weekdayFri"), ""].map((d, i) => (
                <span key={i} className="flex h-[11px] items-center leading-none">{d}</span>
              ))}
            </div>

            {weeks.map((col, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {col.map((cell, di) => {
                  const future = cell.ts > Date.now();
                  return (
                    <div
                      key={di}
                      title={future ? "" : t("countOn", { count: cell.count, date: cell.date })}
                      className={cn(
                        "h-[11px] w-[11px] rounded-[2px]",
                        future ? "bg-transparent" : LEVEL_CLASS[level(cell.count)],
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
        <span>{t("less")}</span>
        {LEVEL_CLASS.map((c, i) => (
          <div key={i} className={cn("h-[11px] w-[11px] rounded-[2px]", c)} />
        ))}
        <span>{t("more")}</span>
      </div>
    </div>
  );
}
