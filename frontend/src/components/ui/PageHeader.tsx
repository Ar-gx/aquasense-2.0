import type { ReactNode } from "react";

/** Consistent page header used across the app shell routes. */
export default function PageHeader({ eyebrow, title, sub, actions }: {
  eyebrow: string; title: string; sub?: string; actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-1.5 flex items-center gap-2 text-leaf-600">
          <span className="h-px w-5 bg-leaf-400/60" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.25em]">
            {eyebrow}
          </span>
        </div>
        <h1 className="font-display text-2xl font-semibold text-ink md:text-3xl">
          {title}
        </h1>
        {sub && (
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-mist/75">
            {sub}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
