// Shared API types — mirrors the FastAPI response payloads.

export type SourceTag =
  | "live_api"
  | "user_supplied"
  | "historical_dataset"
  | "estimated"
  | "simulated"
  | "model_prediction"
  | "rule_based"
  | "illustrative_comparison"
  | "hybrid_ml_rules"
  | "not_configured"
  | "disabled"
  | "unavailable";

export interface Envelope<T> {
  status: "success" | "error";
  data: T;
  meta?: Record<string, unknown>;
  message?: string;
  error?: { code: string; message: string; details?: unknown };
}

export interface Farm {
  id: number;
  name: string;
  is_demo: boolean;
  crop_name: string;
  custom_crop_name: string | null;
  sowing_date: string;
  growth_stage: string | null;
  area_ha: number | null;
  soil_type: string | null;
  soil_moisture_pct: number | null;
  soil_moisture_source: string | null;
  irrigation_method: string | null;
  taluk: string | null;
  district: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  location_precision: string;
  last_irrigation_at: string | null;
  last_irrigation_qty_l: number | null;
  prev_irrigation_info: string | null;
  previous_crop: string | null;
  soil_nutrients: Record<string, number> | null;
  unknown_fields: string[];
  budget_hint: string | null;
}

export interface CropCard {
  key: string;
  name: string;
  emoji: string;
  color: string;
  lifespan_days: number;
  stages: string[];
}

export interface StageInfo {
  /** `stage` on the raw API payload, `name` after normalisation */
  name?: string;
  stage?: string;
  demand: string;
  note: string;
}

export interface CropStageRow {
  index: number;
  name: string;
  start_day: number;
  end_day: number;
  days: number;
  kc: number;
  root_depth_m: number;
  mad: number;
  water_mm: number;
  water_l: number;
  elapsed_days: number;
  required_to_date_mm: number;
}

export interface CropLifecycle {
  crop_key: string;
  crop: string;
  sowing_date: string;
  as_of: string;
  day_of_cycle: number;
  lifespan_days: number;
  days_until_harvest: number;
  growth_stage: string;
  stage_index: number;
  stage_progress_pct: number;
  eto_mm_day: number;
  eto_source: string;
  stages: CropStageRow[];
  total_water_req_mm: number;
  total_water_req_l: number;
  cumulative_required_mm: number;
  cumulative_required_l: number;
  remaining_water_req_mm: number;
  remaining_water_req_l: number;
  avg_daily_remaining_l: number;
  recorded_irrigation_l: number;
  cumulative_required_vs_recorded_l: number;
  progress_pct: number;
  source: string;
  limitation: string;
}

export interface Recommendation {
  irrigation_required: boolean;
  status: "irrigation_required" | "monitor" | "good";
  status_label: string;
  recommended_time: string | null;
  recommended_time_reason: string;
  quantity_l: number;
  quantity_l_per_ha: number;
  quantity_net_l: number;
  quantity_mm: number;
  reason: string;
  reason_parts: string[];
  expected_moisture_after_pct: number;
  daily_goal_l: number;
  remaining_daily_goal_l: number;
  soil_moisture_pct: number;
  soil_moisture_source: string;
  stress_threshold_pct: number;
  trigger_threshold_pct: number;
  field_capacity_pct: number;
  wilting_point_pct: number;
  saturation_pct: number;
  crop: string;
  growth_stage: string;
  stage_kc: number;
  root_depth_m: number;
  eto_mm_day: number;
  eto_method: string;
  irrigation_efficiency: number;
  irrigation_method: string;
  area_ha: number;
  predictions: { h24: number; h48: number; h72: number; min_72h: number; model_kind: string };
  rainfall: {
    rain_24h_mm: number; rain_48h_mm: number; rain_72h_mm: number;
    prob_24h: number; prob_48h: number; prob_72h: number;
    effective_48h_mm: number; impact: string;
  };
  waterlogging_risk: boolean;
  waterlogging_now: boolean;
  savings: Record<string, unknown> & {
    traditional_event_l: number; ai_event_l: number;
    saved_per_event_l: number; saved_per_event_pct: number;
  };
  confidence: "high" | "medium" | "low";
  confidence_reasons: string[];
  limitations: string[];
  unknown_fields: string[];
  suggested_method_upgrade: {
    suggested_method: string; current_method: string;
    current_efficiency: number; suggested_efficiency: number;
    event_qty_with_suggestion_l: number; event_saving_l: number;
    why: string; budget_fit: string; caveat: string;
  } | null;
  source: string;
  label: string;
}

