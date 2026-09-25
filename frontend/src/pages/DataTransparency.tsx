import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import PageHeader from "../components/ui/PageHeader";
import DataStatusPanel from "../components/dashboard/DataStatusPanel";
import { Card, Note, Skeleton, SourceChip, TINT } from "../components/ui/primitives";
import type { DataStatusItem } from "../lib/types";

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

interface AquastatPayload {
  indicators: Array<{ code: string; label: string; unit: string;
    value: string | number; year: string }>;
  state_context: Record<string, { irrigated_share_pct?: string; note?: string }>;
  country: string; source_label: string; granularity: string;
  live: boolean; note: string;
}
interface NassPayload {
  benchmark_yield_t_ha: number | null; source: string; source_label: string;
  granularity: string; live: boolean; note: string;
}

const TAXONOMY = [
  { cls: "src-live", label: "Live API", body: "Fetched from a public API at request time (weather, geocoding, forecasts). Always timestamped." },
  { cls: "src-historical", label: "Historical dataset", body: "Bundled extracts published by FAO AQUASTAT / USDA NASS with attribution — context, never farm measurements." },
  { cls: "src-model", label: "Model prediction", body: "Output of the trained XGBoost model (trained on simulated water-balance data)." },
  { cls: "src-rule", label: "Rule-based", body: "Transparent water-balance formula used when no model artifact exists." },
  { cls: "src-estimated", label: "Estimated", body: "Reference-data calculation (soil bands, savings scenarios) — not a measurement." },
  { cls: "src-simulated", label: "Simulated", body: "Deterministic demo data (sensors, seeded history) — never presented as live." },
  { cls: "src-user", label: "User supplied", body: "Values you typed or selected during onboarding or in settings." },
];

