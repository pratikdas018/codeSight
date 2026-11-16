import type { AnimationStep, SortingAlgorithm } from "../types/visualizer";
import { generateSelectionSortSteps } from "./selectionSort";

const createRecorder = (input: number[]) => {
  const array = [...input];
  const steps: AnimationStep[] = [];
  const sorted = new Set<number>();
  let comparisonsCount = 0;
  let swapsCount = 0;
  const push = (operation: string, comparing: [number, number] | [], swapping: [number, number] | [] = [], activeLine?: number) => steps.push({ array: [...array], comparing, swapping, sortedIndices: [...sorted].sort((a, b) => a - b), comparisonsCount, swapsCount, activeLine, operation });
  return { array, steps, sorted, get comparisonsCount() { return comparisonsCount; }, get swapsCount() { return swapsCount; }, compare: () => { comparisonsCount += 1; }, swap: () => { swapsCount += 1; }, push };
};

const bubbleSort = (input: number[]): AnimationStep[] => {
  const r = createRecorder(input);
  for (let end = r.array.length - 1; end > 0; end -= 1) {
    let changed = false;
    for (let index = 0; index < end; index += 1) { r.compare(); r.push(`Compare positions ${index} and ${index + 1}`, [index, index + 1], [], 3); if (r.array[index] > r.array[index + 1]) { [r.array[index], r.array[index + 1]] = [r.array[index + 1], r.array[index]]; r.swap(); changed = true; r.push(`Swap adjacent values`, [], [index, index + 1], 4); } }
    r.sorted.add(end); r.push(`Lock index ${end}`, [], [], 5); if (!changed) break;
  }
  if (r.array.length) r.sorted.add(0); r.push("Sorted", [], [], 6); return r.steps;
};

const insertionSort = (input: number[]): AnimationStep[] => {
  const r = createRecorder(input); if (r.array.length) r.sorted.add(0);
  for (let index = 1; index < r.array.length; index += 1) { const key = r.array[index]; let cursor = index - 1; while (cursor >= 0) { r.compare(); r.push(`Compare key ${key} with ${r.array[cursor]}`, [cursor, cursor + 1], [], 3); if (r.array[cursor] <= key) break; r.array[cursor + 1] = r.array[cursor]; r.swap(); r.push("Shift value right", [], [cursor, cursor + 1], 4); cursor -= 1; } r.array[cursor + 1] = key; r.sorted.add(index); r.push(`Insert ${key} into sorted prefix`, [], [], 5); }
  r.array.forEach((_, index) => r.sorted.add(index)); r.push("Sorted", [], [], 6); return r.steps;
};

const mergeSort = (input: number[]): AnimationStep[] => {
  const r = createRecorder(input);
  const merge = (left: number, middle: number, right: number) => { const copy = r.array.slice(left, right + 1); let first = 0; let second = middle - left + 1; let write = left; while (first <= middle - left && second <= right - left) { r.compare(); if (copy[first] <= copy[second]) r.array[write] = copy[first++]; else r.array[write] = copy[second++]; r.push(`Merge into position ${write}`, [write, write], [], 5); write += 1; } while (first <= middle - left) r.array[write++] = copy[first++]; while (second <= right - left) r.array[write++] = copy[second++]; for (let index = left; index <= right; index += 1) r.sorted.add(index); r.push(`Merge range ${left}–${right}`, [], [], 6); };
  const divide = (left: number, right: number) => { if (left >= right) return; const middle = Math.floor((left + right) / 2); r.push(`Divide range ${left}–${right}`, [left, right], [], 2); divide(left, middle); divide(middle + 1, right); merge(left, middle, right); };
  divide(0, r.array.length - 1); r.array.forEach((_, index) => r.sorted.add(index)); r.push("Sorted", [], [], 7); return r.steps;
};

const quickSort = (input: number[]): AnimationStep[] => {
  const r = createRecorder(input);
  const partition = (left: number, right: number) => { const pivot = r.array[right]; let store = left; for (let index = left; index < right; index += 1) { r.compare(); r.push(`Compare with pivot ${pivot}`, [index, right], [], 3); if (r.array[index] < pivot) { [r.array[index], r.array[store]] = [r.array[store], r.array[index]]; r.swap(); r.push("Move value below pivot", [], [index, store], 4); store += 1; } } [r.array[store], r.array[right]] = [r.array[right], r.array[store]]; r.swap(); r.sorted.add(store); r.push(`Place pivot at ${store}`, [], [store, right], 5); return store; };
  const sort = (left: number, right: number) => { if (left >= right) { if (left === right) r.sorted.add(left); return; } const pivot = partition(left, right); sort(left, pivot - 1); sort(pivot + 1, right); };
  sort(0, r.array.length - 1); r.array.forEach((_, index) => r.sorted.add(index)); r.push("Sorted", [], [], 6); return r.steps;
};

export const generateSortingAnimationSteps = (input: number[], algorithm: SortingAlgorithm): AnimationStep[] => {
  if (algorithm === "selection-sort") return generateSelectionSortSteps(input);
  if (algorithm === "bubble-sort") return bubbleSort(input);
  if (algorithm === "insertion-sort") return insertionSort(input);
  if (algorithm === "merge-sort") return mergeSort(input);
  return quickSort(input);
};
