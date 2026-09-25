import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Collapsed-by-default section for technical content (graphs, model detail,
 * reasoning chains). Same "Advanced info" language as the navbar/footer
 * toggles. Children unmount while collapsed, so charts only render when
 * revealed.
 */
export default function AdvancedInfo({
  children,
  hint = "graphs & technical detail",
}: {
  children: ReactNode;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-xl
                   border border-line/60 bg-night/40 px-4 py-3 text-start
                   transition hover:border-aqua-400/40"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-ink">
          <span aria-hidden="true">📊</span> Advanced info
          <span className="text-xs font-normal text-mist/65">{hint}</span>
        </span>
        <span className="text-xs text-mist/60">{open ? "▴" : "▸"}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
