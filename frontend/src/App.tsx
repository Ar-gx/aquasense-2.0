import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Shell from "./components/layout/Shell";
import AnalysisOverlay from "./components/analysis/AnalysisOverlay";
import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import CropAnalysis from "./pages/CropAnalysis";
import Irrigation from "./pages/Irrigation";
import SoilHealth from "./pages/SoilHealth";
import WeatherPage from "./pages/Weather";
import History from "./pages/History";
import WaterAnalytics from "./pages/WaterAnalytics";
import Achievements from "./pages/Achievements";
import HowItWorks from "./pages/HowItWorks";
import DataTransparency from "./pages/DataTransparency";
import Impact from "./pages/Impact";
import Connect from "./pages/Connect";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

export default function App() {
  const location = useLocation();
  return (
    <>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Landing />} />
          <Route path="/analyze" element={<Onboarding />} />
          <Route element={<Shell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/crop-analysis" element={<CropAnalysis />} />
            <Route path="/irrigation" element={<Irrigation />} />
            <Route path="/soil-health" element={<SoilHealth />} />
            <Route path="/weather" element={<WeatherPage />} />
            <Route path="/history" element={<History />} />
            <Route path="/water-analytics" element={<WaterAnalytics />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/data" element={<DataTransparency />} />
            <Route path="/impact" element={<Impact />} />
            <Route path="/connect" element={<Connect />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AnimatePresence>
      {/* global analysis overlay — driven by FarmContext loading state.
          Kept OUTSIDE the page-transition AnimatePresence: mode="wait"
          expects a single animating child, and the overlay is persistent. */}
      <AnalysisOverlay />
    </>
  );
}
