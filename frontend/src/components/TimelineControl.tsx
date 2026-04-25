import { useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { motion } from "framer-motion";
import clsx from "clsx";
import type { ExecutionStep } from "../engine/types";
import type { ThemeMode } from "../visualization/types";

interface TimelineControlProps {
  currentStepIndex: number;
  isPlaying: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onStepSelect: (stepIndex: number) => void;
  onToggleFocusMode: () => void;
  onTogglePlay: () => void;
  onToggleTheme: () => void;
  playbackRate: number;
  focusMode: boolean;
  steps: ExecutionStep[];
  themeMode: ThemeMode;
  onPlaybackRateChange: (rate: number) => void;
}

export const TimelineControl = ({
  currentStepIndex,
  isPlaying,
  onNext,
  onPrevious,
  onStepSelect,
  onToggleFocusMode,
  onTogglePlay,
  onToggleTheme,
  playbackRate,
  focusMode,
  steps,
  themeMode,
  onPlaybackRateChange,
}: TimelineControlProps) => {
  const isDark = themeMode === "dark";
  const totalSteps = steps.length;
  const currentStep = steps[currentStepIndex] ?? null;
  const scale = useMemo(
    () =>
      scaleLinear()
        .domain([0, Math.max(totalSteps - 1, 1)])
        .range([34, 966]),
    [totalSteps],
  );

  return (
    <section
      className={clsx(
        "rounded-[2rem] border p-5 shadow-panel backdrop-blur",
        isDark
          ? "border-slate-700/70 bg-slate-900/85 text-slate-100"
          : "border-white/60 bg-white/85 text-slate-900",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p
            className={clsx(
              "font-mono text-xs uppercase tracking-[0.3em]",
              isDark ? "text-slate-400" : "text-slate-500",
            )}
          >
            Timeline
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            Navigate the full execution story
          </h2>
          <p
            className={clsx(
              "mt-2 max-w-2xl text-sm",
              isDark ? "text-slate-300" : "text-slate-600",
            )}
          >
            {currentStep?.explanation ?? currentStep?.description ?? "Run your code to populate the timeline."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onPrevious}
            disabled={currentStepIndex <= 0}
            className={clsx(
              "rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
              isDark
                ? "border border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
                : "border border-slate-300 bg-white text-slate-700 hover:border-ink hover:text-ink",
            )}
          >
            Previous
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={totalSteps === 0}
            className={clsx(
              "rounded-full px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
              isDark
                ? "bg-amber-400 text-slate-950 hover:bg-amber-300"
                : "bg-ink text-white hover:bg-slate-900",
            )}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={totalSteps === 0 || currentStepIndex >= totalSteps - 1}
            className={clsx(
              "rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
              isDark
                ? "border border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
                : "border border-slate-300 bg-white text-slate-700 hover:border-ink hover:text-ink",
            )}
          >
            Next
          </button>
        </div>
      </div>

      <div
        className={clsx(
          "mt-5 rounded-[1.6rem] border p-4",
          isDark
            ? "border-slate-700 bg-slate-950/60"
            : "border-slate-200 bg-slate-50/80",
        )}
      >
        <svg viewBox="0 0 1000 96" className="h-24 w-full">
          <line
            x1="34"
            y1="48"
            x2="966"
            y2="48"
            stroke={isDark ? "#334155" : "#cbd5e1"}
            strokeWidth="4"
            strokeLinecap="round"
          />
          {steps.map((step, index) => {
            const position = scale(index);
            const isActive = index === currentStepIndex;
            const isPast = index < currentStepIndex;

            return (
              <g
                key={`timeline-${index}`}
                onClick={() => onStepSelect(index)}
                className="cursor-pointer"
              >
                <motion.circle
                  cx={position}
                  cy="48"
                  r={isActive ? 13 : 9}
                  initial={false}
                  animate={{
                    fill: isActive
                      ? isDark
                        ? "#fbbf24"
                        : "#102035"
                      : isPast
                        ? isDark
                          ? "#38bdf8"
                          : "#7c3aed"
                        : isDark
                          ? "#475569"
                          : "#cbd5e1",
                    scale: isActive ? 1.08 : 1,
                  }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                />
                <text
                  x={position}
                  y="22"
                  textAnchor="middle"
                  fill={isDark ? "#94a3b8" : "#64748b"}
                  className="font-mono text-[10px]"
                >
                  {index + 1}
                </text>
                <text
                  x={position}
                  y="78"
                  textAnchor="middle"
                  fill={isActive ? (isDark ? "#f8fafc" : "#0f172a") : isDark ? "#94a3b8" : "#64748b"}
                  className="font-mono text-[10px]"
                >
                  L{step.line}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p
            className={clsx(
              "text-sm",
              isDark ? "text-slate-300" : "text-slate-600",
            )}
          >
            Step {totalSteps === 0 ? 0 : currentStepIndex + 1} of {totalSteps}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              className={clsx(
                "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition",
                isDark
                  ? "bg-slate-800 text-slate-100 hover:bg-slate-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              )}
            >
              {isDark ? "Light UI" : "Dark UI"}
            </button>
            <button
              type="button"
              onClick={onToggleFocusMode}
              className={clsx(
                "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition",
                focusMode
                  ? isDark
                    ? "bg-amber-400 text-slate-950 hover:bg-amber-300"
                    : "bg-ink text-white hover:bg-slate-900"
                  : isDark
                    ? "bg-slate-800 text-slate-100 hover:bg-slate-700"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              )}
            >
              {focusMode ? "Focused" : "Focus Mode"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <label className="flex min-w-[260px] flex-1 items-center gap-3">
          <span
            className={clsx(
              "font-mono text-xs uppercase tracking-[0.22em]",
              isDark ? "text-slate-400" : "text-slate-500",
            )}
          >
            Speed
          </span>
          <input
            type="range"
            min="0.5"
            max="2.5"
            step="0.25"
            value={playbackRate}
            onChange={(event) => onPlaybackRateChange(Number(event.target.value))}
            className="h-2 flex-1 accent-amber-500"
          />
          <span
            className={clsx(
              "w-12 text-right font-mono text-sm",
              isDark ? "text-slate-100" : "text-slate-700",
            )}
          >
            {playbackRate.toFixed(2)}x
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={clsx(
              "rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em]",
              isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600",
            )}
          >
            Active line {currentStep?.line ?? 0}
          </span>
        </div>
      </div>
    </section>
  );
};
