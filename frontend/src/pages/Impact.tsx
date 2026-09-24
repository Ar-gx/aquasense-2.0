import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../services/api";
import { useFarm } from "../context/FarmContext";
import PageHeader from "../components/ui/PageHeader";
import { Card, CountUp, Note, Skeleton, SourceChip } from "../components/ui/primitives";
import { fmtLitresShort, pct } from "../lib/format";

interface ImpactData {
  available: boolean;
  farm_area_ha?: number;
  water_saved_per_ha_l?: number;
  water_saved_total_l?: number;
  reduction_pct?: number;
  irrigation_efficiency_pct?: number;
  crop_water_adequacy_pct?: number | null;
  rainwater_conserved_l?: number;
  basis?: string;
  note?: string;
}

export default function Impact() {
  const { dashboard } = useFarm();
  const [impact, setImpact] = useState<ImpactData | null>(null);
  const [loading, setLoading] = useState(true);

  // calculator
  const [baseline, setBaseline] = useState("");
  const [ai, setAi] = useState("");
  const [area, setArea] = useState("");
  const [result, setResult] = useState<{
    baseline_total_l: number; ai_total_l: number; water_saved_l: number;
    reduction_pct: number | null; negative_savings: boolean;
    interpretation: string; errors: string[];
  } | null>(null);
  const [calcErr, setCalcErr] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getImpact()
      .then((d) => setImpact(d as ImpactData))
      .catch(() => setImpact({ available: false }))
      .finally(() => setLoading(false));
  }, [dashboard?.generated_at]);

  // prefill from current farm when available
  useEffect(() => {
    const s = dashboard?.water_analytics.summary;
    if (!s) return;
    if (!baseline) setBaseline(String(Math.round(s.baseline_per_ha_l)));
    if (!ai) setAi(String(Math.round(s.ai_per_ha_l)));
    if (!area && dashboard.farm.area_ha) setArea(String(dashboard.farm.area_ha));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard?.generated_at]);

  const calc = async () => {
    if (!baseline || !ai || !area) return;
    setCalculating(true);
    setCalcErr(null);
    try {
      const r = await api.calculator({
        baseline_per_ha_l: Number(baseline),
        ai_per_ha_l: Number(ai),
        area_ha: Number(area),
      });
      setResult(r);
    } catch (e) {
      setCalcErr(String((e as Error)?.message ?? e));
      setResult(null);
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Solution 05 · Impact"
        title="Every Drop Counts"
        sub="Model-scenario impact from the analysed farm — each figure labelled with"
        actions={
          <>
            {impact?.available && (
              <SourceChip source="estimated" label={impact.basis} />
            )}
            <Link to="/achievements" className="btn-ghost !py-1.5 text-xs">
              Achievements →
            </Link>
          </>
        }
      />

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : impact?.available ? (
        <>
          {/* impact numbers */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Big label="Water saved (30-day window)"
                 value={<CountUp value={impact.water_saved_total_l ?? 0}
                                 format={fmtLitresShort} />}
                 tone="text-leaf-600" />
            <Big label="Per hectare saved"
                 value={<CountUp value={impact.water_saved_per_ha_l ?? 0}
                                 format={fmtLitresShort} />}
                 tone="text-leaf-700" />
            <Big label="Reduction vs traditional"
                 value={<CountUp value={impact.reduction_pct ?? 0}
                                 format={(v) => pct(v, 1)} />}
                 tone={impact.reduction_pct != null && impact.reduction_pct < 0
                   ? "text-alert-600" : "text-aqua-600"} />
            <Big label="Rainwater utilised (separate)"
                 value={<CountUp value={impact.rainwater_conserved_l ?? 0}
                                 format={fmtLitresShort} />}
                 tone="text-aqua-600" />
          </div>

          {/* basis / honesty */}
          <div className="glass-strong flex flex-wrap items-start justify-between
                          gap-4 p-5">
            <div className="max-w-2xl">
              <div className="text-[11px] uppercase tracking-wider text-mist/75">
                Basis
              </div>
              <p className="mt-1 text-sm leading-relaxed text-mist/85">
                {impact.basis}
              </p>
            </div>
            <div className="flex gap-6 text-center">
              <div>
                <div className="font-display text-2xl font-semibold text-warn-700">
                  {impact.irrigation_efficiency_pct}%
                </div>
                <div className="text-[10px] uppercase tracking-wider text-mist/70">
                  AI efficiency
                </div>
              </div>
              <div>
                <div className="font-display text-2xl font-semibold text-leaf-700">
                  {impact.crop_water_adequacy_pct != null
                    ? `${Math.round(impact.crop_water_adequacy_pct)}%` : "—"}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-mist/70">
                  crop water adequacy
                </div>
              </div>
              <div>
                <div className="font-display text-2xl font-semibold text-aqua-600">
                  {impact.farm_area_ha ?? "—"} ha
                </div>
                <div className="text-[10px] uppercase tracking-wider text-mist/70">
                  analysed area
                </div>
              </div>
            </div>
          </div>

          <Note tone="warn">
            These are model scenarios from the Demo Farm's recorded/simulated
            schedule and live weather — not metered field results, not a yield
            forecast, not a claim about your farm. Crop water adequacy is the
            modelled share of crop water need met by the AI plan. Rainwater
            utilisation is reported separately from irrigation savings to avoid
            double counting.
          </Note>
        </>
      ) : (
        <Note tone="info">
          No farm analysed yet — load the Demo Farm (top nav) to generate these
          numbers from the live model, or{" "}
          <Link to="/analyze" className="underline">analyze your own farm</Link>.
          The calculator below works without any farm.
        </Note>
      )}

      {/* water calculator */}
      <Card className="!p-5">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="card-title">Water-savings calculator</span>
          <SourceChip source="illustrative_comparison"
                      label="your inputs" />
        </div>
        <p className="text-xs text-mist/65">
          Try any scenario — e.g. compare your pump bills before/after switching
          methods. Negative results are reported honestly.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Baseline use (L/ha)</label>
            <input className="field" inputMode="numeric" value={baseline}
                   placeholder="e.g. 5000000"
                   onChange={(e) => setBaseline(e.target.value)} />
          </div>
          <div>
            <label className="label">AI / improved use (L/ha)</label>
            <input className="field" inputMode="numeric" value={ai}
                   placeholder="e.g. 2700000"
                   onChange={(e) => setAi(e.target.value)} />
          </div>
          <div>
            <label className="label">Farm area (ha)</label>
            <input className="field" inputMode="decimal" value={area}
                   placeholder="e.g. 2.5"
                   onChange={(e) => setArea(e.target.value)} />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button onClick={calc}
                  disabled={calculating || !baseline || !ai || !area}
                  className="btn-primary disabled:opacity-50">
            {calculating ? "Calculating…" : "Calculate savings"}
          </button>
          {calcErr && <span className="text-xs text-alert-600">{calcErr}</span>}
        </div>

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-xl border border-line/70 bg-night/40 p-4"
          >
            <div className="grid gap-3 text-center sm:grid-cols-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-mist/70">
                  Baseline total
                </div>
                <div className="font-mono text-base text-alert-600/90">
                  {fmtLitresShort(result.baseline_total_l)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-mist/70">
                  Improved total
                </div>
                <div className="font-mono text-base text-aqua-600">
                  {fmtLitresShort(result.ai_total_l)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-mist/70">
                  Difference
                </div>
                <div className={`font-mono text-base ${
                  result.negative_savings ? "text-alert-600" : "text-leaf-600"}`}>
                  {fmtLitresShort(result.water_saved_l)}
                  {result.reduction_pct != null &&
                    <span className="ms-2 text-sm">
                      ({result.negative_savings ? "+" : "−"}
                      {Math.abs(result.reduction_pct).toFixed(1)}%)
                    </span>}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-mist/75">
              {result.interpretation}
            </p>
            {result.errors.length > 0 && (
              <p className="mt-1.5 text-[11px] text-warn-600">
                {result.errors.join(" ")}
              </p>
            )}
          </motion.div>
        )}
      </Card>

      {/* broader impact */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="!p-5">
          <span className="card-title">💧 Water</span>
          <p className="mt-2 text-xs leading-relaxed text-mist/75">
            Agriculture uses ~89% of India&rsquo;s water withdrawals (FAO
            AQUASTAT reference). Cutting wasteful irrigation while keeping crop
            water adequacy is the highest-leverage save available on most farms.
          </p>
          <SourceChip source="historical_dataset" label="FAO AQUASTAT" />
        </Card>
        <Card className="!p-5">
          <span className="card-title">🌱 Soil</span>
          <p className="mt-2 text-xs leading-relaxed text-mist/75">
            Right-sizing irrigations prevents waterlogging and nutrient leaching
            — two of the quietest causes of soil degradation on irrigated land.
            Legume rotation credits are modelled per season.
          </p>
          <SourceChip source="estimated" label="agronomy ranges" />
        </Card>
        <Card className="!p-5">
          <span className="card-title"> farmer agency</span>
          <p className="mt-2 text-xs leading-relaxed text-mist/75">
            Every figure exposes its source, so farmers and extension workers can
            challenge the model instead of trusting it blindly — and &ldquo;I
            don&rsquo;t know&rdquo; remains a first-class input everywhere.
          </p>
          <SourceChip source="user_supplied" label="by design" />
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/water-analytics" className="btn-primary">Water analytics →</Link>
        <Link to="/achievements" className="btn-ghost">Achievements</Link>
        <Link to="/data" className="btn-ghost">Data transparency</Link>
      </div>
    </div>
  );
}

function Big({ label, value, tone }: {
  label: string; value: ReactNode; tone: string;
}) {
  return (
    <div className="glass-strong p-5">
      <div className="text-[11px] uppercase tracking-wider text-mist/75">{label}</div>
      <div className={`mt-1 font-display text-3xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}
