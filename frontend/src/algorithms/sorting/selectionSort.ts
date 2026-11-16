import type { AnimationStep } from "../../types/algorithmVisualizer";

export const generateSelectionSortFrames = (input: number[]): AnimationStep[] => {
  const values = [...input];
  const accepted = new Set<number>();
  const frames: AnimationStep[] = [];
  let comparisons = 0;
  let swaps = 0;

  const push = (summaryBannerText: string, stepDetailText: string, comparing: number[] = [], swapping: number[] = []) => {
    frames.push({
      visualState: { kind: "bars", values: [...values], comparing, swapping, accepted: [...accepted] },
      summaryBannerText,
      stepDetailText,
      codeLine: swapping.length ? 5 : 3,
      comparisonsCount: comparisons,
      swapsCount: swaps,
    });
  };

  push("Selection Sort ready", "Find the minimum value in the unsorted suffix, then lock it into place.");
  for (let start = 0; start < values.length; start += 1) {
    let minimum = start;
    for (let scan = start + 1; scan < values.length; scan += 1) {
      comparisons += 1;
      push(`Comparisons: ${comparisons} | Swaps: ${swaps}`, `Compare arr[${minimum}] = ${values[minimum]} with arr[${scan}] = ${values[scan]}.`, [minimum, scan]);
      if (values[scan] < values[minimum]) minimum = scan;
    }
    if (minimum !== start) {
      [values[start], values[minimum]] = [values[minimum], values[start]];
      swaps += 1;
      push(`Comparisons: ${comparisons} | Swaps: ${swaps}`, `Swap the minimum ${values[start]} into position ${start}.`, [], [start, minimum]);
    }
    accepted.add(start);
    push(`Comparisons: ${comparisons} | Swaps: ${swaps}`, `Index ${start} is now in its final sorted position.`);
  }
  return frames;
};
