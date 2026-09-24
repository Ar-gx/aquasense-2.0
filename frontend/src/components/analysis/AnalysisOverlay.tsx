import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useFarm } from "../../context/FarmContext";

const STAGES = [
  "Reading soil conditions…",
  "Analyzing meteorological conditions…",
  "Analyzing crop water demand…",
  "Predicting soil moisture…",
  "Optimizing irrigation schedule…",
  "Calculating potential water savings…",
];

type Phase = "idle" | "running" | "done";

/**
 * Sequential analysis animation. Each step maps to real API processing:
 * the dashboard/predict calls run weather → soil → crop → prediction →
 * recommendation → water savings on the backend while the overlay plays.
 * When the API finishes first, the overlay fast-forwards to "complete"
 * instead of faking extra runtime.
 */
export default function AnalysisOverlay() {
  const { loading, error } = useFarm();
  const [phase, setPhase] = useState<Phase>("idle");
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stepMs = reduce ? 200 : 620;
    if (loading) {
      setPhase("running");
      setIdx(0);
      let i = 0;
      timer.current = window.setInterval(() => {
        i += 1;
        if (i >= STAGES.length) {
          window.clearInterval(timer.current);
          setIdx(STAGES.length);
        } else {
          setIdx(i);
        }
      }, stepMs);
      return () => window.clearInterval(timer.current);
    }
    // API finished — fast-forward to the done state if a run was in progress
    window.clearInterval(timer.current);
    setPhase((p) => (p === "running" ? "done" : p));
    return () => window.clearInterval(timer.current);
  }, [loading]);

  // auto-dismiss the "complete" state so the user lands on the app
  useEffect(() => {
    if (phase !== "done") return;
    const t = window.setTimeout(() => setPhase("idle"), 3200);
    return () => window.clearTimeout(t);
  }, [phase]);

  const close = () => setPhase("idle");
  const done = phase === "done";

  return (
    <AnimatePresence>
      {phase !== "idle" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[100] grid place-items-center bg-ink/95
                     backdrop-blur-xl"
        >
          <div className="w-full max-w-lg px-6">
            {/* droplet + data stream visual */}
            <div className="relative mx-auto mb-8 h-24 w-24">
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
                className="grid h-24 w-24 place-items-center rounded-full
                           border border-leaf-400/40 bg-leaf-500/10 text-4xl
                           shadow-glow"
              >
                💧
              </motion.div>
              {!done && [0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="absolute left-1/2 top-0 h-2 w-2 rounded-full
                             bg-aqua-300"
                  animate={{
                    y: [10, 90], opacity: [0, 1, 0],
                    x: [i * 14 - 14, i * 10 - 10],
                  }}
                  transition={{
                    repeat: Infinity, duration: 2.2, delay: i * 0.5,
                    ease: "linear",
                  }}
                />
              ))}
            </div>

            <h2 className="text-center font-display text-xl font-semibold
                           text-white">
              {done ? "Analysis Complete" : "Analyzing Your Farm"}
            </h2>
            <p className="mt-1 text-center text-xs text-white/75">
              {done
                ? "Irrigation plan, forecasts and savings are ready."
                : "Running weather → soil → ML → optimization pipeline"}
            </p>

            <ol className="mt-7 space-y-2.5">
              {STAGES.map((s, i) => {
                const shown = done ? "done" : i < idx ? "done" : i === idx ? "active" : "todo";
                return (
                  <li
                    key={s}
                    className={`flex items-center gap-3 rounded-xl border px-3.5
                                py-2.5 text-sm transition-all ${
                      shown === "done"
                        ? "border-leaf-400/40 bg-leaf-500/20 text-white"
                        : shown === "active"
                          ? "border-aqua-400/60 bg-aqua-500/20 text-white"
                          : "border-white/20 bg-white/10 text-white/60"
                    }`}
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center
                                     rounded-full border border-current text-[10px]">
                      {shown === "done" ? "✓" : i + 1}
                    </span>
                    <span className="flex-1">{s}</span>
                    {shown === "active" && (
                      <motion.span
                        className="h-1.5 w-1.5 rounded-full bg-current"
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{ repeat: Infinity, duration: 1 }}
                      />
                    )}
                  </li>
                );
              })}
            </ol>

            {error && (
              <p className="mt-4 text-center text-xs text-alert-400">{error}</p>
            )}

            {done && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 flex justify-center gap-3"
              >
                <button
                  onClick={() => { close(); navigate("/dashboard"); }}
                  className="btn-primary"
                >
                  Open Dashboard →
                </button>
                <button onClick={close} className="btn-ghost">Close</button>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
