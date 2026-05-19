import type {
  HeapBlockModel,
  ParsedMemoryValue,
  PointerLinkModel,
  PointerStatus,
} from "../memory/types";

interface PointerSource {
  id: string;
  label: string;
  anchorId: string;
  sourceKind: "stack" | "heap";
  parsedValue: ParsedMemoryValue;
  targetBlockId?: string;
}

interface ResolvePointerGraphOptions {
  sources: PointerSource[];
  heapBlocks: HeapBlockModel[];
  aliasMap: Map<string, string>;
}

const normalizeKey = (value: string) => value.trim().toLowerCase();

const createSentinelBlock = (
  kind: "null" | "dangling",
  usedCount: number,
): HeapBlockModel => ({
  id: `sentinel:${kind}`,
  anchorId: `heap-block:sentinel:${kind}`,
  address: kind === "null" ? "NULL" : "VOID",
  title: kind === "null" ? "Null target" : "Dangling target",
  typeLabel: kind === "null" ? "null pointer" : "invalid reference",
  kind: "sentinel",
  diffState: "unchanged",
  cells: [
    {
      id: `sentinel:${kind}:detail`,
      label: "status",
      displayValue:
        kind === "null"
          ? `${usedCount} null reference${usedCount === 1 ? "" : "s"}`
          : `${usedCount} unresolved pointer${usedCount === 1 ? "" : "s"}`,
      rawValue: kind,
      typeLabel: "state",
      parsedValue: {
        kind: "primitive",
        display: kind,
      },
      diffState: "unchanged",
      anchorId: `heap-cell:sentinel:${kind}:detail`,
    },
  ],
  size: 1,
  capacity: 1,
  summary:
    kind === "null"
      ? "Pointers with no target end here."
      : "Pointers whose targets no longer exist end here.",
  sourceLabels: [],
  isExpandable: false,
  isExpandedByDefault: true,
});

const resolveTarget = (
  source: PointerSource,
  aliasMap: Map<string, string>,
): { targetId?: string; status: PointerStatus } => {
  if (source.targetBlockId) {
    return {
      targetId: source.targetBlockId,
      status: "valid",
    };
  }

  if (source.parsedValue.kind === "null") {
    return {
      targetId: "sentinel:null",
      status: "null",
    };
  }

  if (source.parsedValue.kind !== "reference") {
    return {
      status: "dangling",
      targetId: "sentinel:dangling",
    };
  }

  if (source.parsedValue.nullish) {
    return {
      targetId: "sentinel:null",
      status: "null",
    };
  }

  const candidates = [
    source.parsedValue.addressHint,
    source.parsedValue.targetKey,
    source.parsedValue.display,
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizeKey);

  for (const candidate of candidates) {
    const targetId = aliasMap.get(candidate);
    if (targetId) {
      return {
        targetId,
        status: "valid",
      };
    }
  }

  return {
    targetId: "sentinel:dangling",
    status: "dangling",
  };
};

export const resolvePointerGraph = ({
  sources,
  heapBlocks,
  aliasMap,
}: ResolvePointerGraphOptions): {
  pointerLinks: PointerLinkModel[];
  heapBlocks: HeapBlockModel[];
} => {
  const pointerLinks: PointerLinkModel[] = [];
  const nextHeapBlocks = [...heapBlocks];
  let nullCount = 0;
  let danglingCount = 0;

  const ensureSentinel = (kind: "null" | "dangling", usedCount: number) => {
    const sentinelId = `sentinel:${kind}`;
    const existingIndex = nextHeapBlocks.findIndex((block) => block.id === sentinelId);
    const block = createSentinelBlock(kind, usedCount);

    if (existingIndex >= 0) {
      nextHeapBlocks[existingIndex] = block;
    } else {
      nextHeapBlocks.push(block);
    }
  };

  for (const source of sources) {
    if (
      source.parsedValue.kind !== "reference" &&
      !source.targetBlockId &&
      source.parsedValue.kind !== "null"
    ) {
      continue;
    }

    const { targetId, status } = resolveTarget(source, aliasMap);

    if (!targetId) {
      continue;
    }

    if (status === "null") {
      nullCount += 1;
      ensureSentinel("null", nullCount);
    }

    if (status === "dangling") {
      danglingCount += 1;
      ensureSentinel("dangling", danglingCount);
    }

    const targetBlock = nextHeapBlocks.find((block) => block.id === targetId);
    if (!targetBlock) {
      continue;
    }

    pointerLinks.push({
      id: `${source.id}->${targetId}`,
      label: source.label,
      sourceAnchorId: source.anchorId,
      targetAnchorId: targetBlock.anchorId,
      sourceKind: source.sourceKind,
      status,
      diffState: "unchanged",
      targetAddress: targetBlock.address,
    });
  }

  return {
    pointerLinks,
    heapBlocks: nextHeapBlocks,
  };
};
