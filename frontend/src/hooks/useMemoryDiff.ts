import { useMemo } from "react";
import type { MemoryVisualizationModel } from "../memory/types";

export const useMemoryDiff = (model: MemoryVisualizationModel) =>
  useMemo(
    () => ({
      summary: model.diff,
      hasChanges:
        model.diff.allocated > 0 ||
        model.diff.freed > 0 ||
        model.diff.updated > 0 ||
        model.diff.pointerMoved > 0,
    }),
    [model],
  );
