import { useCallback, useEffect, useState } from "react";
import type { AnimationStep } from "../types/algorithmVisualizer";

export const visualizerSpeedToDelay = (speed: number) => 500 - ((Math.max(1, Math.min(100, speed)) - 1) / 99) * 495;

export const useVisualizerPlayer = (steps: AnimationStep[], initialSpeed = 50) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(initialSpeed);
  const reset = useCallback(() => { setIsPlaying(false); setCurrentStepIndex(0); }, []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const next = useCallback(() => { setIsPlaying(false); setCurrentStepIndex((index) => Math.min(index + 1, Math.max(steps.length - 1, 0))); }, [steps.length]);
  const previous = useCallback(() => { setIsPlaying(false); setCurrentStepIndex((index) => Math.max(index - 1, 0)); }, []);
  useEffect(() => { reset(); }, [reset, steps]);
  useEffect(() => {
    if (!isPlaying || steps.length < 2) return undefined;
    let animationFrame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (now - last >= visualizerSpeedToDelay(speed)) {
        last = now;
        setCurrentStepIndex((index) => {
          if (index >= steps.length - 1) { setIsPlaying(false); return index; }
          return index + 1;
        });
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying, speed, steps.length]);
  return { currentStepIndex, setCurrentStepIndex, isPlaying, speed, setSpeed, play: () => setIsPlaying(true), pause, toggle: () => setIsPlaying((playing) => !playing), next, previous, reset };
};
