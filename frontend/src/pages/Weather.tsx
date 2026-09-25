import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from "recharts";
import { useFarm } from "../context/FarmContext";
import { api } from "../services/api";
import type { WeatherPayload } from "../lib/types";
import AdvancedInfo from "../components/ui/AdvancedInfo";
import PageHeader from "../components/ui/PageHeader";
import RainVsIrrigationChart from "../components/charts/RainVsIrrigationChart";
import { Card, EmptyFarm, Note, Skeleton, SourceChip } from "../components/ui/primitives";
import DataStatusPanel from "../components/dashboard/DataStatusPanel";
import { axisProps, C, DarkTooltip, gridProps } from "../components/charts/chartTheme";
import { fmtDateShort } from "../lib/format";

const WMO: Record<string, string> = {
  "0": "☀️ Clear", "1": "🌤 Mainly clear", "2": "⛅ Partly cloudy",
  "3": "☁️ Overcast", "45": "🌫 Fog", "48": "🌫 Rime fog",
  "51": "🌦 Light drizzle", "53": "🌦 Drizzle", "55": "🌧 Heavy drizzle",
  "61": "🌧 Light rain", "63": "🌧 Rain", "65": "🌧🌧 Heavy rain",
  "71": "🌨 Light snow", "80": "🌦 Showers", "81": "🌧 Showers",
  "82": "⛈ Violent showers", "95": "⛈ Thunderstorm",
};

