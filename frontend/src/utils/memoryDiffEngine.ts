import type {
  HeapBlockModel,
  HeapCellModel,
  MemoryArrayModel,
  MemoryDiffState,
  MemorySlotModel,
  MemoryVisualizationModel,
  PointerLinkModel,
  RecursionNodeModel,
  StackFrameModel,
} from "../memory/types";

const resolveDiffState = (
  allocated: boolean,
  updated: boolean,
): MemoryDiffState => {
  if (allocated) {
    return "allocated";
  }

  if (updated) {
    return "updated";
  }

  return "unchanged";
};

const markFrameDiff = (
  previousFrameMap: Map<string, StackFrameModel>,
  frames: StackFrameModel[],
) : StackFrameModel[] =>
  frames.map((frame) => {
    const previousFrame = previousFrameMap.get(frame.id);

    const mutateSlot = (slot: MemorySlotModel): MemorySlotModel => {
      const previousSlots = previousFrame
        ? [...previousFrame.locals, ...previousFrame.parameters]
        : [];
      const previousSlot = previousSlots.find(
        (candidate) => candidate.id === slot.id,
      );

      const changed =
        !previousSlot ||
        previousSlot.displayValue !== slot.displayValue ||
        previousSlot.targetBlockId !== slot.targetBlockId;

      return {
        ...slot,
        diffState: resolveDiffState(!previousSlot, changed),
      };
    };

    return {
      ...frame,
      diffState: resolveDiffState(
        !previousFrame,
        previousFrame?.lineNumber !== frame.lineNumber,
      ),
      parameters: frame.parameters.map(mutateSlot),
      locals: frame.locals.map(mutateSlot),
    };
  });

const markBlockDiff = (
  previousBlockMap: Map<string, HeapBlockModel>,
  currentBlockMap: Map<string, HeapBlockModel>,
): HeapBlockModel[] => {
  const currentBlocks = [...currentBlockMap.values()].map((block) => {
    const previousBlock = previousBlockMap.get(block.address);

    const cells = block.cells.map((cell) => {
      const previousCell = previousBlock?.cells.find(
        (candidate) => candidate.label === cell.label,
      );
      const changed =
        !previousCell ||
        previousCell.displayValue !== cell.displayValue ||
        previousCell.targetBlockId !== cell.targetBlockId;

      return {
        ...cell,
        diffState: resolveDiffState(!previousCell, changed),
      };
    });

    const blockChanged =
      !previousBlock ||
      previousBlock.cells.length !== block.cells.length ||
      cells.some((cell) => cell.diffState !== "unchanged");

    return {
      ...block,
      diffState: resolveDiffState(!previousBlock, blockChanged),
      cells,
    };
  });

  const freedBlocks = [...previousBlockMap.values()]
    .filter((block) => !currentBlockMap.has(block.address))
    .map<HeapBlockModel>((block) => ({
      ...block,
      id: `ghost:${block.id}`,
      anchorId: `heap-block:ghost:${block.id}`,
      diffState: "freed",
      summary: `Freed at ${block.address}`,
      cells: block.cells.map((cell) => ({
        ...cell,
        id: `ghost:${cell.id}`,
        anchorId: `heap-cell:ghost:${cell.id}`,
        diffState: "freed",
      })),
    }));

  return [...currentBlocks, ...freedBlocks];
};

const markPointerDiff = (
  previousPointerMap: Map<string, PointerLinkModel>,
  pointerLinks: PointerLinkModel[],
) : PointerLinkModel[] =>
  pointerLinks.map((link) => {
    const previousLink = previousPointerMap.get(link.sourceAnchorId);
    const changed =
      !previousLink ||
      previousLink.targetAnchorId !== link.targetAnchorId ||
      previousLink.status !== link.status;

    return {
      ...link,
      diffState: resolveDiffState(!previousLink, changed),
    };
  });

const walkRecursionDiff = (
  previousNodeMap: Map<string, RecursionNodeModel>,
  nodes: RecursionNodeModel[],
): RecursionNodeModel[] =>
  nodes.map((node) => {
    const previousNode = previousNodeMap.get(node.frameId);
    return {
      ...node,
      diffState: resolveDiffState(!previousNode, previousNode?.active !== node.active),
      children: walkRecursionDiff(previousNodeMap, node.children),
    };
  });

