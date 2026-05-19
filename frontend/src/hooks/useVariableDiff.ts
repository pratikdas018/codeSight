import { useMemo } from "react";
import type { ExecutionStep } from "../engine/types";
import { compareExecutionFrames } from "../utils/executionDiff";

export const useVariableDiff = (
  previousFrame: ExecutionStep | null,
  currentFrame: ExecutionStep | null,
) =>
  useMemo(
    () => compareExecutionFrames(previousFrame, currentFrame),
    [currentFrame, previousFrame],
  );
