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
  onPlaybackRateChange: (value: number) => void;
  onStepScrub: (nextIndex: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onTogglePlayback: () => void;
  onPausePlayback: () => void;
}

export const PlaybackDock = ({
  steps,
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
  onPausePlayback,
}: PlaybackDockProps) => {
  const hasTrace = steps.length > 0;

  return (
    <div className="rounded-[1.35rem] border border-[rgba(114,255,112,0.1)] bg-[linear-gradient(180deg,rgba(7,10,7,0.96),rgba(5,8,5,0.92))] px-4 py-3 shadow-[0_14px_28px_rgba(0,0,0,0.22)]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
              {hasTrace
                ? `Frame ${currentStepIndex + 1}/${steps.length}`
                : "Execution timeline"}
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-muted)]">
              <span>{activeLine ? `Line ${activeLine}` : "No line"}</span>
              {currentFunctionName ? <span>{currentFunctionName}</span> : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrevious}
              disabled={!hasTrace || currentStepIndex <= 0}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)] transition hover:border-[var(--cs-border-strong)] hover:text-[var(--cs-text)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous frame"
            >
              <span className="material-symbols-outlined text-[18px]">skip_previous</span>
            </button>
            <button
              type="button"
              onClick={onTogglePlayback}
              disabled={!hasTrace}
              className={clsx(
                "flex h-11 w-11 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40",
                hasTrace
                  ? "border-[rgba(114,255,112,0.22)] bg-[rgba(114,255,112,0.12)] text-[var(--cs-primary-bright)] shadow-[0_0_22px_rgba(114,255,112,0.16)] hover:border-[rgba(114,255,112,0.34)]"
                  : "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)]",
              )}
              aria-label={isPlaying ? "Pause playback" : "Play playback"}
            >
              <span className="material-symbols-outlined text-[22px]">
                {isPlaying ? "pause" : "play_arrow"}
              </span>
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!hasTrace || currentStepIndex >= steps.length - 1}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)] transition hover:border-[var(--cs-border-strong)] hover:text-[var(--cs-text)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next frame"
            >
              <span className="material-symbols-outlined text-[18px]">skip_next</span>
            </button>
          </div>
        </div>

        <TimelineScrubber
          steps={steps}
          currentStepIndex={currentStepIndex}
          isPlaying={isPlaying}
          onStepSelect={onStepScrub}
          onPausePlayback={onPausePlayback}
        />

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="min-w-0 flex-1 text-sm leading-6 text-[var(--cs-text-muted)]">
            {stepSummary}
          </p>

          <label className="flex items-center gap-2 rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
            <span>Speed</span>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.25"
              value={playbackRate}
              onChange={(event) => onPlaybackRateChange(Number(event.target.value))}
              className="w-20 accent-[#72ff70]"
              aria-label="Playback speed"
            />
            <span className="w-9 text-right font-mono text-[var(--cs-text)]">
              {playbackRate.toFixed(2)}x
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};