export default function WeatherPage() {
  const { dashboard, farmId, loadDemo } = useFarm();
  const [w, setW] = useState<WeatherPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!farmId) { setLoading(false); return; }
    let dead = false;
    setLoading(true);
    setError(null);
    api.getWeather(farmId)
      .then((p) => { if (!dead) setW(p); })
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

  const cur = w?.current ?? dashboard?.weather_current;
  const forecast = w?.forecast ?? dashboard?.forecast;

  // NASA POWER history chart rows
  const hist = w?.history.nasa_power.daily ?? [];
  const histRows = hist.slice(-30).map((d) => ({
    date: fmtDateShort(d.date),
    tmax: d.temp_max_c,
    tmin: d.temp_min_c,
    rain: d.rain_mm,
  }));

  const district = w?.history.district_rainfall;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Live Weather Intelligence"
        title="Weather & rainfall"
        sub="Current conditions, 7-day forecast and rainfall history — each panel"
        actions={
          <>
            <SourceChip source={cur?.source ?? "unavailable"} />
            <Link to="/irrigation" className="btn-ghost !py-1.5 text-xs">
              Irrigation stance →
            </Link>
          </>
        }
      />

      {error && <Note tone="warn">Weather fetch issue: {error}</Note>}
      {loading && !w && <Skeleton className="h-40 w-full" />}

      {/* current conditions */}
      {cur && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="glass p-4 sm:col-span-1">
            <div className="text-[11px] uppercase tracking-wider text-mist/75">
              Temperature
            </div>
            <div className="mt-1 font-display text-3xl font-semibold text-ink">
              {cur.temp_c.toFixed(1)}°C
            </div>
            <div className="text-[11px] text-mist/70">
              feels {cur.feels_like_c?.toFixed(0) ?? "—"}°C
              {cur.city ? ` · ${cur.city}` : ""}
            </div>
          </div>
          <div className="glass p-4">
            <div className="text-[11px] uppercase tracking-wider text-mist/75">
              Humidity
            </div>
            <div className="mt-1 font-display text-3xl font-semibold text-aqua-600">
              {Math.round(cur.humidity_pct)}%
            </div>
            <div className="text-[11px] text-mist/70">
              {cur.description ?? "—"}
            </div>
          </div>
          <div className="glass p-4">
            <div className="text-[11px] uppercase tracking-wider text-mist/75">
              Wind
            </div>
            <div className="mt-1 font-display text-3xl font-semibold text-ink">
              {Math.round(cur.wind_kmh)}
              <span className="text-sm text-mist/75"> km/h</span>
            </div>
            <div className="text-[11px] text-mist/70">
              pressure {cur.pressure_hpa ?? "—"} hPa
            </div>
          </div>
          <div className="glass p-4">
            <div className="text-[11px] uppercase tracking-wider text-mist/75">
              Rain today
            </div>
            <div className="mt-1 font-display text-3xl font-semibold text-aqua-600">
              {cur.precip_mm_today?.toFixed(1) ?? "0.0"}
              <span className="text-sm text-mist/75"> mm</span>
            </div>
            <div className="text-[11px] text-mist/70">
              cloud {cur.cloud_cover_pct ?? "—"}%
            </div>
          </div>
          <div className="glass p-4">
            <div className="text-[11px] uppercase tracking-wider text-mist/75">
              Source
            </div>
            <div className="mt-2">
              <SourceChip source={cur.source} label={cur.source_label} />
            </div>
            <div className="mt-2 text-[10px] leading-snug text-mist/70">
              {cur.observed_at
                ? `observed ${new Date(cur.observed_at).toLocaleString("en-IN")}`
                : "no observation timestamp"}
            </div>
          </div>
        </div>
      )}

      {/* 7-day forecast */}
      {forecast && (
        <Card accent="aqua" className="!p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="card-title">7-day forecast</span>
            <div className="flex items-center gap-2">
              <SourceChip source={forecast.source} label={forecast.source_label} />
              <span className="text-[11px] text-mist/70">
                hourly resolution, aggregated daily
              </span>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {forecast.daily.slice(0, 7).map((d) => {
              const prob = d.precip_prob_pct ?? 0;
              return (
                <div key={d.date}
                     className={`rounded-xl border p-3 text-center transition
                                 hover:-translate-y-0.5 ${
                       prob >= 60 && d.precip_mm >= 10
                         ? "border-aqua-400/50 bg-aqua-500/10"
                         : "border-line/70 bg-night/40"}`}>
                  <div className="text-[11px] text-mist/75">
                    {fmtDateShort(d.date)}
                  </div>
                  <div className="my-1 text-xl">
                    {WMO[d.condition ?? ""] ?? (d.precip_mm >= 10 ? "🌧" : d.precip_mm > 0 ? "🌦" : "☀️")}
                  </div>
                  <div className="font-mono text-xs text-ink">
                    {Math.round(d.temp_max_c)}° / {Math.round(d.temp_min_c)}°
                  </div>
                  <div className={`mt-1 font-mono text-[11px] ${
                    prob >= 60 ? "text-aqua-600" : "text-mist/70"}`}>
                    {d.precip_mm.toFixed(1)} mm · {prob}%
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <AdvancedInfo hint="graphs & technical detail">
      {/* rain vs irrigation (needs recommendation) */}
      {dashboard && forecast && (
        <Card accent="sand" className="!p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="card-title">Rainfall vs irrigation stance</span>
            <Link to="/irrigation" className="text-[11px] text-mist/70
                                              hover:text-leaf-600">
              12-step engine details →
            </Link>
          </div>
          <RainVsIrrigationChart forecast={forecast.daily}
                                 reco={dashboard.recommendation} />
        </Card>
      )}

      {/* NASA POWER history */}
      <Card accent="aqua" className="!p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="card-title">Rainfall & temperature history (30 days)</span>
          <div className="flex items-center gap-2">
            <SourceChip source={w?.history.nasa_power.source ?? "historical_dataset"}
                        label={w?.history.nasa_power.source_label} />
            <span className="text-[11px] text-mist/70">
              {w?.history.nasa_power.granularity ?? "daily point data"}
            </span>
          </div>
        </div>
        {w?.history.nasa_power.error ? (
          <Note tone="warn">
            NASA POWER history unavailable: {w.history.nasa_power.error}. Live
            forecast above still works via Open-Meteo.
          </Note>
        ) : histRows.length === 0 ? (
          <Skeleton className="h-[260px] w-full" />
        ) : (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={histRows}
                             margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} interval={3} />
                <YAxis yAxisId="t" {...axisProps} unit="°C" width={44} />
                <YAxis yAxisId="r" orientation="right" {...axisProps}
                       unit="mm" width={44} />
                <Tooltip content={<DarkTooltip unit="" />} />
                <Bar yAxisId="r" dataKey="rain" name="Rainfall"
                     fill={C.rain} fillOpacity={0.55} radius={[4, 4, 0, 0]} />
                <Line yAxisId="t" dataKey="tmax" name="Max temp"
                      stroke={C.warn} strokeWidth={1.6} dot={false} />
                <Line yAxisId="t" dataKey="tmin" name="Min temp"
                      stroke={C.ai} strokeWidth={1.6} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-mist/70">
          <span>◼ rainfall (mm)</span>
          <span style={{ color: C.warn }}>— max temp</span>
          <span style={{ color: C.ai }}>— min temp</span>
        </div>
      </Card>
      </AdvancedInfo>

      {/* district rainfall (data.gov.in) */}
      {district && (
        <Card accent="soil" className="!p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="card-title">District rainfall records</span>
            <div className="flex items-center gap-2">
              <SourceChip source={district.source}
                          label={district.source_label} />
              <span className="text-[11px] text-mist/70">
                {district.granularity ?? "district level"}
              </span>
            </div>
          </div>
          {district.error ? (
            <Note tone="warn">
              data.gov.in rainfall series unavailable: {district.error} — this
              endpoint sometimes rate-limits; NASA POWER history above remains
              the primary source.
            </Note>
          ) : district.records.length === 0 ? (
            <p className="text-xs text-mist/75">
              No district records matched this location — try setting a
              district in Settings.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {district.records.slice(-14).map((r) => (
                <div key={r.date}
                     className="rounded-lg border border-line/70 bg-night/40
                                px-3 py-2 text-center">
                  <div className="text-[10px] text-mist/70">
                    {fmtDateShort(r.date)}
                  </div>
                  <div className="font-mono text-sm text-aqua-600">
                    {r.rainfall_mm} mm
                  </div>
                  {r.agency && (
                    <div className="text-[9px] text-mist/65">{r.agency}</div>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-[10px] text-mist/70">
            District-level series — coarser than farm coordinates, shown as an
            independent cross-check, not as field measurements.
          </p>
        </Card>
      )}

      {w?.data_status && <DataStatusPanel items={w.data_status} />}

      <div className="flex flex-wrap gap-3">
        <Link to="/dashboard" className="btn-primary">Back to dashboard</Link>
        <Link to="/irrigation" className="btn-ghost">Irrigation goal</Link>
        <Link to="/data" className="btn-ghost">Data sources</Link>
      </div>
    </div>
  );
}
