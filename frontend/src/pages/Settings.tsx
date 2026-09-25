import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useFarm } from "../context/FarmContext";
import type { Farm } from "../lib/types";
import PageHeader from "../components/ui/PageHeader";
import { Card, Note, Skeleton, SourceChip } from "../components/ui/primitives";

const METHODS = ["flood", "furrow", "sprinkler", "drip", "center_pivot",
                 "manual", "rainfed"];
const SOILS = ["sandy", "loamy", "clay", "sandy_loam", "clay_loam", "other"];
const STAGES = ["Germination", "Vegetative", "Flowering",
                "Fruiting / Grain Filling", "Maturity"];

interface DataStatusPayload {
  sources: Array<{ name: string; status: string; needs_key?: boolean }>;
}

export default function Settings() {
  const { farm, dashboard, farmId, refresh, loadDemo, selectFarm } = useFarm();
  const navigate = useNavigate();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [status, setStatus] = useState<DataStatusPayload | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // editable fields
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [soil, setSoil] = useState("");
  const [method, setMethod] = useState("");
  const [stage, setStage] = useState("");
  const [moisture, setMoisture] = useState("");
  const [budget, setBudget] = useState("");
  const [district, setDistrict] = useState("");
  const [taluk, setTaluk] = useState("");
  const [stateName, setStateName] = useState("");

  useEffect(() => {
    api.listFarms().then(setFarms).catch(() => undefined);
    api.getDataStatus()
      .then((d) => setStatus(d as unknown as DataStatusPayload))
      .catch(() => undefined);
  }, [farmId, dashboard?.generated_at]);

  useEffect(() => {
    if (!farm) return;
    setName(farm.name ?? "");
    setArea(farm.area_ha != null ? String(farm.area_ha) : "");
    setSoil(farm.soil_type ?? "");
    setMethod(farm.irrigation_method ?? "");
    setStage(farm.growth_stage ?? "");
    setMoisture(farm.soil_moisture_pct != null
      ? String(farm.soil_moisture_pct) : "");
    setBudget(farm.budget_hint ?? "");
    setTaluk(farm.taluk ?? "");
    setDistrict(farm.district ?? "");
    setStateName(farm.state ?? "");
    setSaveMsg(null);
    setErr(null);
  }, [farmId, farm?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!farmId) return;
    setSaving(true);
    setErr(null);
    setSaveMsg(null);
    try {
      const payload: Record<string, unknown> = {};
      if (name && name !== farm?.name) payload.name = name;
      if (area !== (farm?.area_ha != null ? String(farm.area_ha) : "")) {
        payload.area_ha = area ? Number(area) : null;
      }
      if (soil !== (farm?.soil_type ?? "")) payload.soil_type = soil || null;
      if (method !== (farm?.irrigation_method ?? "")) {
        payload.irrigation_method = method || null;
      }
      if (stage !== (farm?.growth_stage ?? "")) payload.growth_stage = stage || null;
      if (budget !== (farm?.budget_hint ?? "")) payload.budget_hint = budget || null;
      if (taluk !== (farm?.taluk ?? "")) payload.taluk = taluk || null;
      if (district !== (farm?.district ?? "")) payload.district = district || null;
      if (stateName !== (farm?.state ?? "")) payload.state = stateName || null;
      if (moisture !== (farm?.soil_moisture_pct != null
        ? String(farm.soil_moisture_pct) : "") && moisture !== "") {
        payload.soil_moisture_pct = Number(moisture);
      }

      if (Object.keys(payload).length === 0) {
        setSaveMsg("Nothing changed.");
        setSaving(false);
        return;
      }

      await api.updateFarm(farmId, payload);
      setSaveMsg(`Saved ${Object.keys(payload).length} field(s) — re-running analysis.`);
      await refresh();
      setSaveMsg("Saved & analysis re-run with new values.");
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const resetMoisture = async () => {
    if (!farmId) return;
    setSaving(true);
    try {
      // explicitly clear → server falls back to labelled estimate
      await api.updateFarm(farmId, {
        soil_moisture_pct: null,
        soil_moisture_source: "estimated",
      });
      setMoisture("");
      await refresh();
      setSaveMsg("Moisture cleared — engine will use a labelled estimate.");
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  if (!farm && farms.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Settings" title="Farm & app settings"
                    sub="No farm exists yet." />
        <Card accent="soil" className="!p-6 text-center">
          <p className="text-sm text-mist/70">
            Load the demo farm or run the onboarding wizard first.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <button onClick={() => loadDemo().catch(() => undefined)}
                    className="btn-primary">▶ Try Demo Farm</button>
            <Link to="/analyze" className="btn-ghost">Analyze My Farm</Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Settings"
        title="Farm & data settings"
        sub="Edits re-run the full analysis pipeline immediately."
        actions={
          <button onClick={() => refresh()} className="btn-ghost !py-1.5 text-xs">
            ↻ Re-run analysis
          </button>
        }
      />

      {/* farm selector */}
      <Card accent="leaf" className="!p-5">
        <span className="card-title">Farms in this browser session</span>
        <div className="mt-3 flex flex-wrap gap-2">
          {farms.map((f) => (
            <button
              key={f.id}
              onClick={() => { selectFarm(f.id); navigate("/dashboard"); }}
              className={`chip !normal-case !px-3 !py-1.5 ${
                f.id === farmId ? "src-live" : "src-rule"}`}
            >
              {f.is_demo ? "🌾 " : "🚜 "}{f.name} · {f.crop_name}
            </button>
          ))}
          <button onClick={async () => {
                     try { await loadDemo(); navigate("/dashboard"); }
                     catch { /* keep user */ }
                   }}
                  className="chip !normal-case !px-3 !py-1.5 src-rule">
            + load demo again
          </button>
          <Link to="/analyze" className="chip !normal-case !px-3 !py-1.5 src-rule">
            + new farm
          </Link>
        </div>
      </Card>

      {/* edit form */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card accent="aqua" className="!p-5">
          <div className="flex items-center justify-between">
            <span className="card-title">Farm details</span>
            <SourceChip source="user_supplied" label="editable" />
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <label className="label">Farm name</label>
              <input className="field" value={name}
                     onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Area (ha)</label>
                <input className="field" inputMode="decimal" value={area}
                       placeholder="unknown"
                       onChange={(e) => setArea(e.target.value)} />
              </div>
              <div>
                <label className="label">Budget hint</label>
                <select className="field" value={budget}
                        onChange={(e) => setBudget(e.target.value)}>
                  <option value="">not set</option>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Soil texture</label>
                <select className="field" value={soil}
                        onChange={(e) => setSoil(e.target.value)}>
                  <option value="">unknown (estimate used)</option>
                  {SOILS.map((s) => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Growth stage</label>
                <select className="field" value={stage}
                        onChange={(e) => setStage(e.target.value)}>
                  <option value="">derive from sowing date</option>
                  {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Irrigation method</label>
              <div className="flex flex-wrap gap-2">
                {METHODS.map((m) => (
                  <button key={m} type="button"
                          onClick={() => setMethod(method === m ? "" : m)}
                          className={`chip !normal-case ${method === m
                            ? "src-live" : "src-rule"}`}>
                    {m.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Current soil moisture (% vol)</label>
              <div className="flex flex-wrap items-center gap-3">
                <input className="field !w-32" inputMode="decimal" value={moisture}
                       placeholder="estimated"
                       onChange={(e) => setMoisture(e.target.value)} />
                <button onClick={resetMoisture} type="button"
                        className="btn-ghost !py-1.5 text-xs">
                  clear → use estimate
                </button>
                <span className="chip src-estimated">
                  current source: {farm?.soil_moisture_source ?? "unknown"}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card accent="sand" className="!p-5">
          <div className="flex items-center justify-between">
            <span className="card-title">Location</span>
            <SourceChip source={farm?.location_precision ?? "unknown"}
                        label={farm?.location_precision} />
          </div>
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Taluk / Mandal</label>
                <input className="field" value={taluk}
                       onChange={(e) => setTaluk(e.target.value)} />
              </div>
              <div>
                <label className="label">District</label>
                <input className="field" value={district}
                       onChange={(e) => setDistrict(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">State</label>
              <input className="field" value={stateName}
                     onChange={(e) => setStateName(e.target.value)} />
            </div>
            {farm?.latitude != null && (
              <p className="text-[11px] font-mono text-mist/75">
                {farm.latitude.toFixed(4)}, {farm.longitude?.toFixed(4)} ·
                {" "}{farm.location_precision}
              </p>
            )}
            <Note tone="info">
              District/state drive the data.gov.in district rainfall series and
              NGO filtering. Coords drive live weather, NASA POWER history and
              soil lookups. Precision never exceeds the source (GPS → device,
              taluk → approximate).
            </Note>
          </div>

          {/* API key status */}
          <div className="mt-5">
            <span className="card-title">API key status</span>
            <div className="mt-2 space-y-1.5">
              {status?.sources
                .filter((s) => s.needs_key)
                .map((s) => (
                  <div key={s.name}
                       className="flex items-center justify-between rounded-lg
                                  border border-line/60 bg-night/40 px-3 py-2
                                  text-xs">
                    <span className="text-mist/75">{s.name}</span>
                    <span className={`chip ${s.status === "live_api"
                          || s.status === "historical_dataset"
                        ? "src-live" : "src-rule"}`}>
                      {s.status === "live_api" ? "key present"
                        : s.status === "historical_dataset"
                          ? "bundled fallback" : "not configured"}
                    </span>
                  </div>
                ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-mist/70">
              Keys are read from the backend <span className="font-mono">.env</span>{" "}
              at startup and are never exposed to the browser. Rotate them after
              the demo if this repository is shared.
            </p>
          </div>
        </Card>
      </div>

      {/* save bar */}
      <div className="glass-strong flex flex-wrap items-center justify-between
                      gap-3 p-4">
        <div className="text-xs">
          {saveMsg && <span className="text-leaf-600">{saveMsg}</span>}
          {err && <span className="text-alert-600">{err}</span>}
          {!saveMsg && !err && (
            <span className="text-mist/75">
              Edits persist to the local database and re-trigger weather → soil →
              crop → prediction → optimization → savings.
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => farmId && refresh()} className="btn-ghost !py-2
                         text-xs">
            Cancel / reload
          </button>
          <button onClick={save} disabled={saving || !farmId}
                  className="btn-primary !py-2 text-xs disabled:opacity-50">
            {saving ? "Saving…" : "💾 Save & re-analyze"}
          </button>
        </div>
      </div>

      {/* privacy / data */}
      <Card accent="soil" className="!p-5">
        <span className="card-title">Data & privacy</span>
        <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-mist/70">
          <li>• All farm data lives in a local SQLite file on this machine — no
            accounts, no cloud sync, no tracking.</li>
          <li>• Your browser stores only the selected farm id in localStorage.</li>
          <li>• API keys stay in the backend <span className="font-mono">.env</span> —
            never sent to the browser.</li>
          <li>• Browser geolocation is requested only when you press &ldquo;Use my
            location&rdquo;, and is reverse-geocoded server-side.</li>
        </ul>
        <p className="mt-3 text-[11px] text-mist/70">
          To wipe everything: stop the backend and delete{" "}
          <span className="font-mono">backend/aquasense.db</span> — the app
          re-seeds reference data on next start.
        </p>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link to="/dashboard" className="btn-primary">Back to dashboard</Link>
        <Link to="/data" className="btn-ghost">Data transparency</Link>
        <Link to="/how-it-works" className="btn-ghost">How it works</Link>
      </div>
    </div>
  );
}
