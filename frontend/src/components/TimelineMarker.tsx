import { motion } from "framer-motion";
import type { TimelineMarkerData } from "../utils/timeline";

interface TimelineMarkerProps {
  marker: TimelineMarkerData & {
    aggregateCount?: number;
  };
  left: number;
  active: boolean;
  onHoverStart: (marker: TimelineMarkerData, left: number) => void;
  onHoverEnd: () => void;
  onSelect: (stepIndex: number) => void;
}

export const TimelineMarker = ({
  marker,
  left,
  active,
  onHoverStart,
  onHoverEnd,
  onSelect,
}: TimelineMarkerProps) => {
  return (
    <motion.button
      type="button"
      initial={false}
      whileHover={{ scale: 1.18 }}
      animate={{
        scale: active ? [1, 1.16, 1] : 1,
        boxShadow: active
          ? [
              `0 0 0 ${marker.color}00`,
              `0 0 18px ${marker.color}`,
              `0 0 0 ${marker.color}00`,
            ]
          : undefined,
      }}
      transition={{
        duration: active ? 1.15 : 0.2,
        ease: "easeOut",
        repeat: active ? Number.POSITIVE_INFINITY : 0,
        repeatDelay: 0.4,
      }}
      onMouseEnter={() => onHoverStart(marker, left)}
      onMouseLeave={onHoverEnd}
      onFocus={() => onHoverStart(marker, left)}
      onBlur={onHoverEnd}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(marker.stepIndex);
      }}
      style={{
        left,
        top: "50%",
        backgroundColor: marker.color,
      }}
      className="absolute z-20 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/20"
      aria-label={`${marker.shortLabel} at step ${marker.stepIndex + 1}, line ${marker.line}`}
    >
      {marker.aggregateCount && marker.aggregateCount > 1 ? (
        <span className="absolute bottom-[calc(100%+6px)] left-1/2 min-w-[18px] -translate-x-1/2 rounded-full bg-black/78 px-1 text-center text-[8px] leading-4 text-white">
          {marker.aggregateCount}
        </span>
      ) : null}
    </motion.button>
  );
};
