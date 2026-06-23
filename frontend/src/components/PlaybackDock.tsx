import clsx from "clsx";
import { motion } from "framer-motion";
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

const SPEED_STEPS = [0.5, 1, 1.5, 2, 2.5];

const cycleSpeed = (current: number, steps: number[]) => {
  const idx = steps.indexOf(current);
  return steps[(idx + 1) % steps.length] ?? steps[1];
};

export const PlaybackDock = ({
  steps,
  currentStepIndex,
  isPlaying,
  playbackRate,
  onPlaybackRateChange,
  onStepScrub,
  onPrevious,
  onNext,
  onTogglePlayback,
  onPausePlayback,
}: PlaybackDockProps) => {
  const hasTrace = steps.length > 0;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--cs-border)] bg-[rgba(8,10,8,0.96)] px-3 py-2">
      {/* Transport controls */}
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!hasTrace || currentStepIndex <= 0}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--cs-text-subtle)] transition hover:text-[var(--cs-text)] disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Previous frame"
        >
          <span className="material-symbols-outlined text-[16px]">skip_previous</span>
        </button>

        <button
          type="button"
          onClick={onTogglePlayback}
          disabled={!hasTrace}
          className={clsx(
            "flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-30",
            hasTrace
              ? "border-[rgba(114,255,112,0.2)] bg-[rgba(114,255,112,0.1)] text-[var(--cs-primary-bright)] hover:border-[rgba(114,255,112,0.35)]"
              : "border-[var(--cs-border)] text-[var(--cs-text-muted)]",
          )}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          <span className="material-symbols-outlined text-[18px]">
            {isPlaying ? "pause" : "play_arrow"}
          </span>
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!hasTrace || currentStepIndex >= steps.length - 1}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--cs-text-subtle)] transition hover:text-[var(--cs-text)] disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Next frame"
        >
          <span className="material-symbols-outlined text-[16px]">skip_next</span>
        </button>
      </div>

      {/* Timeline scrubber — fills available space */}
      <div className="min-w-0 flex-1">
        <TimelineScrubber
          steps={steps}
          currentStepIndex={currentStepIndex}
          isPlaying={isPlaying}
          onStepSelect={onStepScrub}
          onPausePlayback={onPausePlayback}
        />
      </div>

      {/* Frame counter + speed — compact, right-aligned */}
      <div className="flex shrink-0 items-center gap-2">
        {hasTrace ? (
          <span className="hidden font-mono text-[10px] text-[var(--cs-text-subtle)] sm:inline">
            {currentStepIndex + 1}/{steps.length}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => onPlaybackRateChange(cycleSpeed(playbackRate, SPEED_STEPS))}
          className="hidden h-6 rounded-md border border-[var(--cs-border)] bg-transparent px-2 font-mono text-[10px] text-[var(--cs-text-subtle)] transition hover:border-[var(--cs-border-strong)] hover:text-[var(--cs-text)] sm:flex sm:items-center"
          aria-label={`Playback speed ${playbackRate}x — click to cycle`}
          title="Click to cycle playback speed"
        >
          <motion.span
            key={playbackRate}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            {playbackRate % 1 === 0 ? `${playbackRate}x` : `${playbackRate}x`}
          </motion.span>
        </button>
      </div>
    </div>
  );
};
