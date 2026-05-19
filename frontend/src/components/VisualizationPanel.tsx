import { motion } from "framer-motion";
import clsx from "clsx";
import { MemoryVisualizer } from "./MemoryVisualizer";
import { VariableBox } from "./VariableBox";
import type { ExecutionStep } from "../engine/types";
import { useMemoryModel } from "../hooks/useMemoryModel";
import { createVisualizationModel } from "../visualization/model";
import type { ThemeMode } from "../visualization/types";

interface VisualizationPanelProps {
  step: ExecutionStep | null;
  previousStep: ExecutionStep | null;
  currentStepIndex: number;
  totalSteps: number;
  steps: ExecutionStep[];
  error?: string;
  focusMode: boolean;
  themeMode: ThemeMode;
}

export const VisualizationPanel = ({
  step,
  previousStep,
  currentStepIndex,
  totalSteps,
  steps,
  error,
  focusMode,
  themeMode,
}: VisualizationPanelProps) => {
  const isDark = themeMode === "dark";
  const model = createVisualizationModel(step, previousStep);
  const memoryModel = useMemoryModel(step, previousStep);
  const recentFlow = steps.slice(Math.max(0, currentStepIndex - 3), currentStepIndex + 3);

  return (
    <div className="flex h-full flex-col gap-4">
      <motion.section
        layout
        className={clsx(
          "rounded-[2rem] border p-5 shadow-panel backdrop-blur",
          isDark
            ? "border-slate-700/70 bg-slate-900/85 text-slate-100"
            : "border-white/60 bg-white/80 text-slate-900",
        )}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={clsx(
              "rounded-full px-3 py-1 font-mono text-xs uppercase tracking-[0.2em]",
              isDark ? "bg-slate-800 text-slate-100" : "bg-mist text-ink",
            )}
          >
            Line {step?.line ?? 0}
          </span>
          <span
            className={clsx(
              "rounded-full px-3 py-1 font-mono text-xs uppercase tracking-[0.2em]",
              isDark
                ? "bg-amber-400/15 text-amber-200"
                : "bg-amber-100 text-amber-700",
            )}
          >
            {totalSteps === 0 ? "No trace" : `Step ${currentStepIndex + 1}/${totalSteps}`}
          </span>
          <span
            className={clsx(
              "rounded-full px-3 py-1 font-mono text-xs uppercase tracking-[0.2em]",
              focusMode
                ? isDark
                  ? "bg-cyan-500/15 text-cyan-200"
                  : "bg-cyan-100 text-cyan-700"
                : isDark
                  ? "bg-slate-800 text-slate-300"
                  : "bg-slate-100 text-slate-600",
            )}
          >
            {focusMode ? "Focus mode" : "Panoramic view"}
          </span>
        </div>

        <p className={clsx("mt-4 text-lg font-semibold", isDark ? "text-slate-100" : "text-ink")}>
          {step?.description ??
            (totalSteps === 0
              ? "Run your code to inspect output, errors, and any available execution steps."
              : "Run your code to generate an execution timeline.")}
        </p>
        <p className={clsx("mt-3 text-sm leading-6", isDark ? "text-slate-300" : "text-slate-600")}>
          {totalSteps === 0
            ? "Python returns traced execution steps, JavaScript keeps best-effort educational tracing, and compiled languages currently return output and diagnostics without a step timeline."
            : model.explanation}
        </p>

        {error ? (
          <p
            className={clsx(
              "mt-3 rounded-2xl px-4 py-3 text-sm",
              isDark
                ? "bg-rose-500/15 text-rose-200"
                : "bg-rose-50 text-rose-700",
            )}
          >
            {error}
          </p>
        ) : null}
      </motion.section>

      <div className="grid flex-1 gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <motion.section
          layout
          className={clsx(
            "rounded-[2rem] border p-5 shadow-panel backdrop-blur",
            isDark
              ? "border-slate-700/70 bg-slate-900/85"
              : "border-white/60 bg-white/80",
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className={clsx(
                  "font-mono text-xs uppercase tracking-[0.3em]",
                  isDark ? "text-slate-400" : "text-slate-500",
                )}
              >
                Variables
              </p>
              <h2 className={clsx("mt-2 text-xl font-semibold", isDark ? "text-slate-100" : "text-ink")}>
                Animated state changes
              </h2>
            </div>
            <span
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-medium",
                isDark ? "bg-slate-800 text-slate-100" : "bg-mist text-ink",
              )}
            >
              {model.variables.length} tracked
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            {model.variables.length ? (
              model.variables.map((variable) => (
                <VariableBox
                  key={variable.id}
                  variable={variable}
                  explanation={model.explanation}
                  focusMode={focusMode}
                  themeMode={themeMode}
                />
              ))
            ) : (
              <p
                className={clsx(
                  "rounded-2xl px-4 py-5 text-sm",
                  isDark
                    ? "bg-slate-950/70 text-slate-400"
                    : "bg-slate-50 text-slate-500",
                )}
              >
                Variables will appear here as your code executes.
              </p>
            )}
          </div>
        </motion.section>

        <MemoryVisualizer model={memoryModel} />
      </div>

      <motion.section
        layout
        className={clsx(
          "rounded-[2rem] border p-5 shadow-panel backdrop-blur",
          isDark
            ? "border-slate-700/70 bg-slate-900/85"
            : "border-white/60 bg-white/80",
        )}
      >
        <p
          className={clsx(
            "font-mono text-xs uppercase tracking-[0.3em]",
            isDark ? "text-slate-400" : "text-slate-500",
          )}
        >
          Execution Flow
        </p>
        <div className="mt-4 space-y-3">
          {recentFlow.length === 0 ? (
            <p
              className={clsx(
                "rounded-2xl px-4 py-5 text-sm",
                isDark
                  ? "bg-slate-950/70 text-slate-400"
                  : "bg-slate-50 text-slate-500",
              )}
            >
              Step through code to watch the timeline build.
            </p>
          ) : (
            recentFlow.map((flowStep, index) => {
              const actualIndex = Math.max(0, currentStepIndex - 3) + index;
              const isActive = actualIndex === currentStepIndex;

              return (
                <div
                  key={`${flowStep.line}-${actualIndex}`}
                  className={clsx(
                    "rounded-2xl border px-4 py-3 transition",
                    focusMode && !isActive ? "opacity-45" : "",
                    isActive
                      ? isDark
                        ? "border-amber-300 bg-slate-950 text-white"
                        : "border-ink bg-ink text-white"
                      : isDark
                        ? "border-slate-700 bg-slate-950/70 text-slate-300"
                        : "border-slate-200 bg-white text-slate-700",
                  )}
                >
                  <p className="font-mono text-xs uppercase tracking-[0.2em]">
                    Line {flowStep.line}
                  </p>
                  <p className="mt-2 text-sm">
                    {flowStep.explanation ?? flowStep.description}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </motion.section>
    </div>
  );
};
