import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useFarm } from "../context/FarmContext";
import PageHeader from "../components/ui/PageHeader";
import { Card, EmptyFarm, Note, ProgressBar, SourceChip } from "../components/ui/primitives";
import { pct } from "../lib/format";

const BAND_LABEL: Record<string, { label: string; cls: string }> = {
  waterlogging_risk: { label: "Waterlogging risk", cls: "text-soil-600" },
  above_field_capacity: { label: "Above field capacity", cls: "text-aqua-600" },
  healthy: { label: "Healthy", cls: "text-leaf-600" },
  monitor: { label: "Monitor", cls: "text-warn-600" },
  crop_stress: { label: "Crop stress", cls: "text-alert-600" },
  unknown: { label: "Unknown (estimated)", cls: "text-mist/70" },
};

export default function SoilHealth() {
  const { dashboard, loadDemo } = useFarm();

  if (!dashboard) {
    return (
      <EmptyFarm action={
        <button onClick={() => loadDemo().catch(() => undefined)}
                className="btn-primary">▶ Try Demo Farm</button>
      } />
    );
  }

  const cm = dashboard.current_moisture;
  const n = dashboard.nutrients;
  const band = BAND_LABEL[cm.band] ?? BAND_LABEL.unknown;
  const span = Math.max(1, cm.field_capacity_pct - cm.wilting_point_pct);
  const fill = Math.max(0, Math.min(100,
    ((cm.moisture_pct ?? cm.wilting_point_pct) - cm.wilting_point_pct) / span * 100));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Solution 03 · Soil Health"
        title="Soil moisture & nutrient replenishment"
        sub="Root-zone status against soil-physics reference bands, plus
             rotation and manure recommendations with explained scores."
        actions={
          <Link to="/connect" className="btn-ghost !py-1.5 text-xs">
            Soil testing help →
          </Link>
        }
      />

      {/* moisture gauge */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="!p-5">
          <div className="flex items-center justify-between">
            <span className="card-title">Root-zone moisture</span>
            <span className={`chip ${
              cm.band === "healthy" ? "src-live"
              : cm.band === "monitor" ? "src-estimated"
              : cm.band === "unknown" ? "src-rule" : "src-simulated"}`}>
              {cm.band === "unknown" ? "estimated" : cm.source}
            </span>
          </div>

          <div className="mt-4 flex items-end gap-3">
            <span className="font-display text-4xl font-semibold text-ink">
              {cm.moisture_pct?.toFixed(1) ?? "—"}
              <span className="text-lg text-mist/75">% vol</span>
            </span>
            <span className={`pb-1.5 font-display text-sm font-semibold ${band.cls}`}>
              {band.label}
            </span>
          </div>

          {/* band scale */}
          <div className="mt-5">
            <div className="relative h-4 overflow-hidden rounded-full bg-night">
              {/* zones */}
              <div className="absolute inset-y-0 left-0 bg-alert-500/25"
                   style={{ width: `${(cm.wilting_point_pct / (cm.saturation_pct || 1)) * 100}%` }} />
              <div className="absolute inset-y-0 bg-leaf-500/20"
                   style={{
                     left: `${(cm.wilting_point_pct / (cm.saturation_pct || 1)) * 100}%`,
                     width: `${(span / (cm.saturation_pct || 1)) * 100}%`,
                   }} />
              <div className="absolute inset-y-0 right-0 bg-soil-500/25"
                   style={{
                     left: `${(cm.saturation_pct * 0.97 / (cm.saturation_pct || 1)) * 100}%`,
                   }} />
              {/* marker */}
              <motion.div
                initial={{ left: "0%" }}
                animate={{ left: `${((cm.moisture_pct ?? 0) / (cm.saturation_pct || 1)) * 100}%` }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-y-0 w-1 rounded-full
                           bg-leaf-300 shadow-glow"
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-mist/70">
              <span>WP {cm.wilting_point_pct}%</span>
              <span className="text-alert-600/80">
                stress ≤ {cm.stress_threshold_pct}%
              </span>
              <span>FC {cm.field_capacity_pct}%</span>
              <span className="text-soil-600/80">SAT {cm.saturation_pct}%</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-line/60 bg-night/40 p-3">
              <div className="text-[10px] uppercase tracking-wider text-mist/70">
                Available water
              </div>
              <div className="font-mono text-leaf-700">
                {cm.available_water_pct ?? "—"}% above wilting point
              </div>
            </div>
            <div className="rounded-lg border border-line/60 bg-night/40 p-3">
              <div className="text-[10px] uppercase tracking-wider text-mist/70">
                Depletion allowed (MAD)
              </div>
              <div className="font-mono text-leaf-700">
                {pct((1 - (cm.stress_threshold_pct - cm.wilting_point_pct) / span)
                     * 100, 0)} before stress
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-mist/70">
            {cm.limitation}
          </p>
        </Card>

        {/* soil texture reference */}
        <Card className="!p-5">
          <div className="flex items-center justify-between">
            <span className="card-title">Soil texture reference</span>
            <SourceChip source="historical_dataset"
                        label="soil-physics ranges" />
          </div>
          <div className="mt-4 space-y-3">
            <Row label="Texture in use"
                 value={(dashboard.farm.soil_type ?? "unknown")
                   .replace("_", " ")}
                 warn={!dashboard.farm.soil_type} />
            <div>
              <div className="mb-1 flex justify-between text-[11px]
                              text-mist/65">
                <span>Field capacity</span>
                <span className="font-mono">{cm.field_capacity_pct}% vol</span>
              </div>
              <ProgressBar value={(cm.field_capacity_pct / 50) * 100}
                           color="from-aqua-500 to-aqua-300" height="h-1.5" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[11px]
                              text-mist/65">
                <span>Wilting point</span>
                <span className="font-mono">{cm.wilting_point_pct}% vol</span>
              </div>
              <ProgressBar value={(cm.wilting_point_pct / 50) * 100}
                           color="from-alert-500 to-alert-400" height="h-1.5" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[11px]
                              text-mist/65">
                <span>Saturation</span>
                <span className="font-mono">{cm.saturation_pct}% vol</span>
              </div>
              <ProgressBar value={(cm.saturation_pct / 60) * 100}
                           color="from-soil-500 to-soil-300" height="h-1.5" />
            </div>
          </div>
          <Note tone="warn">
            FC / WP / SAT are reference values for the selected texture class —
            not measured on this farm. A lab soil test is the only way to get
            field-specific values.
          </Note>
        </Card>
      </div>

      {/* nutrient analysis */}
      <Card className="!p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="card-title">Estimated nutrient depletion</span>
          <div className="flex gap-2">
            <SourceChip source={n.source} label={n.label} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {([["N", n.estimated_depletion.n, "kg/ha"],
             ["P", n.estimated_depletion.p, "kg/ha"],
             ["K", n.estimated_depletion.k, "kg/ha"]] as const).map(([el, v, unit]) => (
            <div key={el} className="rounded-xl border border-line/70
                                     bg-night/40 p-4">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-lg font-semibold text-ink">
                  {el}
                </span>
                <span className="font-mono text-lg text-warn-700">
                  {v ?? "—"} <span className="text-xs text-mist/70">{unit}</span>
                </span>
              </div>
              <div className="mt-1 text-[10px] text-mist/70">
                cumulative uptake estimated so far
              </div>
            </div>
          ))}
        </div>
        {n.estimated_depletion.previous_legume_credit_n_kg_ha ? (
          <p className="mt-2 text-[11px] text-leaf-600">
            − {n.estimated_depletion.previous_legume_credit_n_kg_ha} kg N/ha
            credited from the previous legume crop.
          </p>
        ) : null}
        <p className="mt-2 text-xs leading-relaxed text-mist/70">
          {n.explanation.basis_note}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {n.explanation.factors_used.map((f) => (
            <span key={f} className="chip src-rule !normal-case">{f}</span>
          ))}
        </div>
        {n.warning && (
          <div className="mt-3">
            <Note tone="warn">{n.warning}</Note>
          </div>
        )}
      </Card>

      {/* legume rotation */}
      <Card className="!p-5">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="card-title">Legume rotation recommendations</span>
          <span className="text-[11px] text-mist/70">
            compatibility = 0.4·soil fit + 0.4·nutrient need + 0.2·rotation
          </span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {n.legume_recommendations.map((l, i) => (
            <motion.div key={l.key}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.06 }}
                        className="rounded-xl border border-line/70 bg-night/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink">{l.name}</span>
                <span className="font-mono text-sm text-leaf-600">
                  {l.compatibility_pct}%
                </span>
              </div>
              <div className="mt-2">
                <ProgressBar value={l.compatibility_pct} height="h-1.5" />
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2 text-[10px]
                              text-mist/75">
                <span>soil fit <span className="font-mono text-leaf-700">
                  {l.factors.soil_texture_fit_pct}%</span></span>
                <span>nutrient need <span className="font-mono text-leaf-700">
                  {l.factors.nutrient_alignment_pct}%</span></span>
                <span>rotation <span className="font-mono text-leaf-700">
                  {l.factors.rotation_benefit_pct}%</span></span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-mist/70">
                {l.note} — fixes ~<span className="font-mono text-warn-700">
                {l.n_fixed_kg_ha}</span> kg N/ha over {l.duration_days} days.
              </p>
            </motion.div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-mist/70">
          {n.explanation.how_score_is_computed} Scores are relative suitability
          indicators — not yield guarantees.
        </p>
      </Card>

      {/* manures */}
      <Card className="!p-5">
        <span className="card-title">Organic & split-nutrient options</span>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {n.manure_recommendations.map((m) => (
            <div key={m.key} className="rounded-xl border border-line/70
                                        bg-night/40 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink">{m.name}</span>
                <span className="chip src-historical">{m.rate}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {m.supplies.map((s) => (
                  <span key={s} className="chip src-rule !text-[9px]">{s}</span>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-mist/70">
                {m.why}
              </p>
              <p className="mt-1 text-[10px] text-mist/70">{m.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-mist/70">
          Data not used: {n.explanation.data_not_used.filter(Boolean).join("; ")
            || "none — all inputs supplied"}. Basis: {n.explanation.basis}.
        </p>
      </Card>

      {/* soil-related warnings */}
      {dashboard.warnings.filter((w) =>
        ["waterlogging", "nutrient_leaching", "excessive_soil_moisture",
         "crop_water_stress"].includes(w.type)).length > 0 && (
        <Card className="!p-5">
          <span className="card-title">Soil-related risk indicators</span>
          <div className="mt-3 space-y-2.5">
            {dashboard.warnings.filter((w) =>
              ["waterlogging", "nutrient_leaching", "excessive_soil_moisture",
               "crop_water_stress"].includes(w.type)).map((w, i) => (
              <div key={i}
                   className={`rounded-xl border px-4 py-3 text-xs ${
                     w.severity === "danger" ? "border-alert-400/40 bg-alert-500/5"
                     : "border-warn-400/30 bg-warn-500/5"}`}>
                <div className="font-medium text-ink">
                  {w.type.replace(/_/g, " ")}
                </div>
                <p className="mt-1 text-mist/75">{w.potential_problem}</p>
                <p className="mt-1 text-leaf-700/90">
                  Action: {w.recommended_action}
                </p>
                <p className="mt-1 text-mist/70">Evidence: {w.evidence}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Link to="/connect" className="btn-primary">
          Find soil-health support (NGOs) →
        </Link>
        <Link to="/irrigation" className="btn-ghost">Irrigation goal</Link>
        <Link to="/data" className="btn-ghost">Data transparency</Link>
      </div>
    </div>
  );
}

function Row({ label, value, warn }: {
  label: string; value: string; warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-mist/65">{label}</span>
      <span className={warn ? "text-warn-600" : "text-ink"}>{value}</span>
    </div>
  );
}
