import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useFarm } from "../context/FarmContext";
import { api } from "../services/api";
import type { WaterAnalytics as WaterAnalyticsT } from "../lib/types";
import PageHeader from "../components/ui/PageHeader";
import ComparisonChart from "../components/charts/ComparisonChart";
import WaterUsageChart from "../components/charts/WaterUsageChart";
import { Card, EmptyFarm, Note, Skeleton, SourceChip } from "../components/ui/primitives";
import { fmtLitresShort, fmtL, pct, safeDiv } from "../lib/format";

export default function WaterAnalyticsPage() {
  const { dashboard, farmId, loadDemo } = useFarm();
  const [wa, setWa] = useState<WaterAnalyticsT | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!farmId) { setLoading(false); return; }
    let dead = false;
    setLoading(true);
    api.getWaterAnalytics(farmId, "daily", 30)
      .then((p) => { if (!dead) setWa(p); })
      .catch((e) => { if (!dead) setError(String(e?.message ?? e)); })
      .finally(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
  }, [farmId, dashboard?.generated_at]);

  if (!dashboard && !loading) {
    return (
      <EmptyFarm action={
        <button onClick={() => loadDemo().catch(() => undefined)}
                className="btn-primary">▶ Try Demo Farm</button>
      } />
    );
  }

  const data = wa ?? dashboard?.water_analytics;
  const s = data?.summary;
  const area = dashboard?.farm.area_ha ?? 1;

  if (loading && !data) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (!data || !s) {
    return <Note tone="warn">Water analytics unavailable — is the backend running?</Note>;
  }

  // total reduction includes rainwater credit (kept separate from irrigation savings)
  const rainwater = s.rainwater_conserved_l;
  const irrigationSaved = s.saved_l;
  const combinedSaved = irrigationSaved + rainwater;
  const totalReductionPct = s.saved_pct; // server: (saved + rainwater) / baseline

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Solution 05 · Water Analytics"
        title="Traditional vs AquaSense — the honest ledger"
        sub="Water Saved = Baseline − AI. Negative savings stay negative."
        actions={
          <>
            <SourceChip source={s.source} label={s.label} />
            <Link to="/impact" className="btn-ghost !py-1.5 text-xs">
              Impact & calculator →
            </Link>
          </>
        }
      />

      {/* headline comparison */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Big label="Baseline (30 days)" value={fmtLitresShort(s.baseline_total_l)}
             tone="text-alert-600/90"
             sub={`${fmtLitresShort(s.baseline_per_ha_l)}/ha · flood ${pct(s.irrigation_efficiency_baseline * 100, 0)} eff`} />
        <Big label="AI-recommended (30 days)" value={fmtLitresShort(s.ai_total_l)}
             tone="text-aqua-600"
             sub={`${fmtLitresShort(s.ai_per_ha_l)}/ha${
               s.irrigation_efficiency_ai != null
                 ? ` · eff ${pct(s.irrigation_efficiency_ai * 100, 0)}` : ""}`} />
        <Big label="Irrigation water saved" value={fmtLitresShort(irrigationSaved)}
             tone={s.negative_savings ? "text-alert-600" : "text-leaf-600"}
             sub={`${fmtLitresShort(s.saved_per_ha_l)}/ha — engine savings only`} />
        <Big label="Rainwater utilised (separate)" value={fmtLitresShort(rainwater)}
             tone="text-aqua-600"
             sub="days the AI skipped because rain covered the deficit" />
      </div>

      {/* reduction statement */}
      <div className="glass-strong flex flex-wrap items-center justify-between
                      gap-4 p-5">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-mist/75">
            Total reduction vs traditional schedule
          </div>
          <div className={`font-display text-4xl font-bold ${
            totalReductionPct < 0 ? "text-alert-600" : "text-leaf-600"}`}>
            {totalReductionPct > 0 ? "−" : "+"}{Math.abs(totalReductionPct).toFixed(1)}%
          </div>
          <div className="mt-1 text-xs text-mist/65">
            = irrigation savings {fmtLitresShort(irrigationSaved)}{" "}
            <span className="text-mist/65">(engine)</span> + rainwater{" "}
            {fmtLitresShort(rainwater)}{" "}
            <span className="text-mist/65">(skipped irrigations)</span>{" "}
            over a {fmtLitresShort(s.baseline_total_l)} baseline
          </div>
        </div>
        <div className="max-w-md text-xs leading-relaxed text-mist/70">
          <strong className="text-warn-600">No double counting:</strong> the same
          litre is never counted as both an irrigation saving and a rainwater
          conservation. Rainwater-credited days contribute{" "}
          <span className="font-mono text-leaf-700">0 L</span> to{" "}
          <span className="font-mono">saved_l</span>; they appear only in{" "}
          <span className="font-mono">rainwater_l</span>.
        </div>
      </div>

      {/* comparison chart */}
      <Card className="!p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="card-title">Per-hectare & whole-farm comparison</span>
          <SourceChip source={s.source} label="model scenario" />
        </div>
        <ComparisonChart
          baselinePerHa={s.baseline_per_ha_l}
          aiPerHa={s.ai_per_ha_l}
          baselineTotal={s.baseline_total_l}
          aiTotal={s.ai_total_l}
          savedPerHa={s.saved_per_ha_l}
          savedTotal={irrigationSaved}
          reductionPct={totalReductionPct}
        />
      </Card>

      {/* usage chart */}
      <Card className="!p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="card-title">Usage over time</span>
          <span className="text-[11px] text-mist/70">
            switch daily / weekly / monthly / crop-cycle on the chart
          </span>
        </div>
        <WaterUsageChart daily={data.daily} series={data.series ?? data.daily} />
      </Card>

      {/* efficiency + assumptions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="!p-5">
          <span className="card-title">Irrigation efficiency</span>
          <div className="mt-4 space-y-3">
            <EffBar label="Baseline (traditional method)"
                    value={s.irrigation_efficiency_baseline}
                    tone="from-alert-500 to-alert-400" />
            <EffBar label="AI-recommended (post-upgrade)"
                    value={s.irrigation_efficiency_ai ?? s.irrigation_efficiency_baseline}
                    tone="from-leaf-500 to-leaf-300" />
          </div>
          {s.efficiency_improvement_pct != null && (
            <p className="mt-3 text-xs text-leaf-600">
              +{s.efficiency_improvement_pct} percentage points from applying the
              same volume more precisely (and suggesting method upgrades).
            </p>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-mist/75">
            Efficiency = share of applied water reaching the root zone (method
            reference: flood 45% → drip 90%). It changes how much net water the
            crop gets, not the water you pump for free.
          </p>
        </Card>

        <Card className="!p-5">
          <span className="card-title">Assumptions behind these numbers</span>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-mist/75">
            <li className="flex gap-2">
              <span className="text-leaf-600">•</span>
              Baseline: flood irrigation every{" "}
              {String(data.interval_days
                ?? Number(dashboard?.recommendation.savings.traditional_interval_days
                  ?? 5))}{" "}
              days at{" "}
              {fmtLitresShort(Number(data.baseline_event_l
                ?? dashboard?.recommendation.savings.traditional_event_l ?? 0))}{" "}
              per event (your recorded schedule or the documented conventional
              default).
            </li>
            <li className="flex gap-2">
              <span className="text-leaf-600">•</span>
              AI replay: independent rain-aware bucket model, minimum 2-day gap,
              trigger at the MAD-based threshold, gross quantity corrected for
              application efficiency.
            </li>
            <li className="flex gap-2">
              <span className="text-leaf-600">•</span>
              Weather: live Open-Meteo/OpenWeather forecast layered on NASA
              POWER history and district rainfall where available.
            </li>
            <li className="flex gap-2">
              <span className="text-warn-600">•</span>
              {s.basis}
            </li>
          </ul>
          {s.negative_savings && (
            <div className="mt-3">
              <Note tone="warn">
                Negative savings detected — the AI plan would use MORE water than
                the baseline in this window (e.g. correcting an underwatered
                crop). The value is reported as-is, never flipped to a fake
                positive.
              </Note>
            </div>
          )}
        </Card>
      </div>

      <Note tone="info">
        {data.note ?? "Figures are a model scenario over a 30-day window, not a"
          + " metered field result. They update every time weather, stage or"
          + " recorded events change."}
      </Note>

      <div className="flex flex-wrap gap-3">
        <Link to="/history" className="btn-primary">Irrigation history →</Link>
        <Link to="/achievements" className="btn-ghost">Achievements</Link>
        <Link to="/irrigation" className="btn-ghost">Irrigation goal</Link>
      </div>
    </div>
  );
}

function Big({ label, value, tone, sub }: {
  label: string; value: string; tone: string; sub: string;
}) {
  return (
    <div className="glass p-4">
      <div className="text-[11px] uppercase tracking-wider text-mist/75">{label}</div>
      <div className={`mt-1 font-display text-2xl font-semibold ${tone}`}>{value}</div>
      <div className="mt-1 text-[11px] leading-snug text-mist/70">{sub}</div>
    </div>
  );
}

function EffBar({ label, value, tone }: {
  label: string; value: number; tone: string;
}) {
  const pctV = Math.round(value * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-mist/70">{label}</span>
        <span className="font-mono text-ink">{pctV}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-night">
        <div className={`h-full rounded-full bg-gradient-to-r ${tone}`}
             style={{ width: `${pctV}%` }} />
      </div>
    </div>
  );
}
