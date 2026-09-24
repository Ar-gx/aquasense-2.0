import { Card, SourceChip } from "../ui/primitives";
import type { DataStatusItem } from "../../lib/types";

const STATUS_DOT: Record<string, string> = {
  live_api: "bg-leaf-400",
  user_supplied: "bg-aqua-400",
  simulated: "bg-soil-400",
  model_prediction: "bg-aqua-400",
  estimated: "bg-warn-400",
  historical_dataset: "bg-sand-400",
  rule_based: "bg-mist/60",
  not_configured: "bg-mist/40",
  disabled: "bg-mist/40",
  unavailable: "bg-alert-400/70",
};

const STATUS_LABEL: Record<string, string> = {
  live_api: "Live",
  user_supplied: "User",
  simulated: "Simulated",
  model_prediction: "Model",
  estimated: "Estimated",
  historical_dataset: "Historical",
  rule_based: "Rules",
  not_configured: "Not configured",
  disabled: "Disabled",
  unavailable: "Unavailable",
};

/** Visible data-status panel (spec §27) — live, historical and simulated\n    values are never mixed silently. */
export default function DataStatusPanel({ items, compact = false }: {
  items: DataStatusItem[]; compact?: boolean;
}) {
  if (!items?.length) {
    return (
      <Card>
        <span className="card-title">Data Status</span>
        <p className="mt-2 text-xs text-mist/75">No sources reported yet.</p>
      </Card>
    );
  }
  return (
    <Card accent="soil" className="p-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-line/70 px-5 py-3.5">
        <span className="card-title">Data Status</span>
        <span className="text-[10px] text-mist/70">
          every value below is tagged with its origin
        </span>
      </div>
      <div className={compact ? "max-h-[260px] overflow-y-auto" : ""}>
        <table className="w-full text-start text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-mist/70">
              <th className="px-5 py-2 text-start font-medium">Source</th>
              <th className="px-3 py-2 text-start font-medium">Used for</th>
              <th className="hidden px-3 py-2 text-start font-medium md:table-cell">
                Granularity
              </th>
              <th className="px-3 py-2 text-start font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/50">
            {items.map((s, i) => {
              const status = s.status ?? "unavailable";
              const dot = STATUS_DOT[status] ?? "bg-mist/50";
              return (
                <tr key={`${s.source}-${i}`} className="hover:bg-night/50">
                  <td className="px-5 py-2.5">
                    <div className="font-medium text-ink">{s.source}</div>
                    {s.label && (
                      <div className="text-[10px] leading-tight text-mist/70">
                        {s.label}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-mist/75">{s.kind ?? "—"}</td>
                  <td className="hidden px-3 py-2.5 text-mist/75 md:table-cell">
                    {s.granularity ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                      <span className="text-mist/80">
                        {STATUS_LABEL[status] ?? status}
                      </span>
                      {s.data_basis && (
                        <span className="text-[10px] text-warn-600/80">
                          ({s.data_basis})
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line/60 px-5 py-2.5 text-[10px] leading-relaxed text-mist/65">
        <strong className="text-mist/75">Policy:</strong> simulated demo data is
        never presented as live; model predictions are labelled with their
        training basis (simulated water-balance data — not field-validated);
        savings are model scenarios, never claimed as metered field results.
      </p>
    </Card>
  );
}
