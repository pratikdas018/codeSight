import { memo } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import type { LinkedListModel } from "../memory/types";

interface LinkedListVisualizerProps {
  lists: LinkedListModel[];
}

const statusTone = {
  valid: "text-[var(--cs-primary-bright)]",
  null: "text-[#7c8c77]",
  dangling: "text-[#f87171]",
} as const;

export const LinkedListVisualizer = memo(({ lists }: LinkedListVisualizerProps) => {
  if (lists.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[1.45rem] border border-[var(--cs-border)] bg-[rgba(10,12,10,0.82)] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
          Linked Structures
        </div>
        <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
          Node chains reveal insertion, removal, traversal, and broken links.
        </p>
      </div>

      <div className="mt-4 space-y-4">
        {lists.map((list) => (
          <motion.article
            key={list.id}
            layout
            className="rounded-[1.3rem] border border-[rgba(255,255,255,0.05)] bg-[rgba(7,9,7,0.92)] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-[var(--cs-text)]">{list.label}</div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                {list.cycleDetected ? "cycle detected" : `${list.nodes.length} node${list.nodes.length === 1 ? "" : "s"}`}
              </div>
            </div>

            <div className="workbench-scrollbar mt-3 overflow-x-auto pb-2">
              <div className="flex min-w-max items-center gap-2">
                {list.nodes.map((node, index) => (
                  <div key={node.id} className="flex items-center gap-2">
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={clsx(
                        "min-w-[112px] rounded-[1.1rem] border px-3 py-3 shadow-[0_10px_18px_rgba(0,0,0,0.16)]",
                        node.diffState === "allocated"
                          ? "border-emerald-400/30 bg-emerald-400/10"
                          : node.diffState === "updated"
                            ? "border-amber-300/30 bg-amber-300/10"
                            : "border-[rgba(255,255,255,0.06)] bg-[rgba(15,18,15,0.96)]",
                      )}
                    >
                      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--cs-text-subtle)]">
                        {node.address}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-[var(--cs-text)]">
                        {node.valueLabel}
                      </div>
                    </motion.div>

                    {index < list.nodes.length - 1 ? (
                      <div className={clsx("font-mono text-sm", statusTone[node.nextStatus])}>
                        {"->"}
                      </div>
                    ) : (
                      <div className={clsx("font-mono text-xs uppercase tracking-[0.14em]", statusTone[node.nextStatus])}>
                        {node.nextStatus}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
});

LinkedListVisualizer.displayName = "LinkedListVisualizer";
