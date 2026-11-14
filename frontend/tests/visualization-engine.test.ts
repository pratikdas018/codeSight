import assert from "node:assert/strict";
import test from "node:test";
import { generateSearchSteps, parseNumberList } from "../src/algorithms/visualizationEngine";

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

