import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { SourceTag } from "../../lib/types";

/* ---------- source provenance chip (spec §27) ---------- */
const SOURCE_META: Record<string, { label: string; cls: string }> = {
  live_api: { label: "Live API", cls: "src-live" },
  user_supplied: { label: "User supplied", cls: "src-user" },
  historical_dataset: { label: "Historical dataset", cls: "src-historical" },
  estimated: { label: "Estimated", cls: "src-estimated" },
  simulated: { label: "Simulated demo", cls: "src-simulated" },
  model_prediction: { label: "Model prediction", cls: "src-model" },
  rule_based: { label: "Rule-based", cls: "src-rule" },
  hybrid_ml_rules: { label: "ML + rules", cls: "src-model" },
  illustrative_comparison: { label: "Illustrative", cls: "src-estimated" },
  not_configured: { label: "Not configured", cls: "src-rule" },
  disabled: { label: "Disabled", cls: "src-rule" },
  unavailable: { label: "Unavailable", cls: "src-rule" },
  trained_simulated_data: { label: "Trained · simulated data", cls: "src-model" },
  demo: { label: "Demo model", cls: "src-simulated" },
};

export function SourceChip({ source, label }: {
  source: SourceTag | string; label?: string;
}) {
  const meta = SOURCE_META[source] ?? { label: source, cls: "src-rule" };
  return (
    <span className={`chip ${meta.cls}`} title={`Data source: ${meta.label}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label ?? meta.label}
    </span>
  );
}

/* ---------- status dot ---------- */
export function StatusDot({ status }: {
  status: "good" | "monitor" | "alert";
}) {
  const cls = status === "good"
    ? "bg-leaf-400 shadow-[0_0_10px_2px_rgba(138,179,101,0.55)]"
    : status === "monitor"
      ? "bg-warn-400 shadow-[0_0_10px_2px_rgba(242,212,119,0.6)]"
      : "bg-alert-400 shadow-[0_0_10px_2px_rgba(240,144,124,0.55)]";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`} />;
}

/* ---------- card top-edge accent stripe (earthy rotation) ---------- */
export type Accent = "leaf" | "aqua" | "sand" | "soil" | "alert";

const ACCENT_STRIPE: Record<Accent, string> = {
  leaf: "from-leaf-400 to-leaf-600",
  aqua: "from-aqua-400 to-aqua-600",
  sand: "from-sand-400 to-sand-600",
  soil: "from-soil-400 to-soil-600",
  alert: "from-alert-400 to-alert-600",
};

/** 3px gradient bar along a card's top edge — parent needs `relative`. */
export function Stripe({ accent = "leaf", className = "" }: {
  accent?: Accent; className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 top-0 h-[3px]
                  rounded-t-2xl bg-gradient-to-r ${ACCENT_STRIPE[accent]} ${className}`}
    />
  );
}

/** Subtle tinted fill + matching border for small value tiles (earthy hue, ~10%). */
export const TINT: Record<Accent, string> = {
  leaf: "border-leaf-400/40 bg-leaf-500/10",
  aqua: "border-aqua-400/40 bg-aqua-500/10",
  sand: "border-sand-400/50 bg-sand-400/20",
  soil: "border-soil-400/40 bg-soil-500/10",
  alert: "border-alert-400/40 bg-alert-500/10",
};

/* ---------- glass card with optional hover lift ---------- */
export function Card({ children, className = "", hover = false, delay = 0, accent }: {
  children: ReactNode; className?: string; hover?: boolean; delay?: number;
  accent?: Accent;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={hover ? { y: -3 } : undefined}
      className={`glass p-5 ${accent ? "relative" : ""} ${className}`}
    >
      {accent && <Stripe accent={accent} />}
      {children}
    </motion.div>
  );
}

/* ---------- section heading ---------- */
export function SectionTitle({ eyebrow, title, sub, center = false }: {
  eyebrow: string; title: string; sub?: string; center?: boolean;
}) {
  return (
    <div className={`mb-6 ${center ? "text-center" : ""}`}>
      <div className="mb-2 flex items-center gap-2 text-leaf-600"
           style={{ justifyContent: center ? "center" : undefined }}>
        <span className="h-px w-6 bg-leaf-500/60" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.25em]">
          {eyebrow}
        </span>
        {center && <span className="h-px w-6 bg-leaf-500/60" />}
      </div>
      <h2 className="font-display text-2xl font-semibold text-ink md:text-3xl">
        {title}
      </h2>
      {sub && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist/80"
                 style={{ marginInlineStart: center ? "auto" : undefined,
                          marginInlineEnd: center ? "auto" : undefined }}>
        {sub}
      </p>}
    </div>
  );
}

/* ---------- animated count-up number ---------- */
import { useEffect, useRef, useState } from "react";

export function CountUp({ value, duration = 1400, format }: {
  value: number; duration?: number; format?: (v: number) => string;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setDisplay(value); return; }
    const start = performance.now();
    const from = ref.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else ref.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format ? format(display) : Math.round(display).toLocaleString("en-IN")}</>;
}

/* ---------- loading skeleton ---------- */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-line/50 ${className}`} />
  );
}

/* ---------- empty state (no farm yet) ---------- */
export function EmptyFarm({ action }: { action?: ReactNode }) {
  return (
    <div className="glass flex flex-col items-center gap-4 p-10 text-center">
      <div className="text-4xl">🌱</div>
      <div>
        <h3 className="font-display text-lg text-ink">No farm selected</h3>
        <p className="mt-1 max-w-md text-sm text-mist/70">
          Load the Demo Farm for an instant walkthrough, or add your own farm
          with the step-by-step setup.
        </p>
      </div>
      {action}
    </div>
  );
}

/* ---------- progress bar ---------- */
export function ProgressBar({ value, color = "from-leaf-400 to-aqua-400",
                             height = "h-2.5" }: {
  value: number; color?: string; height?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={`w-full overflow-hidden rounded-full bg-night ${height}`}>
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: `${v}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        className={`h-full rounded-full bg-gradient-to-r ${color}`}
      />
    </div>
  );
}

/* ---------- tooltip-ish info note ---------- */
export function Note({ children, tone = "neutral" }: {
  children: ReactNode; tone?: "neutral" | "warn" | "info";
}) {
  const tones = {
    neutral: "border-line bg-night/60 text-mist",
    warn: "border-warn-400/50 bg-warn-500/10 text-warn-600",
    info: "border-aqua-400/40 bg-aqua-500/10 text-aqua-700",
  };
  return (
    <p className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${tones[tone]}`}>
      {children}
    </p>
  );
}