const countDiffState = (
  items: Array<{ diffState: MemoryDiffState }>,
  state: MemoryDiffState,
) => items.filter((item) => item.diffState === state).length;

const countUpdatedCells = (blocks: HeapBlockModel[]) =>
  blocks.reduce(
    (total, block) =>
      total +
      countDiffState(
        block.cells as Array<HeapCellModel & { diffState: MemoryDiffState }>,
        "updated",
      ),
    0,
  );

const markArrayDiff = (
  previousArrays: Map<string, MemoryArrayModel>,
  arrays: MemoryArrayModel[],
): MemoryArrayModel[] =>
  arrays.map((array) => {
    const previousArray = previousArrays.get(array.address);
    const highlightedIndices = array.cells
      .filter((cell) => cell.diffState === "updated" || cell.diffState === "allocated")
      .map((cell) => cell.index)
      .filter((index): index is number => typeof index === "number");

    return {
      ...array,
      diffState: resolveDiffState(
        !previousArray,
        previousArray?.size !== array.size ||
          previousArray?.capacity !== array.capacity ||
          highlightedIndices.length > 0,
      ),
      highlightedIndices,
    };
  });

export const diffMemoryModels = (
  previousModel: MemoryVisualizationModel | null,
  currentModel: MemoryVisualizationModel,
): MemoryVisualizationModel => {
  const previousFrameMap = new Map(
    (previousModel?.stackFrames ?? []).map((frame) => [frame.id, frame]),
  );
  const previousBlockMap = new Map(
    (previousModel?.heapBlocks ?? [])
      .filter((block) => !block.id.startsWith("sentinel:"))
      .map((block) => [block.address, block]),
  );
  const currentBlockMap = new Map(
    currentModel.heapBlocks
      .filter((block) => !block.id.startsWith("sentinel:"))
      .map((block) => [block.address, block]),
  );
  const previousPointerMap = new Map(
    (previousModel?.pointerLinks ?? []).map((link) => [link.sourceAnchorId, link]),
  );
  const previousRecursionNodes = new Map<string, RecursionNodeModel>();

  const collectRecursionNodes = (nodes: RecursionNodeModel[]) => {
    for (const node of nodes) {
      previousRecursionNodes.set(node.frameId, node);
      collectRecursionNodes(node.children);
    }
  };

  collectRecursionNodes(previousModel?.recursionRoots ?? []);

  const stackFrames = markFrameDiff(previousFrameMap, currentModel.stackFrames);
  const heapBlocks = markBlockDiff(previousBlockMap, currentBlockMap);
  const pointerLinks = markPointerDiff(previousPointerMap, currentModel.pointerLinks);
  const arrays = markArrayDiff(
    new Map((previousModel?.arrays ?? []).map((array) => [array.address, array])),
    currentModel.arrays.map((array) => {
      const matchedBlock = heapBlocks.find((block) => block.id === array.blockId);
      return {
        ...array,
        cells: matchedBlock?.cells ?? array.cells,
      };
    }),
  );
  const recursionRoots = walkRecursionDiff(
    previousRecursionNodes,
    currentModel.recursionRoots,
  );

  const allocated =
    countDiffState(stackFrames, "allocated") +
    countDiffState(heapBlocks, "allocated") +
    countDiffState(pointerLinks, "allocated");
  const freed = countDiffState(heapBlocks, "freed");
  const updated =
    countDiffState(stackFrames, "updated") +
    countDiffState(heapBlocks, "updated") +
    countDiffState(pointerLinks, "updated");
  const pointerMoved = pointerLinks.filter(
    (link) => link.diffState === "updated",
  ).length;
  const mutatedValues = countUpdatedCells(heapBlocks);

  return {
    ...currentModel,
    stackFrames,
    heapBlocks,
    pointerLinks,
    arrays,
    recursionRoots,
    diff: {
      allocated,
      freed,
      updated,
      pointerMoved,
      mutatedValues,
    },
    stats: {
      ...currentModel.stats,
      heapBlockCount: heapBlocks.filter((block) => block.kind !== "sentinel").length,
      pointerCount: pointerLinks.length,
      arrayCount: arrays.length,
    },
  };
};
