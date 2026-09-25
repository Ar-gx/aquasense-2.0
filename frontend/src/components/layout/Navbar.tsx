import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useFarm } from "../../context/FarmContext";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/analyze", label: "Analyze Farm" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/crop-analysis", label: "Crop Analysis" },
  { to: "/irrigation", label: "Irrigation" },
  { to: "/soil-health", label: "Soil Health" },
];

/* technical pages — hidden behind the "Advanced info" expandable */
const ADVANCED = [
  { to: "/how-it-works", label: "How It Works" },
  { to: "/data", label: "Data" },
  { to: "/impact", label: "Impact" },
  { to: "/weather", label: "Weather Intelligence" },
  { to: "/history", label: "Irrigation History" },
  { to: "/water-analytics", label: "Water Analytics" },
  { to: "/achievements", label: "Achievements" },
  { to: "/connect", label: "NGOs & Education" },
  { to: "/settings", label: "Settings" },
];

export default function Navbar() {
  const { dashboard, loadDemo, loading } = useFarm();
  const [open, setOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const navigate = useNavigate();

  const analyze = async () => {
    if (dashboard) navigate("/dashboard");
    else navigate("/analyze");
  };

  const demo = async () => {
    try {
      await loadDemo();
      navigate("/dashboard");
    } catch {
      navigate("/analyze");
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-night/85 backdrop-blur-xl">
      {/* horizon stripe — leaf → aqua → sand → soil */}
      <span aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[3px]
                       bg-[linear-gradient(90deg,#6d9a4c_0%,#557f9d_35%,#d4ac45_70%,#a18055_100%)]" />
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <span className="grid h-8 w-8 place-items-center rounded-lg
                           bg-gradient-to-br from-leaf-400 to-aqua-500
                           text-sm font-bold text-ink">A</span>
          <span className="font-display text-sm font-semibold tracking-wide text-ink">
            AquaSense <span className="text-leaf-600">AI</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `rounded-lg px-2.5 py-1.5 text-[13px] transition ${
                  isActive
                    ? "bg-leaf-500/15 text-leaf-700"
                    : "text-mist/75 hover:bg-panel/70 hover:text-leaf-700"
                }`}
            >
              {n.label}
            </NavLink>
          ))}
          <button
            onClick={() => setAdvOpen((v) => !v)}
            aria-expanded={advOpen}
            className={`rounded-lg px-2.5 py-1.5 text-[13px] transition ${
              advOpen
                ? "bg-leaf-500/15 text-leaf-700"
                : "text-mist/75 hover:bg-panel/70 hover:text-leaf-700"
            }`}
          >
            Advanced info {advOpen ? "▴" : "▸"}
          </button>
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <button onClick={demo} disabled={loading}
                  className="hidden rounded-lg border border-line px-3 py-1.5
                             text-xs font-medium text-mist/80 transition
                             hover:border-aqua-400/60 hover:text-aqua-600
                             disabled:opacity-50 sm:block">
            {loading ? "Loading…" : "Try Demo Farm"}
          </button>
          <button onClick={analyze} className="btn-primary !px-4 !py-2 text-xs">
            Analyze My Farm
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-lg border
                       border-line text-mist lg:hidden"
            aria-label="Menu"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* advanced info — desktop expandable panel */}
      <AnimatePresence initial={false}>
        {advOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="hidden overflow-hidden border-t border-line/70
                       bg-night/95 backdrop-blur-xl lg:block"
          >
            <div className="mx-auto grid max-w-[1400px] grid-cols-3 gap-1.5
                            px-4 py-3 sm:grid-cols-5">
              {ADVANCED.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  onClick={() => setAdvOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-[13px] transition ${
                      isActive
                        ? "bg-leaf-500/15 text-leaf-700"
                        : "text-mist/80 hover:bg-panel/70 hover:text-leaf-700"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {open && (
        <div className="border-t border-line/70 bg-night/95 px-4 py-3 lg:hidden">
          <div className="grid grid-cols-2 gap-1.5">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="rounded-lg bg-panel/60 px-3 py-2 text-[13px] text-mist/85"
              >
                {n.label}
              </NavLink>
            ))}
          </div>
          <button
            onClick={() => setAdvOpen((v) => !v)}
            aria-expanded={advOpen}
            className="mt-2.5 w-full rounded-lg border border-line/50
                       bg-night/40 px-3 py-2 text-start text-[13px] text-mist/85"
          >
            Advanced info {advOpen ? "▴" : "▸"}
          </button>
          {advOpen && (
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {ADVANCED.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-panel/60 px-3 py-2 text-[13px] text-mist/85"
                >
                  {n.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
