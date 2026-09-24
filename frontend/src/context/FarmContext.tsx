// Farm context — holds the active farm id + lazily fetched dashboard payload.
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import type { ReactNode } from "react";
import { api, ApiError } from "../services/api";
import type { DashboardPayload, Farm } from "../lib/types";

interface FarmContextValue {
  farmId: number | null;
  farm: Farm | null;
  dashboard: DashboardPayload | null;
  loading: boolean;
  error: string | null;
  stage: string;
  selectFarm: (id: number) => void;
  loadDemo: () => Promise<DashboardPayload>;
  createFrom: (payload: Record<string, unknown>) => Promise<DashboardPayload>;
  refresh: () => Promise<void>;
  setStage: (s: string) => void;
}

const FarmContext = createContext<FarmContextValue | null>(null);
const STORAGE_KEY = "aquasense.farmId";

export function FarmProvider({ children }: { children: ReactNode }) {
  const [farmId, setFarmId] = useState<number | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) : null;
  });
  const [farm, setFarm] = useState<Farm | null>(null);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState("");

  const selectFarm = useCallback((id: number) => {
    localStorage.setItem(STORAGE_KEY, String(id));
    setFarmId(id);
    setDashboard(null);
  }, []);

  const loadDashboard = useCallback(async (id: number, stages?: string[]) => {
    setLoading(true);
    setError(null);
    const stagesList = stages ?? [];
    try {
      if (stagesList.length) setStage(stagesList[0]);
      const data = await api.getDashboard(id);
      setFarm(data.farm);
      setDashboard(data);
      localStorage.setItem(STORAGE_KEY, String(id));
      setFarmId(id);
      return data;
    } catch (e) {
      // Stale saved id (farm deleted / DB reset) — stop retrying it on every
      // load and fall back to the "no farm selected" state.
      if (e instanceof ApiError && e.status === 404) {
        localStorage.removeItem(STORAGE_KEY);
        setFarmId(null);
        setDashboard(null);
      }
      setError(e instanceof Error ? e.message : "Failed to load farm data");
      throw e;
    } finally {
      setLoading(false);
      setStage("");
    }
  }, []);

  const refresh = useCallback(async () => {
    if (farmId) await loadDashboard(farmId).catch(() => undefined);
  }, [farmId, loadDashboard]);

  // auto-load saved farm on first mount
  useEffect(() => {
    if (farmId && !dashboard) {
      loadDashboard(farmId).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDemo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStage("Loading demo farm…");
      const demo = await api.loadDemoFarm();
      setStage("Reading soil conditions…");
      const data = await loadDashboard(demo.id);
      return data;
    } finally {
      setLoading(false);
      setStage("");
    }
  }, [loadDashboard]);

  const createFrom = useCallback(
    async (payload: Record<string, unknown>) => {
      setLoading(true);
      setError(null);
      try {
        setStage("Creating your farm…");
        const created = await api.createFarm(payload);
        setStage("Reading soil conditions…");
        return await loadDashboard(created.id);
      } finally {
        setLoading(false);
        setStage("");
      }
    },
    [loadDashboard],
  );

  const value = useMemo(
    () => ({
      farmId, farm, dashboard, loading, error, stage,
      selectFarm, loadDemo, createFrom, refresh, setStage,
    }),
    [farmId, farm, dashboard, loading, error, stage,
      selectFarm, loadDemo, createFrom, refresh],
  );

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm(): FarmContextValue {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error("useFarm must be used inside <FarmProvider>");
  return ctx;
}
