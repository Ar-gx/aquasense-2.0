import { motion } from "framer-motion";
import { CountUp, Note, ProgressBar, SourceChip, Stripe } from "../ui/primitives";
import { fmtLitresShort, fmtL } from "../../lib/format";
import type { DashboardPayload } from "../../lib/types";

/**
 * Dashboard hero — the optimal irrigation plan card:
 * status, timing, quantity, expected savings + honesty notes.
 */
export default function OptimalPlanCard({ d }: { d: DashboardPayload }) {
  const plan = d.optimal_irrigation_plan;
  const reco = d.recommendation;
  const tone =
    plan.status === "irrigation_required"
      ? { ring: "border-alert-400/50", text: "text-alert-600", dot: "bg-alert-400", emoji: "🔴" }
      : plan.status === "monitor"
        ? { ring: "border-warn-400/50", text: "text-warn-600", dot: "bg-warn-400", emoji: "🟡" }
        : { ring: "border-leaf-400/50", text: "text-leaf-600", dot: "bg-leaf-400", emoji: "🟢" };

  const moistureProgress =
    ((reco.soil_moisture_pct - reco.wilting_point_pct) /
      Math.max(1, reco.field_capacity_pct - reco.wilting_point_pct)) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`glass-strong relative overflow-hidden p-6 ${tone.ring}`}
    >
      <Stripe accent="leaf" />
      {/* decorative droplet stream */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40
                      rounded-full bg-leaf-500/10 blur-2xl" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
            <span className={`font-display text-lg font-semibold ${tone.text}`}>
              {plan.status_label}
            </span>
            <SourceChip source={reco.source} label="ML + rules" />
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-mist/85">
            {plan.reason}
          </p>
        </div>
        <div className="text-end">
          <div className="text-xs uppercase tracking-wider text-mist/75">
            Today's irrigation goal
          </div>
          <div className="font-display text-3xl font-semibold text-ink">
            {plan.irrigation_required ? (
              <>
                <CountUp value={d.daily_goal_l} format={fmtLitresShort} />
              </>
            ) : (
              <span className="text-leaf-600">0 L</span>
            )}
          </div>
          <div className="text-[11px] text-mist/75">
            {plan.irrigation_required
              ? `${fmtLitresShort(reco.quantity_l_per_ha)} per hectare · ${reco.quantity_mm} mm`
              : "No irrigation needed while moisture is adequate"}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* timing */}
        <div className="rounded-xl border border-line/70 bg-night/50 p-3.5">
          <div className="text-[11px] uppercase tracking-wider text-mist/75">
            Recommended time
          </div>
          <div className="mt-1 font-display text-sm font-semibold text-ink">
            {plan.recommended_time ?? "— hold irrigation —"}
          </div>
          <div className="mt-1 text-[11px] leading-relaxed text-mist/75">
            {reco.recommended_time_reason}
          </div>
        </div>

        {/* current moisture gauge */}
        <div className="rounded-xl border border-line/70 bg-night/50 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-mist/75">
              Root-zone moisture
            </span>
            <SourceChip source={reco.soil_moisture_source === "user_supplied" ? "user_supplied" : "simulated"} />
          </div>
          <div className="mt-1.5 font-display text-2xl font-semibold text-ink">
            {reco.soil_moisture_pct.toFixed(1)}%<span className="text-sm text-mist/75"> vol</span>
          </div>
          <div className="mt-2">
            <ProgressBar value={moistureProgress} height="h-1.5" />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-mist/70">
            <span>WP {reco.wilting_point_pct}%</span>
            <span className={reco.soil_moisture_pct <= reco.stress_threshold_pct ? "text-alert-600" : "text-leaf-600"}>
              stress ≤ {reco.stress_threshold_pct}%
            </span>
            <span>FC {reco.field_capacity_pct}%</span>
          </div>
        </div>

        {/* prediction */}
        <div className="rounded-xl border border-line/70 bg-night/50 p-3.5">
          <div className="text-[11px] uppercase tracking-wider text-mist/75">
            Moisture in 24 h (model)
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-aqua-600">
            {d.prediction.predicted_moisture_pct.toFixed(1)}%
          </div>
          <div className="mt-1 text-[11px] text-mist/75">
            {d.prediction.model_kind === "trained_simulated_data"
              ? "XGBoost · trained on simulated data"
              : "Rule-based water balance"}{" "}
            {d.prediction.metrics?.mae_pct_points != null && (
              <span className="font-mono">
                (MAE ±{d.prediction.metrics.mae_pct_points}%)
              </span>
            )}
          </div>
          <div className="mt-1 text-[10px] text-mist/65">
            Not field-validated · horizons &gt;72 h are extended outlook
          </div>
        </div>

        {/* savings */}
        <div className="rounded-xl border border-leaf-400/30 bg-leaf-500/5 p-3.5">
          <div className="text-[11px] uppercase tracking-wider text-mist/75">
            Est. water saved (30 days)
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-leaf-600">
            <CountUp value={plan.estimated_water_saved_l} format={fmtLitresShort} />
          </div>
          <div className="mt-1 text-[11px] text-mist/75">
            {d.water_savings.saved_pct}% less than traditional schedule
          </div>
          <div className="mt-1 text-[10px] text-mist/65">
            {d.water_savings.label}
          </div>
        </div>
      </div>

      {/* remaining daily goal + confidence */}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
        <span className={`chip ${plan.confidence === "high" ? "src-live" : plan.confidence === "medium" ? "src-estimated" : "src-rule"}`}>
          confidence: {plan.confidence}
        </span>
        <span className="text-mist/75">
          Remaining today: <span className="font-mono text-ink">{fmtL(d.remaining_daily_goal_l)}</span>
        </span>
        <span className="text-mist/75">
          Efficiency: <span className="font-mono text-ink">
            {Math.round(reco.irrigation_efficiency * 100)}%</span> ({reco.irrigation_method})
        </span>
        <span className="text-mist/75">
          Growth stage: <span className="text-ink">{reco.growth_stage}</span>
        </span>
        <span className="text-mist/70 ms-auto">
          Last engine run: {new Date(d.generated_at).toLocaleTimeString("en-IN")}
        </span>
      </div>

      {plan.limitations.length > 0 && (
        <div className="mt-3">
          <Note tone="warn">
            <strong className="text-warn-600">Honest limitations:</strong>{" "}
            {plan.limitations.join(" ")}
            {plan.confidence !== "high" && (
              <> Confidence is {plan.confidence} because:{" "}
                {reco.confidence_reasons.filter((r) => r.includes("lowers")).join(" ")}</>
            )}
          </Note>
        </div>
      )}
    </motion.div>
  );
}
