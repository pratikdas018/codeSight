import type { ExecutionStep, StackFrameSnapshot, VariableSnapshot } from "../engine/types";
import type {
  HeapBlockModel,
  HeapCellModel,
  LinkedListModel,
  LinkedListNodeModel,
  MemoryArrayModel,
  MemorySlotModel,
  MemoryVisualizationModel,
  ParsedArrayValue,
  ParsedMemoryValue,
  ParsedObjectValue,
  ParsedReferenceValue,
  PointerLinkModel,
  RecursionNodeModel,
  StackFrameModel,
} from "./types";
import {
  inferCollectionType,
  inferHeapBlockKind,
  inferValueTypeLabel,
  parseMemoryValue,
} from "../utils/memoryParser";
import { createHeapAllocator } from "../utils/heapAllocator";
import { resolvePointerGraph } from "../utils/pointerResolver";

interface BuildOptions {
  step: ExecutionStep | null;
}

interface PendingHeapBlock {
  identity: string;
  title: string;
  typeLabel: string;
  kind: HeapBlockModel["kind"];
  parsedValue: ParsedArrayValue | ParsedObjectValue;
  sourceLabels: string[];
  explicitAddress?: string;
}

interface PendingPointerSource {
  id: string;
  label: string;
  anchorId: string;
  sourceKind: "stack" | "heap";
  parsedValue: ParsedMemoryValue;
  targetBlockId?: string;
}

const pointerishPattern =
  /(?:ptr|ref|head|tail|root|node|next|prev|parent|child|cursor|current|left|right)/i;

const groupVariablesByScope = (variables: VariableSnapshot[]) => {
  const scopes = new Map<string, VariableSnapshot[]>();

  for (const variable of variables) {
    const next = scopes.get(variable.scope) ?? [];
    next.push(variable);
    scopes.set(variable.scope, next);
  }

  return [...scopes.entries()].map(([name, locals]) => ({
    name,
    locals,
  }));
};

const buildFallbackStack = (variables: VariableSnapshot[]) =>
  groupVariablesByScope(variables).map<StackFrameSnapshot>((scope) => ({
    name: scope.name,
    locals: scope.locals,
  }));

const normalizeVariables = (
  variables: ExecutionStep["variables"] | null | undefined,
): VariableSnapshot[] => {
  if (!variables) {
    return [];
  }

  if (Array.isArray(variables)) {
    return variables;
  }

  return Object.entries(variables).map(([name, value]) => ({
    name,
    scope: "global",
    value:
      typeof value === "string"
        ? value
        : typeof value === "undefined"
          ? "undefined"
          : JSON.stringify(value),
  }));
};

const inferRecursionDepth = (frames: Array<{ name: string }>, index: number) =>
  frames
    .slice(0, index + 1)
    .filter((frame) => frame.name === frames[index]?.name).length - 1;

const inferParameters = (locals: MemorySlotModel[]) =>
  locals.filter((slot) => pointerishPattern.test(slot.name) || slot.name.length <= 2);

const inferLocals = (locals: MemorySlotModel[]) => {
  const parameters = new Set(inferParameters(locals).map((slot) => slot.id));
  return locals.filter((slot) => !parameters.has(slot.id));
};

const inferReturnAddress = (frames: StackFrameSnapshot[], index: number, lineNumber: number | null) => {
  const parentFrame = frames[index + 1];
  if (!parentFrame || lineNumber === null) {
    return undefined;
  }

  return `${parentFrame.name} @ line ${lineNumber}`;
};

const deriveCapacity = (
  parsedValue: ParsedArrayValue,
  title: string,
): number => {
  const length = parsedValue.items.length;

  if (inferCollectionType(title, parsedValue.typeName) === "array") {
    return length;
  }

  if (length <= 1) {
    return 1;
  }

  return 2 ** Math.ceil(Math.log2(length));
};

const buildObjectAliases = (name: string, address: string, identity: string) => [
  name,
  name.toLowerCase(),
  address,
  identity,
  identity.toLowerCase(),
];

const createPrimitiveSlot = (
  slotId: string,
  name: string,
  rawValue: string,
  parsedValue: ParsedMemoryValue,
): MemorySlotModel => ({
  id: slotId,
  name,
  displayValue: parsedValue.display,
  rawValue,
  typeLabel: inferValueTypeLabel(parsedValue),
  parsedValue,
  diffState: "unchanged",
  anchorId: `memory-slot:${slotId}`,
});

