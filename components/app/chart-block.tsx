"use client";

import { useMemo, useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { useTranslations } from "next-intl";
import {
  ResponsiveContainer,
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Chart2, Add, Trash, Setting4, TickCircle } from "iconsax-reactjs";

type Row = { label: string; value: number };
const PALETTE = ["#e55a42", "#2f7ea6", "#1f9d76", "#d98324", "#7c5cff", "#c93c2a"];
const DEFAULT_DATA = JSON.stringify([
  { label: "Jan", value: 12 }, { label: "Feb", value: 19 },
  { label: "Mar", value: 8 }, { label: "Apr", value: 22 }, { label: "May", value: 16 },
]);

function stop(e: any) { e.stopPropagation(); }

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs shadow-[var(--elev-2)]">
      {label != null && <div className="font-semibold">{label}</div>}
      <div className="tabular text-muted-foreground">{payload[0]?.value}</div>
    </div>
  );
}

function ChartView({ block, editor }: any) {
  const t = useTranslations("chart");
  const editable = !!editor?.isEditable;
  const [editing, setEditing] = useState(false);

  const chartType: string = block.props.chartType || "bar";
  const color: string = block.props.color || "#e55a42";
  const title: string = block.props.title || "";
  const rows: Row[] = useMemo(() => {
    try { const a = JSON.parse(block.props.data || "[]"); return Array.isArray(a) ? a : []; }
    catch { return []; }
  }, [block.props.data]);

  const update = (patch: any) => editor.updateBlock(block, { props: { ...block.props, ...patch } });
  const setRows = (next: Row[]) => update({ data: JSON.stringify(next) });

  const TYPES = [
    { key: "bar", label: t("bar") },
    { key: "line", label: t("line") },
    { key: "area", label: t("area") },
    { key: "pie", label: t("pie") },
  ];

  return (
    <div className="tx-card my-2 w-full p-4" data-testid="chart-block" contentEditable={false} onClick={stop}>
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `color-mix(in oklch, ${color} 14%, transparent)`, color }}>
          <Chart2 variant="Bulk" size={17} />
        </span>
        {editable ? (
          <input
            value={title}
            onChange={(e) => update({ title: e.target.value })}
            onKeyDown={stop}
            placeholder={t("titlePlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground/70"
            data-testid="chart-title"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title || t("title")}</span>
        )}
        {editable && (
          <button
            onClick={() => setEditing((v) => !v)}
            className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${editing ? "border-primary bg-[var(--flux-coral-soft)] text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
            data-testid="chart-edit-toggle"
          >
            {editing ? <><TickCircle variant="Bulk" size={14} /> {t("done")}</> : <><Setting4 variant="Bulk" size={14} /> {t("edit")}</>}
          </button>
        )}
      </div>

      {/* Type + color controls */}
      {editable && editing && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-muted p-0.5">
            {TYPES.map((ty) => (
              <button key={ty.key} onClick={() => update({ chartType: ty.key })}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${chartType === ty.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                data-testid={`chart-type-${ty.key}`}>
                {ty.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {PALETTE.map((c) => (
              <button key={c} onClick={() => update({ color: c })} title={t("color")}
                className={`h-5 w-5 rounded-full ring-2 ring-offset-1 ring-offset-card transition-transform hover:scale-110 ${color === c ? "ring-foreground/40" : "ring-transparent"}`}
                style={{ background: c }} data-testid="chart-color" />
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="h-[260px] w-full" data-testid="chart-canvas">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "pie" ? (
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="label" innerRadius={55} outerRadius={90} paddingAngle={3} strokeWidth={0}>
                {rows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip content={<ChartTip />} />
            </PieChart>
          ) : chartType === "line" ? (
            <LineChart data={rows} margin={{ left: -18, right: 8, top: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<ChartTip />} />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} />
            </LineChart>
          ) : chartType === "area" ? (
            <AreaChart data={rows} margin={{ left: -18, right: 8, top: 6 }}>
              <defs>
                <linearGradient id={`ca-${block.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#ca-${block.id})`} />
            </AreaChart>
          ) : (
            <BarChart data={rows} margin={{ left: -18, right: 8, top: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "color-mix(in oklch, var(--muted) 55%, transparent)" }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={44}>
                {rows.map((_, i) => <Cell key={i} fill={chartType === "bar" && rows.length > 1 ? PALETTE[i % PALETTE.length] : color} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Data editor */}
      {editable && editing && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>{t("data")}</span>
          </div>
          <div className="space-y-1.5">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={r.label} onKeyDown={stop}
                  onChange={(e) => { const n = [...rows]; n[i] = { ...r, label: e.target.value }; setRows(n); }}
                  placeholder={t("label")} data-testid="chart-row-label"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary/50" />
                <input value={r.value} type="number" onKeyDown={stop}
                  onChange={(e) => { const n = [...rows]; n[i] = { ...r, value: Number(e.target.value) || 0 }; setRows(n); }}
                  placeholder={t("value")} data-testid="chart-row-value"
                  className="tabular w-24 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary/50" />
                <button onClick={() => setRows(rows.filter((_, j) => j !== i))} data-testid="chart-row-remove"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-[#c93c2a]">
                  <Trash variant="Bulk" size={15} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => setRows([...rows, { label: "", value: 0 }])} data-testid="chart-add-row"
            className="mt-2 flex items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary">
            <Add variant="Bulk" size={14} /> {t("addRow")}
          </button>
        </div>
      )}
    </div>
  );
}

export const ChartBlock = createReactBlockSpec(
  {
    type: "chart",
    propSchema: {
      chartType: { default: "bar", values: ["bar", "line", "area", "pie"] },
      title: { default: "" },
      color: { default: "#e55a42" },
      data: { default: DEFAULT_DATA },
    },
    content: "none",
  },
  {
    render: (props) => <ChartView block={props.block} editor={props.editor} />,
  },
);
