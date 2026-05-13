import clsx from "clsx";

interface PlaybackDockProps {
  stepCount: number;
  currentStepIndex: number;
  activeLine?: number;
  isPlaying: boolean;
  playbackRate: number;
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
  isPlaying,
  playbackRate,
  onPlaybackRateChange,
  onStepScrub,
  onPrevious,
  onNext,
  onTogglePlayback,
  onReset,
}: PlaybackDockProps) => {
  const hasTrace = stepCount > 0;

  return (
    <div className="fixed inset-x-0 bottom-12 z-50 px-3 sm:px-4 lg:px-6">
      <div className="mx-auto max-w-[1900px] rounded-[1.2rem] border border-white/8 bg-[rgba(6,13,23,0.88)] px-3 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.3)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] text-slate-300">
                {hasTrace ? `Step ${currentStepIndex + 1}/${stepCount}` : "No trace"}
              </span>
              <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] text-slate-400">
                {activeLine ? `Line ${activeLine}` : "Waiting"}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={Math.max(stepCount - 1, 0)}
                step={1}
                value={hasTrace ? currentStepIndex : 0}
                onChange={(event) => onStepScrub(Number(event.target.value))}
                disabled={!hasTrace}
                className={clsx(
                  "h-2.5 w-full cursor-pointer appearance-none rounded-full accent-cyan-300",
                  hasTrace ? "opacity-100" : "cursor-not-allowed opacity-40",
                )}
              />
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
              className="cs-button cs-button-primary rounded-xl px-4 disabled:cursor-not-allowed disabled:opacity-40"
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
            <label className="ml-1 flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
              <span>Speed</span>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.25"
                value={playbackRate}
                onChange={(event) => onPlaybackRateChange(Number(event.target.value))}
                className="w-24 accent-cyan-300"
              />
              <span className="w-10 text-right font-mono text-slate-200">
                {playbackRate.toFixed(2)}x
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
