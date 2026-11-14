export type SearchAlgorithmId = "linear-search" | "binary-search";
export type DataStructureId = "stack" | "queue";

export interface AlgorithmStep {
  id: string;
  operation: string;
  explanation: string;
  technicalExplanation: string;
  values: number[];
  activeIndices: number[];
  foundIndex: number | null;
  variables: Record<string, string>;
}

export interface AlgorithmDefinition {
  id: SearchAlgorithmId;
  name: string;
  description: string;
  useWhen: string;
  avoidWhen: string;
  time: string;
  space: string;
}

export const searchAlgorithms: AlgorithmDefinition[] = [
  { id: "linear-search", name: "Linear Search", description: "Check each value from left to right until the target is found.", useWhen: "The collection is unsorted or small.", avoidWhen: "You need many searches over sorted data.", time: "Best O(1) · Average/Worst O(n)", space: "O(1)" },
  { id: "binary-search", name: "Binary Search", description: "Repeatedly halve a sorted range to locate the target.", useWhen: "The values are sorted and random access is available.", avoidWhen: "The collection is unsorted or frequently reordered.", time: "Best O(1) · Average/Worst O(log n)", space: "O(1)" },
];

export const parseNumberList = (input: string) => {
  const tokens = input.split(",").map((token) => token.trim()).filter(Boolean);
  const values = tokens.map(Number);
  return values.length > 0 && values.every(Number.isFinite) ? values : null;
};

const step = (partial: Omit<AlgorithmStep, "id">, index: number): AlgorithmStep => ({ ...partial, id: `step-${index}` });

export const generateSearchSteps = (
  input: number[],
  target: number,
  algorithm: SearchAlgorithmId,
): AlgorithmStep[] => {
  const values = algorithm === "binary-search" ? [...input].sort((a, b) => a - b) : [...input];
  const steps: AlgorithmStep[] = [];
  if (values.length === 0) return [];

  if (algorithm === "linear-search") {
    for (let index = 0; index < values.length; index += 1) {
      const found = values[index] === target;
      steps.push(step({
        operation: found ? `Found ${target}` : `Inspect index ${index}`,
        explanation: found ? `The current value is ${target}, so the search can stop.` : `Compare ${values[index]} with ${target}, then move one position right.`,
        technicalExplanation: found ? `values[${index}] === target; return index ${index}.` : `values[${index}] !== target; increment index to ${index + 1}.`,
        values, activeIndices: [index], foundIndex: found ? index : null,
        variables: { index: String(index), current: String(values[index]), target: String(target) },
      }, steps.length));
      if (found) break;
    }
  } else {
    let low = 0;
    let high = values.length - 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const current = values[middle];
      const found = current === target;
      steps.push(step({
        operation: found ? `Found ${target}` : `Inspect midpoint ${middle}`,
        explanation: found ? `The midpoint is the target, so the search is complete.` : `${current} is ${current < target ? "smaller" : "larger"} than ${target}; discard the half that cannot contain the target.`,
        technicalExplanation: found ? `values[${middle}] === target; return index ${middle}.` : `low=${low}, high=${high}, middle=${middle}; update the search bounds.`,
        values, activeIndices: Array.from({ length: high - low + 1 }, (_, offset) => low + offset), foundIndex: found ? middle : null,
        variables: { low: String(low), middle: String(middle), high: String(high), current: String(current), target: String(target) },
      }, steps.length));
      if (found) break;
      if (current < target) low = middle + 1;
      else high = middle - 1;
    }
  }
  if (!steps.some((current) => current.foundIndex !== null)) {
    steps.push(step({ operation: "Target not found", explanation: `${target} was not found in the collection.`, technicalExplanation: "The search exhausted its candidate range and returns -1.", values, activeIndices: [], foundIndex: null, variables: { target: String(target) } }, steps.length));
  }
  return steps;
};

export interface DataStructureStep {
  id: string;
  operation: string;
  explanation: string;
  technicalExplanation: string;
  values: number[];
  activeIndex: number | null;
}

export const createDataStructureStep = (
  values: number[],
  operation: string,
  explanation: string,
  technicalExplanation: string,
  activeIndex: number | null,
  index: number,
): DataStructureStep => ({ id: `operation-${index}`, values: [...values], operation, explanation, technicalExplanation, activeIndex });

