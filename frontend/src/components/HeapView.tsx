import { memo, useState } from "react";
import type { HeapBlockModel } from "../memory/types";
import { HeapNode } from "./HeapNode";

interface HeapViewProps {
  blocks: HeapBlockModel[];
  registerNode?: (id: string) => (element: HTMLElement | null) => void;
}

export const HeapView = memo(({ blocks, registerNode }: HeapViewProps) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <section className="min-w-0 rounded-[1.45rem] border border-[var(--cs-border)] bg-[rgba(10,12,10,0.82)] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
            Heap Memory
          </div>
          <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
            Live allocations, freed blocks, and nested object graphs are grouped by address.
          </p>
        </div>
        <span className="rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--cs-text-muted)]">
          {blocks.length} block{blocks.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="workbench-scrollbar mt-4 max-h-[30rem] space-y-3 overflow-y-auto pr-1">
        {blocks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--cs-border)] px-4 py-5 text-sm leading-6 text-[var(--cs-text-muted)]">
            Heap allocations show up here when your runtime produces composite values.
          </div>
        ) : (
          blocks.map((block) => (
            <HeapNode
              key={block.id}
              block={block}
              expanded={expanded[block.id] ?? block.isExpandedByDefault}
              onToggle={() =>
                setExpanded((current) => ({
                  ...current,
                  [block.id]: !(current[block.id] ?? block.isExpandedByDefault),
                }))
              }
              registerNode={registerNode}
            />
          ))
        )}
      </div>
    </section>
  );
});

HeapView.displayName = "HeapView";