const buildRecursionTree = (stackFrames: StackFrameModel[]): RecursionNodeModel[] => {
  const recursiveFrames = stackFrames.filter((frame) => frame.recursionDepth > 0);

  if (recursiveFrames.length === 0) {
    return [];
  }

  const rootMap = new Map<string, RecursionNodeModel>();
  const nodeMap = new Map<string, RecursionNodeModel>();

  for (const frame of stackFrames) {
    const node: RecursionNodeModel = {
      id: `recursion:${frame.id}`,
      frameId: frame.id,
      name: frame.name,
      depth: frame.depth,
      lineNumber: frame.lineNumber,
      active: frame.isActive,
      diffState: "unchanged",
      children: [],
    };

    nodeMap.set(frame.id, node);
  }

  for (const frame of stackFrames) {
    const node = nodeMap.get(frame.id);
    if (!node) {
      continue;
    }

    if (frame.parentId) {
      const parent = nodeMap.get(frame.parentId);
      if (parent) {
        parent.children.push(node);
        continue;
      }
    }

    rootMap.set(node.id, node);
  }

  return [...rootMap.values()].filter((node) =>
    stackFrames.some(
      (frame) =>
        frame.id === node.frameId &&
        (frame.recursionDepth > 0 || frame.name === stackFrames[0]?.name),
    ),
  );
};

