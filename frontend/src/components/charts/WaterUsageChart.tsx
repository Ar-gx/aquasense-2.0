import { useMemo, useState } from "react";
import {
  Bar, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from "recharts";
import { axisProps, C, HistoryTooltip } from "./chartTheme";
import { fmtDateShort } from "../../lib/format";
import type { WaterDayRow } from "../../lib/types";

export type RangeMode = "daily" | "weekly" | "monthly" | "cycle";

const LABEL_MAP: Record<string, string> = {
  baseline_l: "Baseline (traditional)",
  ai_l: "AI-recommended",
  saved_l: "Water saved",
  rainwater_l: "Rainwater utilised",
};

/**
 * Buyhatke-style interactive water-history chart with
 * daily / weekly / monthly / crop-cycle range switching, crosshair tooltip
 * and clearly differentiated series (recorded vs AI vs savings vs rain).
 */
export default function WaterUsageChart({
  daily, series, compact = false,
}: {
  daily: WaterDayRow[];
  series: WaterDayRow[];      // already rolled up for the active mode
  compact?: boolean;
}) {
  const [mode, setMode] = useState<RangeMode>("daily");
  const [show, setShow] = useState({
    baseline: true, ai: true, saved: true, rain: true,
  });

  const rows = useMemo(() => {
    if (mode === "daily") return daily.slice(-31);
    return series;
  }, [mode, daily, series]);

  // simple client-side rollups so the switch is instant
  const rolled = useMemo(() => {
    if (mode === "daily") return rows;
    const key = (d: string) => {
      const dt = new Date(d);
      if (mode === "weekly") {
        const day = (dt.getDay() + 6) % 7;
        dt.setDate(dt.getDate() - day);
        return dt.toISOString().slice(0, 10);
      }
      if (mode === "monthly") return d.slice(0, 7);
      return "crop-cycle";
    };
    const map = new Map<string, WaterDayRow>();
    for (const r of rows) {
      const k = key(r.date);
      const cur = map.get(k) ?? {
        date: k, label: k, baseline_l: 0, ai_l: 0, saved_l: 0,
        saved_pct: 0, rainwater_l: 0, rain_mm: 0, moisture_pct: 0, days: 0,
      };
      cur.baseline_l += r.baseline_l;
      cur.ai_l += r.ai_l;
      cur.saved_l += r.saved_l;
      cur.rainwater_l += r.rainwater_l;
      cur.rain_mm = +(cur.rain_mm + r.rain_mm).toFixed(1);
      cur.days = (cur.days ?? 0) + 1;
      cur.saved_pct = cur.baseline_l
        ? +((cur.saved_l / cur.baseline_l) * 100).toFixed(1) : 0;
      map.set(k, cur);
    }
    return [...map.values()];
  }, [mode, rows]);

  const xKey = mode === "daily" ? "date" : "date";
  const xLabel = (v: string) =>
    mode === "daily" ? fmtDateShort(v)
      : mode === "cycle" ? "Crop cycle" : v;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line bg-night/60 p-0.5">
          {(["daily", "weekly", "monthly", "cycle"] as RangeMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition ${
                mode === m
                  ? "bg-leaf-500/20 text-leaf-700"
                  : "text-mist/75 hover:text-leaf-700"
              }`}
            >
              {m === "cycle" ? "Crop cycle" : m}
            </button>
          ))}
        </div>
        <div className="ms-auto flex flex-wrap gap-1.5">
          {([
            ["baseline", "Traditional", C.baseline],
            ["ai", "AI use", C.ai],
            ["saved", "Saved", C.saved],
            ["rain", "Rainwater", C.rainwater],
          ] as const).map(([k, label, color]) => (
            <button
              key={k}
              onClick={() => setShow((s) => ({ ...s, [k]: !s[k] }))}
              className={`chip !normal-case ${show[k] ? "" : "opacity-35"}`}
              style={{ borderColor: color, color, background: "transparent" }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={compact ? "h-[240px] w-full" : "h-[320px] w-full"}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rolled} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} strokeDasharray="3 4" vertical={false} />
            <XAxis
              dataKey={xKey} {...axisProps}
              tickFormatter={xLabel}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis {...axisProps} tickFormatter={(v: number) => {
              const abs = Math.abs(v);
              if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
              if (abs >= 1_000) return `${Math.round(v / 1_000)}k`;
              return String(v);
            }} width={54} />
            <Tooltip
              content={<HistoryTooltip labelMap={LABEL_MAP} />}
              labelFormatter={(v: string) => xLabel(String(v))}
            />
            {show.baseline && (
              <Bar dataKey="baseline_l" name="Traditional" fill={C.baseline}
                   fillOpacity={0.55} radius={[3, 3, 0, 0]} maxBarSize={26} />
            )}
            {show.ai && (
              <Bar dataKey="ai_l" name="AI use" fill={C.ai}
                   fillOpacity={0.8} radius={[3, 3, 0, 0]} maxBarSize={26} />
            )}
            {show.rain && (
              <Bar dataKey="rainwater_l" name="Rainwater" fill={C.rainwater}
                   fillOpacity={0.45} radius={[3, 3, 0, 0]} maxBarSize={26} />
            )}
            {show.saved && (
              <Line
                type="stepAfter" dataKey="saved_l" name="Saved"
                stroke={C.saved} strokeWidth={2}
                dot={{ r: 2, fill: C.saved, strokeWidth: 0 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10px] text-mist/70">
        Traditional = recorded fixed-schedule irrigation · AI = model
        recommendation · Saved & rainwater = model estimates. Water skipped
        because of rain appears only in the Rainwater series (no double
        counting). Click a range to switch — hover for exact litres.
      </p>
    </div>
  );
}
