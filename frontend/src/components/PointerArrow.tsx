import { motion } from "framer-motion";
import type { RenderedPointerEdge } from "../hooks/usePointerGraph";

interface PointerArrowProps {
  edge: RenderedPointerEdge;
}

const toneByStatus = {
  valid: {
    stroke: "#72ff70",
    marker: "url(#memory-arrow-valid)",
  },
  null: {
    stroke: "#7c8c77",
    marker: "url(#memory-arrow-null)",
  },
  dangling: {
    stroke: "#f87171",
    marker: "url(#memory-arrow-dangling)",
  },
} as const;

const glowByDiffState = {
  allocated: "drop-shadow(0 0 8px rgba(114,255,112,0.28))",
  updated: "drop-shadow(0 0 10px rgba(250,204,21,0.28))",
  freed: "drop-shadow(0 0 8px rgba(248,113,113,0.22))",
  unchanged: "none",
} as const;

export const PointerArrow = ({ edge }: PointerArrowProps) => {
  const tone = toneByStatus[edge.status];

  return (
    <motion.path
      d={edge.path}
      fill="none"
      stroke={tone.stroke}
      strokeWidth={edge.status === "valid" ? 2.25 : 1.9}
      markerEnd={tone.marker}
      initial={{ pathLength: 0, opacity: 0.12 }}
      animate={{ pathLength: 1, opacity: 0.92 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      style={{
        filter: glowByDiffState[edge.diffState],
      }}
      strokeDasharray={edge.status === "dangling" ? "6 6" : undefined}
    />
  );
};
