import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import type { HeapBlockModel } from "../memory/types";

interface HeapNodeProps {
  block: HeapBlockModel;
  expanded: boolean;
  onToggle: () => void;
  registerNode?: (id: string) => (element: HTMLElement | null) => void;
}

const diffTone = {
  allocated: "border-emerald-400/30 bg-emerald-400/10",
  freed: "border-rose-400/30 bg-rose-400/10",
  updated: "border-amber-300/30 bg-amber-300/10",
  unchanged: "border-[var(--cs-border)] bg-[rgba(12,15,12,0.92)]",
} as const;

const pointerTone = {
  valid: "text-[var(--cs-primary-bright)]",
  null: "text-[#7c8c77]",
  dangling: "text-[#f87171]",
} as const;

export const HeapNode = ({
  block,
  expanded,
  onToggle,
  registerNode,
}: HeapNodeProps) => (
  <motion.article
    layout
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className={clsx(
      "overflow-hidden rounded-[1.3rem] border shadow-[0_16px_36px_rgba(0,0,0,0.24)]",
      diffTone[block.diffState],
    )}
  >
    <div ref={registerNode?.(block.anchorId)} className="px-3 py-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--cs-primary-bright)]">
              {block.address}
            </span>
            <span className="text-sm font-semibold text-[var(--cs-text)]">{block.title}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
            <span>{block.typeLabel}</span>
            <span>{block.summary}</span>
          </div>
        </div>
        <span className="material-symbols-outlined text-[18px] text-[var(--cs-text-subtle)]">
          {expanded ? "expand_less" : "expand_more"}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="cells"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2">
              {block.cells.map((cell) => (
                <div
                  key={cell.id}
                  ref={registerNode?.(cell.anchorId)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(8,10,8,0.94)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs text-[var(--cs-text)]">
                      {cell.label}
                    </div>
                    <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-[var(--cs-text-subtle)]">
                      {cell.typeLabel}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {cell.pointerStatus ? (
                      <span className={clsx("font-mono text-[10px] uppercase tracking-[0.14em]", pointerTone[cell.pointerStatus])}>
                        {cell.pointerStatus}
                      </span>
                    ) : null}
                    <span className="max-w-[12rem] truncate font-mono text-xs text-[var(--cs-text-muted)]">
                      {cell.displayValue}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  </motion.article>
);
