import { Link, Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";

const FOOT_LINKS = [
  { to: "/how-it-works", label: "How It Works" },
  { to: "/data", label: "Data Transparency" },
  { to: "/weather", label: "Weather Intelligence" },
  { to: "/history", label: "Irrigation History" },
  { to: "/water-analytics", label: "Water Analytics" },
  { to: "/achievements", label: "Achievements" },
  { to: "/connect", label: "NGOs & Education" },
  { to: "/settings", label: "Settings" },
];

export default function Shell() {
  const loc = useLocation();
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6">
        <Outlet />
      </main>
      <footer className="mt-10 border-t border-line/70 bg-panel/70">
        <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-8
                        md:grid-cols-3 md:px-6">
          <div>
            <div className="font-display text-sm font-semibold text-ink">
              AquaSense <span className="text-leaf-600">AI</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-mist/75">
              Smarter Irrigation. Healthier Soil. Every Drop Counts.
            </p>
            <p className="mt-3 text-[11px] leading-relaxed text-mist/65">
              Data shown includes live APIs, historical datasets and clearly
              labelled simulated demo values. Savings figures are model
              scenarios, not metered field results.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {FOOT_LINKS.map((l) => (
              <Link key={l.to} to={l.to}
                    className="text-mist/70 hover:text-leaf-600">
                {l.label}
              </Link>
            ))}
          </div>
          <div className="text-xs text-mist/70">
            <div className="mb-1 font-medium text-mist/70">Problem focus</div>
            <p className="leading-relaxed">
              Data-driven smart irrigation & soil health optimization —
              reducing over-irrigation, waterlogging, nutrient leaching and
              freshwater use without hurting crop water adequacy.
            </p>
          </div>
        </div>
        <div className="border-t border-line/50 py-3 text-center text-[11px]
                        text-mist/65">
          © {new Date().getFullYear()} AquaSense AI · Hackathon MVP · {loc.pathname}
        </div>
      </footer>
    </div>
  );
}
