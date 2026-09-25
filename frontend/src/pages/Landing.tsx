import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CountUp, Note, SectionTitle, SourceChip, Stripe, type Accent }
  from "../components/ui/primitives";
import { AnimatedGridPattern } from "../components/ui/animated-grid-pattern";
import { useFarm } from "../context/FarmContext";
import { api } from "../services/api";
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

const PROBLEM = [
  {
    icon: "⏰",
    title: "Irrigating by the calendar",
    body: "Fixed schedules ignore today's soil moisture, crop stage and forecast rain — so fields get watered whether they need it or not.",
  },
  {
    icon: "🌊",
    title: "Waterlogging & leaching",
    body: "Over-irrigation saturates the root zone, starves roots of oxygen and pushes dissolved nutrients below the reach of the crop.",
  },
  {
    icon: "📉",
    title: "Invisible soil health",
    body: "Nutrient depletion is rarely measured, so replenishment becomes guesswork — wasting fertilizer and degrading the soil season after season.",
  },
];

const SOLUTIONS = [
  { n: "01", to: "/crop-analysis", icon: "🌱", title: "Crop Analysis",
    body: "Lifecycle water budget for your crop: Kc × ETo × growth-stage days, stage by stage." },
  { n: "02", to: "/irrigation", icon: "💧", title: "Irrigation Goal",
    body: "When to irrigate, how much (L & mm) and why — hybrid ML + rules, never a blind schedule." },
  { n: "03", to: "/soil-health", icon: "🧪", title: "Nutrient Replenishment",
    body: "Legume rotation & manure recommendations with explained compatibility scores." },
  { n: "04", to: "/irrigation", icon: "🚿", title: "Modern Irrigation Methods",
    body: "Flood → drip/sprinkler upgrade advice with efficiency gains and budget fit." },
  { n: "05", to: "/water-analytics", icon: "📊", title: "Water Analytics",
    body: "Baseline vs AI use, honest savings (negative included) and rainwater tracked separately." },
  { n: "06", to: "/dashboard", icon: "⚠️", title: "Warnings",
    body: "Red/yellow/green risk indicators: heavy rain, waterlogging, stress, heat, leaching." },
  { n: "07", to: "/connect", icon: "🤝", title: "NGO Connections",
    body: "Verified organizations with official websites only — no invented contacts." },
  { n: "08", to: "/achievements", icon: "🏆", title: "Achievements",
    body: "Water conserved, efficiency and crop-water-adequacy metrics with their exact basis." },
];

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* earthy accent rotation — green · blue · yellow · brown */
const HUE_ROT: Accent[] = ["leaf", "aqua", "sand", "soil"];
const PROBLEM_ACCENTS: Accent[] = ["sand", "alert", "soil"];
/* literal class strings so Tailwind emits them */
const TINT = [
  "bg-leaf-100 text-leaf-700",
  "bg-aqua-100 text-aqua-700",
  "bg-sand-100 text-sand-800",
  "bg-soil-100 text-soil-700",
];

const fadeUp = {
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.55, ease: EASE },
};

