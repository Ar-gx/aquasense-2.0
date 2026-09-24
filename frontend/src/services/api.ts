// Typed API client — every button in the UI maps to a real endpoint here.

import type {
  AchievementItem, CropCard, DashboardPayload, Envelope, Farm,
  HistoryPayload, NutrientAnalysis, Organization, PlaceResult,
  PredictPayload, Recommendation, StageInfo, WeatherPayload,
  WaterAnalytics, WaterSummary,
} from "../lib/types";

const BASE = "/api/v1";

/** API error that carries the HTTP status (so callers can react to 404s). */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  let body: Envelope<T>;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError(`Invalid response from ${path} (${res.status})`,
                       res.status);
  }
  if (!res.ok || body.status === "error") {
    throw new ApiError(
      body.error?.message ?? `Request failed: ${path}`,
      res.status,
    );
  }
  return body.data;
}

const get = <T>(p: string) => request<T>(p);
const post = <T>(p: string, data?: unknown) =>
  request<T>(p, { method: "POST", body: data ? JSON.stringify(data) : undefined });
const patch = <T>(p: string, data: unknown) =>
  request<T>(p, { method: "PATCH", body: JSON.stringify(data) });

export const api = {
  // farms & onboarding
  health: () => get<{ status: string; version: string }>("/health"),
  listFarms: () => get<Farm[]>("/farms"),
  getFarm: (id: number) => get<Farm>(`/farms/${id}`),
  createFarm: (payload: Partial<Farm> & Record<string, unknown>) =>
    post<Farm>("/farms", payload),
  updateFarm: (id: number, payload: Record<string, unknown>) =>
    patch<Farm>(`/farms/${id}`, payload),
  loadDemoFarm: () => post<Farm>("/farms/demo"),

  // sensors
  postReading: (payload: Record<string, unknown>) =>
    post<{ id: number }>("/sensors/readings", payload),
  getReadings: (farmId: number, days = 30) =>
    get<Array<Record<string, unknown>>>(`/sensors/readings/${farmId}?days=${days}`),

  // weather / predict / recommend / dashboard
  getWeather: (farmId: number) => get<WeatherPayload>(`/weather/${farmId}`),
  runPredict: (farmId: number) => post<PredictPayload>(`/predict/${farmId}`),
  lastPredict: (farmId: number) => get<PredictPayload>(`/predict/${farmId}`),
  getRecommendation: (farmId: number) =>
    get<Recommendation>(`/recommendation/${farmId}`),
  getDashboard: (farmId: number) => get<DashboardPayload>(`/dashboard/${farmId}`),

  // history / analytics / achievements / nutrients
  getHistory: (farmId: number, mode = "daily", days = 30) =>
    get<HistoryPayload>(`/history/${farmId}?mode=${mode}&days=${days}`),
  recordIrrigation: (farmId: number, payload: Record<string, unknown>) =>
    post<{ id: number }>(`/history/${farmId}/events`, { farm_id: farmId, ...payload }),
  getWaterAnalytics: (farmId: number, mode = "daily", days = 30) =>
    get<WaterAnalytics>(`/water-analytics/${farmId}?mode=${mode}&days=${days}`),
  getAchievements: (farmId: number) =>
    get<{ metrics: AchievementItem[]; water_summary: WaterSummary; note: string }>(
      `/achievements/${farmId}`),
  getNutrients: (farmId: number) => get<NutrientAnalysis>(`/nutrients/${farmId}`),

  // meta / reference / location
  getCrops: () =>
    get<{ cards: CropCard[]; details: Record<string, unknown>;
      stages: StageInfo[]; stage_names: string[] }>("/crops"),
  getSoils: () => get<{ cards: Array<Record<string, unknown>> }>("/soils"),
  getIrrigationMethods: () =>
    get<Record<string, { label: string; eff: number; cost: string; note: string }>>(
      "/irrigation-methods"),
  searchPlaces: (q: string) =>
    get<{ results: PlaceResult[]; source: string }>(
      `/location/search?q=${encodeURIComponent(q)}`),
  reverseLocation: (latitude: number, longitude: number) =>
    post<{ taluk: string | null; district: string | null; state: string | null;
      source: string; precision: string; display_name?: string }>(
      "/location/reverse", { latitude, longitude }),
  getDataStatus: () => get<Record<string, unknown>>("/data-status"),
  getAquastat: (state?: string) =>
    get<Record<string, unknown>>(`/reference/aquastat${state ? `?state=${state}` : ""}`),
  getNass: (crop: string) => get<Record<string, unknown>>(`/reference/nass?crop=${crop}`),
  getOrganizations: (state?: string) =>
    get<{ organizations: Organization[]; search_link: string; note: string }>(
      `/organizations${state ? `?state=${state}` : ""}`),
  calculator: (payload: { baseline_per_ha_l: number; ai_per_ha_l: number; area_ha: number }) =>
    post<{
      baseline_total_l: number; ai_total_l: number; water_saved_l: number;
      reduction_pct: number | null; negative_savings: boolean;
      interpretation: string; errors: string[];
    }>("/water-calculator", payload),
  getImpact: () =>
    get<Record<string, unknown> | { available: boolean }>("/impact"),
};

export type Api = typeof api;
