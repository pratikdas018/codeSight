import type { AnimationStep } from "../../types/algorithmVisualizer";

const activities = [
  { id: "A", start: 1, end: 3 }, { id: "B", start: 2, end: 5 }, { id: "C", start: 3, end: 4 },
  { id: "D", start: 0, end: 7 }, { id: "E", start: 5, end: 8 }, { id: "F", start: 5, end: 9 }, { id: "G", start: 8, end: 10 },
];

export const generateActivitySelectionFrames = (): AnimationStep[] => {
  const ordered = [...activities].sort((a, b) => a.end - b.end);
  const selected = new Set<string>();
  const frames: AnimationStep[] = [];
  let lastEnd = -Infinity;
  ordered.forEach((activity) => {
    const accepted = activity.start >= lastEnd;
    if (accepted) { selected.add(activity.id); lastEnd = activity.end; }
    frames.push({
      visualState: { kind: "timeline", end: 10, intervals: ordered.map((item) => ({ id: item.id, start: item.start, end: item.end, state: item.id === activity.id ? (accepted ? "accepted" : "rejected") : selected.has(item.id) ? "accepted" : "neutral" })) },
      summaryBannerText: `Maximum ${selected.size} activities selected: {${[...selected].join(", ")}}`,
      stepDetailText: accepted ? `Select ${activity.id}: it finishes at ${activity.end}, leaving the most room for later activities.` : `Reject ${activity.id}: it overlaps the current selection, which ends at ${lastEnd}.`,
      codeLine: accepted ? 4 : 5,
    });
  });
  return frames;
};
