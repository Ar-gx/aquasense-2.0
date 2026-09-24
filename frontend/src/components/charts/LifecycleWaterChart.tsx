import {
  Bar, CartesianGrid, ComposedChart, Cell, ResponsiveContainer, Tooltip,
  XAxis, YAxis, ReferenceLine, LabelList,
} from "recharts";
import { axisProps, C } from "./chartTheme";
import { fmtCompact, fmtLitresShort } from "../../lib/format";
import type { CropLifecycle } from "../../lib/types";

/**
 * Crop lifecycle water budget: per-stage estimated requirement (model
 * estimate from Kc × ETo × stage days), with the current stage highlighted.
 */
export default function LifecycleWaterChart({ life }: { life: CropLifecycle }) {
  const rows = life.stages.map((s) => ({
    ...s,
    label: s.name.replace("Fruiting / Grain Filling", "Fruiting/Fill"),
    isCurrent: s.index === life.stage_index,
    status: s.index < life.stage_index
      ? "completed"
      : s.index === life.stage_index ? "current" : "upcoming",
  }));

  return (
    <div>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 18, right: 8, left: -4, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="label" {...axisProps} interval={0} tick={{ fontSize: 10 }} />
            <YAxis {...axisProps} tickFormatter={(v: number) => fmtCompact(v)}
                   width={56} unit=" L" />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as {
                  label: string; water_mm: number; water_l: number; kc: number;
                  days: number; elapsed_days: number; status: string;
                  root_depth_m: number;
                };
                return (
                  <div className="glass-strong !rounded-xl px-3 py-2 text-xs">
                    <div className="mb-1 font-medium text-ink">{r.label}</div>
                    <div className="flex justify-between gap-4">
                      <span className="text-mist/70">Duration</span>
                      <span className="font-mono">{r.days} days</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-mist/70">Crop coefficient Kc</span>
                      <span className="font-mono">{r.kc}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-mist/70">Est. water demand</span>
                      <span className="font-mono text-leaf-700">
                        {r.water_mm} mm · {fmtLitresShort(r.water_l)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-mist/70">Root depth</span>
                      <span className="font-mono">{r.root_depth_m} m</span>
                    </div>
                    <div className="mt-1.5 border-t border-line/70 pt-1.5
                                    uppercase tracking-wide text-[10px]
                                    text-mist/75">
                      {r.status} · {Math.round(r.elapsed_days)}/{r.days} days elapsed
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="water_l" radius={[5, 5, 0, 0]} maxBarSize={64}>
              {rows.map((r) => (
                <Cell
                  key={r.index}
                  fill={r.isCurrent ? C.saved : r.status === "completed" ? C.ai : C.grid}
                  fillOpacity={r.isCurrent ? 0.95 : r.status === "completed" ? 0.45 : 0.9}
                  stroke={r.isCurrent ? C.predicted : "transparent"}
                  strokeWidth={r.isCurrent ? 1.5 : 0}
                />
              ))}
              <LabelList
                dataKey="water_l"
                position="top"
                formatter={(v: number) => fmtCompact(Number(v))}
                style={{ fill: "rgba(101,89,75,0.9)", fontSize: 10 }}
              />
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-5">
        {life.stages.map((s) => {
          const isCurrent = s.index === life.stage_index;
          return (
            <div
              key={s.index}
              className={`rounded-lg border px-2.5 py-2 text-[11px] ${
                isCurrent
                  ? "border-leaf-400/50 bg-leaf-500/10 text-ink"
                  : s.index < life.stage_index
                    ? "border-line/60 bg-night/40 text-mist/75"
                    : "border-line/40 bg-night/30 text-mist/65"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{s.name.replace("Fruiting / Grain Filling", "Fill")}</span>
                {isCurrent && <span className="text-leaf-600">◀ now</span>}
              </div>
              <div className="mt-0.5 font-mono text-[10px] opacity-80">
                {s.water_mm} mm · Kc {s.kc}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-mist/70">
        {life.limitation} ETo used: {life.eto_mm_day} mm/day ({life.eto_source}).
      </p>
    </div>
  );
}
