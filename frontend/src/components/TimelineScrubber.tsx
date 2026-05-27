import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import type { ExecutionStep } from "../engine/types";

interface TimelineScrubberProps {
  steps: ExecutionStep[];
  currentStepIndex: number;
  isPlaying: boolean;
  onStepSelect: (nextIndex: number) => void;
  onPausePlayback: () => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getStepLineNumber = (step: ExecutionStep | null | undefined) => {
  const candidate = step?.line ?? step?.lineNumber ?? 0;
  return candidate > 0 ? candidate : null;
};

export const TimelineScrubber = ({
  steps,
  currentStepIndex,
  isPlaying,
  onStepSelect,
  onPausePlayback,
}: TimelineScrubberProps) => {
  const railRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const totalSteps = steps.length;
  const activeIndex = previewIndex ?? currentStepIndex;
  const progress =
    totalSteps <= 1 ? (totalSteps === 1 ? 1 : 0) : activeIndex / (totalSteps - 1);
  const activeStep = steps[activeIndex] ?? null;
  const activeLine = getStepLineNumber(activeStep);
  const sampleDots = useMemo(() => {
    if (totalSteps <= 1) {
      return [0];
    }

    const count = Math.min(7, totalSteps);
    return Array.from({ length: count }, (_value, index) =>
      count === 1 ? 0 : index / (count - 1),
    );
  }, [totalSteps]);

  const positionToStepIndex = (clientX: number) => {
    const rail = railRef.current;

    if (!rail || totalSteps === 0) {
      return 0;
    }

    const bounds = rail.getBoundingClientRect();
    const ratio = clamp((clientX - bounds.left) / bounds.width, 0, 1);
    return clamp(Math.round(ratio * Math.max(totalSteps - 1, 0)), 0, totalSteps - 1);
  };

  const updatePreview = (clientX: number) => {
    const nextIndex = positionToStepIndex(clientX);
    setPreviewIndex(nextIndex);
    onStepSelect(nextIndex);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (totalSteps === 0) {
      return;
    }

    draggingRef.current = true;
    onPausePlayback();
    event.currentTarget.setPointerCapture(event.pointerId);
    updatePreview(event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || totalSteps === 0) {
      return;
    }

    updatePreview(event.clientX);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) {
      return;
    }

    draggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    updatePreview(event.clientX);
    setPreviewIndex(null);
  };

  const handlePointerLeave = () => {
    if (!draggingRef.current) {
      setPreviewIndex(null);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (totalSteps === 0) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onPausePlayback();
      onStepSelect(clamp(currentStepIndex - 1, 0, totalSteps - 1));
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      onPausePlayback();
      onStepSelect(clamp(currentStepIndex + 1, 0, totalSteps - 1));
    }
  };

  return (
    <div className="min-w-0">
      <div
        ref={railRef}
        tabIndex={totalSteps > 0 ? 0 : -1}
        role="slider"
        aria-label="Execution timeline"
        aria-valuemin={totalSteps > 0 ? 1 : 0}
        aria-valuemax={Math.max(totalSteps, 0)}
        aria-valuenow={totalSteps > 0 ? activeIndex + 1 : 0}
        aria-valuetext={
          totalSteps > 0
            ? `Frame ${activeIndex + 1} of ${totalSteps}`
            : "No execution frames"
        }
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className={clsx(
          "relative rounded-full px-1 py-3 outline-none transition",
          totalSteps > 0
            ? "cursor-pointer"
            : "cursor-not-allowed opacity-50",
        )}
      >
        <div className="pointer-events-none relative h-6">
          <div className="absolute inset-x-2 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[rgba(255,255,255,0.1)]" />
          <div className="absolute inset-x-2 top-1/2 h-[2px] -translate-y-1/2">
            <motion.div
              className="h-full rounded-full bg-[linear-gradient(90deg,rgba(0,255,65,0.38),rgba(114,255,112,0.88))]"
              initial={false}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: isPlaying ? 0.2 : 0.14, ease: "easeOut" }}
            />

            {sampleDots.map((dot, index) => (
              <div
                key={`${dot}-${index}`}
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(255,255,255,0.22)] bg-[rgba(8,10,8,0.92)]"
                style={{ left: `${dot * 100}%` }}
              />
            ))}

            <motion.div
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(114,255,112,0.24)] bg-[var(--cs-primary-bright)] shadow-[0_0_18px_rgba(114,255,112,0.25)]"
              initial={false}
              animate={{ left: `${progress * 100}%` }}
              transition={{ duration: isPlaying ? 0.2 : 0.14, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 px-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
          {totalSteps > 0 ? `Frame ${activeIndex + 1}` : "Timeline idle"}
        </div>
        <div className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
          {activeLine ? `Line ${activeLine}` : "No line"}
        </div>
      </div>
    </div>
  );
};
