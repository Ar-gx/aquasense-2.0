import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../services/api";
import { useFarm } from "../context/FarmContext";
import type { CropCard } from "../lib/types";
import { SourceChip } from "../components/ui/primitives";
import LocationPicker, { EMPTY_LOCATION } from "../components/onboarding/LocationPicker";
import type { LocationValue } from "../components/onboarding/LocationPicker";

type StageStep = 0 | 1 | 2 | 3 | 4; // crop · location · field · knowledge · review

const STEPS = [
  { key: "crop", label: "Crop", icon: "🌱" },
  { key: "location", label: "Location", icon: "📍" },
  { key: "field", label: "Field", icon: "🚜" },
  { key: "know", label: "Conditions", icon: "🧪" },
  { key: "review", label: "Review", icon: "✨" },
];

const SOILS = [
  { key: "sandy", label: "Sandy", emoji: "🏖️" },
  { key: "loamy", label: "Loamy", emoji: "🟤" },
  { key: "clay", label: "Clay", emoji: "🧱" },
  { key: "sandy_loam", label: "Sandy loam", emoji: "🌾" },
  { key: "clay_loam", label: "Clay loam", emoji: "🪨" },
  { key: "other", label: "Other / mix", emoji: "❓" },
];

const METHODS = [
  { key: "flood", label: "Flood / basin" },
  { key: "furrow", label: "Furrow" },
  { key: "sprinkler", label: "Sprinkler" },
  { key: "drip", label: "Drip" },
  { key: "center_pivot", label: "Center pivot" },
  { key: "manual", label: "Manual / hose" },
  { key: "rainfed", label: "Rainfed (no irrigation)" },
];