export default function DataTransparency() {
  const [ds, setDs] = useState<DataStatusPayload | null>(null);
  const [aqua, setAqua] = useState<AquastatPayload | null>(null);
  const [nass, setNass] = useState<NassPayload | null>(null);
  const [crop, setCrop] = useState("wheat");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getDataStatus(),
      api.getAquastat(),
      api.getNass(crop),
    ])
      .then(([d, a, n]) => {
        setDs(d as unknown as DataStatusPayload);
        setAqua(a as unknown as AquastatPayload);
        setNass(n as unknown as NassPayload);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [crop]);

  const items: DataStatusItem[] = (ds?.sources ?? []).map((s) => ({
    source: s.name, status: s.status, kind: s.kind,
    granularity: s.granularity, label: s.note,
  }));

  if (loading && !ds) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Data Transparency"
        title="Every source, status and limitation — visible"
        sub="Live APIs, historical datasets, models and simulated values are never"
        actions={<Link to="/how-it-works" className="btn-ghost !py-1.5 text-xs">
          How it works →
        </Link>}
      />

      {/* policy */}
      <div className="glass-strong border-aqua-400/40 p-5">
        <div className="flex items-center gap-2">
          <span className="text-lg">🛡</span>
          <span className="font-display text-sm font-semibold text-aqua-700">
            Data policy
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-mist/85">
          {ds?.policy ?? "Loading policy…"}
        </p>
        {ds && (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {Object.entries(ds.savings_kinds).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-line/70
                                      bg-night/50 p-3">
                <div className="font-mono text-[11px] text-leaf-600">{k}</div>
                <div className="mt-1 text-[11px] leading-snug text-mist/70">{v}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* source status table */}
      {items.length > 0 && <DataStatusPanel items={items} />}

      {/* taxonomy */}
      <Card accent="aqua" className="!p-5">
        <span className="card-title">Source taxonomy — what each chip means</span>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {TAXONOMY.map((t) => (
            <div key={t.label} className="flex items-start gap-3 rounded-xl
                                          border border-line/60 bg-night/40 p-3">
              <span className={`chip ${t.cls} shrink-0`}>{t.label}</span>
              <span className="text-xs leading-relaxed text-mist/75">{t.body}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* ML metrics */}
      {ds?.ml && (
        <Card accent="leaf" className="!p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="card-title">Model metrics</span>
            <SourceChip source="model_prediction"
                        label={ds.ml.data_basis ?? "model"} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            <M label="Model" v={ds.ml.model_name ?? "—"} />
            <M label="MAE" v={ds.ml.metrics.mae_pct_points?.toFixed(3)
              ? `${ds.ml.metrics.mae_pct_points.toFixed(3)} % vol` : "—"} />
            <M label="RMSE" v={ds.ml.metrics.rmse_pct_points?.toFixed(3)
              ? `${ds.ml.metrics.rmse_pct_points.toFixed(3)} % vol` : "—"} />
            <M label="R²" v={ds.ml.metrics.r2?.toFixed(3) ?? "—"} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-mist/70">
            {ds.ml.note}
          </p>
          <p className="mt-1 text-[11px] text-warn-600/80">
            {ds.ml.metrics.n_samples != null &&
              `${ds.ml.metrics.n_samples.toLocaleString("en-IN")} rows simulated · held-out test set ${ds.ml.metrics.test_size != null ? ds.ml.metrics.test_size.toLocaleString("en-IN") : "—"}`}
            {ds.ml.metrics.trained_at &&
              ` · trained ${new Date(ds.ml.metrics.trained_at).toLocaleString("en-IN")}`}
          </p>
        </Card>
      )}

      {/* reference datasets */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* AQUASTAT */}
        <Card accent="sand" className="!p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="card-title">FAO AQUASTAT — water context</span>
            <SourceChip source="historical_dataset"
                        label={aqua?.source_label ?? "bundled extract"} />
          </div>
          {aqua && (
            <>
              <div className="mt-3 divide-y divide-line/50 rounded-xl border
                              border-line/60 bg-night/40">
                {aqua.indicators.map((ind) => (
                  <div key={ind.code} className="flex items-start justify-between
                                                 gap-3 px-4 py-2.5 text-xs">
                    <span className="text-mist/70">{ind.label}</span>
                    <span className="text-end">
                      <span className="font-mono text-warn-700">{ind.value}</span>
                      <span className="ms-1.5 text-mist/70">{ind.unit}</span>
                      <div className="text-[10px] text-mist/65">{ind.year}</div>
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-mist/75">
                {aqua.note} Granularity: {aqua.granularity} ·{" "}
                {aqua.live ? "live" : "bundled extract"}.
              </p>
              {aqua.state_context && Object.keys(aqua.state_context).length > 0 && (
                <div className="mt-3">
                  <div className="mb-1.5 text-[10px] uppercase tracking-wider
                                  text-mist/70">
                    State context
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(aqua.state_context).map(([st, ctx]) => (
                      <div key={st} className="text-xs">
                        <span className="text-leaf-700">{st}</span>
                        <span className="ms-2 font-mono text-warn-700">
                          {ctx.irrigated_share_pct}% irrigated
                        </span>
                        <span className="ms-2 text-mist/75">{ctx.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {/* USDA NASS */}
        <Card accent="soil" className="!p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="card-title">USDA NASS — yield benchmark</span>
            <SourceChip source={nass?.source ?? "historical_dataset"}
                        label={nass?.source_label} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="text-xs text-mist/70">Compare crop:</label>
            <select className="field !w-auto !py-1.5 text-xs" value={crop}
                    onChange={(e) => setCrop(e.target.value)}>
              {["wheat", "rice", "maize", "cotton", "sugarcane", "tomato",
                "potato", "soybean", "groundnut", "onion"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="mt-4 font-display text-4xl font-bold text-warn-700">
            {nass?.benchmark_yield_t_ha != null
              ? `${nass.benchmark_yield_t_ha} t/ha`
              : "—"}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-mist/70">
            {nass?.note}
          </p>
          <p className="mt-2 text-[11px] text-mist/70">
            {nass?.granularity} · {nass?.live ? "live API" : "bundled reference extract"}
          </p>
          <Note tone="warn">
            National benchmark for context only — never presented as your
            expected or achievable yield.
          </Note>
        </Card>
      </div>

      {/* datasets used list */}
      <Card accent="leaf" className="!p-5">
        <span className="card-title">Public datasets &amp; APIs used</span>
        <div className="mt-3 grid gap-2.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <Ds name="OpenWeather" kind="current weather" link="https://openweathermap.org/api" />
          <Ds name="Open-Meteo" kind="7-day forecast + geocoding (keyless)" link="https://open-meteo.com" />
          <Ds name="NASA POWER" kind="historical daily meteorology" link="https://power.larc.nasa.gov" />
          <Ds name="data.gov.in" kind="district rainfall / groundwater" link="https://data.gov.in" />
          <Ds name="FAO AQUASTAT" kind="agricultural water statistics" link="https://www.fao.org/aquastat" />
          <Ds name="USDA NASS Quick Stats" kind="crop yield benchmarks" link="https://quickstats.nass.usda.gov" />
          <Ds name="SoilGrids (ISRIC)" kind="soil property point lookup" link="https://soilgrids.org" />
          <Ds name="OpenStreetMap Nominatim" kind="reverse geocoding" link="https://nominatim.org" />
          <Ds name="FAO-56 crop coefficients" kind="Kc reference methodology" link="https://www.fao.org/4/X0490E/x0490e00.htm" />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-mist/70">
          Keys live only in the backend <span className="font-mono">.env</span>{" "}
          file — never in the frontend bundle and never hardcoded in source.
        </p>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link to="/how-it-works" className="btn-primary">Full method →</Link>
        <Link to="/settings" className="btn-ghost">API key status</Link>
        <Link to="/dashboard" className="btn-ghost">Dashboard</Link>
      </div>
    </div>
  );
}

function M({ label, v }: { label: string; v: string }) {
  return (
    <div className={`rounded-lg border p-3 ${TINT.aqua}`}>
      <div className="text-[10px] uppercase tracking-wider text-mist/70">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-ink">{v}</div>
    </div>
  );
}

function Ds({ name, kind, link }: { name: string; kind: string; link: string }) {
  return (
    <a href={link} target="_blank" rel="noreferrer"
       className={`rounded-xl border p-3 transition
                   hover:border-leaf-400/50 ${TINT.leaf}`}>
      <div className="font-medium text-ink">{name} ↗</div>
      <div className="mt-0.5 text-[11px] text-mist/75">{kind}</div>
    </a>
  );
}
