// Formatting helpers + guarded math (never NaN, never silent positives).

export const nf = new Intl.NumberFormat("en-IN");

export function fmtInt(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return nf.format(Math.round(v));
}

export function fmtCompact(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)} B`;
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} M`;
  if (abs >= 10_000) return `${(v / 1_000).toFixed(1)} k`;
  return nf.format(Math.round(v));
}

export function fmtL(v: number | null | undefined): string {
  return `${fmtInt(v)} L`;
}

export function fmtLitresShort(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} ML`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)} kL`;
  return `${Math.round(v)} L`;
}

export function pct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

export function safeDiv(a: number, b: number): number {
  if (!b) return 0;
  return a / b;
}

/** Honest percentage change — negative results stay negative. */
export function changePct(baseline: number, current: number): number | null {
  if (!baseline) return null;
  return ((baseline - current) / baseline) * 100;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function daysBetween(a: string, b = new Date().toISOString().slice(0, 10)): number {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.floor((d2.getTime() - d1.getTime()) / 86_400_000);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function fmtDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric", month: "short",
    });
  } catch {
    return iso;
  }
}

export function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}
