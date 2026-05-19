import type { ExecutionStep } from "../engine/types";
import { compareExecutionFrames } from "./executionDiff";

export type TimelineEventType =
  | "function-call"
  | "loop"
  | "condition"
  | "return"
  | "error"
  | "breakpoint";

export interface TimelineStepPreview {
  stepIndex: number;
  line: number;
  codePreview: string;
  changedVariablesCount: number;
  description: string;
}

export interface TimelineMarkerData {
  id: string;
  stepIndex: number;
  line: number;
  type: TimelineEventType;
  description: string;
  shortLabel: string;
  color: string;
  lane: number;
}

export interface TimelineAnalysis {
  markers: TimelineMarkerData[];
  previews: TimelineStepPreview[];
}

const markerColorMap: Record<TimelineEventType, string> = {
  "function-call": "#38bdf8",
  loop: "#a855f7",
  condition: "#2dd4bf",
  return: "#22c55e",
  error: "#ef4444",
  breakpoint: "#facc15",
};

const markerLabelMap: Record<TimelineEventType, string> = {
  "function-call": "Function Call",
  loop: "Loop Iteration",
  condition: "Condition Branch",
  return: "Return",
  error: "Runtime Error",
  breakpoint: "Breakpoint",
};

const getStepLine = (step: ExecutionStep) => step.lineNumber ?? step.line ?? 0;

const getStepNarrative = (step: ExecutionStep) =>
  step.explanation?.trim() ||
  step.description?.trim() ||
  step.codeLine?.trim() ||
  "Execution event";

const createMarkerId = (
  stepIndex: number,
  type: TimelineEventType,
  lane: number,
) => `timeline-marker-${type}-${stepIndex}-${lane}`;

const conditionRegex = /\b(if|else if|elif|switch|case|branch|condition)\b/i;
const loopRegex = /\b(for|while|do)\b/i;
const returnRegex = /\breturn\b/i;
const errorRegex = /\b(error|exception|traceback|panic|failed)\b/i;

const appendMarker = (
  store: Map<string, TimelineMarkerData>,
  stepIndex: number,
  line: number,
  type: TimelineEventType,
  description: string,
) => {
  const key = `${stepIndex}:${type}:${line}`;
  const existing = store.get(key);

  if (existing) {
    existing.description = [existing.description, description]
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(" | ");
    return;
  }

  store.set(key, {
    id: "",
    stepIndex,
    line,
    type,
    description,
    shortLabel: markerLabelMap[type],
    color: markerColorMap[type],
    lane: 0,
  });
};

const getFunctionEntryDescriptions = (step: ExecutionStep) =>
  (step.functionCalls ?? [])
    .filter((call) => call.event === "enter")
    .map((call) => `${call.name}()`);

const getFunctionExitDescriptions = (step: ExecutionStep) =>
  (step.functionCalls ?? [])
    .filter((call) => call.event === "exit")
    .map((call) => `${call.name}()`);

export const analyzeExecutionTimeline = (
  steps: ExecutionStep[],
  options?: {
    breakpointLines?: number[];
    traceError?: string;
  },
): TimelineAnalysis => {
  const markerStore = new Map<string, TimelineMarkerData>();
  const breakpointLineSet = new Set(options?.breakpointLines ?? []);
  const previews = steps.map((step, stepIndex) => {
    const comparison = compareExecutionFrames(
      stepIndex > 0 ? steps[stepIndex - 1] ?? null : null,
      step,
    );
    const line = getStepLine(step);
    const codePreview = step.codeLine?.trim() || step.description?.trim() || "";
    const description = getStepNarrative(step);
    const content = `${step.codeLine ?? ""} ${step.description ?? ""} ${step.explanation ?? ""}`;

    for (const functionName of getFunctionEntryDescriptions(step)) {
      appendMarker(
        markerStore,
        stepIndex,
        line,
        "function-call",
        functionName,
      );
    }

    if (loopRegex.test(content)) {
      appendMarker(markerStore, stepIndex, line, "loop", description);
    }

    if (conditionRegex.test(content)) {
      appendMarker(markerStore, stepIndex, line, "condition", description);
    }

    if (returnRegex.test(content) || getFunctionExitDescriptions(step).length > 0) {
      appendMarker(
        markerStore,
        stepIndex,
        line,
        "return",
        getFunctionExitDescriptions(step)[0] ?? description,
      );
    }

    if (errorRegex.test(content)) {
      appendMarker(markerStore, stepIndex, line, "error", description);
    }

    if (breakpointLineSet.has(line)) {
      appendMarker(
        markerStore,
        stepIndex,
        line,
        "breakpoint",
        `Breakpoint ready on line ${line}`,
      );
    }

    return {
      stepIndex,
      line,
      codePreview,
      changedVariablesCount: comparison.stats.changed,
      description,
    };
  });

  if (options?.traceError && steps.length > 0) {
    const lastStepIndex = steps.length - 1;
    appendMarker(
      markerStore,
      lastStepIndex,
      getStepLine(steps[lastStepIndex]),
      "error",
      options.traceError,
    );
  }

  const markersByStep = new Map<number, number>();
  const markers = [...markerStore.values()]
    .sort((left, right) => left.stepIndex - right.stepIndex)
    .map((marker) => {
      const lane = markersByStep.get(marker.stepIndex) ?? 0;
      markersByStep.set(marker.stepIndex, lane + 1);

      return {
        ...marker,
        id: createMarkerId(marker.stepIndex, marker.type, lane),
        lane,
      };
    });

  return {
    markers,
    previews,
  };
};
