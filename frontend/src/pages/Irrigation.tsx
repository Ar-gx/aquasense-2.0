import { Link } from "react-router-dom";
import { useFarm } from "../context/FarmContext";
import AdvancedInfo from "../components/ui/AdvancedInfo";
import PageHeader from "../components/ui/PageHeader";
import RainVsIrrigationChart from "../components/charts/RainVsIrrigationChart";
import { Card, EmptyFarm, Note, SourceChip, TINT } from "../components/ui/primitives";
import { fmtLitresShort, fmtL, pct } from "../lib/format";

export default function Irrigation() {
  const { dashboard, loadDemo } = useFarm();

  if (!dashboard) {
    return (
      <EmptyFarm action={
        <button onClick={() => loadDemo().catch(() => undefined)}
                className="btn-primary">▶ Try Demo Farm</button>
      } />
    );
  }

  const r = dashboard.recommendation;
  const rain = r.rainfall;
  const upgrade = r.suggested_method_upgrade;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Solution 02 · Irrigation Goal"
        title="Irrigation recommendation"
        sub="12-step hybrid pipeline: moisture → prediction → crop needs →
             rain analysis → deficit → efficiency → risk → decision →
             quantity → timing → confidence."
        actions={
          <>
            <SourceChip source={r.source} label={r.label} />
            <Link to="/how-it-works" className="btn-ghost !py-1.5 text-xs">
              How it works →
            </Link>
          </>
        }
      />

      {/* decision banner */}
      <div className={`glass-strong p-6 ${
        r.status === "irrigation_required" ? "border-alert-400/50"
        : r.status === "monitor" ? "border-warn-400/50"
        : "border-leaf-400/50"}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5">
              <span className={`h-3 w-3 rounded-full ${
                r.status === "irrigation_required" ? "bg-alert-400"
                : r.status === "monitor" ? "bg-warn-400" : "bg-leaf-400"}`} />
              <span className={`font-display text-2xl font-semibold ${
                r.status === "irrigation_required" ? "text-alert-600"
                : r.status === "monitor" ? "text-warn-600" : "text-leaf-600"}`}>
                {r.status_label}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-mist/85">{r.reason}</p>
            <AdvancedInfo hint="step-by-step reasoning">
              <ol className="mt-4 space-y-1.5">
                {r.reason_parts.map((p, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-relaxed
                                         text-mist/70">
                    <span className="grid h-4 w-4 shrink-0 place-items-center
                                     rounded-full border border-leaf-400/40
                                     font-mono text-[9px] text-leaf-600 mt-0.5">
                      {i + 1}
                    </span>
                    <span>{p}</span>
                  </li>
                ))}
              </ol>
            </AdvancedInfo>
          </div>
          <div className="text-end">
            <div className="text-xs uppercase tracking-wider text-mist/75">
              Recommended quantity
            </div>
            <div className="font-display text-3xl font-semibold text-ink">
              {r.irrigation_required ? fmtLitresShort(r.quantity_l) : "0 L"}
            </div>
            <div className="text-[11px] text-mist/75">
              {r.irrigation_required
                ? `${fmtL(r.quantity_l_per_ha)}/ha · ${r.quantity_mm} mm gross
                   (${fmtLitresShort(r.quantity_net_l)} net to root zone)`
                : "no application needed"}
            </div>
            <div className="mt-2 text-sm font-medium text-leaf-700">
              {r.recommended_time ?? "— hold —"}
            </div>
            <div className="mt-0.5 max-w-[240px] text-[11px] leading-snug
                            text-mist/70 ms-auto">
              {r.recommended_time_reason}
            </div>
          </div>
        </div>

        {/* input chain */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Soil moisture (input)"
                 value={`${r.soil_moisture_pct.toFixed(1)}% vol`}
                 sub={r.soil_moisture_source === "user_supplied"
                   ? "user supplied" : "estimated (no sensor)"} />
          <Input label="Thresholds"
                 value={`stress ${r.stress_threshold_pct}% · trigger ${r.trigger_threshold_pct}%`}
                 sub={`FC ${r.field_capacity_pct}% · WP ${r.wilting_point_pct}%
                       · MAD-based for ${r.growth_stage}`} />
          <Input label="Reference ETo"
                 value={`${r.eto_mm_day} mm/day`}
                 sub={r.eto_method} />
          <Input label="Application efficiency"
                 value={pct(r.irrigation_efficiency * 100, 0)}
                 sub={`method: ${r.irrigation_method}`} />
        </div>

        {/* rain analysis */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Input label="Rain next 24 h"
                 value={`${rain.rain_24h_mm} mm`}
                 sub={`probability ${rain.prob_24h}%`} />
          <Input label="Rain next 48 h"
                 value={`${rain.rain_48h_mm} mm`}
                 sub={`effective ${rain.effective_48h_mm} mm
                       (soil-infiltration adjusted)`} />
          <Input label="Rain next 72 h"
                 value={`${rain.rain_72h_mm} mm`}
                 sub={`probability ${rain.prob_72h}% · ${rain.impact}`} />
        </div>

        {/* risk flags */}
        {(r.waterlogging_risk || r.waterlogging_now) && (
          <div className="mt-4 rounded-xl border border-soil-400/50
                          bg-soil-500/10 px-4 py-3 text-xs text-soil-800">
            ⚠ Waterlogging{" "}
            {r.waterlogging_now ? "detected now" : "risk in the forecast window"}{" "}
            — irrigation should be delayed.
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className={`chip ${r.confidence === "high" ? "src-live"
            : r.confidence === "medium" ? "src-estimated" : "src-rule"}`}>
            confidence: {r.confidence}
          </span>
          {r.confidence_reasons.map((c) => (
            <span key={c} className="text-mist/75">· {c}</span>
          ))}
        </div>
        {r.limitations.length > 0 && (
          <div className="mt-3">
            <Note tone="warn">
              <strong className="text-warn-600">Limitations:</strong>{" "}
              {r.limitations.join(" ")}
            </Note>
          </div>
        )}
      </div>

      <AdvancedInfo hint="graphs & technical detail">
        {/* rain chart */}
        <Card accent="aqua" className="!p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="card-title">Rainfall vs irrigation stance (7 days)</span>
            <SourceChip source={dashboard.forecast.source}
                        label={dashboard.forecast.source_label} />
          </div>
          <RainVsIrrigationChart forecast={dashboard.forecast.daily} reco={r} />
        </Card>
      </AdvancedInfo>

      {/* savings per event */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card accent="leaf" className="!p-5">
          <span className="card-title">Per-event savings</span>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className={`rounded-xl border p-3 ${TINT.alert}`}>
              <div className="text-[10px] uppercase tracking-wider text-mist/70">
                Traditional event
              </div>
              <div className="mt-1 font-mono text-sm text-alert-600/90">
                {fmtLitresShort(Number(r.savings.traditional_event_l))}
              </div>
              <div className="text-[10px] text-mist/70">
                every {String(r.savings.traditional_interval_days ?? 5)} days
              </div>
            </div>
            <div className="rounded-xl border border-aqua-400/40 bg-aqua-500/10 p-3">
              <div className="text-[10px] uppercase tracking-wider text-mist/70">
                AI event
              </div>
              <div className="mt-1 font-mono text-sm text-aqua-600">
                {fmtLitresShort(r.quantity_l)}
              </div>
              <div className="text-[10px] text-mist/70">on demand only</div>
            </div>
            <div className="rounded-xl border border-leaf-400/40 bg-leaf-500/10 p-3">
              <div className="text-[10px] uppercase tracking-wider text-mist/70">
                Difference
              </div>
              <div className={`mt-1 font-mono text-sm ${
                Number(r.savings.saved_per_event_l) < 0
                  ? "text-alert-600" : "text-leaf-600"}`}>
                {fmtLitresShort(Number(r.savings.saved_per_event_l))}
              </div>
              <div className="text-[10px] text-mist/70">
                {pct(Number(r.savings.saved_per_event_pct), 1)}
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-mist/75">
            {String(r.savings.note ?? "")}
          </p>
          <SourceChip source={String(r.savings.source ?? "estimated")} />
        </Card>

        <Card accent="soil" className="!p-5">
          <span className="card-title">Method upgrade suggestion</span>
          {upgrade ? (
            <>
              <div className="mt-3 flex items-center gap-3 text-sm">
                <span className="chip src-rule">{upgrade.current_method}
                  · {pct(upgrade.current_efficiency * 100, 0)}</span>
                <span className="text-leaf-600">→</span>
                <span className="chip src-live">{upgrade.suggested_method}
                  · {pct(upgrade.suggested_efficiency * 100, 0)}</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-mist/75">
                {upgrade.why}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div className={`rounded-lg border p-3 ${TINT.soil}`}>
                  <div className="text-[10px] uppercase tracking-wider text-mist/70">
                    Event qty with upgrade
                  </div>
                  <div className="font-mono text-soil-700">
                    {fmtLitresShort(upgrade.event_qty_with_suggestion_l)}
                  </div>
                </div>
                <div className={`rounded-lg border p-3 ${TINT.leaf}`}>
                  <div className="text-[10px] uppercase tracking-wider text-mist/70">
                    Change per event
                  </div>
                  <div className={`font-mono ${
                    upgrade.event_saving_l >= 0 ? "text-leaf-600" : "text-alert-600"}`}>
                    {fmtLitresShort(upgrade.event_saving_l)}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-mist/75">
                <strong className="text-mist/75">Budget fit:</strong>{" "}
                {upgrade.budget_fit}
              </p>
              <p className="mt-1 text-[11px] text-warn-600/80">
                Caveat: {upgrade.caveat}
              </p>
            </>
          ) : (
            <p className="mt-3 text-xs text-mist/65">
              Current method is already high-efficiency (drip / center pivot), or
              no irrigation is required right now — no upgrade suggested.
            </p>
          )}
        </Card>
      </div>

      {/* methods reference */}
      <MethodsTable />

      <div className="flex flex-wrap gap-3">
        <Link to="/history" className="btn-primary">Log an irrigation event →</Link>
        <Link to="/weather" className="btn-ghost">Weather details</Link>
        <Link to="/water-analytics" className="btn-ghost">Water analytics</Link>
      </div>

      <Note tone="info">
        Recommendation persists to the database on every run (Recommendation
        table) so history is auditable. Quantities assume uniform application —
        actual field distribution varies by method and terrain.
      </Note>
    </div>
  );
}

function Input({ label, value, sub }: {
  label: string; value: string; sub: string;
}) {
  return (
    <div className="rounded-xl border border-line/70 bg-night/50 p-3">
      <div className="text-[10px] uppercase tracking-wider text-mist/70">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-ink">{value}</div>
      <div className="mt-0.5 text-[10px] leading-snug text-mist/70">{sub}</div>
    </div>
  );
}

function MethodsTable() {
  const methods = [
    { key: "flood", label: "Flood / furrow", eff: 45, cost: "low",
      note: "Traditional — 45-60% lost to runoff & deep percolation." },
    { key: "furrow", label: "Furrow", eff: 50, cost: "low",
      note: "Better than broad flooding, still loses to percolation." },
    { key: "manual", label: "Manual / hose", eff: 55, cost: "low",
      note: "Labour intensive, uneven application." },
    { key: "sprinkler", label: "Sprinkler", eff: 75, cost: "medium",
      note: "Uniform, suits cereals & pulses." },
    { key: "center_pivot", label: "Center pivot", eff: 85, cost: "high",
      note: "Large uniform fields." },
    { key: "drip", label: "Drip", eff: 90, cost: "high",
      note: "Root-zone delivery, lowest leaching risk." },
    { key: "rainfed", label: "Rainfed", eff: 100, cost: "none",
      note: "Rainfall only — monitoring becomes critical." },
  ];
  return (
    <Card accent="sand" className="!p-0 overflow-hidden">
      <div className="border-b border-line/70 px-5 py-3.5">
        <span className="card-title">Modern irrigation methods — efficiency reference</span>
      </div>
      <div className="divide-y divide-line/50">
        {methods.map((m) => (
          <div key={m.key} className="flex items-center gap-4 px-5 py-3 text-xs
                                      hover:bg-night/50">
            <span className="w-36 font-medium text-ink">{m.label}</span>
            <div className="h-2 w-32 overflow-hidden rounded-full bg-night">
              <div className="h-full rounded-full bg-gradient-to-r
                              from-leaf-500 to-aqua-400"
                   style={{ width: `${m.eff}%` }} />
            </div>
            <span className="w-12 font-mono text-leaf-700">{m.eff}%</span>
            <span className="chip src-rule">{m.cost}</span>
            <span className="hidden flex-1 text-mist/75 sm:block">{m.note}</span>
          </div>
        ))}
      </div>
      <p className="border-t border-line/60 px-5 py-2.5 text-[10px] text-mist/65">
        Application efficiency = share of applied water reaching the root zone
        (reference estimates from standard irrigation engineering ranges).
        Source: historical dataset.
      </p>
    </Card>
  );
}
