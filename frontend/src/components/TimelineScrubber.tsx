import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import type { ExecutionStep } from "../engine/types";
import { analyzeExecutionTimeline, type TimelineMarkerData } from "../utils/timeline";
import { TimelineMarker } from "./TimelineMarker";
import { TimelineTooltip } from "./TimelineTooltip";

interface TimelineScrubberProps {
  steps: ExecutionStep[];
  currentStepIndex: number;
  isPlaying: boolean;
  breakpointLines?: number[];
  traceError?: string;
  onStepSelect: (nextIndex: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onTogglePlayback: () => void;
  onPausePlayback: () => void;
}

type TooltipState =
  | {
      kind: "marker";
      marker: TimelineMarkerData;
      left: number;
    }
  | {
      kind: "preview";
      stepIndex: number;
      left: number;
    }
  | null;

const previewTrackPadding = 10;
const markerPriority: Record<TimelineMarkerData["type"], number> = {
  error: 0,
  breakpoint: 1,
  return: 2,
  "function-call": 3,
  condition: 4,
  loop: 5,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const TimelineScrubber = ({
  steps,
  currentStepIndex,
  isPlaying,
  breakpointLines = [],
  traceError,
  onStepSelect,
  onPrevious,
  onNext,
  onTogglePlayback,
  onPausePlayback,
}: TimelineScrubberProps) => {
  const railRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingIndexRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const [railWidth, setRailWidth] = useState(0);
  const [tooltipState, setTooltipState] = useState<TooltipState>(null);
  const [dragPreviewIndex, setDragPreviewIndex] = useState<number | null>(null);
  const totalSteps = steps.length;
  const currentIndex = dragPreviewIndex ?? currentStepIndex;
  const isDragging = dragPreviewIndex !== null;
  const analysis = useMemo(
    () =>
      analyzeExecutionTimeline(steps, {
        breakpointLines,
        traceError,
      }),
    [breakpointLines, steps, traceError],
  );
  const progress =
    totalSteps <= 1 ? (totalSteps === 1 ? 1 : 0) : currentIndex / (totalSteps - 1);

  useEffect(() => {
    const element = railRef.current;

    if (!element) {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setRailWidth(Math.max(entry.contentRect.width - previewTrackPadding * 2, 0));
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  const scheduleStepUpdate = (nextIndex: number) => {
    pendingIndexRef.current = nextIndex;

    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const value = pendingIndexRef.current;

      if (typeof value === "number") {
        onStepSelect(value);
      }
    });
  };

  const positionToStepIndex = (clientX: number) => {
    const element = railRef.current;

    if (!element || totalSteps === 0) {
      return 0;
    }

    const bounds = element.getBoundingClientRect();
    const relativeX = clamp(clientX - bounds.left - previewTrackPadding, 0, railWidth);
    const ratio = railWidth === 0 ? 0 : relativeX / railWidth;
    return clamp(Math.round(ratio * Math.max(totalSteps - 1, 0)), 0, totalSteps - 1);
  };

  const positionToLeft = (clientX: number) => {
    const element = railRef.current;

    if (!element) {
      return previewTrackPadding;
    }

    const bounds = element.getBoundingClientRect();
    return clamp(clientX - bounds.left, previewTrackPadding, bounds.width - previewTrackPadding);
  };

  const updatePreviewFromClientX = (clientX: number) => {
    const stepIndex = positionToStepIndex(clientX);
    const left = positionToLeft(clientX);

    setTooltipState({
      kind: "preview",
      stepIndex,
      left,
    });

    return stepIndex;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (totalSteps === 0) {
      return;
    }

    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    onPausePlayback();
    const stepIndex = updatePreviewFromClientX(event.clientX);
    setDragPreviewIndex(stepIndex);
    scheduleStepUpdate(stepIndex);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (totalSteps === 0) {
      return;
    }

    const stepIndex = updatePreviewFromClientX(event.clientX);

    if (draggingRef.current) {
      setDragPreviewIndex(stepIndex);
      scheduleStepUpdate(stepIndex);
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) {
      return;
    }

    draggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const stepIndex = updatePreviewFromClientX(event.clientX);
    setDragPreviewIndex(null);
    scheduleStepUpdate(stepIndex);
  };

  const handlePointerLeave = () => {
    if (!draggingRef.current) {
      setTooltipState(null);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onPrevious();
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      onNext();
      return;
    }

    if (event.key === " " || event.code === "Space") {
      event.preventDefault();
      onTogglePlayback();
    }
  };

  const renderedMarkers = useMemo(() => {
    if (analysis.markers.length === 0 || railWidth === 0) {
      return [];
    }

    const bucketSize = Math.max(8, Math.floor(railWidth / 140));
    const buckets = new Map<number, (TimelineMarkerData & { left: number })[]>();

    for (const marker of analysis.markers) {
      const left =
        previewTrackPadding +
        (totalSteps <= 1 ? 0 : (marker.stepIndex / Math.max(totalSteps - 1, 1)) * railWidth);
      const bucketIndex = Math.round(left / bucketSize);
      const bucket = buckets.get(bucketIndex) ?? [];
      bucket.push({
        ...marker,
        left,
      });
      buckets.set(bucketIndex, bucket);
    }

    return [...buckets.values()]
      .map((bucket) =>
        bucket.sort((left, right) => {
          const priorityDelta =
            markerPriority[left.type] - markerPriority[right.type];

          if (priorityDelta !== 0) {
            return priorityDelta;
          }

          return left.stepIndex - right.stepIndex;
        }),
      )
      .map((bucket) => {
        const primary = bucket[0];
        return {
          ...primary,
          aggregateCount: bucket.length,
          description:
            bucket.length > 1
              ? `${primary.description} | ${bucket.length - 1} nearby event${
                  bucket.length === 2 ? "" : "s"
                }`
              : primary.description,
        };
      });
  }, [analysis.markers, railWidth, totalSteps]);

  const tooltipMarker =
    tooltipState?.kind === "marker" ? tooltipState.marker : null;
  const tooltipPreview =
    tooltipState?.kind === "preview"
      ? analysis.previews[tooltipState.stepIndex] ?? null
      : null;
  const tooltipLeft =
    tooltipState?.left ??
    previewTrackPadding + progress * railWidth;

  return (
    <div className="relative">
      <div
        ref={railRef}
        tabIndex={totalSteps > 0 ? 0 : -1}
        role="slider"
        aria-label="Execution timeline"
        aria-valuemin={totalSteps > 0 ? 1 : 0}
        aria-valuemax={Math.max(totalSteps, 0)}
        aria-valuenow={totalSteps > 0 ? currentStepIndex + 1 : 0}
        aria-valuetext={
          totalSteps > 0
            ? `Step ${currentStepIndex + 1} of ${totalSteps}`
            : "No execution trace"
        }
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className={clsx(
          "relative rounded-full border border-[rgba(114,255,112,0.1)] bg-[linear-gradient(180deg,rgba(8,11,8,0.84),rgba(6,9,6,0.7))] px-[10px] py-3 outline-none transition",
          totalSteps > 0
            ? "cursor-pointer focus-visible:border-[rgba(114,255,112,0.22)] focus-visible:shadow-[0_0_0_1px_rgba(114,255,112,0.12),0_0_0_5px_rgba(114,255,112,0.04)]"
            : "cursor-not-allowed opacity-60",
        )}
      >
        <TimelineTooltip
          marker={tooltipMarker}
          preview={tooltipPreview}
          left={tooltipLeft}
          maxWidth={(railRef.current?.getBoundingClientRect().width ?? railWidth) + previewTrackPadding * 2}
        />

        <div className="relative h-5">
          <div className="pointer-events-none absolute inset-x-[10px] top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[rgba(255,255,255,0.08)]" />
          <motion.div
            className="pointer-events-none absolute left-[10px] top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,rgba(0,255,65,0.18),rgba(114,255,112,0.72))] shadow-[0_0_12px_rgba(0,255,65,0.1)]"
            initial={false}
            animate={{
              width: Math.max(progress * railWidth, 0),
            }}
            transition={{ duration: isPlaying ? 0.24 : 0.16, ease: "easeOut" }}
          />

          {renderedMarkers.map((marker) => (
            <TimelineMarker
              key={marker.id}
              marker={marker}
              left={marker.left}
              active={marker.stepIndex === currentStepIndex}
              onHoverStart={(nextMarker, left) => {
                setTooltipState({
                  kind: "marker",
                  marker: nextMarker,
                  left,
                });
              }}
              onHoverEnd={() => {
                setTooltipState(null);
              }}
              onSelect={onStepSelect}
            />
          ))}

        </div>
      </div>
    </div>
  );
};
