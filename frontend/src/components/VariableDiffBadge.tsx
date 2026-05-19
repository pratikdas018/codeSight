import clsx from "clsx";
import type { VisualVariable } from "../visualization/types";

interface VariableDiffBadgeProps {
  change: VisualVariable["change"];
  changeCount: number;
}

const toneMap: Record<VisualVariable["change"], string> = {
  added:
    "border-emerald-300/20 bg-emerald-300/10 text-emerald-100 shadow-[0_0_18px_rgba(34,197,94,0.18)]",
  updated:
    "border-amber-300/20 bg-amber-300/10 text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.16)]",
  removed:
    "border-rose-300/20 bg-rose-300/10 text-rose-100 shadow-[0_0_18px_rgba(244,63,94,0.16)]",
  unchanged:
    "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)]",
};

const labelMap: Record<VisualVariable["change"], string> = {
  added: "new",
  updated: "updated",
  removed: "deleted",
  unchanged: "stable",
};

export const VariableDiffBadge = ({
  change,
  changeCount,
}: VariableDiffBadgeProps) => (
  <span
    className={clsx(
      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em]",
      toneMap[change],
    )}
  >
    <span>{labelMap[change]}</span>
    {changeCount > 0 ? <span>{changeCount}</span> : null}
  </span>
);
