import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import type { ThemeMode, VisualVariable } from "../visualization/types";

interface VariableBoxProps {
  variable: VisualVariable;
  explanation: string;
  focusMode: boolean;
  themeMode: ThemeMode;
}

export const VariableBox = ({
  variable,
  explanation,
  focusMode,
  themeMode,
}: VariableBoxProps) => {
  const isDark = themeMode === "dark";
  const isChanged = variable.change !== "unchanged";

  return (
    <motion.div
      layout
      whileHover={{ y: -3, scale: 1.01 }}
      animate={
        isChanged
          ? {
              scale: [1, 1.02, 1],
              boxShadow: isDark
                ? [
                    "0 0 0 rgba(251,191,36,0)",
                    "0 16px 32px rgba(251,191,36,0.18)",
                    "0 0 0 rgba(251,191,36,0)",
                  ]
                : [
                    "0 0 0 rgba(16,32,53,0)",
                    "0 18px 40px rgba(245,183,0,0.18)",
                    "0 0 0 rgba(16,32,53,0)",
                  ],
            }
          : {}
      }
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={clsx(
        "group relative overflow-hidden rounded-[1.6rem] border p-4 transition",
        isDark
          ? "border-slate-700/70 bg-slate-900/85 text-slate-100"
          : "border-white/70 bg-white/90 text-ink",
        variable.emphasis
          ? isDark
            ? "ring-1 ring-amber-400/40"
            : "ring-1 ring-amber-200"
          : "",
        focusMode && !variable.emphasis
          ? "opacity-45 saturate-50"
          : "opacity-100",
      )}
    >
      <div
        className={clsx(
          "absolute inset-x-0 top-0 h-1.5",
          isChanged
            ? "bg-[linear-gradient(90deg,_#f59e0b,_#fb7185,_#38bdf8)]"
            : isDark
              ? "bg-slate-700"
              : "bg-slate-100",
        )}
      />

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold">{variable.name}</p>
            {variable.isPointer ? (
              <span
                className={clsx(
                  "rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em]",
                  isDark
                    ? "bg-cyan-500/15 text-cyan-200"
                    : "bg-cyan-100 text-cyan-700",
                )}
              >
                Pointer
              </span>
            ) : null}
            {variable.isComposite ? (
              <span
                className={clsx(
                  "rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em]",
                  isDark
                    ? "bg-violet-500/15 text-violet-200"
                    : "bg-violet-100 text-violet-700",
                )}
              >
                Heap Ref
              </span>
            ) : null}
          </div>
          <p
            className={clsx(
              "mt-1 font-mono text-xs uppercase tracking-[0.22em]",
              isDark ? "text-slate-400" : "text-slate-400",
            )}
          >
            {variable.scope}
          </p>
        </div>

        <span
          className={clsx(
            "rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em]",
            variable.change === "updated"
              ? isDark
                ? "bg-amber-400/15 text-amber-200"
                : "bg-amber-100 text-amber-700"
              : variable.change === "added"
                ? isDark
                  ? "bg-emerald-400/15 text-emerald-200"
                  : "bg-emerald-100 text-emerald-700"
                : isDark
                  ? "bg-slate-800 text-slate-300"
                  : "bg-slate-100 text-slate-600",
          )}
        >
          {variable.change}
        </span>
      </div>

      <div className="mt-4 rounded-[1.2rem] border border-black/5 bg-black/5 p-3 backdrop-blur-sm">
        <p
          className={clsx(
            "font-mono text-sm break-all",
            isDark ? "text-slate-100" : "text-slate-700",
          )}
        >
          {variable.parsedValue.display}
        </p>
      </div>

      <AnimatePresence initial={false}>
        {isChanged && variable.previousValue ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className={clsx(
              "mt-3 rounded-[1.2rem] border px-3 py-2",
              isDark
                ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                : "border-amber-200 bg-amber-50 text-amber-800",
            )}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.2em]">
              Value Transition
            </p>
            <p className="mt-2 text-xs">
              <span className="font-mono">{variable.previousValue}</span>
              <span className="mx-2">-&gt;</span>
              <span className="font-mono font-semibold">{variable.currentValue}</span>
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileHover={{ opacity: 1, y: 0 }}
          className={clsx(
            "pointer-events-none absolute inset-x-4 bottom-4 rounded-[1rem] border p-3 opacity-0 shadow-lg transition group-hover:opacity-100",
            isDark
              ? "border-slate-700 bg-slate-950/95 text-slate-100"
              : "border-slate-200 bg-white/95 text-slate-700",
          )}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.22em]">
            Why it matters
          </p>
          <p className="mt-2 text-xs leading-5">
            {isChanged
              ? `${variable.name} changed on this step. ${explanation}`
              : `${variable.name} is part of the current memory snapshot. ${explanation}`}
          </p>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};
