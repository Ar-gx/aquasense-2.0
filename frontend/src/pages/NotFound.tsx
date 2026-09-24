import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="text-center">
        <div className="text-6xl">🌾</div>
        <h1 className="mt-4 font-display text-3xl font-semibold text-ink">
          404 — This path ran dry
        </h1>
        <p className="mt-2 text-sm text-mist/70">
          The page you are looking for does not exist.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/" className="btn-primary">Back Home</Link>
          <Link to="/dashboard" className="btn-ghost">Open Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
