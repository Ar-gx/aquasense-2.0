import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from "recharts";
import { useFarm } from "../context/FarmContext";
import { api } from "../services/api";
import type { HistoryPayload } from "../lib/types";
import AdvancedInfo from "../components/ui/AdvancedInfo";
import PageHeader from "../components/ui/PageHeader";
import WaterUsageChart from "../components/charts/WaterUsageChart";
import { Card, EmptyFarm, Note, Skeleton, SourceChip } from "../components/ui/primitives";
import { axisProps, C, DarkTooltip, gridProps } from "../components/charts/chartTheme";
import { fmtDateShort, fmtLitresShort, fmtL, pct } from "../lib/format";

const METHODS = ["flood", "furrow", "sprinkler", "drip", "center_pivot",
                 "manual", "rainfed"];

export default function History() {
  const { dashboard, farmId, loadDemo, refresh } = useFarm();
  const [h, setH] = useState<HistoryPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // record form
  const [qty, setQty] = useState("");
  const [method, setMethod] = useState("flood");
  const [mBefore, setMBefore] = useState("");
  const [mAfter, setMAfter] = useState("");
  const [followed, setFollowed] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formNote, setFormNote] = useState<string | null>(null);

  useEffect(() => {
    if (!farmId) { setLoading(false); return; }
    let dead = false;
    setLoading(true);
    setError(null);
    api.getHistory(farmId, "daily", 30)
      .then((p) => { if (!dead) setH(p); })
      .catch((e) => { if (!dead) setError(String(e?.message ?? e)); })
      .finally(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
  }, [farmId, dashboard?.generated_at]);

  if (!dashboard && !loading) {
    return (
      <EmptyFarm action={
        <button onClick={() => loadDemo().catch(() => undefined)}
                className="btn-primary">▶ Try Demo Farm</button>
      } />
    );
  }

  const summary = h?.summary ?? dashboard?.water_analytics.summary;
  const daily = h?.daily ?? dashboard?.water_analytics.daily ?? [];
  const series = h?.series ?? h?.daily ?? daily;
  const events = h?.events ?? [];
  const goalRows = h?.goal_completion ?? [];

  const submit = async () => {
    if (!farmId || !qty) return;
    setSaving(true);
    setFormNote(null);
    try {
      const payload: Record<string, unknown> = {
        quantity_l: Number(qty),
        method,
        recommendation_followed: followed,
      };
      if (mBefore) payload.moisture_before = Number(mBefore);
      if (mAfter) payload.moisture_after = Number(mAfter);
      const res = await api.recordIrrigation(farmId, payload);
      setFormNote(`Stored event #${res.id} — ${fmtLitresShort(Number(qty))}.`);
      setQty(""); setMBefore(""); setMAfter("");
      await refresh();
      const p = await api.getHistory(farmId, "daily", 30);
      setH(p);
    } catch (e) {
      setFormNote(`Save failed: ${String((e as Error)?.message ?? e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Irrigation History"
        title="Every drop, logged & compared"
        sub="Baseline vs AI vs recorded events — daily / weekly / monthly / crop-cycle."
        actions={
          <>
            <SourceChip source="simulated" label="demo series seeded" />
            <Link to="/water-analytics" className="btn-ghost !py-1.5 text-xs">
              Water analytics →
            </Link>
          </>
        }
      />

      {error && <Note tone="warn">History error: {error}</Note>}

      {/* summary tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Baseline (traditional)" value={fmtLitresShort(summary?.baseline_total_l)}
              tone="text-alert-600/90" sub="what a fixed schedule would use" />
        <Tile label="AI-recommended" value={fmtLitresShort(summary?.ai_total_l)}
              tone="text-aqua-600" sub="engine output, rain-aware" />
        <Tile label="Water saved (irrigation)" value={fmtLitresShort(summary?.saved_l)}
              tone={summary?.negative_savings ? "text-alert-600" : "text-leaf-600"}
              sub={`${pct(summary?.saved_pct)} of baseline incl. rainwater credit`} />
        <Tile label="Rainwater utilised (separate)" value={fmtLitresShort(summary?.rainwater_conserved_l)}
              tone="text-aqua-600" sub="never double-counted as irrigation savings" />
      </div>

      <AdvancedInfo hint="graphs & technical detail">
      {/* main chart */}
      <Card accent="aqua" className="!p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="card-title">Water usage history</span>
          <span className="text-[11px] text-mist/70">
            hover for exact litres · switch range modes above the chart
          </span>
        </div>
        {loading && !h ? (
          <Skeleton className="h-[340px] w-full" />
        ) : (
          <WaterUsageChart daily={daily} series={series} />
        )}
        <p className="mt-2 text-[10px] leading-relaxed text-mist/70">
          Basis: {summary?.basis ?? "—"} · source: {summary?.label ?? "—"}.
          Negative savings (AI above baseline) are shown as negative — never
          flipped to positive.
        </p>
      </Card>

        {/* goal completion */}
        <Card accent="leaf" className="!p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="card-title">Daily goal vs traditional use</span>
            <SourceChip source="model_prediction" label="AI goal" />
          </div>
          {goalRows.length === 0 ? (
            <Skeleton className="h-[240px] w-full" />
          ) : (
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={goalRows.slice(-30).map((g) => ({
                                ...g, label: fmtDateShort(g.date),
                              }))}
                               margin={{ top: 10, right: 8, left: -6, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} interval={4} />
                  <YAxis {...axisProps} tickFormatter={fmtLitresShort}
                         width={64} />
                  <Tooltip content={<DarkTooltip />} />
                  <Bar dataKey="actual_l" name="Traditional actual"
                       fill={C.baseline} fillOpacity={0.65} radius={[4, 4, 0, 0]} />
                  <Line dataKey="goal_l" name="AI daily goal"
                        stroke={C.ai} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-2 text-[10px] text-mist/70">
            Bars = traditional use replayed from the baseline schedule; line =
            the AI goal for that day (varies with stage, ETo and rain).
          </p>
        </Card>
      </AdvancedInfo>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* record irrigation */}
        <Card accent="sand" className="!p-5 lg:col-span-2">
          <span className="card-title">Record an irrigation event</span>
          <p className="mt-1 text-xs text-mist/65">
            Log what actually happened — real events override simulated history.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="label">Quantity (litres) *</label>
              <input className="field" inputMode="numeric" value={qty}
                     placeholder="e.g. 2500000"
                     onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Method</label>
                <select className="field" value={method}
                        onChange={(e) => setMethod(e.target.value)}>
                  {METHODS.map((m) => (
                    <option key={m} value={m}>{m.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Moisture before (% vol)</label>
                <input className="field" inputMode="decimal" value={mBefore}
                       placeholder="optional"
                       onChange={(e) => setMBefore(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Moisture after (% vol)</label>
                <input className="field" inputMode="decimal" value={mAfter}
                       placeholder="optional"
                       onChange={(e) => setMAfter(e.target.value)} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex cursor-pointer items-center gap-2 text-xs
                                  text-mist/75">
                  <input type="checkbox" checked={followed}
                         onChange={(e) => setFollowed(e.target.checked)}
                         className="h-4 w-4 accent-leaf-500" />
                  Followed the AI recommendation
                </label>
              </div>
            </div>
            <button onClick={submit} disabled={saving || !qty}
                    className="btn-primary w-full disabled:opacity-50">
              {saving ? "Saving…" : "💾 Save event"}
            </button>
            {formNote && (
              <p className={`text-xs ${formNote.startsWith("Stored")
                ? "text-leaf-600" : "text-alert-600"}`}>{formNote}</p>
            )}
            <p className="text-[10px] leading-relaxed text-mist/70">
              Without logged events, seeded SIMULATED history powers the charts
              (labelled everywhere). Events persist in the local database only.
            </p>
          </div>
        </Card>
      </div>

      {/* events table */}
      <Card accent="soil" className="!p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line/70
                        px-5 py-3.5">
          <span className="card-title">Recorded events</span>
          <span className="text-[11px] text-mist/70">
            {events.length} event{events.length === 1 ? "" : "s"} (latest 60)
          </span>
        </div>
        {events.length === 0 ? (
          <p className="px-5 py-6 text-xs text-mist/75">
            No irrigation events recorded yet — add one above or load the demo
            farm (which seeds a labelled simulated schedule).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-mist/70">
                  <th className="px-5 py-2 text-start font-medium">When</th>
                  <th className="px-3 py-2 text-start font-medium">Quantity</th>
                  <th className="px-3 py-2 text-start font-medium">Method</th>
                  <th className="px-3 py-2 text-start font-medium">Moisture</th>
                  <th className="px-3 py-2 text-start font-medium">AI followed</th>
                  <th className="px-5 py-2 text-start font-medium">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-night/50">
                    <td className="px-5 py-2.5 font-mono text-mist/75">
                      {new Date(ev.ts).toLocaleString("en-IN", {
                        day: "2-digit", month: "short", hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-ink">
                      {fmtL(ev.quantity_l)}
                    </td>
                    <td className="px-3 py-2.5 text-mist/70">
                      {ev.method ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-mist/70">
                      {ev.moisture_before != null
                        ? `${ev.moisture_before}% → ${ev.moisture_after ?? "?"}%`
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {ev.recommendation_followed == null ? (
                        <span className="text-mist/65">—</span>
                      ) : ev.recommendation_followed ? (
                        <span className="text-leaf-600">✓ yes</span>
                      ) : (
                        <span className="text-warn-600">✗ no</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      <span className={`chip ${ev.source === "simulated"
                        ? "src-simulated" : "src-user"}`}>
                        {ev.source}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Note tone="info">
        Baseline replay assumes a fixed flood schedule (event size & interval
        from your last recorded irrigation or the documented conventional
        default). AI replay runs its own rain-aware bucket trajectory with a
        minimum 2-day gap. Rainwater-credited days contribute 0 to irrigation
        savings (saved_l) to prevent double counting.
      </Note>

      <div className="flex flex-wrap gap-3">
        <Link to="/water-analytics" className="btn-primary">Water analytics →</Link>
        <Link to="/achievements" className="btn-ghost">Achievements</Link>
        <Link to="/settings" className="btn-ghost">Edit farm</Link>
      </div>
    </div>
  );
}

function Tile({ label, value, tone, sub }: {
  label: string; value: string; tone: string; sub: string;
}) {
  return (
    <div className="glass p-4">
      <div className="text-[11px] uppercase tracking-wider text-mist/75">{label}</div>
      <div className={`mt-1 font-display text-xl font-semibold ${tone}`}>{value}</div>
      <div className="mt-1 text-[11px] leading-snug text-mist/70">{sub}</div>
    </div>
  );
}
