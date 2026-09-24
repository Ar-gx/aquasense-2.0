import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { axisProps, C, fmtLakh } from "./chartTheme";
import { fmtLitresShort } from "../../lib/format";

interface Props {
  baselinePerHa: number;
  aiPerHa: number;
  baselineTotal: number;
  aiTotal: number;
  savedPerHa: number;
  savedTotal: number;
  reductionPct: number;
}

/** Animated traditional-vs-AquaSense consumption comparison. */
export default function ComparisonChart({
  baselinePerHa, aiPerHa, baselineTotal, aiTotal,
  savedPerHa, savedTotal, reductionPct,
}: Props) {
  const data = [
    { name: "Per hectare", traditional: baselinePerHa, ai: aiPerHa },
    { name: "Whole farm", traditional: baselineTotal, ai: aiTotal },
  ];
  const negative = reductionPct < 0;

  return (
    <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
      <div>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 14, right: 8, left: -4, bottom: 0 }}
                      barGap={6}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={fmtLakh} width={56} />
              <Tooltip
                cursor={{ fill: "rgba(109,154,76,0.07)" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="glass-strong !rounded-xl px-3 py-2 text-xs">
                      <div className="mb-1 font-medium text-ink">{label}</div>
                      {payload.map((p) => (
                        <div key={String(p.dataKey)} className="flex justify-between gap-4">
                          <span className="text-mist/70">
                            {p.dataKey === "traditional"
                              ? "Traditional schedule" : "AquaSense optimized"}
                          </span>
                          <span className="font-mono text-ink">
                            {fmtLitresShort(Number(p.value))}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Bar dataKey="traditional" name="Traditional" fill={C.baseline}
                   fillOpacity={0.7} radius={[6, 6, 0, 0]} maxBarSize={70} />
              <motion.g />
              <Bar dataKey="ai" name="AquaSense" fill={C.ai}
                   fillOpacity={0.85} radius={[6, 6, 0, 0]} maxBarSize={70}>
                {data.map((_, i) => (
                  <Cell key={i} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex gap-4 text-[11px] text-mist/70">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: C.baseline }} />
            Traditional fixed-schedule
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: C.ai }} />
            AquaSense optimized
          </span>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className={`glass p-4 ${negative ? "border-alert-400/40" : "border-leaf-400/40"}`}
        >
          <div className="text-xs uppercase tracking-wider text-mist/75">
            Potential reduction
          </div>
          <div className={`font-display text-4xl font-semibold ${
            negative ? "text-alert-600" : "text-leaf-600"}`}>
            {negative ? "" : "−"}
            {Math.abs(reductionPct).toFixed(1)}%
          </div>
          <div className="mt-1 text-[11px] text-mist/75">
            {negative
              ? "AI scenario uses MORE water than baseline — reported honestly."
              : "Model scenario under these conditions — not a field trial."}
          </div>
        </motion.div>
        <div className="glass p-4 text-sm">
          <div className="flex justify-between border-b border-line/60 pb-2">
            <span className="text-mist/70">Saved / hectare</span>
            <span className="font-mono text-leaf-700">
              {fmtLitresShort(savedPerHa)}
            </span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-mist/70">Total farm saved</span>
            <span className="font-mono text-leaf-700">
              {fmtLitresShort(savedTotal)}
            </span>
          </div>
        </div>
        <div className="text-[11px] leading-relaxed text-mist/70">
          Water Saved = Baseline Water Usage − AI Water Usage, over the same
          30-day analysis window on the same farm area. All values are
          illustrative model scenarios.
        </div>
      </div>
    </div>
  );
}
