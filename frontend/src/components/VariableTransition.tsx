import { AnimatePresence, motion, type TargetAndTransition } from "framer-motion";
import clsx from "clsx";
import type { VisualVariable } from "../visualization/types";
import { VariableDiffBadge } from "./VariableDiffBadge";

interface VariableTransitionProps {
  variable: VisualVariable;
}

const shellToneMap: Record<VisualVariable["change"], string> = {
  added:
    "border-emerald-300/20 bg-[linear-gradient(180deg,rgba(12,26,15,0.96),rgba(10,15,10,0.96))]",
  updated:
    "border-amber-300/18 bg-[linear-gradient(180deg,rgba(30,24,8,0.38),rgba(12,15,12,0.96))]",
  removed:
    "border-rose-300/18 bg-[linear-gradient(180deg,rgba(40,12,18,0.3),rgba(14,10,12,0.96))]",
  unchanged: "border-[var(--cs-border)] bg-[rgba(15,20,15,0.95)]",
};

const accentToneMap: Record<VisualVariable["change"], string> = {
  added: "from-emerald-400 via-[var(--cs-primary-bright)] to-transparent",
  updated: "from-amber-300 via-[var(--cs-primary)] to-transparent",
  removed: "from-rose-400 via-rose-300 to-transparent",
  unchanged: "from-[rgba(114,255,112,0.14)] via-transparent to-transparent",
};

const cardAnimationMap: Record<VisualVariable["change"], TargetAndTransition> = {
  added: {
    opacity: [0.82, 1],
    x: [-10, 0],
    boxShadow: [
      "0 0 0 rgba(34,197,94,0)",
      "0 18px 42px rgba(34,197,94,0.18)",
      "0 0 0 rgba(34,197,94,0)",
    ],
  },
  updated: {
    scale: [1, 1.012, 1],
    boxShadow: [
      "0 0 0 rgba(251,191,36,0)",
      "0 16px 38px rgba(251,191,36,0.16)",
      "0 0 0 rgba(251,191,36,0)",
    ],
  },
  removed: {
    opacity: [0.96, 0.88, 0.94],
    boxShadow: [
      "0 0 0 rgba(244,63,94,0)",
      "0 14px 36px rgba(244,63,94,0.16)",
      "0 0 0 rgba(244,63,94,0)",
    ],
  },
  unchanged: {},
};

const valueToneMap: Record<VisualVariable["change"], string> = {
  added: "border-emerald-300/14 bg-emerald-300/8 text-emerald-50",
  updated: "border-amber-300/14 bg-amber-300/8 text-amber-50",
  removed: "border-rose-300/14 bg-rose-300/8 text-rose-50 line-through decoration-rose-200/70",
  unchanged: "border-[rgba(255,255,255,0.04)] bg-[rgba(11,15,11,0.92)] text-[var(--cs-text)]",
};

export const VariableTransition = ({ variable }: VariableTransitionProps) => {
  const hasDetailedChanges =
    variable.change !== "unchanged" && variable.diffPaths.length > 0;
  const renderedChanges = variable.diffPaths.slice(0, 4);

  return (
    <motion.div
      layout
      initial={variable.change === "added" ? { opacity: 0, y: 14 } : false}
      animate={cardAnimationMap[variable.change]}
      exit={
        variable.change === "removed"
          ? {
              opacity: 0,
              scale: 0.98,
              y: -6,
            }
          : undefined
      }
      transition={{ duration: 0.42, ease: "easeOut" }}
      className={clsx(
        "relative overflow-hidden rounded-2xl border px-3.5 py-3",
        shellToneMap[variable.change],
      )}
    >
      <div
        className={clsx(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-90",
          accentToneMap[variable.change],
        )}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-[var(--cs-text)]">
              {variable.name}
            </span>
            <span className="rounded-full border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.03)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-muted)]">
              {variable.valueType}
            </span>
            {!variable.present ? (
              <span className="rounded-full border border-rose-300/16 bg-rose-300/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-rose-100">
                exited
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
            {variable.scope}
          </div>
        </div>

        <VariableDiffBadge
          change={variable.change}
          changeCount={variable.changeCount}
        />
      </div>

      <motion.div
        layout
        className={clsx(
          "mt-3 rounded-xl border px-3 py-2.5 font-mono text-xs leading-6",
          valueToneMap[variable.change],
        )}
        animate={
          variable.change === "updated"
            ? {
                backgroundColor: [
                  "rgba(251,191,36,0.06)",
                  "rgba(251,191,36,0.16)",
                  "rgba(251,191,36,0.06)",
                ],
              }
            : undefined
        }
        transition={{ duration: 0.48, ease: "easeOut" }}
      >
        {variable.currentValue}
      </motion.div>

      <AnimatePresence initial={false}>
        {variable.previousValue &&
        variable.change !== "unchanged" &&
        variable.change !== "added" ? (
          <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="mt-2.5 rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(6,10,6,0.72)] px-3 py-2.5"
          >
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
              Previous
            </div>
            <div className="mt-2 font-mono text-[11px] leading-6 text-[var(--cs-text-muted)]">
              {variable.previousValue}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {hasDetailedChanges ? (
          <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mt-3 rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(8,11,8,0.88)] px-3 py-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
                Change Map
              </div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--cs-primary-bright)]">
                {variable.changeSummary}
              </div>
            </div>

            <div className="mt-2 space-y-2">
              {renderedChanges.map((change) => (
                <motion.div
                  key={`${variable.id}-${change.path}-${change.kind}`}
                  layout
                  className="grid grid-cols-[minmax(0,1fr),auto,minmax(0,1fr)] items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.03)] bg-black/10 px-2.5 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cs-text-subtle)]">
                      {change.path}
                    </div>
                    <div className="mt-1 truncate font-mono text-[11px] text-[var(--cs-text-muted)]">
                      {change.before ?? "new"}
                    </div>
                  </div>
                  <motion.span
                    animate={
                      change.kind === "updated"
                        ? { scale: [1, 1.18, 1] }
                        : { scale: 1 }
                    }
                    transition={{ duration: 0.32, ease: "easeOut" }}
                    className={clsx(
                      "font-mono text-[11px]",
                      change.kind === "removed"
                        ? "text-rose-200"
                        : change.kind === "added"
                          ? "text-emerald-200"
                          : "text-amber-200",
                    )}
                  >
                    -&gt;
                  </motion.span>
                  <div className="min-w-0 text-right">
                    <div className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cs-text-subtle)]">
                      {change.kind}
                    </div>
                    <div className="mt-1 truncate font-mono text-[11px] text-[var(--cs-text)]">
                      {change.after ?? "deleted"}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
};
