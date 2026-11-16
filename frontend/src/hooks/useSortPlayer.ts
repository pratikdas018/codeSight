import { useCallback, useEffect, useState } from "react";
import type { AnimationStep } from "../types/visualizer";

export const speedToDelay = (speedPercent: number) => 500 - ((Math.max(1, Math.min(100, speedPercent)) - 1) / 99) * 495;

export const useSortPlayer = (steps: AnimationStep[], speedPercent: number) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const reset = useCallback(() => { setIsPlaying(false); setStepIndex(0); }, []);
  const stop = useCallback(() => setIsPlaying(false), []);
  const next = useCallback(() => setStepIndex((current) => Math.min(current + 1, Math.max(steps.length - 1, 0))), [steps.length]);
  const previous = useCallback(() => { setIsPlaying(false); setStepIndex((current) => Math.max(current - 1, 0)); }, []);
  useEffect(() => { setIsPlaying(false); setStepIndex(0); }, [steps]);
  useEffect(() => {
    if (!isPlaying || steps.length < 2) return undefined;
    let frame = 0; let last = performance.now();
    const tick = (now: number) => { if (now - last >= speedToDelay(speedPercent)) { last = now; setStepIndex((current) => { if (current >= steps.length - 1) { setIsPlaying(false); return current; } return current + 1; }); } frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [isPlaying, speedPercent, steps.length]);
  return { stepIndex, setStepIndex, isPlaying, start: () => setIsPlaying(true), stop, toggle: () => setIsPlaying((current) => !current), next, previous, reset };
};
