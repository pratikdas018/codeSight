import type { AnimationStep } from "../types/visualizer";

export const generateSelectionSortSteps = (input: number[]): AnimationStep[] => {
  const array = [...input];
  const steps: AnimationStep[] = [];
  const sorted = new Set<number>();
  let comparisonsCount = 0;
  let swapsCount = 0;
  const push = (operation: string, comparing: [number, number] | [], swapping: [number, number] | [] = [], activeLine?: number) => {
    steps.push({ array: [...array], comparing, swapping, sortedIndices: [...sorted].sort((a, b) => a - b), comparisonsCount, swapsCount, activeLine, operation });
  };

  if (!array.length) {
    push("Empty input", []);
    return steps;
  }

  for (let start = 0; start < array.length - 1; start += 1) {
    let minimum = start;
    push(`Start position ${start}`, [start, start], [], 2);
    for (let scan = start + 1; scan < array.length; scan += 1) {
      comparisonsCount += 1;
      push(`Compare ${array[minimum]} and ${array[scan]}`, [minimum, scan], [], 3);
      if (array[scan] < array[minimum]) {
        minimum = scan;
        push(`New minimum at ${scan}`, [start, minimum], [], 4);
      }
    }
    if (minimum !== start) {
      [array[start], array[minimum]] = [array[minimum], array[start]];
      swapsCount += 1;
      push(`Place minimum at ${start}`, [], [start, minimum], 5);
    }
    sorted.add(start);
    push(`Lock index ${start}`, [], [], 6);
  }
  sorted.add(array.length - 1);
  push("Sorted", [], [], 7);
  return steps;
};
