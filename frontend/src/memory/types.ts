export type MemoryDiffState = "allocated" | "freed" | "updated" | "unchanged";

export type PointerStatus = "valid" | "null" | "dangling";

export interface ParsedPrimitiveValue {
  kind: "primitive";
  display: string;
  numericValue?: number;
  booleanValue?: boolean;
}

export interface ParsedNullValue {
  kind: "null";
  display: string;
}

export interface ParsedReferenceValue {
  kind: "reference";
  display: string;
  addressHint?: string;
  targetKey?: string;
  referenceKind: "pointer" | "reference";
  nullish: boolean;
}

export interface ParsedArrayValue {
  kind: "array";
  display: string;
  items: ParsedMemoryValue[];
  collectionType: "array" | "vector";
  typeName?: string;
}

export interface ParsedObjectEntry {
  key: string;
  value: ParsedMemoryValue;
}

export interface ParsedObjectValue {
  kind: "object";
  display: string;
  entries: ParsedObjectEntry[];
  typeName?: string;
}

export type ParsedMemoryValue =
  | ParsedPrimitiveValue
  | ParsedNullValue
  | ParsedReferenceValue
  | ParsedArrayValue
  | ParsedObjectValue;

export interface MemorySlotModel {
  id: string;
  name: string;
  displayValue: string;
  rawValue: string;
  typeLabel: string;
  parsedValue: ParsedMemoryValue;
  diffState: MemoryDiffState;
  anchorId: string;
  targetBlockId?: string;
  pointerStatus?: PointerStatus;
}

export interface StackFrameModel {
  id: string;
  name: string;
  depth: number;
  recursionDepth: number;
  lineNumber: number | null;
  parameters: MemorySlotModel[];
  locals: MemorySlotModel[];
  isActive: boolean;
  isGlobal: boolean;
  diffState: MemoryDiffState;
  parentId?: string;
  returnAddress?: string;
}

export interface HeapCellModel {
  id: string;
  label: string;
  displayValue: string;
  rawValue: string;
  typeLabel: string;
  parsedValue: ParsedMemoryValue;
  diffState: MemoryDiffState;
  anchorId: string;
  targetBlockId?: string;
  pointerStatus?: PointerStatus;
  index?: number;
}

export type HeapBlockKind =
  | "array"
  | "vector"
  | "object"
  | "linked-node"
  | "tree-node"
  | "class"
  | "sentinel";

export interface HeapBlockModel {
  id: string;
  anchorId: string;
  address: string;
  title: string;
  typeLabel: string;
  kind: HeapBlockKind;
  diffState: MemoryDiffState;
  cells: HeapCellModel[];
  size: number;
  capacity: number;
  summary: string;
  sourceLabels: string[];
  isExpandable: boolean;
  isExpandedByDefault: boolean;
}

export interface PointerLinkModel {
  id: string;
  label: string;
  sourceAnchorId: string;
  targetAnchorId: string;
  sourceKind: "stack" | "heap";
  status: PointerStatus;
  diffState: MemoryDiffState;
  targetAddress?: string;
}

export interface MemoryArrayModel {
  id: string;
  blockId: string;
  label: string;
  address: string;
  collectionType: "array" | "vector";
  cells: HeapCellModel[];
  size: number;
  capacity: number;
  highlightedIndices: number[];
  diffState: MemoryDiffState;
  sourceLabels: string[];
}

export interface LinkedListNodeModel {
  id: string;
  blockId: string;
  address: string;
  label: string;
  valueLabel: string;
  nextStatus: PointerStatus;
  diffState: MemoryDiffState;
}

export interface LinkedListModel {
  id: string;
  label: string;
  nodes: LinkedListNodeModel[];
  cycleDetected: boolean;
}

export interface RecursionNodeModel {
  id: string;
  frameId: string;
  name: string;
  depth: number;
  lineNumber: number | null;
  active: boolean;
  diffState: MemoryDiffState;
  children: RecursionNodeModel[];
}

export interface MemoryDiffSummary {
  allocated: number;
  freed: number;
  updated: number;
  pointerMoved: number;
  mutatedValues: number;
}

export interface MemoryVisualizationModel {
  stackFrames: StackFrameModel[];
  heapBlocks: HeapBlockModel[];
  pointerLinks: PointerLinkModel[];
  arrays: MemoryArrayModel[];
  linkedLists: LinkedListModel[];
  recursionRoots: RecursionNodeModel[];
  diff: MemoryDiffSummary;
  stats: {
    stackFrameCount: number;
    heapBlockCount: number;
    pointerCount: number;
    arrayCount: number;
    linkedListCount: number;
  };
}
