import { useMemo } from "react";
import type { ExecutionStep } from "../engine/types";
import { buildMemoryVisualizationModel } from "../memory/buildMemoryVisualizationModel";
import { diffMemoryModels } from "../utils/memoryDiffEngine";

export const useMemoryModel = (
  step: ExecutionStep | null,
  previousStep: ExecutionStep | null,
) =>
  useMemo(() => {
    const currentModel = buildMemoryVisualizationModel({ step });
    const previousModel = previousStep
      ? buildMemoryVisualizationModel({ step: previousStep })
      : null;

    return diffMemoryModels(previousModel, currentModel);
  }, [previousStep, step]);
