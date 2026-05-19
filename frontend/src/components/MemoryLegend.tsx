import clsx from "clsx";
import type { MemoryDiffSummary } from "../memory/types";

interface MemoryLegendProps {
  diff: MemoryDiffSummary;
}

const legendItems = [
  {
    label: "Allocated",
    color: "bg-emerald-400",
    helper: "New stack frames, heap blocks, or pointers",
  },
  {
    label: "Freed",
    color: "bg-rose-400",
    helper: "Memory released on this step",
  },
  {
    label: "Updated",
    color: "bg-amber-300",
    helper: "Values or fields changed",
  },
  {
    label: "Valid pointer",
    color: "bg-[var(--cs-primary-bright)]",
    helper: "Reference resolves to live memory",
  },
  {
    label: "Null pointer",
    color: "bg-[#7c8c77]",
    helper: "Reference has no target",
  },
  {
    label: "Dangling pointer",
    color: "bg-[#f87171]",
    helper: "Reference points to missing memory",
  },
] as const;

export const MemoryLegend = ({ diff }: MemoryLegendProps) => (
  <div className="rounded-[1.4rem] border border-[var(--cs-border)] bg-[rgba(10,12,10,0.82)] p-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
          Memory Diff Legend
        </div>
        <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
          Heap and pointer changes are color coded per timeline frame.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          `${diff.allocated} allocated`,
          `${diff.freed} freed`,
          `${diff.updated} updated`,
          `${diff.pointerMoved} pointer moves`,
        ].map((label) => (
          <span
            key={label}
            className="rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--cs-text-muted)]"
          >
            {label}
          </span>
        ))}
      </div>
    </div>

    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {legendItems.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(7,9,7,0.92)] px-3 py-2.5"
        >
          <div className="flex items-center gap-2">
            <span className={clsx("h-2.5 w-2.5 rounded-full", item.color)} />
            <span className="text-sm font-medium text-[var(--cs-text)]">
              {item.label}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--cs-text-subtle)]">
            {item.helper}
          </p>
        </div>
      ))}
    </div>
  </div>
);
