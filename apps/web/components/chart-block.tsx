"use client";

import { useState, useCallback, useMemo } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon,
  AreaChart as AreaChartIcon, Plus, Trash2,
  X, Check, Pencil, Maximize2, Minimize2,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type ChartType = "bar" | "line" | "pie" | "area";

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface ChartConfig {
  type: ChartType;
  title: string;
  data: DataPoint[];
  showGrid: boolean;
  showLegend: boolean;
  accentColor: string;
}

// ─── Color palette ──────────────────────────────────────────────────────────

const CHART_COLORS = [
  "#E14B3D", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#e11d48",
];

const CHART_TYPE_ICONS: Record<ChartType, React.ElementType> = {
  bar: BarChart3,
  line: LineChartIcon,
  pie: PieChartIcon,
  area: AreaChartIcon,
};

const CHART_TYPES: ChartType[] = ["bar", "line", "area", "pie"];

// ─── Default data ───────────────────────────────────────────────────────────

const DEFAULT_DATA: DataPoint[] = [
  { label: "Jan", value: 40 },
  { label: "Feb", value: 65 },
  { label: "Mar", value: 50 },
  { label: "Apr", value: 80 },
  { label: "May", value: 60 },
];

function parseChartData(raw: string): ChartConfig {
  try {
    const parsed = JSON.parse(raw);
    return {
      type: parsed.type ?? "bar",
      title: parsed.title ?? "",
      data: Array.isArray(parsed.data) ? parsed.data : DEFAULT_DATA,
      showGrid: parsed.showGrid ?? true,
      showLegend: parsed.showLegend ?? false,
      accentColor: parsed.accentColor ?? CHART_COLORS[0],
    };
  } catch {
    return {
      type: "bar",
      title: "",
      data: DEFAULT_DATA,
      showGrid: true,
      showLegend: false,
      accentColor: CHART_COLORS[0],
    };
  }
}

// ─── Chart renderer ─────────────────────────────────────────────────────────

function ChartRenderer({ config, height }: { config: ChartConfig; height: number }) {
  const { type, data, showGrid, showLegend, accentColor } = config;
  const gradientId = useMemo(() => `cg-${Math.random().toString(36).slice(2, 8)}`, []);

  const chartData = data.map((d, i) => ({
    name: d.label,
    value: d.value,
    fill: d.color || CHART_COLORS[i % CHART_COLORS.length],
  }));

  const commonProps = {
    data: chartData,
    margin: { top: 12, right: 20, left: 4, bottom: 8 },
  };

  const axisStyle = { fontSize: 11, fill: "var(--muted-foreground, #9ca3af)" };
  const gridStroke = "var(--border, #e5e7eb)";

  const tooltipStyle = {
    contentStyle: {
      background: "var(--background, #fff)",
      border: "1px solid var(--border, #e5e7eb)",
      borderRadius: "8px",
      fontSize: "12px",
      padding: "8px 12px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
    },
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      {type === "bar" ? (
        <BarChart {...commonProps}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.4} />}
          <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={40} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted, #f3f4f6)", opacity: 0.4 }} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      ) : type === "line" ? (
        <LineChart {...commonProps}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.4} />}
          <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={40} />
          <Tooltip {...tooltipStyle} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <Line
            type="monotone"
            dataKey="value"
            stroke={accentColor}
            strokeWidth={2.5}
            dot={{ r: 4, fill: accentColor, strokeWidth: 2, stroke: "var(--background, #fff)" }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      ) : type === "area" ? (
        <AreaChart {...commonProps}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.4} />}
          <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={40} />
          <Tooltip {...tooltipStyle} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={accentColor} stopOpacity={0.25} />
              <stop offset="95%" stopColor={accentColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={accentColor}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={{ r: 3, fill: accentColor, strokeWidth: 2, stroke: "var(--background, #fff)" }}
          />
        </AreaChart>
      ) : (
        <PieChart>
          <Tooltip {...tooltipStyle} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={height * 0.2}
            outerRadius={height * 0.38}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            strokeWidth={0}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      )}
    </ResponsiveContainer>
  );
}

// ─── Data editor panel (multilingual) ───────────────────────────────────────

