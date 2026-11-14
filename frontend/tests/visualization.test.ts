import { test } from "node:test";
import assert from "node:assert/strict";
import { createExecutionClassroomFrame } from "../src/visualization/executionClassroom";
import type { ExecutionTrace } from "../src/engine/types";

const trace = (steps: ExecutionTrace["steps"]): ExecutionTrace => ({
  executionId: "execution-test",
  traceId: "trace-test",
  startedAt: new Date(0).toISOString(),
  completedAt: new Date(1).toISOString(),
  steps,
  traceFrames: steps,
  traceSummary: {
    available: steps.length > 0,
    frameCount: steps.length,
    quality: "full",
    source: "test",
    status: "ready",
    message: "ready",
    error: "",
  },
  output: "3",
  outputLines: ["3"],
  error: "",
  executionTime: 1,
  timedOut: false,
  language: "javascript",
  status: "completed",
  failurePhase: null,
  phases: { compile: null, run: null, trace: null },
  mode: {
    selected: "trace",
    autoSelected: true,
    reason: "test",
    traceStrategy: "full",
  },
  limits: {
    queueConcurrency: 1,
    queueDepthLimit: 1,
    compileTimeoutMs: 1,
    runTimeoutMs: 1,
    traceTimeoutMs: 1,
    memoryLimitMb: 1,
    cpuLimit: 1,
    pidsLimit: 1,
  },
  metrics: {
    queueTimeMs: 0,
    executionTimeMs: 1,
    compileTimeMs: 0,
    runTimeMs: 1,
    peakMemoryBytes: null,
    peakMemoryKb: null,
  },
  diagnostics: [],
  logs: { system: [], entries: [] },
  stdin: { provided: false, lineCount: 0, charCount: 0, preview: "" },
});

test("classroom frame synchronizes source, variables, stack, and heap", () => {
  const steps: ExecutionTrace["steps"] = [
    {
      line: 1,
      description: "Declared total.",
      variables: [{ name: "total", scope: "global", value: "1" }],
      stack: [{ name: "global", locals: [{ name: "total", scope: "global", value: "1" }] }],
      heap: [{ id: "array-1", label: "values", type: "array", value: "[1, 2]" }],
      output: [],
      traceQuality: "full",
    },
    {
      line: 2,
      description: "Updated total.",
      variables: [{ name: "total", scope: "global", value: "3" }],
      stack: [{ name: "global", locals: [{ name: "total", scope: "global", value: "3" }] }],
      heap: [{ id: "array-1", label: "values", type: "array", value: "[1, 2]" }],
      output: ["3"],
      traceQuality: "full",
    },
  ];

  const frame = createExecutionClassroomFrame({
    trace: trace(steps),
    step: steps[1],
    previousStep: steps[0],
    steps,
    currentStepIndex: 1,
    codeLines: ["let total = 1;", "total = total + 2;"],
    language: "javascript",
  });

  assert.equal(frame.frameNumber, 2);
  assert.equal(frame.lineNumber, 2);
  assert.equal(frame.lineCode, "total = total + 2;");
  assert.equal(frame.trackedVariables[0]?.currentValue, "3");
  assert.ok(frame.changedVariables.some((variable) => variable.name === "total"));
  assert.equal(frame.memory.stackFrames.length, 1);
  assert.equal(frame.heapBlocks.length, 1);
  assert.ok(frame.explanation.length > 0);
});
