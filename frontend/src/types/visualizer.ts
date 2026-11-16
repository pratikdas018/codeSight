export type SortingAlgorithm =
  | "selection-sort"
  | "bubble-sort"
  | "insertion-sort"
  | "merge-sort"
  | "quick-sort";

export interface AnimationStep {
  array: number[];
  comparing: [number, number] | [];
  swapping: [number, number] | [];
  sortedIndices: number[];
  comparisonsCount: number;
  swapsCount: number;
  activeLine?: number;
  operation: string;
}

export interface SortingAlgorithmDefinition {
  id: SortingAlgorithm;
  label: string;
  description: string;
  best: string;
  average: string;
  worst: string;
  space: string;
  stable: boolean;
}
