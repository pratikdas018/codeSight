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

    const intervalId = window.setInterval(() => {
      setStepIndex((currentStep) => {
        if (currentStep >= stepCount - 1) {
          setIsPlaying(false);
          return currentStep;
        }

        return currentStep + 1;
      });
    }, stepDurationMs);

    return () => {
      window.clearInterval(intervalId);
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
