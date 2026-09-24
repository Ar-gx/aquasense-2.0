import {
  Area, ComposedChart, CartesianGrid, Line, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis,
} from "recharts";
import { axisProps, C, DarkTooltip, fmtLakh } from "./chartTheme";
import type { TrajectoryPoint } from "../../lib/types";

interface Props {
  current: number;
  trajectory: TrajectoryPoint[];
  thresholds: {
    field_capacity_pct: number; wilting_point_pct: number;
    saturation_pct: number; stress_threshold_pct: number;
  };
}

/**
 * Soil-moisture forecast chart: current reading + model trajectory with
 * healthy zone, crop-stress threshold and waterlogging threshold bands.
 * Hovering a point shows date, prediction, crop stress status and action.
 */
export default function MoistureForecastChart({ current, trajectory,
                                               thresholds }: Props) {
  const data = [
    {
      key: "now", label: "Now", offset_hours: 0,
      predicted: current, rain: 0, horizon: "actual",
      status: current <= thresholds.stress_threshold_pct
        ? "Crop stress" : current >= thresholds.saturation_pct - 1.5
          ? "Waterlogging risk" : "Healthy",
      action: current <= thresholds.stress_threshold_pct
        ? "Irrigate per recommendation"
        : "No action needed",
    },
    ...trajectory.map((t) => ({
      key: String(t.offset_hours),
      label: `+${t.offset_hours}h`,
      offset_hours: t.offset_hours,
      predicted: t.predicted_moisture_pct,
      rain: t.forecast_rain_mm,
      horizon: t.horizon_class,
      status: t.predicted_moisture_pct <= thresholds.stress_threshold_pct
        ? "Crop stress"
        : t.predicted_moisture_pct >= thresholds.saturation_pct - 1.5
          ? "Waterlogging risk"
          : t.predicted_moisture_pct >= thresholds.stress_threshold_pct + 2
            ? "Healthy" : "Monitor",
      action: t.predicted_moisture_pct <= thresholds.stress_threshold_pct
        ? "Irrigate before this point"
        : t.predicted_moisture_pct >= thresholds.saturation_pct - 1.5
          ? "Delay irrigation, check drainage"
          : "Continue monitoring",
    })),
  ];

  return (
    <div>
      <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid {...gridSafe} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} domain={[
            Math.max(0, thresholds.wilting_point_pct - 4),
            Math.min(100, thresholds.saturation_pct + 4),
          ]} unit="%" width={44} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as {
                label: string; predicted: number; status: string;
                action: string; rain: number; horizon: string;
              };
              return (
                <div className="glass-strong !rounded-xl px-3 py-2 text-xs">
                  <div className="mb-1 font-medium text-ink">{row.label}</div>
                  <div className="flex justify-between gap-4">
                    <span className="text-mist/70">Predicted moisture</span>
                    <span className="font-mono text-ink">
                      {row.predicted.toFixed(1)}% vol
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-mist/70">Forecast rain</span>
                    <span className="font-mono text-aqua-600">{row.rain} mm</span>
                  </div>
                  <div className="mt-1.5 border-t border-line/70 pt-1.5">
                    <span className={row.status === "Healthy"
                      ? "text-leaf-600" : row.status === "Monitor"
                        ? "text-warn-600" : "text-alert-600"}>
                      {row.status}
                    </span>
                    <div className="text-mist/70">{row.action}</div>
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-mist/70">
                    {row.horizon === "extended_outlook"
                      ? "Extended outlook (not validated)"
                      : row.horizon === "actual"
                        ? "Current measurement" : "Short-range forecast"}
                  </div>
                </div>
              );
            }}
          />
          {/* healthy zone */}
          <ReferenceArea
            y1={thresholds.stress_threshold_pct}
            y2={thresholds.field_capacity_pct}
            fill={C.healthyZone} stroke="none"
          />
          <ReferenceLine
            y={thresholds.stress_threshold_pct} stroke={C.stress}
            strokeDasharray="5 4" label={{
              value: "Crop stress threshold", position: "insideTopRight",
              fill: C.stress, fontSize: 10,
            }}
          />
          <ReferenceLine
            y={thresholds.saturation_pct} stroke={C.waterlog}
            strokeDasharray="5 4" label={{
              value: "Waterlogging threshold", position: "insideBottomRight",
              fill: C.waterlog, fontSize: 10,
            }}
          />
          <ReferenceLine
            y={thresholds.field_capacity_pct} stroke={C.ai}
            strokeDasharray="2 5" label={{
              value: "Field capacity", position: "insideTopLeft",
              fill: C.ai, fontSize: 10,
            }}
          />
          <Area
            type="monotone" dataKey="predicted" stroke="none"
            fill="url(#moistGrad)" strokeWidth={0}
          />
          <Line
            type="monotone" dataKey="predicted" stroke={C.moisture}
            strokeWidth={2.5} dot={{ r: 3, fill: C.moisture, strokeWidth: 0 }}
            activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2 }}
          />
          <Scatter dataKey="predicted" fill={C.predicted} shape="diamond" />
          <defs>
            <linearGradient id="moistGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.moisture} stopOpacity={0.35} />
              <stop offset="100%" stopColor={C.moisture} stopOpacity={0.02} />
            </linearGradient>
          </defs>
        </ComposedChart>
      </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[10px] text-mist/70">
        Hover any point for date, predicted moisture, stress status and the
        recommended action. Horizons beyond 72 h are extended outlook, not
        validated forecasts.
      </p>
    </div>
  );
}

const gridSafe = { stroke: C.grid, strokeDasharray: "3 4", vertical: false };