function DataEditor({
  config,
  onChange,
  onClose,
}: {
  config: ChartConfig;
  onChange: (config: ChartConfig) => void;
  onClose: () => void;
}) {
  const t = useTranslations("chart");
  const [draft, setDraft] = useState<ChartConfig>({ ...config, data: config.data.map(d => ({ ...d })) });

  const updateData = (index: number, field: keyof DataPoint, value: string | number) => {
    const newData = [...draft.data];
    newData[index] = { ...newData[index], [field]: value };
    setDraft({ ...draft, data: newData });
  };

  const addRow = () => {
    setDraft({
      ...draft,
      data: [...draft.data, { label: `Item ${draft.data.length + 1}`, value: 0 }],
    });
  };

  const removeRow = (index: number) => {
    if (draft.data.length <= 1) return;
    setDraft({ ...draft, data: draft.data.filter((_, i) => i !== index) });
  };

  const apply = () => {
    onChange(draft);
    onClose();
  };

  return (
    <div className="border-t border-border/40 bg-muted/30 p-4 space-y-3 animate-in slide-in-from-top-1 duration-150">
      {/* Title */}
      <input
        type="text"
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        placeholder={t("titlePlaceholder")}
        className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm font-medium placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-shadow"
      />

      {/* Chart type selector */}
      <div className="flex gap-1 p-0.5 rounded-lg bg-muted/50">
        {CHART_TYPES.map((ct) => {
          const Icon = CHART_TYPE_ICONS[ct];
          return (
            <button
              key={ct}
              onClick={() => setDraft({ ...draft, type: ct })}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all",
                draft.type === ct
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(`types.${ct}` as any)}
            </button>
          );
        })}
      </div>

      {/* Data rows */}
      <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
        {draft.data.map((row, i) => (
          <div key={i} className="flex items-center gap-2 group/row">
            <span
              className="h-3 w-3 shrink-0 rounded-full ring-1 ring-border/30"
              style={{ backgroundColor: row.color || CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <input
              type="text"
              value={row.label}
              onChange={(e) => updateData(i, "label", e.target.value)}
              className="flex-1 min-w-0 rounded-md border border-border/40 bg-background px-2.5 py-1.5 text-[12px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-shadow"
              placeholder={t("labelPlaceholder")}
            />
            <input
              type="number"
              value={row.value}
              onChange={(e) => updateData(i, "value", Number(e.target.value))}
              className="w-20 rounded-md border border-border/40 bg-background px-2.5 py-1.5 text-[12px] font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/20 transition-shadow"
            />
            <input
              type="color"
              value={row.color || CHART_COLORS[i % CHART_COLORS.length]}
              onChange={(e) => updateData(i, "color", e.target.value)}
              className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-border/30 p-0.5"
            />
            <button
              onClick={() => removeRow(i)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 opacity-0 group-hover/row:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-border/50 px-3 py-2 text-[11px] font-medium text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors w-full justify-center"
      >
        <Plus className="h-3 w-3" /> {t("addDataPoint")}
      </button>

      {/* Options row */}
      <div className="flex items-center gap-4 text-[11px] pt-1">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={draft.showGrid}
            onChange={(e) => setDraft({ ...draft, showGrid: e.target.checked })}
            className="rounded border-border/60"
          />
          <span className="text-muted-foreground">{t("grid")}</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={draft.showLegend}
            onChange={(e) => setDraft({ ...draft, showLegend: e.target.checked })}
            className="rounded border-border/60"
          />
          <span className="text-muted-foreground">{t("legend")}</span>
        </label>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-muted-foreground">{t("accentColor")}</span>
          <div className="flex gap-0.5">
            {CHART_COLORS.slice(0, 8).map((c) => (
              <button
                key={c}
                onClick={() => setDraft({ ...draft, accentColor: c })}
                className={cn(
                  "h-4 w-4 rounded-full transition-all",
                  draft.accentColor === c ? "ring-2 ring-offset-1 ring-offset-background" : "ring-1 ring-border/30 hover:scale-110",
                )}
                style={{ backgroundColor: c, ...(draft.accentColor === c ? { ringColor: c } : {}) }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <X className="h-3 w-3" /> {t("cancel")}
        </button>
        <button
          onClick={apply}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Check className="h-3 w-3" /> {t("apply")}
        </button>
      </div>
    </div>
  );
}

// ─── BlockNote Block Spec ───────────────────────────────────────────────────

export const ChartBlockSpec = createReactBlockSpec(
  {
    type: "chart" as const,
    propSchema: {
      chartData: { default: JSON.stringify({
        type: "bar",
        title: "",
        data: DEFAULT_DATA,
        showGrid: true,
        showLegend: false,
        accentColor: CHART_COLORS[0],
      }) },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const t = useTranslations("chart");
      const [editing, setEditing] = useState(false);
      const [expanded, setExpanded] = useState(false);
      const config = useMemo(() => parseChartData(block.props.chartData), [block.props.chartData]);

      const handleChange = useCallback((newConfig: ChartConfig) => {
        (editor as any).updateBlock(block, {
          props: { chartData: JSON.stringify(newConfig) },
        });
      }, [editor, block]);

      const chartHeight = expanded ? 400 : 260;
      const Icon = CHART_TYPE_ICONS[config.type];

      return (
        <div
          className={cn(
            "group relative my-3 rounded-xl border border-border/40 bg-background overflow-hidden transition-all duration-200",
            "hover:border-border/70 hover:shadow-[0_2px_12px_rgba(0,0,0,0.04)]",
            expanded && "shadow-[0_4px_20px_rgba(0,0,0,0.06)]",
          )}
          style={{ width: "100%" }}
          contentEditable={false}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-muted/20">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center justify-center h-5 w-5 rounded bg-primary/10">
                <Icon className="h-3 w-3 text-primary" />
              </div>
              {config.title ? (
                <span className="text-[13px] font-semibold text-foreground/90 truncate">{config.title}</span>
              ) : (
                <span className="text-[12px] text-muted-foreground/40 italic">{t("untitled")}</span>
              )}
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => setEditing(!editing)}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {editing ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                {editing ? t("close") : t("edit")}
              </button>
            </div>
          </div>

          {/* Chart — full width */}
          <div className="w-full px-3 pt-4 pb-2">
            <ChartRenderer config={config} height={chartHeight} />
          </div>

          {/* Inline data editor */}
          {editing && (
            <DataEditor
              config={config}
              onChange={handleChange}
              onClose={() => setEditing(false)}
            />
          )}
        </div>
      );
    },
  },
);

// ─── Slash menu items for charts ────────────────────────────────────────────

function ChartMenuIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
      {children}
    </span>
  );
}

export function buildChartSlashMenuItems(editor: any, t?: (key: string) => string): Array<{
  title: string;
  subtext: string;
  icon: React.ReactElement;
  group: string;
  aliases: string[];
  onItemClick: () => void;
}> {
  const tr = (key: string, fallback: string) => t ? t(key) : fallback;

  const insertChart = (type: ChartType, title: string) => {
    const config: ChartConfig = {
      type,
      title,
      data: DEFAULT_DATA,
      showGrid: true,
      showLegend: false,
      accentColor: CHART_COLORS[0],
    };
    (editor as any).insertBlocks(
      [{ type: "chart", props: { chartData: JSON.stringify(config) } }],
      editor.getTextCursorPosition().block,
      "after",
    );
  };

  return [
    {
      title: tr("menu.barChart", "Bar Chart"),
      subtext: tr("menu.barChartSubtext", "Interactive bar chart with editable data"),
      icon: <ChartMenuIcon><BarChart3 size={14} /></ChartMenuIcon>,
      group: tr("menu.chartGroup", "Charts & Graphs"),
      aliases: ["bar", "chart", "graph", "data", "visualization", "graphique", "barres", "diagramme"],
      onItemClick: () => insertChart("bar", ""),
    },
    {
      title: tr("menu.lineChart", "Line Chart"),
      subtext: tr("menu.lineChartSubtext", "Trend line chart with smooth curves"),
      icon: <ChartMenuIcon><LineChartIcon size={14} /></ChartMenuIcon>,
      group: tr("menu.chartGroup", "Charts & Graphs"),
      aliases: ["line", "chart", "trend", "graph", "data", "ligne", "tendance", "graphique"],
      onItemClick: () => insertChart("line", ""),
    },
    {
      title: tr("menu.areaChart", "Area Chart"),
      subtext: tr("menu.areaChartSubtext", "Filled area chart for volume data"),
      icon: <ChartMenuIcon><AreaChartIcon size={14} /></ChartMenuIcon>,
      group: tr("menu.chartGroup", "Charts & Graphs"),
      aliases: ["area", "chart", "graph", "data", "fill", "aires", "graphique"],
      onItemClick: () => insertChart("area", ""),
    },
    {
      title: tr("menu.pieChart", "Pie Chart"),
      subtext: tr("menu.pieChartSubtext", "Donut/pie chart for proportional data"),
      icon: <ChartMenuIcon><PieChartIcon size={14} /></ChartMenuIcon>,
      group: tr("menu.chartGroup", "Charts & Graphs"),
      aliases: ["pie", "donut", "chart", "graph", "data", "proportion", "secteurs", "circulaire", "camembert"],
      onItemClick: () => insertChart("pie", ""),
    },
  ];
}
