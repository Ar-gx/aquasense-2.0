// Shared Recharts theme, colours and tooltip.
import type { TooltipProps } from "recharts";

export const C = {
  baseline: "#b84a35", // traditional schedule (terracotta)
  ai: "#557f9d",       // AI-recommended use (dusty blue)
  saved: "#6d9a4c",    // savings (moss green)
  rainwater: "#97b5ca",
  rain: "#4f7fa5",
  moisture: "#577c3c",
  predicted: "#adcb8e",
  stress: "#b84a35",
  waterlog: "#866643", // waterlogged soil (walnut)
  warn: "#dfb547",
  grid: "rgba(35,25,15,0.10)",
  axis: "rgba(101,89,75,0.9)",
  healthyZone: "rgba(109,154,76,0.14)",
};

export const axisProps = {
  stroke: C.axis,
  fontSize: 11,
  tickLine: false,
  axisLine: { stroke: C.grid },
} as const;

export const gridProps = {
  stroke: C.grid, strokeDasharray: "3 4", vertical: false,
} as const;

export function fmtLakh(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

interface Row {
  [key: string]: unknown;
}

/** Custom dark tooltip used across all charts. */
export function DarkTooltip(
  { active, payload, label, labelMap, unit }: TooltipProps<number, string> & {
    labelMap?: Record<string, string>;
    unit?: string;
  },
) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong !rounded-xl px-3 py-2 text-xs">
      <div className="mb-1 font-medium text-ink">{label}</div>
      {payload.map((p) => {
        const name = labelMap?.[String(p.dataKey)] ?? String(p.name ?? p.dataKey);
        const val = typeof p.value === "number"
          ? p.value.toLocaleString("en-IN")
          : String(p.value);
        return (
          <div key={String(p.dataKey)} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.stroke || p.fill }} />
            <span className="text-mist">{name}:</span>
            <span className="font-mono text-ink">
              {val}
              {unit ?? ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Buyhatke-style crosshair tooltip for time series. */
export function HistoryTooltip(
  { active, payload, label, labelMap }: TooltipProps<number, string> & {
    labelMap?: Record<string, string>;
  },
) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong !rounded-xl min-w-[190px] px-3 py-2 text-xs">
      <div className="mb-1.5 border-b border-line/70 pb-1 font-medium
                      text-ink">
        {label}
      </div>
      {payload.map((p) => {
        const name = labelMap?.[String(p.dataKey)] ?? String(p.name ?? p.dataKey);
        const v = typeof p.value === "number" ? p.value : 0;
        return (
          <div key={String(p.dataKey)} className="flex items-center justify-between gap-3 py-0.5">
            <span className="flex items-center gap-1.5 text-mist">
              <span className="h-2 w-2 rounded-full"
                    style={{ background: p.color || p.stroke || p.fill }} />
              {name}
            </span>
            <span className="font-mono text-ink">
              {v.toLocaleString("en-IN")} L
            </span>
          </div>
        );
      })}
    </div>
  );
}
