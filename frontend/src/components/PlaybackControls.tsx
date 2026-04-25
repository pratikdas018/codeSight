interface PlaybackControlsProps {
  currentStepIndex: number;
  totalSteps: number;
  isPlaying: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
}

export const PlaybackControls = ({
  currentStepIndex,
  totalSteps,
  isPlaying,
  onPrevious,
  onNext,
  onTogglePlay,
}: PlaybackControlsProps) => (
  <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-white/60 bg-white/85 px-5 py-4 shadow-panel backdrop-blur">
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
        Playback
      </p>
      <p className="mt-1 text-sm text-slate-600">
        Step {totalSteps === 0 ? 0 : currentStepIndex + 1} of {totalSteps}
      </p>
    </div>

    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onPrevious}
        disabled={currentStepIndex <= 0}
        className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous
      </button>
      <button
        type="button"
        onClick={onTogglePlay}
        disabled={totalSteps === 0}
        className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPlaying ? "Pause" : "Play"}
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={totalSteps === 0 || currentStepIndex >= totalSteps - 1}
        className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
    </div>
  </div>
);
