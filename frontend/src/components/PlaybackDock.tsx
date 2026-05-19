import clsx from "clsx";
import type { ExecutionStep } from "../engine/types";
import { TimelineScrubber } from "./TimelineScrubber";

interface PlaybackDockProps {
  steps: ExecutionStep[];
  currentStepIndex: number;
  activeLine?: number;
  currentFunctionName?: string;
  isPlaying: boolean;
  playbackRate: number;
  stepSummary: string;
  traceError?: string;
  breakpointLines?: number[];
  onPlaybackRateChange: (value: number) => void;
  onStepScrub: (nextIndex: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onTogglePlayback: () => void;
  onPausePlayback: () => void;
  onReset: () => void;
}

export const PlaybackDock = ({
  steps,
  currentStepIndex,
  activeLine,
  currentFunctionName,
  isPlaying,
  playbackRate,
  stepSummary,
  traceError,
  breakpointLines,
  onPlaybackRateChange,
  onStepScrub,
  onPrevious,
  onNext,
  onTogglePlayback,
  onPausePlayback,
  onReset,
}: PlaybackDockProps) => {
  const stepCount = steps.length;
  const hasTrace = stepCount > 0;
  const timelineProgress =
    hasTrace && stepCount > 1
      ? (currentStepIndex / (stepCount - 1)) * 100
      : hasTrace
        ? 100
        : 0;
  const dockSummary = hasTrace
    ? stepSummary
    : "Run your program to capture a synchronized execution timeline.";

  return (
    <div className="fixed inset-x-0 bottom-12 z-50 px-3 sm:px-4 lg:px-6">
      <div className="mx-auto max-w-[1900px] rounded-[1.35rem] border border-[#1f1f1f] bg-[rgba(7,9,7,0.96)] px-3 py-3 shadow-[0_24px_54px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr),auto] xl:items-center">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-1.5 font-mono text-[11px] text-[#dfffe5]">
                {hasTrace ? `Frame ${currentStepIndex + 1}/${stepCount}` : "No trace"}
              </span>
              <span className="rounded-full border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-1.5 font-mono text-[11px] text-[#84967e]">
                {activeLine ? `Line ${activeLine}` : "Waiting"}
              </span>
              <span className="rounded-full border border-[rgba(114,255,112,0.14)] bg-[rgba(114,255,112,0.07)] px-3 py-1.5 font-mono text-[11px] text-[#72ff70]">
                {currentFunctionName ?? "global scope"}
              </span>
              <span className="rounded-full border border-[rgba(114,255,112,0.08)] bg-[rgba(255,255,255,0.02)] px-3 py-1.5 font-mono text-[11px] text-[#84967e]">
                {hasTrace ? `${timelineProgress.toFixed(0)}% through trace` : "Awaiting playback"}
              </span>
            </div>

            <TimelineScrubber
              steps={steps}
              currentStepIndex={currentStepIndex}
              isPlaying={isPlaying}
              breakpointLines={breakpointLines}
              traceError={traceError}
              onStepSelect={onStepScrub}
              onPrevious={onPrevious}
              onNext={onNext}
              onTogglePlayback={onTogglePlayback}
              onPausePlayback={onPausePlayback}
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 flex-1 truncate text-sm text-[#b9ccb2]">
                {dockSummary}
              </p>
              <span
                className={clsx(
                  "font-mono text-[11px] uppercase tracking-[0.16em]",
                  traceError ? "text-rose-200" : "text-[#84967e]",
                )}
              >
                {traceError ? "Runtime issue captured on timeline" : "Hover to preview any frame"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <button
              type="button"
              onClick={onReset}
              className="cs-button rounded-xl px-3"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onPrevious}
              disabled={!hasTrace || currentStepIndex <= 0}
              className="cs-button rounded-xl px-3 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[18px]">skip_previous</span>
            </button>
            <button
              type="button"
              onClick={onTogglePlayback}
              disabled={!hasTrace}
              className={clsx(
                "cs-button cs-button-primary rounded-xl px-4 disabled:cursor-not-allowed disabled:opacity-40",
                hasTrace ? "shadow-[0_0_24px_rgba(0,255,65,0.22)]" : "",
              )}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isPlaying ? "pause" : "play_arrow"}
              </span>
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!hasTrace || currentStepIndex >= stepCount - 1}
              className="cs-button rounded-xl px-3 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[18px]">skip_next</span>
            </button>
            <label className="ml-1 flex items-center gap-2 rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-2 text-xs text-[#84967e]">
              <span>Speed</span>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.25"
                value={playbackRate}
                onChange={(event) => onPlaybackRateChange(Number(event.target.value))}
                className="w-24 accent-[#00ff41]"
                aria-label="Playback speed"
              />
              <span className="w-10 text-right font-mono text-[#dfffe5]">
                {playbackRate.toFixed(2)}x
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