export default function Landing() {
  const { loadDemo, loading, dashboard } = useFarm();
  const [impact, setImpact] = useState<ImpactData | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // real model output from the demo farm — never hard-coded numbers
    api.getImpact()
      .then((d) => setImpact(d as ImpactData))
      .catch(() => setImpact({ available: false }));
  }, []);

  const demo = async () => {
    try {
      await loadDemo();
      navigate("/dashboard");
    } catch {
      navigate("/analyze");
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* ---------------- top bar ---------------- */}
      <header className="sticky top-0 z-50 border-b border-line/60 bg-night/85
                          backdrop-blur-xl">
        {/* horizon stripe — leaf → aqua → sand → soil */}
        <span aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-[3px]
                         bg-[linear-gradient(90deg,#6d9a4c_0%,#557f9d_35%,#d4ac45_70%,#a18055_100%)]" />
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4">
          <span className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg
                             bg-gradient-to-br from-leaf-400 to-aqua-500
                             text-sm font-bold text-ink">A</span>
            <span className="font-display text-sm font-semibold text-ink">
              AquaSense <span className="text-leaf-600">AI</span>
            </span>
          </span>
          <nav className="ms-auto hidden items-center gap-5 text-[13px]
                           text-mist/75 md:flex">
            <a href="#problem" className="hover:text-leaf-600">Problem</a>
            <a href="#solutions" className="hover:text-leaf-600">Solutions</a>
            <Link to="/how-it-works" className="hover:text-leaf-600">How It Works</Link>
            <Link to="/data" className="hover:text-leaf-600">Data</Link>
          </nav>
          <div className="ms-auto flex items-center gap-2 md:ms-4">
            <button onClick={demo} disabled={loading}
                    className="btn-ghost !px-3.5 !py-2 text-xs">
              {loading ? "Loading…" : "Try Demo Farm"}
            </button>
            <Link to="/analyze" className="btn-primary !px-4 !py-2 text-xs">
              Analyze My Farm
            </Link>
          </div>
        </div>
      </header>

      {/* ---------------- hero ---------------- */}
      <section className="relative overflow-hidden">
        {/* earthy gradient wash — carries colour into the hero */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br
                        from-leaf-100 via-sand-50 to-aqua-100
                        [mask-image:linear-gradient(to_bottom,black_55%,transparent)]" />
        {/* animated earthy grid — full-bleed hero background */}
        <AnimatedGridPattern />
        <div className="pointer-events-none absolute -right-32 -top-24 h-96
                        w-96 rounded-full bg-leaf-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 top-40 h-80
                        w-80 rounded-full bg-aqua-500/10 blur-3xl" />

        {/* floating droplets */}
        {[...Array(6)].map((_, i) => (
          <motion.span
            key={i}
            className="pointer-events-none absolute text-leaf-600/40"
            style={{ left: `${8 + i * 16}%`, top: `${30 + (i % 3) * 18}%` }}
            animate={{ y: [-14, 14], opacity: [0.25, 0.7, 0.25] }}
            transition={{ repeat: Infinity, duration: 4 + i * 0.7,
                         ease: "easeInOut", delay: i * 0.4 }}
          >
            💧
          </motion.span>
        ))}

        <div className="relative mx-auto max-w-[1400px] px-4 pb-20 pt-20
                        md:px-6 md:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            <span className="chip src-live mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              PS-2B · Smart Agriculture · Hackathon MVP
            </span>
            <h1 className="font-display text-4xl font-bold leading-tight
                           text-ink md:text-6xl">
              Smarter Irrigation.
              <br />
              <span className="bg-gradient-to-r from-leaf-500 to-aqua-600
                               bg-clip-text text-transparent">
                Healthier Soil.
              </span>
              <br />
              Every Drop Counts.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-mist/85
                          md:text-lg">
              AquaSense AI decides <em className="text-leaf-600 not-italic font-medium">if,
              when and how much</em> to irrigate — from live weather, soil physics,
              crop growth stage and a trained ML model.{" "}
              <span className="text-leaf-700">
                Do not irrigate simply because it is time to irrigate.
              </span>
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={demo} disabled={loading}
                      className="btn-primary !px-6 !py-3 text-base">
                {loading ? "Loading demo…" : "▶ Try the Demo Farm"}
              </button>
              <Link to="/analyze" className="btn-ghost !px-6 !py-3 text-base">
                Analyze My Farm →
              </Link>
            </div>
            <p className="mt-3 text-xs text-mist/70">
              One-click demo · runs the full pipeline in ~30–60 s · no sensors or
              sign-up required
            </p>
          </motion.div>

          {/* impact strip — real model output, each labelled */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {impact?.available ? (
              <>
                <Stat value={<CountUp value={impact.water_saved_total_l ?? 0}
                                      format={fmtLitresShort} />}
                      label="Est. water saved (30 days)" chip="estimated"
                      accent="leaf" />
                <Stat value={<><CountUp value={impact.reduction_pct ?? 0}
                                        format={(v) => pct(v, 1)} /></>}
                      label="vs traditional schedule" chip="estimated"
                      accent="aqua" />
                <Stat value={<CountUp value={impact.irrigation_efficiency_pct ?? 0}
                                      format={(v) => `${Math.round(v)}%`} />}
                      label="Irrigation efficiency" chip="estimated"
                      accent="sand" />
                <Stat value={<CountUp value={impact.rainwater_conserved_l ?? 0}
                                      format={fmtLitresShort} />}
                      label="Rainwater utilised (separate)" chip="estimated"
                      accent="soil" />
              </>
            ) : (
              <>
                <Stat value="8" label="Core AI solutions" chip="demo" accent="leaf" />
                <Stat value="12" label="Irrigation decision steps" chip="demo"
                      accent="aqua" />
                <Stat value="6" label="Analysis pipeline stages" chip="demo"
                      accent="sand" />
                <Stat value="0" label="Sensors required" chip="demo" accent="soil" />
              </>
            )}
          </motion.div>
          <div className="mt-3">
            <Note tone={impact?.available ? "warn" : "info"}>
              {impact?.available
                ? `Model scenario from the Demo Farm (${impact.basis ?? "estimated"}) — an
                   illustrative model scenario, not metered field results. Rainwater
                   utilisation is reported separately and is never double-counted
                   with irrigation savings.`
                : `Load the Demo Farm to generate these numbers from the live
                   model — every figure on this site is produced by the running
                   pipeline, labelled with its data source.`}
            </Note>
          </div>
        </div>
      </section>

      {/* ---------------- problem (§2) ---------------- */}
      <section id="problem" className="border-t border-line/60 bg-night/40
                                       py-16 md:py-20">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6">
          <motion.div {...fadeUp}>
            <SectionTitle
              eyebrow="The Problem"
              title="Farmers irrigate on schedule, not on need"
              sub="Data-driven smart irrigation & soil health optimization —
                   reducing over-irrigation, waterlogging, nutrient leaching and
                   freshwater use without hurting crop water adequacy."
            />
          </motion.div>
          <div className="grid gap-4 md:grid-cols-3">
            {PROBLEM.map((p, i) => (
              <motion.div key={p.title} {...fadeUp}
                          transition={{ ...fadeUp.transition, delay: i * 0.1 }}
                          className="glass relative p-5">
                <Stripe accent={PROBLEM_ACCENTS[i]} />
                <div className="text-3xl">{p.icon}</div>
                <h3 className="mt-3 font-display text-base font-semibold
                               text-ink">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist/75">{p.body}</p>
              </motion.div>
            ))}
          </div>
          <motion.div {...fadeUp} className="mt-6">
            <Note tone="warn">
              <strong className="text-warn-600">Core principle:</strong> Do not
              irrigate simply because it is time to irrigate. AquaSense evaluates
              root-zone moisture, crop stage, soil retention, forecast rainfall and
              application efficiency before recommending a single drop.
            </Note>
          </motion.div>
        </div>
      </section>

      {/* ---------------- solutions ---------------- */}
      <section id="solutions" className="py-16 md:py-20">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6">
          <motion.div {...fadeUp}>
            <SectionTitle
              eyebrow="8 Solutions"
              title="One platform, the whole irrigation decision"
              sub="Every card links to a working page in this app — these are not
                   mock-ups."
            />
          </motion.div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SOLUTIONS.map((s, i) => (
              <motion.div key={s.n} {...fadeUp}
                          transition={{ ...fadeUp.transition, delay: (i % 4) * 0.07 }}>
                <Link to={s.to}
                      className="glass group relative block h-full p-5 transition
                                 hover:-translate-y-1 hover:border-leaf-400/50">
                  <Stripe accent={HUE_ROT[i % 4]} />
                  <div className="flex items-center justify-between">
                    <span className={`grid h-9 w-9 place-items-center rounded-xl
                                      text-xl ${TINT[i % 4]}`}>{s.icon}</span>
                    <span className="font-mono text-xs text-mist/65 group-hover:text-leaf-600">
                      {s.n}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-sm font-semibold
                                 text-ink group-hover:text-leaf-600">
                    {s.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-mist/70">
                    {s.body}
                  </p>
                  <span className="mt-3 inline-block text-[11px] text-leaf-600
                                   opacity-0 transition group-hover:opacity-100">
                    Open →
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- how it works teaser ---------------- */}
      <section className="border-t border-line/60 bg-night/40 py-16 md:py-20">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6">
          <motion.div {...fadeUp}>
            <SectionTitle
              eyebrow="Pipeline"
              title="Weather → Soil → Crop → ML → Irrigation"
              sub="The demo overlay animates the *actual* stages executed by the
                   backend — real API calls in sequence, not theatre."
              center
            />
          </motion.div>
          <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {["Soil read", "Weather", "Crop demand", "Moisture forecast",
              "Optimize", "Savings"].map((s, i) => (
              <motion.div key={s} {...fadeUp}
                          transition={{ ...fadeUp.transition, delay: i * 0.08 }}
                          className="glass relative p-4 text-center">
                <Stripe accent={HUE_ROT[i % 4]} />
                <div className={`mx-auto grid h-7 w-7 place-items-center rounded-full
                                 font-mono text-[11px] font-semibold ${TINT[i % 4]}`}>
                  0{i + 1}
                </div>
                <div className="mt-1.5 text-xs font-medium text-ink">{s}</div>
                {i < 5 && (
                  <span className="absolute -right-2.5 top-1/2 hidden
                                   -translate-y-1/2 text-leaf-500/60 sm:block">→</span>
                )}
              </motion.div>
            ))}
          </div>
          <motion.div {...fadeUp} className="mt-8 text-center">
            <Link to="/how-it-works" className="btn-ghost">
              See the full method →
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ---------------- data honesty ---------------- */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6">
          <motion.div {...fadeUp}>
            <SectionTitle
              eyebrow="Data Honesty"
              title="Every number shows its source"
              sub="Live API values, historical datasets, model predictions and
                   simulated demo data are never mixed silently."
            />
          </motion.div>
          <motion.div {...fadeUp}
                      className="glass flex flex-wrap items-center gap-2.5 p-5">
            <SourceChip source="live_api" label="OpenWeather / Open-Meteo" />
            <SourceChip source="live_api" label="NASA POWER" />
            <SourceChip source="live_api" label="data.gov.in" />
            <SourceChip source="historical_dataset" label="FAO AQUASTAT" />
            <SourceChip source="historical_dataset" label="USDA NASS" />
            <SourceChip source="model_prediction" label="XGBoost moisture model" />
            <SourceChip source="estimated" label="Savings scenarios" />
            <SourceChip source="simulated" label="Demo sensors" />
          </motion.div>
          <motion.p {...fadeUp} className="mt-4 max-w-3xl text-xs leading-relaxed
                                           text-mist/75">
            The ML model is trained on a simulated FAO-style water-balance dataset
            (not field-validated), savings figures are model scenarios (not metered
            field results), and demo sensor readings are clearly tagged
            &ldquo;simulated&rdquo;. Nothing here fabricates yields, accuracy or
            field trials.
          </motion.p>
          <motion.div {...fadeUp} className="mt-5">
            <Link to="/data" className="btn-ghost !py-2 text-xs">
              View the full data-transparency panel →
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ---------------- final CTA ---------------- */}
      <section className="relative overflow-hidden border-t border-line/60
                          bg-gradient-to-br from-leaf-100 via-aqua-50 to-sand-100
                          py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center md:px-6">
          <motion.h2 {...fadeUp}
                     className="font-display text-3xl font-bold text-ink
                                md:text-4xl">
            Ready to see what your field actually needs?
          </motion.h2>
          <motion.p {...fadeUp} className="mt-4 text-sm leading-relaxed
                                           text-mist/80 md:text-base">
            Load the demo farm for a complete walkthrough, or answer a few
            questions about your own field — you can honestly answer
            &ldquo;I don&rsquo;t know&rdquo; to any of them.
          </motion.p>
          <motion.div {...fadeUp} className="mt-8 flex flex-wrap justify-center gap-3">
            <button onClick={demo} disabled={loading} className="btn-primary
                            !px-6 !py-3 text-base">
              {loading ? "Loading…" : "▶ Try Demo Farm"}
            </button>
            <Link to="/analyze" className="btn-ghost !px-6 !py-3 text-base">
              Start onboarding →
            </Link>
          </motion.div>
          {dashboard && (
            <p className="mt-4 text-xs text-leaf-600">
              Farm &ldquo;{dashboard.farm.name}&rdquo; is already analysed —
              open the dashboard.
            </p>
          )}
        </div>
      </section>

      {/* ---------------- footer ---------------- */}
      <footer className="border-t border-line/70 bg-night/70 py-8">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center
                        justify-between gap-3 px-4 text-xs text-mist/70 md:px-6">
          <span>AquaSense AI · Smarter Irrigation. Healthier Soil. Every Drop Counts.</span>
          <span className="flex gap-4">
            <Link to="/how-it-works" className="hover:text-leaf-600">How It Works</Link>
            <Link to="/data" className="hover:text-leaf-600">Data Transparency</Link>
            <Link to="/impact" className="hover:text-leaf-600">Impact</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

function Stat({ value, label, chip, accent = "leaf" }: {
  value: ReactNode; label: string; chip: string; accent?: Accent;
}) {
  return (
    <div className="glass relative p-4">
      <Stripe accent={accent} />
      <div className="font-display text-2xl font-semibold text-ink">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-mist/65">{label}</div>
      <div className="mt-1.5">
        <span className={`chip ${chip === "demo" ? "src-rule" : "src-estimated"}`}>
          {chip === "demo" ? "static" : "estimated"}
        </span>
      </div>
    </div>
  );
}
