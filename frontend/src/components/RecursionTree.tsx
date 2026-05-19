import { memo } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import type { RecursionNodeModel } from "../memory/types";

interface RecursionTreeProps {
  roots: RecursionNodeModel[];
}

const renderNode = (node: RecursionNodeModel) => (
  <div key={node.id} className="relative pl-5">
    <div className="absolute left-1.5 top-0 h-full w-px bg-[rgba(255,255,255,0.06)]" />
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={clsx(
        "relative rounded-xl border px-3 py-2.5",
        node.active
          ? "border-[rgba(114,255,112,0.26)] bg-[rgba(114,255,112,0.09)] shadow-[0_0_24px_rgba(114,255,112,0.08)]"
          : node.diffState === "updated"
            ? "border-amber-300/28 bg-amber-300/10"
            : "border-[rgba(255,255,255,0.06)] bg-[rgba(7,9,7,0.92)]",
      )}
    >
      <div className="text-sm font-semibold text-[var(--cs-text)]">{node.name}()</div>
      <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
        depth {node.depth} {node.lineNumber ? `• line ${node.lineNumber}` : ""}
      </div>
    </motion.div>
    {node.children.length > 0 ? (
      <div className="mt-2 space-y-2">
        {node.children.map((child) => renderNode(child))}
      </div>
    ) : null}
  </div>
);

export const RecursionTree = memo(({ roots }: RecursionTreeProps) => {
  if (roots.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[1.45rem] border border-[var(--cs-border)] bg-[rgba(10,12,10,0.82)] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
          Recursion Tree
        </div>
        <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
          Parent-child calls stay visible so students can follow active depth and returns.
        </p>
      </div>

      <div className="mt-4 space-y-3">{roots.map((root) => renderNode(root))}</div>
    </section>
  );
});

RecursionTree.displayName = "RecursionTree";
