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
  const stepLabel = hasTrace
    ? `Step ${currentStepIndex + 1}/${stepCount}`
    : "Awaiting trace";
  const lineLabel = activeLine ? `Line ${activeLine}` : "No line";
  const functionLabel = currentFunctionName ?? "global";

  return (
    <div
      className="mb-4 w-full rounded-[1.2rem] border border-[rgba(114,255,112,0.08)] bg-[linear-gradient(180deg,rgba(8,10,8,0.9),rgba(7,9,7,0.82))] px-3 py-2 shadow-[0_12px_24px_rgba(0,0,0,0.16)]"
      title={hasTrace ? stepSummary : "Run your program to capture a synchronized execution timeline."}
    >
      <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:gap-3">
        <div className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
          <span className="text-[var(--cs-text-muted)]">Trace</span>
          <span>{stepLabel}</span>
          <span className="hidden sm:inline">{lineLabel}</span>
          <span className="hidden md:inline max-w-[7rem] truncate text-[var(--cs-primary-bright)]">
            {functionLabel}
          </span>
          {traceError ? (
            <span className="rounded-full border border-rose-400/20 bg-rose-400/8 px-1.5 py-0.5 text-[9px] text-rose-200">
              issue
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onPrevious}
            disabled={!hasTrace || currentStepIndex <= 0}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)] transition hover:border-[var(--cs-border-strong)] hover:text-[var(--cs-text)] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous frame"
          >
            <span className="material-symbols-outlined text-[15px]">skip_previous</span>
          </button>
          <button
            type="button"
            onClick={onTogglePlayback}
            disabled={!hasTrace}
            className={clsx(
              "flex h-7 w-7 items-center justify-center rounded-full border text-[var(--cs-text)] transition disabled:cursor-not-allowed disabled:opacity-40",
              hasTrace
                ? "border-[rgba(114,255,112,0.2)] bg-[rgba(114,255,112,0.1)] text-[var(--cs-primary-bright)] shadow-[0_0_18px_rgba(0,255,65,0.12)] hover:border-[rgba(114,255,112,0.3)] hover:bg-[rgba(114,255,112,0.14)]"
                : "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)]",
            )}
            aria-label={isPlaying ? "Pause playback" : "Play playback"}
          >
            <span className="material-symbols-outlined text-[15px]">
              {isPlaying ? "pause" : "play_arrow"}
            </span>
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={!hasTrace}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)] transition hover:border-[var(--cs-border-strong)] hover:text-[var(--cs-text)] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Stop and reset playback"
          >
            <span className="material-symbols-outlined text-[15px]">stop</span>
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!hasTrace || currentStepIndex >= stepCount - 1}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)] transition hover:border-[var(--cs-border-strong)] hover:text-[var(--cs-text)] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next frame"
          >
            <span className="material-symbols-outlined text-[15px]">skip_next</span>
          </button>
        </div>

        <div className="min-w-[180px] flex-1">
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
        </div>

        <label className="ml-auto flex shrink-0 items-center gap-2 rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-2.5 py-1 text-[10px] text-[var(--cs-text-subtle)]">
          <span className="hidden md:inline">Speed</span>
          <input
            type="range"
            min="0.5"
            max="2.5"
            step="0.25"
            value={playbackRate}
            onChange={(event) => onPlaybackRateChange(Number(event.target.value))}
            className="w-20 accent-[#00ff41]"
            aria-label="Playback speed"
          />
          <span className="w-8 text-right font-mono text-[var(--cs-text)]">
            {playbackRate.toFixed(2)}x
          </span>
        </label>
      </div>
    </div>
  );
};
