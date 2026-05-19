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
  const topOffset = 8 + marker.lane * 14;

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
        top: topOffset,
        backgroundColor: marker.color,
      }}
      className="absolute z-20 h-3 w-3 -translate-x-1/2 rounded-full border border-black/40"
      aria-label={`${marker.shortLabel} at step ${marker.stepIndex + 1}, line ${marker.line}`}
    >
      {marker.aggregateCount && marker.aggregateCount > 1 ? (
        <span className="absolute left-1/2 top-1/2 h-5 min-w-[20px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/70 px-1 text-[9px] leading-5 text-white">
          {marker.aggregateCount}
        </span>
      ) : null}
    </motion.button>
  );
};
