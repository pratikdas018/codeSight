import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import type { MemorySlotModel, StackFrameModel } from "../memory/types";

interface StackFrameProps {
  frame: StackFrameModel;
  compact?: boolean;
  collapsed: boolean;
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

const SlotRow = ({
  slot,
  registerNode,
}: {
  slot: MemorySlotModel;
  registerNode?: StackFrameProps["registerNode"];
}) => (
  <div
    ref={registerNode?.(slot.anchorId)}
    className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(8,10,8,0.94)] px-3 py-2"
  >
    <div className="min-w-0 flex-1">
      <div className="truncate font-mono text-xs text-[var(--cs-text)]">
        {slot.name}
      </div>
      <div className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
        {slot.typeLabel}
      </div>
    </div>
    <div className="ml-auto flex min-w-0 max-w-full flex-1 flex-col items-end gap-1 text-right">
      {slot.pointerStatus ? (
        <span className={clsx("font-mono text-[10px] uppercase tracking-[0.16em]", pointerTone[slot.pointerStatus])}>
          {slot.pointerStatus}
        </span>
      ) : null}
      <span className="max-w-full break-words font-mono text-xs leading-5 text-[var(--cs-text-muted)]">
        {slot.displayValue}
      </span>
    </div>
  </div>
);

export const StackFrame = ({
  frame,
  compact = false,
  collapsed,
  onToggle,
  registerNode,
}: StackFrameProps) => {
  const renderedLocals = compact ? frame.locals.slice(0, 3) : frame.locals;
  const renderedParameters = compact
    ? frame.parameters.slice(0, 2)
    : frame.parameters;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={clsx(
        "relative min-w-0 overflow-hidden rounded-[1.35rem] border p-3 shadow-[0_16px_36px_rgba(0,0,0,0.28)]",
        diffTone[frame.diffState],
        frame.isActive
          ? "ring-1 ring-[rgba(114,255,112,0.18)]"
          : "",
      )}
      style={{ marginLeft: `${Math.min(frame.recursionDepth, 4) * 14}px` }}
    >
      <div
        className={clsx(
          "absolute bottom-0 left-0 top-0 w-1",
          frame.isActive ? "bg-[var(--cs-primary)]" : "bg-[rgba(255,255,255,0.06)]",
        )}
      />

      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 text-left"
        aria-expanded={!collapsed}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--cs-text)]">
              {frame.isGlobal ? "global scope" : `${frame.name}()`}
            </span>
            <span className="rounded-full border border-[rgba(114,255,112,0.14)] bg-[rgba(114,255,112,0.08)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--cs-primary-bright)]">
              depth {frame.depth}
            </span>
            {frame.recursionDepth > 0 ? (
              <span className="rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                recursion {frame.recursionDepth}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
            <span>{frame.lineNumber ? `line ${frame.lineNumber}` : "line pending"}</span>
            {frame.returnAddress ? <span>return {frame.returnAddress}</span> : null}
          </div>
        </div>
        <span className="material-symbols-outlined text-[18px] text-[var(--cs-text-subtle)]">
          {collapsed ? "expand_more" : "expand_less"}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed ? (
          <motion.div
            key="content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3">
              {renderedParameters.length > 0 ? (
                <div>
                  <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                    Parameters
                  </div>
                  <div className="space-y-2">
                    {renderedParameters.map((slot) => (
                      <SlotRow key={slot.id} slot={slot} registerNode={registerNode} />
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                  {renderedParameters.length > 0 ? "Locals" : "Frame variables"}
                </div>
                <div className="space-y-2">
                  {(renderedLocals.length > 0 ? renderedLocals : frame.locals).map((slot) => (
                    <SlotRow key={slot.id} slot={slot} registerNode={registerNode} />
                  ))}
                  {frame.locals.length === 0 && frame.parameters.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--cs-border)] px-3 py-3 text-xs text-[var(--cs-text-subtle)]">
                      No locals captured on this frame.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
};
