import type { LucideIcon } from "lucide-react";

export type VisualizerCategoryId = "sorting" | "greedy" | "searching" | "dynamic-programming";

export type BarVisualState = {
  kind: "bars";
  values: number[];
  comparing: number[];
  swapping: number[];
  accepted: number[];
};

export type TimelineVisualState = {
  kind: "timeline";
  intervals: Array<{ id: string; start: number; end: number; state: "neutral" | "active" | "accepted" | "rejected" }>;
  end: number;
};

export type VisualState = BarVisualState | TimelineVisualState;

export interface AnimationStep {
  visualState: VisualState;
  summaryBannerText: string;
  stepDetailText: string;
  codeLine?: number;
  comparisonsCount?: number;
  swapsCount?: number;
}

export interface AlgorithmDefinition {
  id: string;
  title: string;
  description: string;
  complexity: string;
  categoryId: VisualizerCategoryId;
  generateSteps: (input: unknown) => AnimationStep[];
  createExample: () => unknown;
}

export interface AlgorithmCategory {
  id: VisualizerCategoryId;
  title: string;
  description: string;
  icon: LucideIcon;
  algorithms: AlgorithmDefinition[];
}
