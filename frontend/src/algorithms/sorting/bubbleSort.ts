import type { AnimationStep } from "../../types/algorithmVisualizer";

export const generateBubbleSortFrames = (input: number[]): AnimationStep[] => {
  const values = [...input];
  const accepted = new Set<number>();
  const frames: AnimationStep[] = [];
  let comparisons = 0;
  let swaps = 0;
  const push = (summary: string, detail: string, comparing: number[] = [], swapping: number[] = []) => frames.push({ visualState: { kind: "bars", values: [...values], comparing, swapping, accepted: [...accepted] }, summaryBannerText: summary, stepDetailText: detail, codeLine: swapping.length ? 4 : 3, comparisonsCount: comparisons, swapsCount: swaps });
  push("Bubble Sort ready", "Compare neighboring values and bubble the larger value toward the right.");
  for (let end = values.length - 1; end > 0; end -= 1) {
    let changed = false;
    for (let index = 0; index < end; index += 1) {
      comparisons += 1;
      push(`Comparisons: ${comparisons} | Swaps: ${swaps}`, `Compare adjacent values ${values[index]} and ${values[index + 1]}.`, [index, index + 1]);
      if (values[index] > values[index + 1]) {
        [values[index], values[index + 1]] = [values[index + 1], values[index]];
        swaps += 1;
        changed = true;
        push(`Comparisons: ${comparisons} | Swaps: ${swaps}`, "The larger value moves one position to the right.", [], [index, index + 1]);
      }
    }
    accepted.add(end);
    push(`Comparisons: ${comparisons} | Swaps: ${swaps}`, `The value at index ${end} is sorted.`);
    if (!changed) break;
  }
  values.forEach((_, index) => accepted.add(index));
  push(`Comparisons: ${comparisons} | Swaps: ${swaps}`, "Every value is sorted.");
  return frames;
};
