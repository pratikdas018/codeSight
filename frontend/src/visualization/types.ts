export type ThemeMode = "light" | "dark";

export interface ParsedPrimitiveValue {
  kind: "primitive";
  display: string;
  numericValue?: number;
}

export interface ParsedArrayValue {
  kind: "array";
  display: string;
  items: ParsedValue[];
}

export interface ParsedObjectValue {
  kind: "object";
  display: string;
  entries: Array<{
    key: string;
    value: ParsedValue;
  }>;
}

export type ParsedValue =
  | ParsedPrimitiveValue
  | ParsedArrayValue
  | ParsedObjectValue;

export interface VisualVariable {
  id: string;
  name: string;
  scope: string;
  currentValue: string;
  previousValue?: string;
  parsedValue: ParsedValue;
  change:
    | "added"
    | "updated"
    | "removed"
    | "unchanged";
  isPointer: boolean;
  pointerIndex?: number;
  isComposite: boolean;
  emphasis: boolean;
}

export interface VisualArrayItem {
  motionId: string;
  index: number;
  label: string;
  changed: boolean;
}

export interface VisualPointer {
  name: string;
  index: number;
  active: boolean;
}

export interface VisualArray {
  id: string;
  name: string;
  scope: string;
  items: VisualArrayItem[];
  pointers: VisualPointer[];
  activeIndices: number[];
}

export interface HeapNode {
  id: string;
  label: string;
  kind: "array" | "object";
  rows: Array<{
    key: string;
    value: string;
  }>;
  emphasized: boolean;
}

export interface MemoryLink {
  sourceId: string;
  targetId: string;
  emphasized: boolean;
}

export interface VisualizationModel {
  variables: VisualVariable[];
  arrays: VisualArray[];
  heapNodes: HeapNode[];
  links: MemoryLink[];
  explanation: string;
  focusNames: string[];
}