export const buildMemoryVisualizationModel = ({
  step,
}: BuildOptions): MemoryVisualizationModel => {
  const allocator = createHeapAllocator();
  const variables = normalizeVariables(step?.variables);
  const rawFrames = step?.stack?.length ? step.stack : buildFallbackStack(variables);
  const pendingBlocks: PendingHeapBlock[] = [];
  const pointerSources: PendingPointerSource[] = [];
  const aliasMap = new Map<string, string>();
  const blockSourceLabels = new Map<string, string[]>();
  const builtBlocks = new Map<string, HeapBlockModel>();

  const ensureSourceLabels = (blockId: string, labels: string[]) => {
    const existing = blockSourceLabels.get(blockId) ?? [];
    blockSourceLabels.set(blockId, [...new Set([...existing, ...labels])]);
  };

  const enqueueCompositeValue = (
    identity: string,
    title: string,
    parsedValue: ParsedArrayValue | ParsedObjectValue,
    sourceLabels: string[],
    explicitAddress?: string,
  ) => {
    const existing = pendingBlocks.find((block) => block.identity === identity);
    const kind = inferHeapBlockKind(title, parsedValue);
    const typeLabel =
      parsedValue.kind === "array"
        ? inferCollectionType(title, parsedValue.typeName)
        : parsedValue.typeName ?? "object";

    if (existing) {
      existing.sourceLabels = [...new Set([...existing.sourceLabels, ...sourceLabels])];
      return allocator.ensureAddress(identity, explicitAddress);
    }

    pendingBlocks.push({
      identity,
      title,
      typeLabel,
      kind,
      parsedValue,
      sourceLabels,
      explicitAddress,
    });

    return allocator.ensureAddress(identity, explicitAddress);
  };

  const createSlot = (
    slotId: string,
    name: string,
    rawValue: string,
    parsedValue: ParsedMemoryValue,
    sourceLabel: string,
  ): MemorySlotModel => {
    if (parsedValue.kind === "array" || parsedValue.kind === "object") {
      const blockAddress = enqueueCompositeValue(
        `stack:${slotId}`,
        name,
        parsedValue,
        [sourceLabel],
      );
      const targetBlockId = `heap:${blockAddress}`;
      const typeLabel =
        parsedValue.kind === "array"
          ? inferCollectionType(name, parsedValue.typeName)
          : parsedValue.typeName ?? "object";
      const slot: MemorySlotModel = {
        id: slotId,
        name,
        displayValue: blockAddress,
        rawValue,
        typeLabel,
        parsedValue,
        diffState: "unchanged",
        anchorId: `memory-slot:${slotId}`,
        targetBlockId,
        pointerStatus: "valid",
      };

      pointerSources.push({
        id: slotId,
        label: name,
        anchorId: slot.anchorId,
        sourceKind: "stack",
        parsedValue,
        targetBlockId,
      });

      return slot;
    }

    if (parsedValue.kind === "reference" || parsedValue.kind === "null") {
      const slot = createPrimitiveSlot(slotId, name, rawValue, parsedValue);
      pointerSources.push({
        id: slotId,
        label: name,
        anchorId: slot.anchorId,
        sourceKind: "stack",
        parsedValue,
      });
      return slot;
    }

    return createPrimitiveSlot(slotId, name, rawValue, parsedValue);
  };

  const stackFrames = rawFrames.map<StackFrameModel>((frame, frameIndex) => {
    const slotValues = frame.locals.map((local) =>
      createSlot(
        `frame:${frameIndex}:${local.scope}:${local.name}`,
        local.name,
        local.value,
        parseMemoryValue(local.value),
        `${frame.name}.${local.name}`,
      ),
    );
    const parameters = inferParameters(slotValues);
    const locals = inferLocals(slotValues);

    return {
      id: `frame:${frameIndex}:${frame.name}`,
      name: frame.name,
      depth: frameIndex,
      recursionDepth: inferRecursionDepth(rawFrames, frameIndex),
      lineNumber: step?.line ?? step?.lineNumber ?? null,
      parameters,
      locals,
      isActive: frameIndex === 0,
      isGlobal: frame.name === "global",
      diffState: "unchanged",
      parentId: rawFrames[frameIndex + 1]
        ? `frame:${frameIndex + 1}:${rawFrames[frameIndex + 1].name}`
        : undefined,
      returnAddress: inferReturnAddress(
        rawFrames,
        frameIndex,
        step?.line ?? step?.lineNumber ?? null,
      ),
    };
  });

  for (const heapNode of step?.heap ?? []) {
    const parsedValue = parseMemoryValue(heapNode.value);
    if (parsedValue.kind !== "array" && parsedValue.kind !== "object") {
      continue;
    }

    enqueueCompositeValue(
      `trace:${heapNode.id}`,
      heapNode.label,
      parsedValue,
      [heapNode.label],
      heapNode.id.startsWith("0x") ? heapNode.id : undefined,
    );
  }

  const buildCell = (
    blockId: string,
    blockTitle: string,
    label: string,
    rawValue: string,
    parsedValue: ParsedMemoryValue,
    sourceLabel: string,
    index?: number,
  ): HeapCellModel => {
    const cellId = `${blockId}:${label}`;

    if (parsedValue.kind === "array" || parsedValue.kind === "object") {
      const address = enqueueCompositeValue(
        `nested:${cellId}`,
        `${blockTitle}.${label}`,
        parsedValue,
        [sourceLabel],
      );
      const targetBlockId = `heap:${address}`;
      pointerSources.push({
        id: cellId,
        label,
        anchorId: `memory-cell:${cellId}`,
        sourceKind: "heap",
        parsedValue,
        targetBlockId,
      });

      return {
        id: cellId,
        label,
        displayValue: address,
        rawValue,
        typeLabel:
          parsedValue.kind === "array"
            ? inferCollectionType(blockTitle, parsedValue.typeName)
            : parsedValue.typeName ?? "object",
        parsedValue,
        diffState: "unchanged",
        anchorId: `memory-cell:${cellId}`,
        targetBlockId,
        pointerStatus: "valid",
        index,
      };
    }

    if (parsedValue.kind === "reference" || parsedValue.kind === "null") {
      pointerSources.push({
        id: cellId,
        label,
        anchorId: `memory-cell:${cellId}`,
        sourceKind: "heap",
        parsedValue,
      });
    }

    return {
      id: cellId,
      label,
      displayValue: parsedValue.display,
      rawValue,
      typeLabel: inferValueTypeLabel(parsedValue),
      parsedValue,
      diffState: "unchanged",
      anchorId: `memory-cell:${cellId}`,
      index,
    };
  };

  while (pendingBlocks.length > 0) {
    const blockSpec = pendingBlocks.shift();
    if (!blockSpec) {
      continue;
    }

    const address = allocator.ensureAddress(blockSpec.identity, blockSpec.explicitAddress);
    const blockId = `heap:${address}`;

    if (builtBlocks.has(blockId)) {
      ensureSourceLabels(blockId, blockSpec.sourceLabels);
      continue;
    }

    const cells =
      blockSpec.parsedValue.kind === "array"
        ? blockSpec.parsedValue.items.map((item, index) =>
            buildCell(
              blockId,
              blockSpec.title,
              `[${index}]`,
              item.display,
              item,
              `${blockSpec.title}[${index}]`,
              index,
            ),
          )
        : blockSpec.parsedValue.entries.map((entry) =>
            buildCell(
              blockId,
              blockSpec.title,
              entry.key,
              entry.value.display,
              entry.value,
              `${blockSpec.title}.${entry.key}`,
            ),
          );

    const capacity =
      blockSpec.parsedValue.kind === "array"
        ? deriveCapacity(blockSpec.parsedValue, blockSpec.title)
        : cells.length;

    const block: HeapBlockModel = {
      id: blockId,
      anchorId: `heap-block:${blockId}`,
      address,
      title: blockSpec.title,
      typeLabel: blockSpec.typeLabel,
      kind: blockSpec.kind,
      diffState: "unchanged",
      cells,
      size: cells.length,
      capacity,
      summary:
        blockSpec.parsedValue.kind === "array"
          ? `${cells.length} ${blockSpec.typeLabel} slot${cells.length === 1 ? "" : "s"}`
          : `${cells.length} field${cells.length === 1 ? "" : "s"}`,
      sourceLabels: [...blockSpec.sourceLabels],
      isExpandable: cells.length > 0,
      isExpandedByDefault: cells.length <= 8,
    };

    builtBlocks.set(blockId, block);
    ensureSourceLabels(blockId, blockSpec.sourceLabels);

    for (const alias of buildObjectAliases(blockSpec.title, address, blockSpec.identity)) {
      aliasMap.set(alias.toLowerCase(), blockId);
    }
  }

  const heapBlocks = [...builtBlocks.values()].map((block) => ({
    ...block,
    sourceLabels: blockSourceLabels.get(block.id) ?? block.sourceLabels,
  }));

  for (const block of heapBlocks) {
    aliasMap.set(block.address.toLowerCase(), block.id);
    aliasMap.set(block.title.toLowerCase(), block.id);
    aliasMap.set(block.id.toLowerCase(), block.id);
    for (const label of block.sourceLabels) {
      aliasMap.set(label.toLowerCase(), block.id);
    }
  }

  const resolved = resolvePointerGraph({
    sources: pointerSources,
    heapBlocks,
    aliasMap,
  });

  const arrays = resolved.heapBlocks
    .filter(
      (
        block,
      ): block is HeapBlockModel & { kind: "array" | "vector" } =>
        block.kind === "array" || block.kind === "vector",
    )
    .map<MemoryArrayModel>((block) => ({
      id: `array:${block.id}`,
      blockId: block.id,
      label: block.title,
      address: block.address,
      collectionType: block.kind,
      cells: block.cells,
      size: block.size,
      capacity: block.capacity,
      highlightedIndices: [],
      diffState: "unchanged",
      sourceLabels: block.sourceLabels,
    }));

  const linkedLists: LinkedListModel[] = resolved.heapBlocks
    .filter((block) => block.kind === "linked-node")
    .map<LinkedListModel>((block) => {
      const nodes: LinkedListNodeModel[] = [];
      let current: HeapBlockModel | undefined = block;
      let cycleDetected = false;
      const visited = new Set<string>();

      while (current) {
        if (visited.has(current.id)) {
          cycleDetected = true;
          break;
        }

        visited.add(current.id);

        const valueCell =
          current.cells.find((cell) => /value|data/i.test(cell.label)) ??
          current.cells[0];
        const nextCell: HeapCellModel | undefined = current.cells.find((cell) =>
          /^next$/i.test(cell.label),
        );

        nodes.push({
          id: `list-node:${current.id}`,
          blockId: current.id,
          address: current.address,
          label: current.title,
          valueLabel: valueCell?.displayValue ?? "?",
          nextStatus: nextCell?.pointerStatus ?? "null",
          diffState: current.diffState,
        });

        if (!nextCell?.targetBlockId) {
          break;
        }

        current = resolved.heapBlocks.find(
          (candidate) => candidate.id === nextCell.targetBlockId,
        );
      }

      return {
        id: `list:${block.id}`,
        label: block.title,
        nodes,
        cycleDetected,
      };
    })
    .filter((model) => model.nodes.length > 1);

  for (const block of resolved.heapBlocks) {
    for (const cell of block.cells) {
      const pointerLink = resolved.pointerLinks.find(
        (link) => link.sourceAnchorId === cell.anchorId,
      );
      if (pointerLink) {
        cell.pointerStatus = pointerLink.status;
      }
    }
  }

  for (const frame of stackFrames) {
    for (const slot of [...frame.parameters, ...frame.locals]) {
      const pointerLink = resolved.pointerLinks.find(
        (link) => link.sourceAnchorId === slot.anchorId,
      );
      if (pointerLink) {
        slot.pointerStatus = pointerLink.status;
      }
    }
  }

  const recursionRoots = buildRecursionTree(stackFrames);
  const pointerLinks: PointerLinkModel[] = resolved.pointerLinks;

  return {
    stackFrames,
    heapBlocks: resolved.heapBlocks,
    pointerLinks,
    arrays,
    linkedLists,
    recursionRoots,
    diff: {
      allocated: 0,
      freed: 0,
      updated: 0,
      pointerMoved: 0,
      mutatedValues: 0,
    },
    stats: {
      stackFrameCount: stackFrames.length,
      heapBlockCount: resolved.heapBlocks.filter((block) => block.kind !== "sentinel").length,
      pointerCount: pointerLinks.length,
      arrayCount: arrays.length,
      linkedListCount: linkedLists.length,
    },
  };
};