const STAGES_LIST = ["Germination", "Vegetative", "Flowering",
                     "Fruiting / Grain Filling", "Maturity"];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { createFrom, loading, error, loadDemo } = useFarm();
  const [step, setStep] = useState<StageStep>(0);

  const [crops, setCrops] = useState<CropCard[]>([]);
  const [crop, setCrop] = useState<string>("");
  const [customCrop, setCustomCrop] = useState("");

  const [loc, setLoc] = useState<LocationValue>(EMPTY_LOCATION);

  const [sowingDate, setSowingDate] = useState(todayISO());
  const [stageKnown, setStageKnown] = useState(false);
  const [growthStage, setGrowthStage] = useState("");
  const [area, setArea] = useState("");
  const [irrigationMethod, setIrrigationMethod] = useState("");
  const [budget, setBudget] = useState("");

  const [soilKnown, setSoilKnown] = useState(false);
  const [soilType, setSoilType] = useState("");
  const [moistureKnown, setMoistureKnown] = useState(false);
  const [moisture, setMoisture] = useState("25");
  const [lastIrrigKnown, setLastIrrigKnown] = useState(false);
  const [lastIrrigDate, setLastIrrigDate] = useState(daysAgoISO(5));
  const [lastIrrigQty, setLastIrrigQty] = useState("");
  const [prevCrop, setPrevCrop] = useState("");

  useEffect(() => {
    api.getCrops().then((r) => setCrops(r.cards)).catch(() => undefined);
  }, []);

  const unknownFields = useMemo(() => {
    const u: string[] = [];
    if (!soilKnown) u.push("soil_type");
    if (!moistureKnown) u.push("soil_moisture");
    if (!stageKnown) u.push("growth_stage");
    if (!lastIrrigKnown) u.push("last_irrigation");
    if (!area) u.push("area");
    return u;
  }, [soilKnown, moistureKnown, stageKnown, lastIrrigKnown, area]);

  const canNext = (): boolean => {
    if (step === 0) return Boolean(crop) && (crop !== "other" || customCrop.trim().length > 0);
    if (step === 1) return Boolean(loc.taluk || loc.district || loc.state
                                   || loc.latitude != null);
    if (step === 2) return Boolean(sowingDate);
    return true;
  };

  const submit = async () => {
    const payload: Record<string, unknown> = {
      name: "My Farm",
      crop_name: crop === "other" ? "other" : crop,
      custom_crop_name: crop === "other" ? customCrop.trim() : null,
      sowing_date: sowingDate,
      taluk: loc.taluk, district: loc.district, state: loc.state,
      latitude: loc.latitude, longitude: loc.longitude,
      location_precision: loc.location_precision,
      unknown_fields: unknownFields,
      growth_stage: stageKnown && growthStage ? growthStage : null,
      area_ha: area ? Number(area) : null,
      soil_type: soilKnown && soilType ? soilType : null,
      soil_moisture_pct: moistureKnown ? Number(moisture) : null,
      irrigation_method: irrigationMethod || null,
      budget_hint: budget || null,
      previous_crop: prevCrop.trim() || null,
      last_irrigation_at: lastIrrigKnown ? lastIrrigDate : null,
      last_irrigation_qty_l: lastIrrigKnown && lastIrrigQty
        ? Number(lastIrrigQty) : null,
      prev_irrigation_info: lastIrrigKnown && lastIrrigQty
        ? `Recorded: ~${lastIrrigQty} L on ${lastIrrigDate}`
        : null,
    };
    try {
      await createFrom(payload);
      navigate("/dashboard"); // overlay shows pipeline stages while loading
    } catch {
      /* error surfaced via context */
    }
  };

  const cropCards = crops.length ? crops : [];

  return (
    <div className="min-h-screen">
      {/* header */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-panel/85
                          backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <button onClick={() => navigate("/")}
                  className="text-sm text-mist/70 hover:text-leaf-600">
            ← Home
          </button>
          <span className="ms-auto font-display text-sm font-semibold
                           text-ink">
            Analyze My Farm
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* stepper */}
        <div className="mb-8 flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex flex-1 items-center gap-1.5">
              <button
                type="button"
                onClick={() => i < step && setStep(i as StageStep)}
                className={`flex h-9 w-full items-center justify-center gap-1.5
                            rounded-lg border px-2 text-[11px] transition ${
                  i < step
                    ? "border-leaf-400/40 bg-leaf-500/10 text-leaf-700"
                    : i === step
                      ? "border-aqua-400/60 bg-aqua-500/10 text-aqua-700"
                      : "border-line/60 bg-night/40 text-mist/65"
                }`}
              >
                <span>{s.icon}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong p-6"
          >
            {/* ---------------- STEP 1: CROP ---------------- */}
            {step === 0 && (
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">
                  What are you growing?
                </h2>
                <p className="mt-1 text-sm text-mist/70">
                  Pick a crop card — or choose &ldquo;Other&rdquo; and type its
                  name. Water demand is derived from FAO-56 crop coefficients
                  for your selection.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3
                                md:grid-cols-4">
                  {cropCards.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setCrop(c.key)}
                      className={`rounded-xl border p-3 text-start transition
                                  hover:-translate-y-0.5 ${
                        crop === c.key
                          ? "border-leaf-400 bg-leaf-500/15 shadow-glow"
                          : "border-line/70 bg-night/50 hover:border-leaf-400/50"
                      }`}
                    >
                      {/* icon tile tinted with the crop's own colour */}
                      <div
                        className="grid h-9 w-9 place-items-center text-2xl"
                        style={{
                          backgroundColor: `${c.color}26`,
                          borderRadius: "0.625rem",
                          boxShadow: `inset 0 0 0 1px ${c.color}59`,
                        }}
                      >
                        {c.emoji}
                      </div>
                      <div className="mt-1.5 text-xs font-medium text-ink">
                        {c.name}
                      </div>
                      <div className="text-[10px] text-mist/70">
                        {c.lifespan_days}-day cycle
                      </div>
                    </button>
                  ))}
                </div>
                {crop === "other" && (
                  <div className="mt-4">
                    <label className="label">Crop name</label>
                    <input className="field" value={customCrop}
                           placeholder="e.g. Cumin, Mustard, Groundnut…"
                           onChange={(e) => setCustomCrop(e.target.value)} />
                    <p className="mt-1.5 text-[11px] text-mist/70">
                      Unknown crops use a generic 120-day reference cycle —
                      labelled as an estimate everywhere it appears.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ---------------- STEP 2: LOCATION ---------------- */}
            {step === 1 && (
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">
                  Where is the farm?
                </h2>
                <p className="mt-1 text-sm text-mist/70">
                  Used to fetch live weather, rainfall history and soil
                  properties. Location is approximate — never more precise
                  than the source allows.
                </p>
                <div className="mt-5">
                  <LocationPicker value={loc} onChange={setLoc} />
                </div>
              </div>
            )}

            {/* ---------------- STEP 3: FIELD ---------------- */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="font-display text-xl font-semibold text-ink">
                    Field details
                  </h2>
                  <p className="mt-1 text-sm text-mist/70">
                    Don&rsquo;t know something? Leave it — the engine will use
                    labelled reference estimates instead of guessing silently.
                  </p>
                </div>

                <div>
                  <label className="label">Sowing / transplanting date *</label>
                  <input type="date" className="field max-w-xs" value={sowingDate}
                         max={todayISO()}
                         onChange={(e) => setSowingDate(e.target.value)} />
                  <p className="mt-1 text-[11px] text-mist/70">
                    Drives growth-stage detection. Approximate is fine.
                  </p>
                </div>

                <div>
                  <label className="label">Current growth stage</label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button"
                            onClick={() => setStageKnown(false)}
                            className={`chip !px-3 !py-1.5 !normal-case ${
                              !stageKnown ? "src-user" : "src-rule"}`}>
                      I don&rsquo;t know — derive from sowing date
                    </button>
                    {STAGES_LIST.map((s) => (
                      <button key={s} type="button"
                              onClick={() => { setStageKnown(true); setGrowthStage(s); }}
                              className={`chip !px-3 !py-1.5 !normal-case ${
                                stageKnown && growthStage === s
                                  ? "src-live" : "src-rule"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Farm area (hectares)</label>
                    <input className="field" inputMode="decimal"
                           placeholder="e.g. 2.5 — leave blank if unsure"
                           value={area}
                           onChange={(e) => setArea(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Budget for upgrades</label>
                    <div className="flex flex-wrap gap-2">
                      {["low", "medium", "high"].map((b) => (
                        <button key={b} type="button"
                                onClick={() => setBudget(budget === b ? "" : b)}
                                className={`chip !px-3 !py-1.5 !normal-case ${
                                  budget === b ? "src-user" : "src-rule"}`}>
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="label">Irrigation method in use</label>
                  <div className="flex flex-wrap gap-2">
                    {METHODS.map((m) => (
                      <button key={m.key} type="button"
                              onClick={() => setIrrigationMethod(
                                irrigationMethod === m.key ? "" : m.key)}
                              className={`chip !px-3 !py-1.5 !normal-case ${
                                irrigationMethod === m.key ? "src-live" : "src-rule"}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-mist/70">
                    Application efficiency of this method is used in every
                    quantity calculation (flood ≈ 45 %, drip ≈ 90 %).
                  </p>
                </div>
              </div>
            )}

            {/* ---------------- STEP 4: CONDITIONS ---------------- */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="font-display text-xl font-semibold text-ink">
                    What do you know about current conditions?
                  </h2>
                  <p className="mt-1 text-sm text-mist/70">
                    Honesty is a feature: &ldquo;I don&rsquo;t know&rdquo; is a
                    valid answer and will be labelled as an estimate downstream.
                  </p>
                </div>

                {/* soil */}
                <div>
                  <label className="label">Soil texture</label>
                  <button type="button" onClick={() => setSoilKnown(false)}
                          className={`chip me-2 !px-3 !py-1.5 !normal-case ${
                            !soilKnown ? "src-user" : "src-rule"}`}>
                    I don&rsquo;t know
                  </button>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SOILS.map((s) => (
                      <button key={s.key} type="button"
                              onClick={() => { setSoilKnown(true); setSoilType(s.key); }}
                              className={`chip !px-3 !py-1.5 !normal-case ${
                                soilKnown && soilType === s.key
                                  ? "src-live" : "src-rule"}`}>
                        {s.emoji} {s.label}
                      </button>
                    ))}
                  </div>
                  {!soilKnown && (
                    <p className="mt-1.5 text-[11px] text-warn-600/80">
                      Loam-like reference values will be used and flagged in the
                      data-status panel.
                    </p>
                  )}
                </div>

                {/* moisture */}
                <div>
                  <label className="label">Soil moisture right now</label>
                  <button type="button" onClick={() => setMoistureKnown(false)}
                          className={`chip me-2 !px-3 !py-1.5 !normal-case ${
                            !moistureKnown ? "src-user" : "src-rule"}`}>
                    I don&rsquo;t know — estimate it
                  </button>
                  <div className="mt-2 flex items-center gap-3">
                    <button type="button"
                            onClick={() => setMoistureKnown(true)}
                            className={`chip !px-3 !py-1.5 !normal-case ${
                              moistureKnown ? "src-live" : "src-rule"}`}>
                      I have a reading / sensor
                    </button>
                    {moistureKnown && (
                      <div className="flex items-center gap-2">
                        <input type="range" min={0} max={60} value={moisture}
                               onChange={(e) => setMoisture(e.target.value)}
                               className="w-44" />
                        <span className="font-mono text-sm text-leaf-700 w-14">
                          {moisture}%
                        </span>
                      </div>
                    )}
                  </div>
                  {!moistureKnown && (
                    <p className="mt-1.5 text-[11px] text-warn-600/80">
                      A labelled estimate (from soil texture + recent rain) will
                      be used — confidence in recommendations will show as
                      lower.
                    </p>
                  )}
                </div>

                {/* last irrigation */}
                <div>
                  <label className="label">Last irrigation</label>
                  <button type="button" onClick={() => setLastIrrigKnown(false)}
                          className={`chip me-2 !px-3 !py-1.5 !normal-case ${
                            !lastIrrigKnown ? "src-user" : "src-rule"}`}>
                    I don&rsquo;t remember
                  </button>
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <button type="button"
                            onClick={() => setLastIrrigKnown(true)}
                            className={`chip !px-3 !py-1.5 !normal-case ${
                              lastIrrigKnown ? "src-live" : "src-rule"}`}>
                      I remember
                    </button>
                    {lastIrrigKnown && (
                      <>
                        <div>
                          <label className="label !mb-1">Date</label>
                          <input type="date" className="field !py-1.5 text-xs"
                                 value={lastIrrigDate} max={todayISO()}
                                 onChange={(e) => setLastIrrigDate(e.target.value)} />
                        </div>
                        <div>
                          <label className="label !mb-1">Approx. litres</label>
                          <input className="field !py-1.5 text-xs" inputMode="numeric"
                                 placeholder="e.g. 2500000"
                                 value={lastIrrigQty}
                                 onChange={(e) => setLastIrrigQty(e.target.value)} />
                        </div>
                      </>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] text-mist/70">
                    Used as the &ldquo;traditional baseline&rdquo; for
                    water-savings comparisons. Without it, a documented
                    conventional default is used and labelled.
                  </p>
                </div>

                {/* previous crop */}
                <div>
                  <label className="label">Previous crop (rotation credit)</label>
                  <input className="field" placeholder="e.g. Pulses (kharif) — leave blank if unsure"
                         value={prevCrop}
                         onChange={(e) => setPrevCrop(e.target.value)} />
                  <p className="mt-1 text-[11px] text-mist/70">
                    A legume predecessor credits ~45 kg N/ha of fixed nitrogen.
                  </p>
                </div>
              </div>
            )}

            {/* ---------------- STEP 5: REVIEW ---------------- */}
            {step === 4 && (
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">
                  Review & analyze
                </h2>
                <div className="mt-5 divide-y divide-line/60 rounded-xl
                                border border-line/70 bg-night/40">
                  <Row k="Crop"
                       v={crop === "other" ? customCrop || "Other"
                          : (cropCards.find((c) => c.key === crop)?.name ?? crop)} />
                  <Row k="Location"
                       v={[loc.taluk, loc.district, loc.state]
                          .filter(Boolean).join(", ") || "—"}
                       extra={loc.location_precision} />
                  <Row k="Sowing date" v={sowingDate} />
                  <Row k="Growth stage"
                       v={stageKnown ? growthStage : "derived from sowing date"}
                       extra={stageKnown ? "user supplied" : "computed"} />
                  <Row k="Area" v={area ? `${area} ha` : "unknown → per-hectare basis"}
                       extra={area ? "user supplied" : "estimated"} />
                  <Row k="Soil"
                       v={soilKnown ? soilType.replace("_", " ") : "unknown"}
                       extra={soilKnown ? "user supplied"
                                        : "loam reference (flagged)"} />
                  <Row k="Moisture"
                       v={moistureKnown ? `${moisture}% vol` : "not provided"}
                       extra={moistureKnown ? "user supplied"
                                            : "estimated from soil + rain"} />
                  <Row k="Irrigation method"
                       v={irrigationMethod
                          ? METHODS.find((m) => m.key === irrigationMethod)?.label
                            ?? irrigationMethod
                          : "not specified"} />
                  <Row k="Unknowns flagged"
                       v={unknownFields.length ? unknownFields.join(", ") : "none"} />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <SourceChip source="user_supplied" label="your inputs" />
                  <SourceChip source="estimated" label="reference estimates" />
                  <SourceChip source="live_api" label="live weather by coords" />
                  <SourceChip source="simulated" label="seeded sensor history" />
                </div>

                <p className="mt-4 text-xs leading-relaxed text-mist/65">
                  On submit, the backend runs the full pipeline: soil → weather
                  (live APIs) → crop water demand → ML moisture prediction →
                  12-step irrigation optimization → savings calculation. A
                  labelled simulated sensor history is seeded so charts work
                  instantly.
                </p>

                {error && (
                  <p className="mt-3 text-xs text-alert-600">{error}</p>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* nav */}
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1) as StageStep)}
            disabled={step === 0 || loading}
            className="btn-ghost disabled:opacity-40"
          >
            ← Back
          </button>
          <div className="text-xs text-mist/70">
            Step {step + 1} of {STEPS.length}
          </div>
          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(4, s + 1) as StageStep)}
              disabled={!canNext()}
              className="btn-primary disabled:opacity-40"
            >
              Continue →
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={loading}
                    className="btn-primary disabled:opacity-60">
              {loading ? "Analyzing…" : "✨ Analyze My Farm"}
            </button>
          )}
        </div>

        <div className="mt-8 text-center">
          <button onClick={async () => {
            try {
              await loadDemo();
              navigate("/dashboard");
            } catch { navigate("/analyze"); }
          }}
            className="text-xs text-mist/75 hover:text-leaf-600">
            Rather see it working? Load the Demo Farm instead →
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, extra }: { k: string; v: string; extra?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-mist/65">{k}</span>
      <span className="text-end">
        <span className="text-ink">{v}</span>
        {extra && <span className="ms-2 text-[10px] text-mist/70">{extra}</span>}
      </span>
    </div>
  );
}
