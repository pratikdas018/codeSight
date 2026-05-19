import { memo, useMemo } from "react";
import { LayoutGroup, motion } from "framer-motion";
import clsx from "clsx";
import type { MemoryArrayModel } from "../memory/types";

interface ArrayVisualizerProps {
  arrays: MemoryArrayModel[];
}

const maxDenseCells = 28;

const buildVisibleCells = (array: MemoryArrayModel) => {
  if (array.cells.length <= maxDenseCells) {
    return array.cells;
  }

  const highlighted = new Set(array.highlightedIndices);
  const visibleIndexes = new Set<number>();

  for (let index = 0; index < 12; index += 1) {
    visibleIndexes.add(index);
  }

  for (let index = Math.max(array.cells.length - 10, 0); index < array.cells.length; index += 1) {
    visibleIndexes.add(index);
  }

  for (const index of highlighted) {
    for (let cursor = Math.max(0, index - 1); cursor <= Math.min(array.cells.length - 1, index + 1); cursor += 1) {
      visibleIndexes.add(cursor);
    }
  }

  return array.cells.filter((cell) => typeof cell.index === "number" && visibleIndexes.has(cell.index));
};

export const ArrayVisualizer = memo(({ arrays }: ArrayVisualizerProps) => {
  const preparedArrays = useMemo(
    () =>
      arrays.map((array) => ({
        ...array,
        visibleCells: buildVisibleCells(array),
      })),
    [arrays],
  );

  if (arrays.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[1.45rem] border border-[var(--cs-border)] bg-[rgba(10,12,10,0.82)] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
            Arrays and Vectors
          </div>
          <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
            Indexed cells, resize hints, and changed values stay synchronized with playback.
          </p>
        </div>
        <span className="rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--cs-text-muted)]">
          {arrays.length} tracked
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {preparedArrays.map((array) => (
          <motion.article
            key={array.id}
            layout
            className="rounded-[1.3rem] border border-[rgba(255,255,255,0.05)] bg-[rgba(7,9,7,0.92)] p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-[var(--cs-text)]">
                  {array.label}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                  <span>{array.collectionType}</span>
                  <span>{array.address}</span>
                  <span>size {array.size}</span>
                  <span>capacity {array.capacity}</span>
                </div>
              </div>
              <div className="rounded-full border border-[rgba(114,255,112,0.16)] bg-[rgba(114,255,112,0.08)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--cs-primary-bright)]">
                {array.highlightedIndices.length} updated
              </div>
            </div>

            <div className="mt-3">
              <div className="mb-3 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                <motion.div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#00ff41,#72ff70)]"
                  initial={false}
                  animate={{
                    width: `${array.capacity === 0 ? 0 : (array.size / array.capacity) * 100}%`,
                  }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                />
              </div>

              <div className="workbench-scrollbar overflow-x-auto pb-2">
                <LayoutGroup id={array.id}>
                  <div className="flex min-w-max items-end gap-2">
                    {array.visibleCells.map((cell) => (
                      <motion.div
                        key={cell.id}
                        layout
                        animate={
                          cell.diffState !== "unchanged"
                            ? { y: [0, -4, 0], scale: [1, 1.03, 1] }
                            : { y: 0, scale: 1 }
                        }
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="flex min-w-[74px] flex-col items-center gap-1"
                      >
                        <span className="font-mono text-[11px] text-[var(--cs-text-subtle)]">
                          [{cell.index ?? 0}]
                        </span>
                        <div
                          className={clsx(
                            "flex h-16 w-[74px] items-center justify-center rounded-[1.1rem] border px-2 text-center font-mono text-xs shadow-[0_10px_18px_rgba(0,0,0,0.16)]",
                            cell.diffState === "allocated"
                              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                              : cell.diffState === "updated"
                                ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
                                : "border-[rgba(255,255,255,0.06)] bg-[rgba(15,18,15,0.96)] text-[var(--cs-text)]",
                          )}
                        >
                          {cell.displayValue}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </LayoutGroup>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
});

ArrayVisualizer.displayName = "ArrayVisualizer";