export interface WeatherCurrent {
  temp_c: number; feels_like_c?: number; humidity_pct: number;
  wind_kmh: number; description?: string; precip_mm_today?: number;
  city?: string; pressure_hpa?: number; cloud_cover_pct?: number;
  source: SourceTag; source_label?: string; observed_at?: string;
}

export interface ForecastHour {
  time: string; temp_c: number; humidity_pct?: number;
  precip_mm: number; precip_prob_pct: number; wind_kmh?: number;
}

export interface ForecastDay {
  date: string; temp_max_c: number; temp_min_c: number;
  precip_mm: number; precip_prob_pct: number; humidity_pct?: number;
  wind_kmh?: number; condition?: string;
}

export interface Forecast {
  hourly: ForecastHour[];
  daily: ForecastDay[];
  source: SourceTag;
  source_label?: string;
}

export interface HistoryDay {
  date: string; temp_mean_c: number; temp_max_c: number; temp_min_c: number;
  humidity_pct: number; rain_mm: number; wind_ms?: number;
  solar_mj_m2_day?: number;
}

export interface WarningItem {
  type: string;
  severity: "info" | "watch" | "warning" | "danger";
  potential_problem: string;
  why_it_matters: string;
  affected: string;
  recommended_action: string;
  evidence: string;
  certainty: string;
  source: string;
}

export interface NutrientAnalysis {
  crop: string;
  growth_stage: string;
  estimated_depletion: {
    n?: number; p?: number; k?: number; basis: string; unit: string;
    previous_legume_credit_n_kg_ha?: number;
  };
  legume_recommendations: Array<{
    key: string; name: string; n_fixed_kg_ha: number; duration_days: number;
    note: string; compatibility_pct: number;
    factors: { soil_texture_fit_pct: number; nutrient_alignment_pct: number;
      rotation_benefit_pct: number; n_fixed_kg_ha: number };
  }>;
  manure_recommendations: Array<{
    key: string; name: string; rate: string; supplies: string[];
    note: string; why: string;
  }>;
  compatibility_pct: number | null;
  warning: string | null;
  explanation: {
    how_score_is_computed: string; factors_used: string[];
    basis: string; basis_note: string; data_not_used: (string | null)[];
  };
  source: string;
  label: string;
}

export interface WaterDayRow {
  date: string;
  baseline_l: number;
  ai_l: number;
  saved_l: number;
  saved_pct: number;
  rainwater_l: number;
  rain_mm: number;
  moisture_pct: number;
  recorded_moisture_pct?: number | null;
  label?: string;
  days?: number;
}

export interface WaterSummary {
  baseline_total_l: number;
  ai_total_l: number;
  saved_l: number;
  saved_pct: number;
  saved_per_ha_l: number;
  baseline_per_ha_l: number;
  ai_per_ha_l: number;
  rainwater_conserved_l: number;
  rainwater_per_ha_l: number;
  irrigation_efficiency_baseline: number;
  irrigation_efficiency_ai: number | null;
  efficiency_improvement_pct?: number;
  negative_savings: boolean;
  basis: string;
  source: string;
  label: string;
}

export interface WaterAnalytics {
  mode: string;
  series: WaterDayRow[];
  daily: WaterDayRow[];
  summary: WaterSummary;
  /** absent when embedded in the dashboard payload (compute_water_series) */
  source?: string;
  interval_days?: number;
  baseline_event_l?: number;
  series_legend?: Array<{ key: string; label: string; kind: string }>;
  note?: string;
}

export interface AchievementItem {
  metric: string;
  label: string;
  value: number;
  unit: string;
  source: string;
  note: string;
  history: Array<{ date: string; cumulative_saved_l: number; cumulative_rainwater_l: number }>;
}

