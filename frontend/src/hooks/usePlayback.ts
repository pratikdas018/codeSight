import { Dispatch, SetStateAction, useEffect, useState } from "react";

export const usePlayback = (
  stepCount: number,
  setStepIndex: Dispatch<SetStateAction<number>>,
  stepDurationMs = 900,
) => {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying || stepCount === 0) {
      return undefined;
    }

    let frameId = 0;
    let lastAdvanceAt = performance.now();

    const tick = (now: number) => {
      if (now - lastAdvanceAt >= stepDurationMs) {
        const advanceBy = Math.max(
          1,
          Math.floor((now - lastAdvanceAt) / stepDurationMs),
        );
        lastAdvanceAt = now;

        setStepIndex((currentStep) => {
          if (currentStep >= stepCount - 1) {
            setIsPlaying(false);
            return currentStep;
          }

          const nextStep = Math.min(currentStep + advanceBy, stepCount - 1);

          if (nextStep >= stepCount - 1) {
            setIsPlaying(false);
          }

          return nextStep;
        });
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isPlaying, setStepIndex, stepCount, stepDurationMs]);

  const togglePlayback = () => {
    if (stepCount === 0) {
      return;
    }

    setIsPlaying((current) => !current);
  };

  const stopPlayback = () => {
    setIsPlaying(false);
  };

  return {
    isPlaying,
    togglePlayback,
    stopPlayback,
    setIsPlaying,
  };
};
