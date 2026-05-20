import { memo, useEffect, useState } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import type { MemoryVisualizationModel } from "../memory/types";
import { useMemoryDiff } from "../hooks/useMemoryDiff";
import { usePointerGraph } from "../hooks/usePointerGraph";
import { ArrayVisualizer } from "./ArrayVisualizer";
import { HeapView } from "./HeapView";
import { LinkedListVisualizer } from "./LinkedListVisualizer";
import { MemoryLegend } from "./MemoryLegend";
import { PointerArrow } from "./PointerArrow";
import { StackView } from "./StackView";

interface MemoryVisualizerProps {
  model: MemoryVisualizationModel;
}

export const MemoryVisualizer = memo(({ model }: MemoryVisualizerProps) => {
  const diff = useMemoryDiff(model);
  const { containerRef, registerNode, edges } = usePointerGraph(model.pointerLinks);
  const [isSplitLayout, setIsSplitLayout] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const updateLayout = () => {
      setIsSplitLayout(container.clientWidth >= 920);
    };

    updateLayout();

    const observer = new ResizeObserver(() => {
      updateLayout();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [containerRef]);

  return (
    <section className="min-w-0 rounded-[1.45rem] border border-[var(--cs-border)] bg-[linear-gradient(180deg,rgba(11,14,11,0.94),rgba(6,8,6,0.98))] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
            Advanced Memory Inspector
          </div>
          <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
            Stack, heap, pointers, arrays, and linked structures stay synchronized with the active timeline frame.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            `${model.stats.heapBlockCount} heap`,
            `${model.stats.pointerCount} pointers`,
            `${model.stats.arrayCount} arrays`,
            `${model.stats.linkedListCount} lists`,
          ].map((label) => (
            <span
              key={label}
              className="rounded-full border border-[rgba(114,255,112,0.14)] bg-[rgba(114,255,112,0.08)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--cs-primary-bright)]"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="relative mt-4 rounded-[1.35rem] border border-[rgba(255,255,255,0.04)] bg-[rgba(6,8,6,0.75)] p-3">
        {isSplitLayout ? (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <marker id="memory-arrow-valid" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" fill="#72ff70" />
              </marker>
              <marker id="memory-arrow-null" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" fill="#7c8c77" />
              </marker>
              <marker id="memory-arrow-dangling" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" fill="#f87171" />
              </marker>
            </defs>
            {edges.map((edge) => (
              <PointerArrow key={edge.id} edge={edge} />
            ))}
          </svg>
        ) : null}

        <div
          className={clsx(
            "grid gap-4",
            isSplitLayout
              ? "items-start grid-cols-[minmax(18rem,0.88fr)_minmax(22rem,1.12fr)]"
              : "grid-cols-1",
          )}
        >
          <StackView frames={model.stackFrames} compact={isSplitLayout} registerNode={registerNode} />
          <HeapView blocks={model.heapBlocks} registerNode={registerNode} />
        </div>
      </div>

      <div
        className={clsx(
          "mt-4 grid gap-4",
          isSplitLayout
            ? "grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"
            : "grid-cols-1",
        )}
      >
        <ArrayVisualizer arrays={model.arrays} />
        <LinkedListVisualizer lists={model.linkedLists} />
      </div>

      <motion.div layout className="mt-4">
        <MemoryLegend diff={diff.summary} />
      </motion.div>
    </section>
  );
});

MemoryVisualizer.displayName = "MemoryVisualizer";
