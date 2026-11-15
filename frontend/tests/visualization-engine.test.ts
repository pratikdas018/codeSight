import assert from "node:assert/strict";
import test from "node:test";
import { generateArrayTrace, generateSearchSteps, generateSortingSteps, parseNumberList } from "../src/algorithms/visualizationEngine";

test("linear search produces correct deterministic states", () => {
  const steps = generateSearchSteps([4, -2, 4, 9], 4, "linear-search");
  assert.equal(steps[0]?.activeIndices[0], 0);
  assert.equal(steps[0]?.foundIndex, 0);
  assert.equal(steps.length, 1);
});

test("binary search sorts its working copy and finds a duplicate target", () => {
  const steps = generateSearchSteps([9, 1, 4, 4, -2], 4, "binary-search");
  const final = steps.at(-1);
  assert.deepEqual(final?.values, [-2, 1, 4, 4, 9]);
  assert.notEqual(final?.foundIndex, null);
  assert.ok(steps.every((step) => step.activeIndices.every((index) => index >= 0 && index < step.values.length)));
});

test("search emits a truthful not-found terminal state and rejects invalid input", () => {
  const steps = generateSearchSteps([1, 3, 5], 4, "linear-search");
  assert.equal(steps.at(-1)?.foundIndex, null);
  assert.match(steps.at(-1)?.operation ?? "", /not found/i);
  assert.equal(parseNumberList("1, nope, 3"), null);
  assert.deepEqual(parseNumberList("-2, 0, 4"), [-2, 0, 4]);
});

test("all sorted-search algorithms find boundary values and report missing targets", () => {
  for (const algorithm of ["binary-search", "jump-search", "interpolation-search", "exponential-search"] as const) {
    const found = generateSearchSteps([-10, 0, 4, 7, 12], 12, algorithm);
    assert.equal(found.at(-1)?.foundIndex, 4, `${algorithm} should find the last value`);
    const missing = generateSearchSteps([-10, 0, 4, 7, 12], 6, algorithm);
    assert.match(missing.at(-1)?.operation ?? "", /not found/i, `${algorithm} should report a missing value`);
    assert.ok(missing.every((step) => step.activeIndices.every((index) => index >= 0 && index < step.values.length)));
  }
});

test("search algorithms handle empty input without throwing", () => {
  for (const algorithm of ["linear-search", "binary-search", "jump-search", "interpolation-search", "exponential-search"] as const) {
    const steps = generateSearchSteps([], 3, algorithm);
    assert.match(steps.at(-1)?.operation ?? "", /not found/i);
  }
});

test("array traces apply deterministic insert, update, delete, and access operations", () => {
  const inserted = generateArrayTrace([10, 30], { type: "insert", index: 1, value: 20 });
  assert.deepEqual(inserted.finalValues, [10, 20, 30]);
  assert.equal(inserted.steps.at(-1)?.activeIndices[0], 1);

  const updated = generateArrayTrace(inserted.finalValues, { type: "update", index: 2, value: 40 }, "dynamic-array");
  assert.deepEqual(updated.finalValues, [10, 20, 40]);
  assert.equal(updated.structure, "dynamic-array");

  const deleted = generateArrayTrace(updated.finalValues, { type: "delete", index: 0 });
  assert.deepEqual(deleted.finalValues, [20, 40]);
  assert.equal(deleted.result, 10);

  const accessed = generateArrayTrace(deleted.finalValues, { type: "access", index: 1 });
  assert.equal(accessed.result, 40);
});

test("array traces validate invalid indexes and search state", () => {
  const invalid = generateArrayTrace([1, 2], { type: "delete", index: 4 });
  assert.equal(invalid.finalValues.length, 2);
  assert.equal(invalid.steps[0]?.operation, "Invalid operation");

  const search = generateArrayTrace([-2, 5, 9], { type: "search", value: 5 });
  assert.equal(search.result, 1);
  assert.equal(search.steps.at(-1)?.activeIndices[0], 1);
});

test("sorting traces produce ordered results for every supported sorting algorithm", () => {
  for (const algorithm of ["bubble-sort", "selection-sort", "insertion-sort", "merge-sort", "quick-sort"] as const) {
    const steps = generateSortingSteps([7, -2, 7, 1, 0], algorithm);
    assert.deepEqual(steps.at(-1)?.values, [-2, 0, 1, 7, 7], algorithm);
    assert.equal(steps.at(-1)?.operation, "Sorted");
    assert.ok(steps.every((step) => step.activeIndices.every((index) => index >= 0 && index < step.values.length)));
  }
});

test("sorting traces handle empty input safely", () => {
  const steps = generateSortingSteps([], "merge-sort");
  assert.equal(steps.at(-1)?.operation, "Empty input");
  assert.deepEqual(steps.at(-1)?.values, []);
});

