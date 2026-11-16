import test from "node:test";
import assert from "node:assert/strict";
import { generateSelectionSortSteps } from "../src/algorithms/selectionSort";
import { generateSortingAnimationSteps } from "../src/algorithms/sortingAlgorithms";
import type { SortingAlgorithm } from "../src/types/visualizer";

const algorithms: SortingAlgorithm[] = ["selection-sort", "bubble-sort", "insertion-sort", "merge-sort", "quick-sort"];

test("every sorting visualizer produces a sorted terminal frame", () => {
  const input = [7, 2, 9, 2, -1, 4];
  for (const algorithm of algorithms) {
    const steps = generateSortingAnimationSteps(input, algorithm);
    assert.deepEqual(steps.at(-1)?.array, [-1, 2, 2, 4, 7, 9]);
    assert.deepEqual(input, [7, 2, 9, 2, -1, 4]);
  }
});

test("selection sort records comparison and swap snapshots", () => {
  const steps = generateSelectionSortSteps([3, 1, 2]);
  assert.ok(steps.some((step) => step.comparing.length === 2));
  assert.ok(steps.some((step) => step.swapping.length === 2));
  assert.equal(steps.at(-1)?.comparisonsCount, 3);
  assert.equal(steps.at(-1)?.swapsCount, 2);
});

test("sorting steps remain safe for empty and single-value inputs", () => {
  for (const algorithm of algorithms) {
    assert.deepEqual(generateSortingAnimationSteps([], algorithm).at(-1)?.array, []);
    assert.deepEqual(generateSortingAnimationSteps([5], algorithm).at(-1)?.array, [5]);
  }
});
