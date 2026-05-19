import { motion } from "framer-motion";
import clsx from "clsx";

interface PlaybackDockProps {
  stepCount: number;
  currentStepIndex: number;
  activeLine?: number;
  currentFunctionName?: string;
  isPlaying: boolean;
  playbackRate: number;
  stepSummary: string;
  onPlaybackRateChange: (value: number) => void;
  onStepScrub: (nextIndex: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onTogglePlayback: () => void;
  onReset: () => void;
}

export const PlaybackDock = ({
  stepCount,
  currentStepIndex,
  activeLine,
  currentFunctionName,
  isPlaying,
  playbackRate,
  stepSummary,
  onPlaybackRateChange,
  onStepScrub,
  onPrevious,
  onNext,
  onTogglePlayback,
  onReset,
}: PlaybackDockProps) => {
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
      <div className="mx-auto max-w-[1900px] rounded-[1.2rem] border border-[#1f1f1f] bg-[rgba(10,10,10,0.94)] px-3 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-1.5 font-mono text-[11px] text-[#dfffe5]">
                {hasTrace ? `Frame ${currentStepIndex + 1}/${stepCount}` : "No trace"}
              </span>
              <span className="rounded-full border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-1.5 font-mono text-[11px] text-[#84967e]">
                {activeLine ? `Line ${activeLine}` : "Waiting"}
              </span>
              <span className="rounded-full border border-[rgba(114,255,112,0.14)] bg-[rgba(114,255,112,0.07)] px-3 py-1.5 font-mono text-[11px] text-[#72ff70]">
                {currentFunctionName ?? "global scope"}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <div className="pointer-events-none absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full border border-[#1f1f1f] bg-[#070907]" />
                <motion.div
                  className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,rgba(0,255,65,0.18),rgba(114,255,112,0.42))] shadow-[0_0_22px_rgba(0,255,65,0.18)]"
                  initial={false}
                  animate={{
                    width: `${timelineProgress}%`,
                  }}
                  transition={{ duration: isPlaying ? 0.26 : 0.16, ease: "easeOut" }}
                />
                <input
                  type="range"
                  min={0}
                  max={Math.max(stepCount - 1, 0)}
                  step={1}
                  value={hasTrace ? currentStepIndex : 0}
                  onChange={(event) => onStepScrub(Number(event.target.value))}
                  disabled={!hasTrace}
                  className={clsx(
                    "relative z-10 h-2.5 w-full cursor-pointer appearance-none rounded-full bg-transparent accent-[#00ff41]",
                    hasTrace ? "opacity-100" : "cursor-not-allowed opacity-40",
                  )}
                />
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 flex-1 truncate text-sm text-[#b9ccb2]">
                {dockSummary}
              </p>
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#84967e]">
                {hasTrace ? `${timelineProgress.toFixed(0)}% through trace` : "Awaiting playback"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
