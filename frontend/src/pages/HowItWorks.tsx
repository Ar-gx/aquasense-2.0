import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../services/api";
import PageHeader from "../components/ui/PageHeader";
import { Card, Note, SectionTitle, Skeleton, SourceChip } from "../components/ui/primitives";
import { pct } from "../lib/format";

interface DataSourceRow {
  name: string; kind: string; status: string; needs_key?: boolean;
  granularity?: string; note?: string;
}
interface DataStatusPayload {
  sources: DataSourceRow[];
  ml: {
    model_name: string | null; data_basis: string | null;
    metrics: { mae_pct_points?: number; rmse_pct_points?: number; r2?: number;
      n_samples?: number; test_size?: number; trained_at?: string };
    note: string | null;
    kinds: Record<string, string>;
  };
  savings_kinds: Record<string, string>;
  policy: string;
}

const PIPELINE = [
  { n: "01", title: "Soil conditions", body: "Current root-zone moisture (user-supplied, sensor, or labelled estimate from soil texture + recent rain) with field-capacity / wilting-point / saturation reference bands." },
  { n: "02", title: "Meteorological data", body: "Current weather from OpenWeather → Open-Meteo → simulated fallback; 7-day hourly forecast; NASA POWER daily history; district rainfall from data.gov.in." },
  { n: "03", title: "Crop water demand", body: "FAO-56 style Kc × reference ETo × growth-stage days × farm area → per-stage and cumulative water budget in mm and litres." },
  { n: "04", title: "Soil moisture prediction", body: "Trained XGBoost regressor forecasts +24 h moisture and builds a multi-day trajectory; a transparent rule-based water-balance model takes over if the artifact is missing." },
  { n: "05", title: "Irrigation optimization", body: "12-step hybrid engine: stage-weighted thresholds, MAD, rainfall probability, soil retention, application efficiency, waterlogging check → if/when/how much/what time + confidence." },
  { n: "06", title: "Water savings calculation", body: "Baseline (fixed schedule) replay vs AI (rain-aware) replay. Water Saved = Baseline − AI; negatives stay negative; rainwater days credited separately." },
];

const STEPS = [
  "Read current soil moisture (measured or estimated)",
  "Predict moisture at 24 / 48 / 72 hours (ML)",
  "Apply crop-specific FC / WP / MAD requirements",
  "Weight thresholds by growth stage (flowering = stricter)",
  "Analyse forecast rainfall volume + probability",
  "Estimate crop water deficit in the root zone",
  "Correct for soil type and water retention",
  "Correct gross quantity for application efficiency",
  "Check waterlogging / deep-percolation risk",
  "Decide: is irrigation required at all?",
  "Compute quantity (net + gross, L and L/ha)",
  "Pick timing + explain reasoning + confidence level",
];

