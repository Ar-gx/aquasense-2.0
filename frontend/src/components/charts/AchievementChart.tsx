import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from "recharts";
import { axisProps, C } from "./chartTheme";
import { fmtCompact, fmtDateShort } from "../../lib/format";
import type { AchievementItem } from "../../lib/types";

/**
 * Cumulative achievements chart: irrigation savings line + rainwater
 * utilisation area over the analysis window (two separate buckets).
 */
export default function AchievementChart({ metric }: { metric: AchievementItem }) {
  const data = metric.history ?? [];

  if (!data.length) {
    return (
      <div className="grid h-[200px] place-items-center text-xs text-mist/70">
        No history available for this metric yet.
      </div>
    );
  }

  return (
    <div className="h-[230px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: -4, bottom: 0 }}>
          <defs>
            <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.rainwater} stopOpacity={0.35} />
              <stop offset="100%" stopColor={C.rainwater} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.grid} strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="date" {...axisProps} tickFormatter={(v: string) => fmtDateShort(v)} />
          <YAxis {...axisProps} tickFormatter={(v: number) => fmtCompact(v)} width={54} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as {
                date: string; cumulative_saved_l: number; cumulative_rainwater_l: number;
              };
              return (
                <div className="glass-strong !rounded-xl px-3 py-2 text-xs">
                  <div className="mb-1 font-medium text-ink">
                    {fmtDateShort(String(label ?? row.date))}
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-mist/70">
                      <span className="h-2 w-2 rounded-full" style={{ background: C.saved }} />
                      Cumulative savings
                    </span>
                    <span className="font-mono text-leaf-700">
                      {Math.round(row.cumulative_saved_l).toLocaleString("en-IN")} L
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-mist/70">
                      <span className="h-2 w-2 rounded-full" style={{ background: C.rainwater }} />
                      Rainwater utilised
                    </span>
                    <span className="font-mono text-aqua-600">
                      {Math.round(row.cumulative_rainwater_l).toLocaleString("en-IN")} L
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-mist/70">
                    model estimate (not metered)
                  </div>
                </div>
              );
            }}
          />
          <Area
            type="monotone" dataKey="cumulative_rainwater_l"
            stroke={C.rainwater} strokeWidth={1.5} fill="url(#rainGrad)"
          />
          <Line
            type="monotone" dataKey="cumulative_saved_l" stroke={C.saved}
            strokeWidth={2.5} dot={{ r: 2.5, fill: C.saved, strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
