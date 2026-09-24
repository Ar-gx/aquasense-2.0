import {
  Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { axisProps, C } from "./chartTheme";
import { fmtDateShort } from "../../lib/format";
import type { ForecastDay, Recommendation } from "../../lib/types";

/**
 * Rainfall-vs-irrigation intelligence: for each of the next days shows
 * forecast rain (mm), probability, and the engine's irrigation stance.
 */
export default function RainVsIrrigationChart({
  forecast, reco,
}: {
  forecast: ForecastDay[]; reco: Recommendation;
}) {
  const data = forecast.slice(0, 7).map((d) => {
    const prob = d.precip_prob_pct ?? 0;
    const stance = prob >= 60 && d.precip_mm >= 10
      ? "Delay irrigation"
      : prob >= 40 && d.precip_mm >= 5
        ? "Re-check after rain"
        : "Irrigation may be required";
    return {
      ...d,
      label: fmtDateShort(d.date),
      stance,
      stanceColor: stance === "Delay irrigation"
        ? C.rainwater
        : stance === "Re-check after rain" ? C.warn : C.baseline,
    };
  });

  return (
    <div>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 8, left: -6, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis yAxisId="l" {...axisProps} unit="mm" width={44} />
            <YAxis yAxisId="r" orientation="right" {...axisProps} unit="%"
                   width={38} domain={[0, 100]} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as {
                  label: string; temp_max_c: number; temp_min_c: number;
                  precip_mm: number; precip_prob_pct: number; stance: string;
                };
                return (
                  <div className="glass-strong !rounded-xl px-3 py-2 text-xs">
                    <div className="mb-1 font-medium text-ink">
                      {row.label}
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-mist/70">Temp</span>
                      <span className="font-mono">
                        {Math.round(row.temp_min_c)}–{Math.round(row.temp_max_c)}°C
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-mist/70">Forecast rain</span>
                      <span className="font-mono text-aqua-600">
                        {row.precip_mm} mm
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-mist/70">Probability</span>
                      <span className="font-mono text-aqua-600">
                        {row.precip_prob_pct}%
                      </span>
                    </div>
                    <div className="mt-1.5 border-t border-line/70 pt-1.5
                                    text-leaf-700">
                      {row.stance}
                    </div>
                  </div>
                );
              }}
            />
            <ReferenceLine yAxisId="l" y={10} stroke={C.ai}
                           strokeDasharray="4 4" label={{
                             value: "Useful rain ≥10 mm", position: "insideTopRight",
                             fill: C.ai, fontSize: 10,
                           }} />
            <Bar yAxisId="l" dataKey="precip_mm" name="Rain"
                 fill={C.rain} fillOpacity={0.6} radius={[4, 4, 0, 0]}
                 maxBarSize={30} />
            <Line yAxisId="r" type="monotone" dataKey="precip_prob_pct"
                  name="Probability" stroke={C.rainwater} strokeWidth={2}
                  dot={{ r: 3, fill: C.rainwater, strokeWidth: 0 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {data.slice(0, 3).map((d, i) => (
          <div key={d.date}
               className="rounded-xl border border-line/70 bg-night/50 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink">
                {i === 0 ? "Today" : d.label}
              </span>
              <span className="text-[11px] font-mono text-aqua-600">
                {d.precip_prob_pct}%
              </span>
            </div>
            <div className="mt-0.5 text-[11px]"
                 style={{ color: d.stanceColor }}>
              {d.stance}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-mist/70">
        Engine stance today:{" "}
        <span className="text-leaf-700">
          {reco.irrigation_required
            ? `Irrigation required — ${reco.recommended_time ?? "timing varies with rain"}`
            : "No irrigation while soil moisture and forecast rain cover demand"}
        </span>
        . Forecast source: {forecast.length ? "live 7-day forecast" : "demo"}.
      </p>
    </div>
  );
}
