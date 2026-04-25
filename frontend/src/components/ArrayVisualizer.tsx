import { scalePoint } from "d3-scale";
import { LayoutGroup, motion } from "framer-motion";
import clsx from "clsx";
import type { ThemeMode, VisualArray } from "../visualization/types";

interface ArrayVisualizerProps {
  arrays: VisualArray[];
  focusMode: boolean;
  themeMode: ThemeMode;
}

const slotWidth = 88;
const tokenWidth = 56;

export const ArrayVisualizer = ({
  arrays,
  focusMode,
  themeMode,
}: ArrayVisualizerProps) => {
  const isDark = themeMode === "dark";

  if (arrays.length === 0) {
    return (
      <div
        className={clsx(
          "rounded-[1.7rem] border border-dashed px-5 py-10 text-sm",
          isDark
            ? "border-slate-700 bg-slate-900/60 text-slate-400"
            : "border-slate-200 bg-slate-50/80 text-slate-500",
        )}
      >
        Arrays will render here as animated blocks once the current step contains
        array data.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {arrays.map((array) => {
        const width = Math.max(array.items.length * slotWidth, 280);
        const scale = scalePoint<number>()
          .domain(array.items.map((item) => item.index))
          .range([44, Math.max(44, width - 44)])
          .padding(0.45);
        const isEmphasized =
          array.activeIndices.length > 0 || array.items.some((item) => item.changed);

        return (
          <motion.section
            key={array.id}
            layout
            className={clsx(
              "rounded-[1.7rem] border p-4 transition",
              isDark
                ? "border-slate-700/70 bg-slate-900/80"
                : "border-white/70 bg-white/90",
              focusMode && !isEmphasized
                ? "opacity-45 saturate-50"
                : "opacity-100",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p
                  className={clsx(
                    "font-mono text-xs uppercase tracking-[0.24em]",
                    isDark ? "text-slate-400" : "text-slate-400",
                  )}
                >
                  Array Structure
                </p>
                <h3
                  className={clsx(
                    "mt-2 text-lg font-semibold",
                    isDark ? "text-slate-100" : "text-ink",
                  )}
                >
                  {array.name}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {array.pointers.map((pointer) => (
                  <span
                    key={`${array.id}-${pointer.name}`}
                    className={clsx(
                      "rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em]",
                      pointer.active
                        ? isDark
                          ? "bg-cyan-500/15 text-cyan-200"
                          : "bg-cyan-100 text-cyan-700"
                        : isDark
                          ? "bg-slate-800 text-slate-300"
                          : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {pointer.name} = {pointer.index}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 overflow-x-auto pb-2">
              <LayoutGroup id={array.id}>
                <div className="relative h-44 min-w-max" style={{ width }}>
                  <div className="absolute inset-x-0 top-14 flex gap-4">
                    {array.items.map((item) => (
                      <div
                        key={`slot-${array.id}-${item.index}`}
                        className={clsx(
                          "flex h-24 w-[72px] flex-col items-center justify-end rounded-[1.4rem] border pb-3",
                          array.activeIndices.includes(item.index)
                            ? isDark
                              ? "border-cyan-400/50 bg-cyan-400/10"
                              : "border-cyan-300 bg-cyan-50"
                            : isDark
                              ? "border-slate-700 bg-slate-950/60"
                              : "border-slate-200 bg-slate-50/90",
                        )}
                      >
                        <span
                          className={clsx(
                            "font-mono text-xs",
                            isDark ? "text-slate-400" : "text-slate-400",
                          )}
                        >
                          [{item.index}]
                        </span>
                      </div>
                    ))}
                  </div>

                  {array.pointers.map((pointer, pointerIndex) => {
                    const xPosition = scale(pointer.index) ?? 44;

                    return (
                      <motion.div
                        key={`${array.id}-pointer-${pointer.name}`}
                        initial={false}
                        animate={{ x: xPosition - tokenWidth / 2 }}
                        transition={{ type: "spring", stiffness: 220, damping: 24 }}
                        className="absolute left-0 top-0"
                      >
                        <div className="flex flex-col items-center">
                          <div
                            className={clsx(
                              "rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-[0.22em]",
                              pointer.active
                                ? isDark
                                  ? "bg-cyan-500/15 text-cyan-200"
                                  : "bg-cyan-100 text-cyan-700"
                                : isDark
                                  ? "bg-slate-800 text-slate-300"
                                  : "bg-slate-100 text-slate-600",
                            )}
                            style={{ marginTop: pointerIndex * 26 }}
                          >
                            {pointer.name}
                          </div>
                          <div
                            className={clsx(
                              "mt-2 h-8 w-px",
                              pointer.active
                                ? "bg-cyan-400"
                                : isDark
                                  ? "bg-slate-600"
                                  : "bg-slate-300",
                            )}
                          />
                        </div>
                      </motion.div>
                    );
                  })}

                  {array.items.map((item) => {
                    const xPosition = scale(item.index) ?? 44;

                    return (
                      <motion.div
                        key={`${array.id}-${item.motionId}`}
                        layoutId={`${array.id}-${item.motionId}`}
                        initial={false}
                        animate={{
                          x: xPosition - tokenWidth / 2,
                          y: 74,
                          scale: item.changed ? [1, 1.08, 1] : 1,
                        }}
                        transition={{
                          x: { type: "spring", stiffness: 220, damping: 24 },
                          scale: { duration: 0.45, ease: "easeOut" },
                        }}
                        className="absolute left-0 top-0"
                      >
                        <div
                          className={clsx(
                            "flex h-14 w-14 items-center justify-center rounded-[1rem] border text-sm font-semibold shadow-sm",
                            item.changed
                              ? isDark
                                ? "border-amber-400/50 bg-amber-400/15 text-amber-100"
                                : "border-amber-300 bg-amber-100 text-amber-900"
                              : isDark
                                ? "border-slate-600 bg-slate-800 text-slate-100"
                                : "border-slate-200 bg-white text-ink",
                          )}
                        >
                          {item.label}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </LayoutGroup>
            </div>
          </motion.section>
        );
      })}
    </div>
  );
};
