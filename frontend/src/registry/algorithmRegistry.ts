import { BarChart3, GitBranch, Search, Sparkles } from "lucide-react";
import { generateActivitySelectionFrames } from "../algorithms/greedy/activitySelection";
import { generateBubbleSortFrames } from "../algorithms/sorting/bubbleSort";
import { generateSelectionSortFrames } from "../algorithms/sorting/selectionSort";
import type { AlgorithmCategory, AlgorithmDefinition } from "../types/algorithmVisualizer";

const createNumbers = () => [42, 17, 8, 31, 24, 12, 36, 5, 28, 19, 7, 33];
const sorting: AlgorithmDefinition[] = [
  { id: "selection-sort", title: "Selection Sort", description: "Find the smallest remaining value and lock it into the next sorted position.", complexity: "O(n²) time · O(1) space", categoryId: "sorting", generateSteps: (input) => generateSelectionSortFrames(input as number[]), createExample: createNumbers },
  { id: "bubble-sort", title: "Bubble Sort", description: "Compare neighbors and move larger values toward the end of the array.", complexity: "O(n²) average time · O(1) space", categoryId: "sorting", generateSteps: (input) => generateBubbleSortFrames(input as number[]), createExample: createNumbers },
];
const greedy: AlgorithmDefinition[] = [{ id: "activity-selection", title: "Activity Selection", description: "Choose the maximum number of non-overlapping activities by earliest finish time.", complexity: "O(n log n) time · O(n) space", categoryId: "greedy", generateSteps: () => generateActivitySelectionFrames(), createExample: () => undefined }];

export const algorithmRegistry: AlgorithmCategory[] = [
  { id: "sorting", title: "Sorting", description: "Selection Sort, Bubble Sort", icon: BarChart3, algorithms: sorting },
  { id: "greedy", title: "Greedy", description: "Activity Selection", icon: Sparkles, algorithms: greedy },
  { id: "searching", title: "Searching", description: "Linear Search, Binary Search", icon: Search, algorithms: [] },
  { id: "dynamic-programming", title: "Dynamic Programming", description: "Memoization, Tabulation", icon: GitBranch, algorithms: [] },
];
