import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useFarm } from "../context/FarmContext";
import { api } from "../services/api";
import type { AchievementItem, WaterSummary } from "../lib/types";
import AdvancedInfo from "../components/ui/AdvancedInfo";
import PageHeader from "../components/ui/PageHeader";
import AchievementChart from "../components/charts/AchievementChart";
import { Card, CountUp, EmptyFarm, Note, Skeleton, SourceChip } from "../components/ui/primitives";
import { fmtLitresShort, pct } from "../lib/format";

interface AchievementsPayload {
  metrics: AchievementItem[];
  water_summary: WaterSummary;
  note: string;
}

function fmtMetric(a: AchievementItem): string {
  if (a.unit === "%") return pct(a.value, 1);
  if (a.unit === "L" || a.unit === "L/ha") return fmtLitresShort(a.value);
  if (a.unit === "ratio") return `${a.value.toFixed(2)}`;
  return `${Math.round(a.value)} ${a.unit}`;
}

const ICONS: Record<string, string> = {
  total_water_saved_l: "💧",
  total_water_conserved_l: "💧",
  irrigation_water_saved_l: "🚿",
  rainwater_conserved_l: "🌧",
  irrigation_efficiency_pct: "⚡",
  crop_water_adequacy_pct: "🌱",
  reduction_pct: "📉",
  water_savings_pct: "📉",
};

export default function Achievements() {
  const { dashboard, farmId, loadDemo } = useFarm();
  const [data, setData] = useState<AchievementsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!farmId) { setLoading(false); return; }
    let dead = false;
    setLoading(true);
    api.getAchievements(farmId)
      .then((p) => {
        if (dead) return;
        setData(p);
        const firstWithHistory = p.metrics.find((m) => m.history?.length);
        setSelected(firstWithHistory?.metric ?? p.metrics[0]?.metric ?? null);
      })
      .catch(() => { if (!dead) setData(null); })
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

  if (loading && !data) return <Skeleton className="h-96 w-full" />;
  if (!data) {
    return <Note tone="warn">Achievements unavailable — is the backend running?</Note>;
  }

  const s = data.water_summary;
  const active = data.metrics.find((m) => m.metric === selected) ?? data.metrics[0];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Solution 08 · Achievements"
        title="Every Drop Counts — tracked honestly"
        sub="Cumulative savings, efficiency and crop-water-adequacy with the exact"
        actions={
          <>
            <SourceChip source={s.source} label={s.label} />
            <Link to="/water-analytics" className="btn-ghost !py-1.5 text-xs">
              Water analytics →
            </Link>
          </>
        }
      />

      {/* hero cumulative numbers */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Hero label="Cumulative water saved"
              value={fmtLitresShort(s.saved_l)} tone="text-leaf-600"
              sub="baseline − AI (irrigation only)" />
        <Hero label="Rainwater utilised"
              value={fmtLitresShort(s.rainwater_conserved_l)} tone="text-aqua-600"
              sub="separate bucket — never double-counted" />
        <Hero label="Reduction vs traditional"
              value={`${s.negative_savings ? "+" : "−"}${Math.abs(s.saved_pct).toFixed(1)}%`}
              tone={s.negative_savings ? "text-alert-600" : "text-leaf-600"}
              sub="(saved + rainwater) / baseline" />
        <Hero label="Irrigation efficiency"
              value={`${Math.round((s.irrigation_efficiency_ai
                ?? s.irrigation_efficiency_baseline) * 100)}%`}
              tone="text-warn-700"
              sub={`baseline ${Math.round(s.irrigation_efficiency_baseline * 100)}%`} />
      </div>

      {/* metric cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.metrics.map((m, i) => {
          const isActive = m.metric === selected;
          return (
            <button
              key={m.metric}
              onClick={() => setSelected(m.metric)}
              className={`glass p-4 text-start transition hover:-translate-y-1 ${
                isActive ? "!border-leaf-400/60 shadow-glow" : ""}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wider text-mist/75">
                  {ICONS[m.metric] ?? "🏅"} {m.label}
                </span>
                <SourceChip source={m.source} />
              </div>
              <div className="mt-1.5 font-display text-2xl font-semibold text-ink">
                <CountUp value={m.value}
                         format={() => fmtMetric(m)} />
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-mist/75">
                {m.note}
              </p>
            </button>
          );
        })}
      </div>

      <AdvancedInfo hint="trend chart & technical detail">
        {/* chart of selected metric */}
        {active && (
          <Card accent="sand" className="!p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="card-title">
                Cumulative trend — {active.label}
              </span>
              <span className="text-[11px] text-mist/70">
                two buckets: irrigation savings (green) &amp; rainwater (blue)
              </span>
            </div>
            <AchievementChart metric={active} />
          </Card>
        )}
      </AdvancedInfo>

      {/* honesty */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Note tone="info">{data.note}</Note>
        <Note tone="warn">
          Savings are model scenarios computed from recorded/simulated data and
          live weather — they are not metered field results. Crop water adequacy
          (% of crop water need met) is a coverage ratio from the model, not a
          yield or revenue forecast.
        </Note>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/impact" className="btn-primary">Broader impact →</Link>
        <Link to="/history" className="btn-ghost">Irrigation history</Link>
        <Link to="/connect" className="btn-ghost">NGO connections</Link>
      </div>
    </div>
  );
}

function Hero({ label, value, tone, sub }: {
  label: string; value: string; tone: string; sub: string;
}) {
  return (
    <div className="glass-strong p-5">
      <div className="text-[11px] uppercase tracking-wider text-mist/75">{label}</div>
      <div className={`mt-1 font-display text-3xl font-bold ${tone}`}>{value}</div>
      <div className="mt-1 text-[11px] text-mist/70">{sub}</div>
    </div>
  );
}
