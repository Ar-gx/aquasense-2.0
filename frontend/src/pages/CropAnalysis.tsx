import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useFarm } from "../context/FarmContext";
import { api } from "../services/api";
import type { StageInfo } from "../lib/types";
import PageHeader from "../components/ui/PageHeader";
import LifecycleWaterChart from "../components/charts/LifecycleWaterChart";
import { Card, EmptyFarm, Note, ProgressBar, Skeleton, SourceChip } from "../components/ui/primitives";
import { fmtLitresShort, fmtL, pct } from "../lib/format";

const DEMAND_TONE: Record<string, string> = {
  low: "text-aqua-600",
  rising: "text-warn-600",
  peak: "text-alert-600",
  high: "text-warn-600",
  falling: "text-leaf-600",
};

export default function CropAnalysis() {
  const { dashboard, loadDemo, farmId } = useFarm();
  const [stageInfo, setStageInfo] = useState<StageInfo[]>([]);

  useEffect(() => {
    api.getCrops()
      .then((r) => setStageInfo(r.stages ?? []))
      .catch(() => setStageInfo([]));
  }, []);

  if (!dashboard) {
    return (
      <EmptyFarm action={
        <button onClick={() => loadDemo().catch(() => undefined)}
                className="btn-primary">▶ Try Demo Farm</button>
      } />
    );
  }

  const life = dashboard.crop_lifecycle;
  const reco = dashboard.recommendation;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Solution 01 · Crop Analysis"
        title={`${life.crop} — lifecycle water budget`}
        sub={`Day ${life.day_of_cycle} of ${life.lifespan_days} ·
              ${life.growth_stage} stage · harvest in ~${life.days_until_harvest} days`}
        actions={
          <>
            <span className="chip src-estimated">Kc × ETo model</span>
            <Link to="/irrigation" className="btn-ghost !py-1.5 text-xs">
              Irrigation goal →
            </Link>
          </>
        }
      />

      {/* headline numbers */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total cycle water need"
                value={`${fmtLitresShort(life.total_water_req_l)}`}
                sub={`${life.total_water_req_mm} mm across ${life.lifespan_days} days`} />
        <Metric label="Required to date"
                value={fmtLitresShort(life.cumulative_required_l)}
                sub={`${life.cumulative_required_mm} mm · ${life.progress_pct}% of cycle`} />
        <Metric label="Remaining need"
                value={fmtLitresShort(life.remaining_water_req_l)}
                sub={`${life.remaining_water_req_mm} mm · avg ${fmtLitresShort(life.avg_daily_remaining_l)}/day`} />
        <Metric label="Recorded irrigation (so far)"
                value={fmtLitresShort(life.recorded_irrigation_l)}
                sub="farmer-recorded events — kept separate from estimates"
                tone="text-aqua-600" />
      </div>

      <Note tone="info">
        <strong>Estimate vs record:</strong> required water is a model estimate
        (Kc × reference ETo × stage days × farm area); recorded irrigation comes
        from logged events. The difference ({fmtLitresShort(life.cumulative_required_vs_recorded_l)}) is
        a comparison of two different kinds of numbers — not a measured deficit.{" "}
        {life.limitation}
      </Note>

      {/* lifecycle chart */}
      <Card className="!p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="card-title">Water demand by growth stage</span>
          <div className="flex items-center gap-2">
            <SourceChip source="estimated" label="FAO-56 style estimate" />
            <span className="text-[11px] text-mist/70">
              ETo {life.eto_mm_day} mm/day · {life.eto_source}
            </span>
          </div>
        </div>
        <LifecycleWaterChart life={life} />
      </Card>

      {/* stage progression detail */}
      <Card className="!p-0 overflow-hidden">
        <div className="border-b border-line/70 px-5 py-3.5">
          <span className="card-title">Stage-by-stage detail</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-mist/70">
                <th className="px-5 py-2 text-start font-medium">Stage</th>
                <th className="px-3 py-2 text-start font-medium">Days</th>
                <th className="px-3 py-2 text-start font-medium">Kc</th>
                <th className="px-3 py-2 text-start font-medium">Root depth</th>
                <th className="px-3 py-2 text-start font-medium">Allow. depletion</th>
                <th className="px-3 py-2 text-start font-medium">Water need</th>
                <th className="px-5 py-2 text-start font-medium">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/50">
              {life.stages.map((s) => {
                const isCurrent = s.index === life.stage_index;
                return (
                  <tr key={s.index}
                      className={`${isCurrent ? "bg-leaf-500/10" : ""} hover:bg-night/50`}>
                    <td className="px-5 py-2.5">
                      <span className={isCurrent ? "font-medium text-leaf-700"
                                                 : "text-mist/80"}>
                        {s.name}{isCurrent && <span className="ms-1.5 text-[10px]
                                                                text-leaf-600">◀ now</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-mist/70">
                      {s.start_day}–{s.end_day}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-mist/70">{s.kc}</td>
                    <td className="px-3 py-2.5 font-mono text-mist/70">
                      {s.root_depth_m} m
                    </td>
                    <td className="px-3 py-2.5 font-mono text-mist/70">
                      {Math.round(s.mad * 100)}%
                    </td>
                    <td className="px-3 py-2.5 font-mono text-leaf-700">
                      {s.water_mm} mm · {fmtLitresShort(s.water_l)}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="w-28">
                        <ProgressBar
                          value={s.index < life.stage_index ? 100
                            : isCurrent ? life.stage_progress_pct : 0}
                          height="h-1.5" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line/60 px-5 py-2.5 text-[10px] text-mist/65">
          Kc values are FAO-56 style reference crop coefficients (historical
          dataset) — actual field demand varies with local climate, soil and
          irrigation uniformity.
        </p>
      </Card>

      {/* why demand changes */}
      <Card className="!p-5">
        <span className="card-title">Why water demand changes</span>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {(stageInfo.length ? stageInfo : []).map((s) => {
            const name = s.name ?? s.stage ?? "";
            const isCurrent = name === life.growth_stage;
            return (
              <div key={name}
                   className={`rounded-xl border p-3 text-xs ${
                     isCurrent ? "border-leaf-400/50 bg-leaf-500/10"
                               : "border-line/60 bg-night/40"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">{name}</span>
                  <span className={`text-[10px] uppercase tracking-wide
                                    ${DEMAND_TONE[s.demand] ?? "text-mist/75"}`}>
                    {s.demand}
                  </span>
                </div>
                <p className="mt-1.5 leading-relaxed text-mist/70">{s.note}</p>
              </div>
            );
          })}
          {stageInfo.length === 0 && (
            <p className="text-xs text-mist/70">
              Stage explanations load from /api/v1/crops (FAO reference data).
            </p>
          )}
        </div>
      </Card>

      {/* current stage card */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="!p-5">
          <span className="card-title">Current stage focus</span>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="font-display text-2xl font-semibold text-ink">
              {life.growth_stage}
            </span>
            <span className="font-mono text-sm text-mist/75">
              {pct(life.stage_progress_pct)} through stage
            </span>
          </div>
          <div className="mt-3">
            <ProgressBar value={life.stage_progress_pct} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-line/60 bg-night/40 p-3">
              <div className="text-[10px] uppercase tracking-wider text-mist/70">
                Stage Kc
              </div>
              <div className="font-mono text-base text-leaf-700">
                {reco.stage_kc}
              </div>
            </div>
            <div className="rounded-lg border border-line/60 bg-night/40 p-3">
              <div className="text-[10px] uppercase tracking-wider text-mist/70">
                Active root depth
              </div>
              <div className="font-mono text-base text-leaf-700">
                {reco.root_depth_m} m
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-mist/75">
            Stage derived from sowing date ({life.sowing_date}) + crop reference
            calendar {dashboard.farm.growth_stage
              ? `(user confirmed: ${dashboard.farm.growth_stage})`
              : "(no user confirmation supplied)"}. Water is most
            sensitive at flowering — stress there hits yield hardest.
          </p>
        </Card>

        <Card className="!p-5">
          <span className="card-title">Reference yield benchmark</span>
          <div className="mt-3 font-display text-3xl font-semibold text-warn-700">
            {dashboard.yield_reference.benchmark_yield_t_ha != null
              ? `${dashboard.yield_reference.benchmark_yield_t_ha} t/ha`
              : "—"}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-mist/70">
            {dashboard.yield_reference.note}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SourceChip source={dashboard.yield_reference.source}
                        label={dashboard.yield_reference.source_label} />
            <span className="chip src-rule">
              {dashboard.yield_reference.source_label.includes("NASS")
                ? "US benchmark, not local"
                : "reference only"}
            </span>
          </div>
          <Note tone="warn">
            This is a published national benchmark for context only — it is
            never presented as your expected or guaranteed yield.
          </Note>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/irrigation" className="btn-primary">Set irrigation goal →</Link>
        <Link to="/soil-health" className="btn-ghost">Soil & nutrients</Link>
        <Link to="/water-analytics" className="btn-ghost">Water analytics</Link>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, tone = "text-ink" }: {
  label: string; value: string; sub: string; tone?: string;
}) {
  return (
    <div className="glass p-4">
      <div className="text-[11px] uppercase tracking-wider text-mist/75">{label}</div>
      <div className={`mt-1 font-display text-xl font-semibold ${tone}`}>{value}</div>
      <div className="mt-1 text-[11px] leading-snug text-mist/70">{sub}</div>
    </div>
  );
}
