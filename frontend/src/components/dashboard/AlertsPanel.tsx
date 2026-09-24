import { motion } from "framer-motion";
import { Card } from "../ui/primitives";
import type { WarningItem } from "../../lib/types";

const SEV_STYLE: Record<string, { bar: string; label: string; cls: string }> = {
  danger: { bar: "bg-alert-400", label: "High risk", cls: "text-alert-600 border-alert-400/40" },
  warning: { bar: "bg-warn-400", label: "Warning", cls: "text-warn-600 border-warn-400/40" },
  watch: { bar: "bg-aqua-400", label: "Watch", cls: "text-aqua-600 border-aqua-400/40" },
  info: { bar: "bg-leaf-400", label: "Info", cls: "text-leaf-600 border-leaf-400/40" },
};

/**
 * Alerts panel: red/yellow/green risk indicators with problem, cause,
 * affected crop/stage, recommended action and evidence.
 */
export default function AlertsPanel({ warnings, status }: {
  warnings: WarningItem[];
  status: "irrigation_required" | "monitor" | "good";
}) {
  return (
    <Card accent="alert" className="p-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-line/70 px-5 py-3.5">
        <span className="card-title">Warnings &amp; risk indicators</span>
        <span className={`chip ${
          status === "good" ? "src-live" : status === "monitor" ? "src-estimated" : "src-simulated"
        }`}>
          {status === "good" ? "🟢 no active risk" : status === "monitor" ? "🟡 monitor" : "🔴 action"}
        </span>
      </div>
      <div className="divide-y divide-line/60">
        {warnings.map((w, i) => {
          const sev = SEV_STYLE[w.severity] ?? SEV_STYLE.info;
          return (
            <motion.div
              key={`${w.type}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              className="relative flex gap-3 px-5 py-4 hover:bg-night/40"
            >
              <span className={`absolute inset-y-0 start-0 w-1 ${sev.bar}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`chip ${sev.cls}`}>{sev.label}</span>
                  <span className="font-display text-sm font-semibold text-ink">
                    {w.type.replace(/_/g, " ")}
                  </span>
                  <span className="text-[11px] text-mist/70">{w.affected}</span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-mist/90">
                  {w.potential_problem}
                </p>
                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                  <div>
                    <div className="mb-0.5 text-[10px] uppercase tracking-wider text-mist/70">
                      Why it matters
                    </div>
                    <div className="leading-relaxed text-mist/75">{w.why_it_matters}</div>
                  </div>
                  <div>
                    <div className="mb-0.5 text-[10px] uppercase tracking-wider text-mist/70">
                      Recommended action
                    </div>
                    <div className="leading-relaxed text-ink/90">
                      {w.recommended_action}
                    </div>
                  </div>
                  <div>
                    <div className="mb-0.5 text-[10px] uppercase tracking-wider text-mist/70">
                      Evidence
                    </div>
                    <div className="leading-relaxed text-mist/70">{w.evidence}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      <p className="border-t border-line/60 px-5 py-2.5 text-[10px] text-mist/65">
        All warnings express potential risk indicated by forecast/reference data —
        nothing is claimed as having actually occurred unless a measurement
        supports it. Source: rule-based engine over live forecast + soil/crop models.
      </p>
    </Card>
  );
}
