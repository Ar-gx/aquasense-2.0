import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useFarm } from "../context/FarmContext";
import { api } from "../services/api";
import type { PredictPayload } from "../lib/types";
import PageHeader from "../components/ui/PageHeader";
import OptimalPlanCard from "../components/dashboard/OptimalPlanCard";
import AlertsPanel from "../components/dashboard/AlertsPanel";
import DataStatusPanel from "../components/dashboard/DataStatusPanel";
import MoistureForecastChart from "../components/charts/MoistureForecastChart";
import RainVsIrrigationChart from "../components/charts/RainVsIrrigationChart";
import WaterUsageChart from "../components/charts/WaterUsageChart";
import LifecycleWaterChart from "../components/charts/LifecycleWaterChart";
import { Card, CountUp, EmptyFarm, Note, Skeleton, SourceChip, Stripe } from "../components/ui/primitives";
import { fmtLitresShort, fmtL, pct } from "../lib/format";

export default function Dashboard() {
  const { dashboard, farm, loading, error, refresh, loadDemo, farmId } = useFarm();
  const [predict, setPredict] = useState<PredictPayload | null>(null);
  const [predicting, setPredicting] = useState(false);

  // run the real ML prediction endpoint when the dashboard is ready
  useEffect(() => {
    if (!farmId) { setPredicting(false); return; }
    let cancelled = false;
    setPredicting(true);
    api.runPredict(farmId)
      .then((p) => { if (!cancelled) setPredict(p); })
      .catch(() => { if (!cancelled) setPredict(null); })
      .finally(() => { if (!cancelled) setPredicting(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId, dashboard?.generated_at]);

  if (loading && !dashboard) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="space-y-4">
        {error && (
          <Note tone="warn">
            Could not load farm data: {error}. Is the backend running on
            port 8000?
          </Note>
        )}
        <EmptyFarm
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <button onClick={() => loadDemo().catch(() => undefined)}
                      className="btn-primary">▶ Try Demo Farm</button>
              <Link to="/analyze" className="btn-ghost">Analyze My Farm</Link>
              <button onClick={() => refresh()} className="btn-ghost">Retry</button>
            </div>
          }
        />
      </div>
    );
  }

  const d = dashboard;
  const reco = d.recommendation;
  const wa = d.water_analytics;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={farm?.is_demo ? "Demo Farm" : "My Farm"}
        title={farm?.name ?? "Dashboard"}
        sub={`${d.farm.crop_name === "other"
          ? d.farm.custom_crop_name ?? "Other crop"
          : d.farm.crop_name.charAt(0).toUpperCase() + d.farm.crop_name.slice(1)}`}
        actions={
          <>
            <span className="chip src-rule">
              {[d.farm.taluk, d.farm.state].filter(Boolean).join(", ") ||
               "location not set"}
            </span>
            <span className="chip src-estimated">
              {d.growth_stage} · day {d.crop_lifecycle.day_of_cycle}/
              {d.crop_lifecycle.lifespan_days}
            </span>
            <button onClick={() => refresh()} className="btn-ghost !py-1.5 text-xs">
              ↻ Re-run analysis
            </button>
          </>
        }
      />

      {/* hero plan */}
      <OptimalPlanCard d={d} />

      {/* forecast + rain intelligence */}
      <div className="grid gap-5 lg:grid-cols-5">
        <Card accent="aqua" className="lg:col-span-3 !p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="card-title">Soil moisture forecast</span>
            <div className="flex items-center gap-2">
              <SourceChip source={predict?.source ?? "model_prediction"} />
              <Link to="/how-it-works" className="text-[11px] text-mist/70
                                                  hover:text-leaf-600">
                method →
              </Link>
            </div>
          </div>
          {predicting && !predict ? (
            <Skeleton className="h-[300px] w-full" />
          ) : predict ? (
            <MoistureForecastChart
              current={predict.current_moisture_pct ?? reco.soil_moisture_pct}
              trajectory={predict.trajectory}
              thresholds={{
                field_capacity_pct: predict.thresholds.field_capacity_pct,
                wilting_point_pct: predict.thresholds.wilting_point_pct,
                saturation_pct: predict.thresholds.saturation_pct,
                stress_threshold_pct: predict.thresholds.stress_threshold_pct,
              }}
            />
          ) : (
            <div className="grid h-[300px] place-items-center text-xs text-mist/70">
              Prediction unavailable — showing rule-based fallback.
            </div>
          )}
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            {([["24 h", reco.predictions.h24], ["48 h", reco.predictions.h48],
              ["72 h", reco.predictions.h72]] as const).map(([label, v]) => (
              <div key={label} className="rounded-lg border border-line/60
                                          bg-night/40 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-wider text-mist/70">
                  {label}
                </div>
                <div className={`font-mono text-sm ${
                  v <= reco.stress_threshold_pct ? "text-alert-600" : "text-leaf-700"}`}>
                  {v.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-mist/70">
            {predict?.metrics?.data_basis
              ? `Model: ${predict.model_name} — ${predict.metrics.data_basis} basis
                 (MAE ±${predict.metrics.mae_pct_points} % vol). Not field-validated.`
              : "Rule-based water-balance fallback — transparent bucket model."}{" "}
            {predict?.note}
          </p>
        </Card>

        <Card accent="sand" className="lg:col-span-2 !p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="card-title">Rain vs irrigation</span>
            <SourceChip source={d.forecast.source} />
          </div>
          <RainVsIrrigationChart forecast={d.forecast.daily} reco={reco} />
        </Card>
      </div>

      {/* warnings */}
      <AlertsPanel warnings={d.warnings} status={reco.status} />

      {/* water usage + lifecycle */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card accent="aqua" className="!p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="card-title">Water use — 30 days</span>
            <Link to="/water-analytics" className="text-[11px] text-mist/70
                                                    hover:text-leaf-600">
              full analytics →
            </Link>
          </div>
          <WaterUsageChart daily={wa.daily} series={wa.series ?? wa.daily} compact />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Baseline" value={fmtLitresShort(wa.summary.baseline_total_l)}
                      tone="text-alert-600/90" />
            <MiniStat label="AI use" value={fmtLitresShort(wa.summary.ai_total_l)}
                      tone="text-aqua-600" />
            <MiniStat label="Saved (irrigation)" value={fmtLitresShort(wa.summary.saved_l)}
                      tone="text-leaf-600" />
            <MiniStat label="Rainwater (separate)"
                      value={fmtLitresShort(wa.summary.rainwater_conserved_l)}
                      tone="text-aqua-600" />
          </div>
        </Card>

        <Card accent="leaf" className="!p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="card-title">Crop lifecycle water</span>
            <Link to="/crop-analysis" className="text-[11px] text-mist/70
                                                  hover:text-leaf-600">
              full analysis →
            </Link>
          </div>
          <LifecycleWaterChart life={d.crop_lifecycle} />
        </Card>
      </div>

      {/* quick metrics */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {d.achievements.slice(0, 4).map((a, i) => (
          <motion.div key={a.metric}
                      initial={{ opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      className="glass relative p-4">
            <Stripe accent={(["leaf", "aqua", "sand", "soil"] as const)[i % 4]} />
            <div className="text-[11px] text-mist/75">{a.label}</div>
            <div className="mt-1 font-display text-xl font-semibold text-ink">
              <CountUp value={a.value}
                       format={(v) => a.unit === "%"
                         ? pct(v, 1)
                         : a.unit === "L" || a.unit === "L/ha"
                           ? fmtLitresShort(v)
                           : `${Math.round(v)} ${a.unit}`} />
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <SourceChip source={a.source} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* yield reference honesty */}
      <Note tone="info">
        <strong>Yield reference:</strong> {d.yield_reference.note}{" "}
        {d.yield_reference.benchmark_yield_t_ha != null && (
          <span className="font-mono">
            ({d.yield_reference.benchmark_yield_t_ha} t/ha benchmark ·{" "}
            {d.yield_reference.source_label})
          </span>
        )}
      </Note>

      {/* nutrients teaser */}
      <Card accent="soil" className="!p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="card-title">Nutrient replenishment</span>
          <Link to="/soil-health" className="text-[11px] text-mist/70
                                              hover:text-leaf-600">
            full breakdown →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {d.nutrients.legume_recommendations.slice(0, 3).map((l) => (
            <div key={l.key} className="rounded-xl border border-line/70
                                        bg-night/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink">{l.name}</span>
                <span className="font-mono text-xs text-leaf-600">
                  {l.compatibility_pct}%
                </span>
              </div>
              <div className="mt-1 text-[11px] text-mist/75">
                Fixes ~{l.n_fixed_kg_ha} kg N/ha · {l.duration_days} days
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-mist/70">
          {d.nutrients.label}. {d.nutrients.explanation.basis_note}
        </p>
      </Card>

      {/* data status */}
      <DataStatusPanel items={d.data_status} />

      <div className="flex flex-wrap items-center justify-between gap-2
                      text-[11px] text-mist/65">
        <span>
          Engine last run: {new Date(d.generated_at).toLocaleString("en-IN")} ·
          farm #{d.farm.id} · location precision: {d.farm.location_precision}
        </span>
        <span className="flex gap-3">
          <Link to="/settings" className="hover:text-leaf-600">Edit farm</Link>
          <Link to="/history" className="hover:text-leaf-600">Irrigation history</Link>
          <Link to="/achievements" className="hover:text-leaf-600">Achievements</Link>
        </span>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: {
  label: string; value: string; tone: string;
}) {
  return (
    <div className="rounded-lg border border-line/60 bg-night/40 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-mist/70">{label}</div>
      <div className={`font-mono text-sm ${tone}`}>{value}</div>
    </div>
  );
}