export interface PredictionInfo {
  current_moisture_pct: number | null;
  predicted_moisture_pct: number;
  model_name: string;
  model_kind: string;
  metrics: {
    mae_pct_points?: number; rmse_pct_points?: number; r2?: number;
    n_samples?: number; data_basis?: string;
  } | null;
  source: SourceTag;
}

export interface TrajectoryPoint {
  offset_hours: number;
  date: string;
  predicted_moisture_pct: number;
  forecast_rain_mm: number;
  forecast_prob_pct: number;
  horizon_class: "short_range" | "extended_outlook";
  model_kind: string;
  confidence: "medium" | "low";
}

export interface DataStatusItem {
  source: string;
  status?: string;
  kind?: string;
  label?: string;
  granularity?: string;
  data_basis?: string;
}

export interface DashboardPayload {
  farm: Farm;
  optimal_irrigation_plan: {
    irrigation_required: boolean;
    status: "irrigation_required" | "monitor" | "good";
    status_label: string;
    recommended_time: string | null;
    quantity_l: number;
    quantity_l_per_ha: number;
    estimated_water_saved_l: number;
    crop_water_adequacy: number | null;
    reason: string;
    confidence: string;
    limitations: string[];
  };
  recommendation: Recommendation;
  prediction: PredictionInfo;
  current_moisture: {
    moisture_pct?: number; field_capacity_pct: number;
    wilting_point_pct: number; saturation_pct: number;
    stress_threshold_pct: number; band: string;
    available_water_pct?: number; source: string; limitation: string;
  };
  weather_current: WeatherCurrent;
  forecast: Forecast;
  growth_stage: string;
  crop_lifecycle: CropLifecycle;
  daily_goal_l: number;
  remaining_daily_goal_l: number;
  water_savings: WaterSummary;
  water_analytics: WaterAnalytics;
  soil?: Record<string, unknown>;
  warnings: WarningItem[];
  nutrients: NutrientAnalysis;
  achievements: AchievementItem[];
  yield_reference: { benchmark_yield_t_ha: number | null; source: string;
    source_label: string; note: string };
  data_status: Array<DataStatusItem & { kind?: string; granularity?: string }>;
  generated_at: string;
}

export interface HistoryPayload {
  series: WaterDayRow[];
  mode: string;
  daily: WaterDayRow[];
  summary: WaterSummary;
  goal_completion: Array<{ date: string; goal_l: number; actual_l: number; completion_pct: number }>;
  events: Array<{
    id: number; ts: string; quantity_l: number; method: string | null;
    area_ha: number | null; moisture_before: number | null;
    moisture_after: number | null; recommendation_followed: boolean | null;
    source: string;
  }>;
}

export interface WeatherPayload {
  current: WeatherCurrent;
  forecast: Forecast;
  history: {
    nasa_power: { source: string; source_label?: string; granularity?: string;
      daily: HistoryDay[]; error?: string };
    district_rainfall: { source: string; source_label?: string;
      granularity?: string; records: Array<{ date: string; rainfall_mm: number;
      agency?: string }>; error?: string };
  };
  data_status: DataStatusItem[];
}

export interface PredictPayload {
  prediction_id: number;
  current_moisture_pct: number;
  predicted_moisture_pct: number;
  horizon_hours: number;
  model_name: string;
  model_kind: string;
  metrics: PredictionInfo["metrics"];
  label: string;
  source: SourceTag;
  trajectory: TrajectoryPoint[];
  thresholds: {
    field_capacity_pct: number; wilting_point_pct: number;
    saturation_pct: number; stress_threshold_pct: number;
  };
  actual_measurement: number | null;
  actual_source: string | null;
  note: string;
}

export interface PlaceResult {
  name: string; latitude: number; longitude: number;
  state: string | null; district: string | null; taluk: string | null;
  country: string | null; population: number | null; precision: string;
}

export interface Organization {
  name: string; org_type: string; states: string[]; services: string[];
  website: string | null; verified: boolean; note?: string; source: string;
}