export default function HowItWorks() {
  const [ds, setDs] = useState<DataStatusPayload | null>(null);

  useEffect(() => {
    api.getDataStatus()
      .then((d) => setDs(d as unknown as DataStatusPayload))
      .catch(() => setDs(null));
  }, []);

  const m = ds?.ml;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Method"
        title="How AquaSense AI works"
        sub="The analysis overlay animates these exact backend stages — real API"
        actions={<Link to="/data" className="btn-ghost !py-1.5 text-xs">
          Data transparency →
        </Link>}
      />

      {/* core principle */}
      <div className="glass-strong border-leaf-400/40 p-6 text-center">
        <p className="font-display text-xl font-semibold text-ink md:text-2xl">
          &ldquo;Do not irrigate simply because it is time to irrigate.&rdquo;
        </p>
        <p className="mt-2 text-sm text-mist/70">
          Every recommendation starts from actual root-zone need — not a calendar.
        </p>
      </div>

      {/* pipeline */}
      <div>
        <SectionTitle
          eyebrow="Analysis pipeline"
          title="Six stages, executed in sequence"
          sub="These run live when you click Analyze or Try Demo Farm."
        />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {PIPELINE.map((p, i) => (
            <motion.div
              key={p.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.07, duration: 0.5 }}
              className="glass p-5"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg
                                 bg-leaf-500/15 font-mono text-xs text-leaf-600">
                  {p.n}
                </span>
                <h3 className="font-display text-sm font-semibold text-ink">
                  {p.title}
                </h3>
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-mist/75">
                {p.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 12-step engine */}
      <Card accent="leaf" className="!p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="card-title">The 12-step irrigation optimization</span>
          <span className="text-[11px] text-mist/70">
            hybrid ML + rules · every step visible in the recommendation payload
          </span>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-lg
                                    border border-line/60 bg-night/40 px-3 py-2">
              <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center
                               rounded-full border border-leaf-400/40
                               font-mono text-[9px] text-leaf-600">
                {i + 1}
              </span>
              <span className="text-xs leading-snug text-mist/80">{s}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-mist/70">
          Objective: minimise water use while keeping root-zone moisture in the
          healthy band for the current stage — the same objective a farmer has,
          evaluated every run instead of every few days.
        </p>
      </Card>

      {/* ML model card */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card accent="aqua" className="!p-5">
          <div className="flex items-center justify-between">
            <span className="card-title">ML model card</span>
            <SourceChip source="model_prediction" />
          </div>
          {!m ? (
            <Skeleton className="mt-4 h-40 w-full" />
          ) : (
            <>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-mono text-sm text-leaf-700">
                  {m.model_name ?? "rule_based_water_balance"}
                </span>
                <span className="chip src-simulated">
                  {m.data_basis ?? "unknown basis"}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                <Stat label="MAE" value={m.metrics.mae_pct_points != null
                  ? `${m.metrics.mae_pct_points.toFixed(3)} % vol` : "—"} />
                <Stat label="RMSE" value={m.metrics.rmse_pct_points != null
                  ? `${m.metrics.rmse_pct_points.toFixed(3)} % vol` : "—"} />
                <Stat label="R²" value={m.metrics.r2 != null
                  ? m.metrics.r2.toFixed(3) : "—"} />
                <Stat label="Train rows" value={m.metrics.n_samples != null
                  ? `${m.metrics.n_samples}` : "—"} />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-mist/70">
                {m.note ?? "Metrics reported by the trained artifact."}
              </p>
              <ul className="mt-2 space-y-1 text-[11px] text-mist/75">
                {Object.entries(m.kinds ?? {}).map(([k, v]) => (
                  <li key={k}>
                    <span className="font-mono text-leaf-600">{k}</span> — {v}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card accent="sand" className="!p-5">
          <span className="card-title">Where the numbers come from</span>
          <div className="mt-4 space-y-3 text-xs leading-relaxed text-mist/75">
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-mist/70">
                Reference ETo
              </div>
              Radiation-based Priestley-Taylor from NASA POWER solar data
              (primary) or FAO-56 Hargreaves from temperature + latitude
              (fallback), sanity-clamped to 2.5–9.5 mm/day. Always an estimate.
            </div>
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-mist/70">
                Crop coefficients
              </div>
              FAO Irrigation &amp; Drainage Paper 56 style Kc values per stage
              (historical dataset) — not measurements of your field.
            </div>
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-mist/70">
                Training data
              </div>
              {(m?.metrics?.n_samples != null
                ? m.metrics.n_samples.toLocaleString("en-IN")
                : "Multi-thousand")}-row dataset generated from an explicit
              FAO-style soil water-balance simulation — clearly labelled
              simulated, not field-validated.
            </div>
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-mist/70">
                Savings
              </div>
              Model scenario: baseline schedule replay vs AI rain-aware replay.
              Not metered, not a field trial, no yield claim.
            </div>
          </div>
        </Card>
      </div>

      {/* honest limitations */}
      <Card accent="alert" className="!p-5 !border-warn-400/40">
        <span className="card-title text-warn-600">
          Honest limitations — what this MVP does NOT claim
        </span>
        <div className="mt-3 grid gap-2.5 text-xs leading-relaxed text-mist/75
                        sm:grid-cols-2">
          <Limit text="No sensor hardware: moisture readings are user-supplied or
                       estimated; demo readings are simulated and labelled." />
          <Limit text="No field validation: model metrics come from held-out
                       simulated data, not instrumented fields." />
          <Limit text="No flow-meter savings: savings are computed model
                       scenarios, never presented as metered water savings." />
          <Limit text="No yield guarantees: crop adequacy is a model coverage
                       ratio; published benchmarks are context only." />
          <Limit text="No invented organisations: NGO entries link to official
                       websites only; no contact persons or partnerships are
                       fabricated." />
          <Limit text="Weather fallbacks: if a live API fails, the cascade is
                       shown in the data-status panel — never silently." />
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link to="/data" className="btn-primary">Data transparency →</Link>
        <Link to="/analyze" className="btn-ghost">Analyze my farm</Link>
        <Link to="/how-it-works" className="btn-ghost">Back to top</Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line/60 bg-night/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-mist/70">{label}</div>
      <div className="font-mono text-sm text-ink">{value}</div>
    </div>
  );
}

function Limit({ text }: { text: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-warn-600">✗</span>
      <span>{text}</span>
    </div>
  );
}
