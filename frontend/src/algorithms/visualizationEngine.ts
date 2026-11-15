export type SearchAlgorithmId =
  | "linear-search"
  | "binary-search"
  | "jump-search"
  | "interpolation-search"
  | "exponential-search";

export type DataStructureId = "array" | "dynamic-array" | "stack" | "queue";

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
  { id: "linear-search", name: "Linear Search", description: "Check each value from left to right until the target is found.", useWhen: "The collection is unsorted or small.", avoidWhen: "You need many searches over sorted data.", time: "Best O(1) - Average/Worst O(n)", space: "O(1)" },
  { id: "binary-search", name: "Binary Search", description: "Repeatedly halve a sorted range to locate the target.", useWhen: "The values are sorted and random access is available.", avoidWhen: "The collection is unsorted or frequently reordered.", time: "Best O(1) - Average/Worst O(log n)", space: "O(1)" },
  { id: "jump-search", name: "Jump Search", description: "Jump through sorted blocks, then scan the block that can contain the target.", useWhen: "The values are sorted and block-sized jumps are useful.", avoidWhen: "The collection is unsorted or random access is unavailable.", time: "Best O(1) - Worst O(sqrt(n))", space: "O(1)" },
  { id: "interpolation-search", name: "Interpolation Search", description: "Estimate a target position in uniformly distributed sorted values.", useWhen: "Sorted numeric values are fairly uniform.", avoidWhen: "Values are clustered or the distribution is unknown.", time: "Best O(1) - Average O(log log n) - Worst O(n)", space: "O(1)" },
  { id: "exponential-search", name: "Exponential Search", description: "Expand an upper bound exponentially before applying binary search.", useWhen: "The target may be near the start of a sorted range.", avoidWhen: "The values are unsorted.", time: "Best O(1) - Average/Worst O(log n)", space: "O(1)" },
];

export const parseNumberList = (input: string) => {
  const tokens = input.split(",").map((token) => token.trim()).filter(Boolean);
  const values = tokens.map(Number);
  return values.length > 0 && values.every(Number.isFinite) ? values : null;
};

const step = (partial: Omit<AlgorithmStep, "id">, index: number): AlgorithmStep => ({ ...partial, id: `step-${index}` });
const activeRange = (low: number, high: number) => high < low ? [] : Array.from({ length: high - low + 1 }, (_, offset) => low + offset);

const foundOrNotFound = (steps: AlgorithmStep[], values: number[], target: number) => {
  if (!steps.some((current) => current.foundIndex !== null)) {
    steps.push(step({ operation: "Target not found", explanation: `${target} was not found in the collection.`, technicalExplanation: "The candidate range was exhausted and the algorithm returns -1.", values, activeIndices: [], foundIndex: null, variables: { target: String(target) } }, steps.length));
  }
  return steps;
};

export const generateSearchSteps = (input: number[], target: number, algorithm: SearchAlgorithmId): AlgorithmStep[] => {
  const values = algorithm === "linear-search" ? [...input] : [...input].sort((a, b) => a - b);
  const steps: AlgorithmStep[] = [];
  if (values.length === 0) return foundOrNotFound(steps, values, target);

  if (algorithm === "linear-search") {
    for (let index = 0; index < values.length; index += 1) {
      const found = values[index] === target;
      steps.push(step({ operation: found ? `Found ${target}` : `Inspect index ${index}`, explanation: found ? `The current value is ${target}, so the search can stop.` : `Compare ${values[index]} with ${target}, then move one position right.`, technicalExplanation: `values[${index}] ${found ? "===" : "!=="} target; ${found ? "return the index" : "increment index"}.`, values, activeIndices: [index], foundIndex: found ? index : null, variables: { index: String(index), current: String(values[index]), target: String(target) } }, steps.length));
      if (found) break;
    }
  } else if (algorithm === "binary-search") {
    let low = 0;
    let high = values.length - 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const current = values[middle];
      const found = current === target;
      steps.push(step({ operation: found ? `Found ${target}` : `Inspect midpoint ${middle}`, explanation: found ? "The midpoint is the target, so the search is complete." : `${current} is ${current < target ? "smaller" : "larger"} than ${target}; discard the impossible half.`, technicalExplanation: `low=${low}, high=${high}, middle=${middle}; update the binary-search bounds.`, values, activeIndices: activeRange(low, high), foundIndex: found ? middle : null, variables: { low: String(low), middle: String(middle), high: String(high), current: String(current), target: String(target) } }, steps.length));
      if (found) break;
      if (current < target) low = middle + 1;
      else high = middle - 1;
    }
  } else if (algorithm === "jump-search") {
    const blockSize = Math.max(1, Math.floor(Math.sqrt(values.length)));
    let blockStart = 0;
    let blockEnd = Math.min(blockSize, values.length) - 1;
    while (blockStart < values.length && values[blockEnd] < target) {
      steps.push(step({ operation: `Jump past index ${blockEnd}`, explanation: `${values[blockEnd]} is smaller than ${target}, so the block can be skipped.`, technicalExplanation: `Advance the candidate block by ${blockSize} positions.`, values, activeIndices: activeRange(blockStart, blockEnd), foundIndex: null, variables: { blockStart: String(blockStart), blockEnd: String(blockEnd), blockSize: String(blockSize), target: String(target) } }, steps.length));
      blockStart = blockEnd + 1;
      blockEnd = Math.min(blockStart + blockSize, values.length) - 1;
    }
    for (let index = blockStart; index <= blockEnd && index < values.length; index += 1) {
      const found = values[index] === target;
      steps.push(step({ operation: found ? `Found ${target}` : `Scan index ${index}`, explanation: found ? "The block scan reached the target." : `${values[index]} is not ${target}; continue through the candidate block.`, technicalExplanation: `values[${index}] ${found ? "===" : "!=="} target inside the selected block.`, values, activeIndices: [index], foundIndex: found ? index : null, variables: { blockStart: String(blockStart), blockEnd: String(blockEnd), index: String(index), target: String(target) } }, steps.length));
      if (found) break;
    }
  } else if (algorithm === "interpolation-search") {
    let low = 0;
    let high = values.length - 1;
    while (low <= high && target >= values[low] && target <= values[high]) {
      const position = values[low] === values[high] ? low : low + Math.floor(((target - values[low]) * (high - low)) / (values[high] - values[low]));
      const current = values[position];
      const found = current === target;
      steps.push(step({ operation: found ? `Found ${target}` : `Estimate index ${position}`, explanation: found ? "The estimated position contains the target." : `${current} is ${current < target ? "smaller" : "larger"} than ${target}; narrow the estimated range.`, technicalExplanation: `low=${low}, high=${high}, position=${position}; update interpolation bounds.`, values, activeIndices: activeRange(low, high), foundIndex: found ? position : null, variables: { low: String(low), position: String(position), high: String(high), current: String(current), target: String(target) } }, steps.length));
      if (found) break;
      if (current < target) low = position + 1;
      else high = position - 1;
    }
  } else {
    let low = 0;
    let high = 0;
    while (high < values.length && values[high] < target) {
      const nextBound = high === 0 ? 1 : high * 2;
      steps.push(step({ operation: `Expand bound to ${Math.min(values.length - 1, nextBound)}`, explanation: `${values[high]} is smaller than ${target}, so double the candidate range.`, technicalExplanation: `The exponential probe at index ${high} has not reached the target.`, values, activeIndices: [high], foundIndex: null, variables: { bound: String(high), target: String(target) } }, steps.length));
      high = nextBound;
    }
    high = Math.min(high, values.length - 1);
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const current = values[middle];
      const found = current === target;
      steps.push(step({ operation: found ? `Found ${target}` : `Inspect midpoint ${middle}`, explanation: found ? "The bounded binary search reached the target." : `${current} is ${current < target ? "smaller" : "larger"} than ${target}; narrow the discovered range.`, technicalExplanation: `low=${low}, middle=${middle}, high=${high}; continue binary search.`, values, activeIndices: activeRange(low, high), foundIndex: found ? middle : null, variables: { low: String(low), middle: String(middle), high: String(high), target: String(target) } }, steps.length));
      if (found) break;
      if (current < target) low = middle + 1;
      else high = middle - 1;
    }
  }
  return foundOrNotFound(steps, values, target);
};

export interface DataStructureStep {
  id: string;
  operation: string;
  explanation: string;
  technicalExplanation: string;
  values: number[];
  activeIndex: number | null;
}

export const createDataStructureStep = (values: number[], operation: string, explanation: string, technicalExplanation: string, activeIndex: number | null, index: number): DataStructureStep => ({ id: `operation-${index}`, values: [...values], operation, explanation, technicalExplanation, activeIndex });

export type ArrayOperation =
  | { type: "access"; index: number }
  | { type: "insert"; index: number; value: number }
  | { type: "delete"; index: number }
  | { type: "update"; index: number; value: number }
  | { type: "search"; value: number };

export interface DataStructureTraceStep extends DataStructureStep {
  activeIndices: number[];
  variables: Record<string, string>;
  statistics: { comparisons: number; mutations: number };
}

export interface DataStructureTrace {
  structure: "array" | "dynamic-array";
  operation: ArrayOperation;
  steps: DataStructureTraceStep[];
  result: number | null;
  finalValues: number[];
}

const arrayStep = (
  values: number[],
  operation: string,
  explanation: string,
  technicalExplanation: string,
  activeIndices: number[],
  variables: Record<string, string>,
  statistics: DataStructureTraceStep["statistics"],
  index: number,
): DataStructureTraceStep => ({
  ...createDataStructureStep(values, operation, explanation, technicalExplanation, activeIndices[0] ?? null, index),
  activeIndices,
  variables,
  statistics,
});

const validIndex = (index: number, length: number, allowEnd = false) =>
  Number.isInteger(index) && index >= 0 && index < length + (allowEnd ? 1 : 0);

export const validateArrayOperation = (values: number[], operation: ArrayOperation): string | null => {
  if (operation.type === "insert") {
    if (!Number.isFinite(operation.value)) return "Insert value must be a finite number.";
    if (!validIndex(operation.index, values.length, true)) return `Insert index must be between 0 and ${values.length}.`;
  }
  if (operation.type === "update" && !Number.isFinite(operation.value)) return "Updated value must be a finite number.";
  if ((operation.type === "access" || operation.type === "delete" || operation.type === "update") && !validIndex(operation.index, values.length)) {
    return values.length ? `Index must be between 0 and ${values.length - 1}.` : "The array is empty.";
  }
  return null;
};

export const generateArrayTrace = (
  input: number[],
  operation: ArrayOperation,
  structure: "array" | "dynamic-array" = "array",
): DataStructureTrace => {
  const values = [...input];
  const steps: DataStructureTraceStep[] = [];
  let comparisons = 0;
  let mutations = 0;
  let result: number | null = null;
  const push = (next: number[], name: string, explanation: string, technical: string, active: number[], variables: Record<string, string>) => {
    steps.push(arrayStep(next, name, explanation, technical, active, variables, { comparisons, mutations }, steps.length));
  };
  const invalid = validateArrayOperation(values, operation);
  if (invalid) {
    push(values, "Invalid operation", invalid, "Validation failed; the state was not mutated.", [], {});
    return { structure, operation, steps, result, finalValues: values };
  }

  if (operation.type === "access") {
    result = values[operation.index] ?? null;
    push(values, `Access index ${operation.index}`, `Read the value at position ${operation.index}.`, `value = array[${operation.index}]`, [operation.index], { index: String(operation.index), value: String(result) });
  } else if (operation.type === "insert") {
    values.splice(operation.index, 0, operation.value);
    mutations += 1;
    push(values, `Insert ${operation.value}`, `Place ${operation.value} at index ${operation.index}; later values shift right.`, `${structure}.splice(${operation.index}, 0, ${operation.value})`, [operation.index], { index: String(operation.index), value: String(operation.value) });
  } else if (operation.type === "delete") {
    result = values[operation.index] ?? null;
    values.splice(operation.index, 1);
    mutations += 1;
    push(values, `Delete index ${operation.index}`, `Remove the value at index ${operation.index}; later values shift left.`, `const removed = ${structure}.splice(${operation.index}, 1)`, [Math.min(operation.index, values.length - 1)].filter((index) => index >= 0), { index: String(operation.index), removed: String(result) });
  } else if (operation.type === "update") {
    const previous = values[operation.index];
    values[operation.index] = operation.value;
    mutations += 1;
    push(values, `Update index ${operation.index}`, `Replace ${previous} with ${operation.value} at index ${operation.index}.`, `${structure}[${operation.index}] = ${operation.value}`, [operation.index], { index: String(operation.index), previous: String(previous), value: String(operation.value) });
  } else {
    for (let index = 0; index < values.length; index += 1) {
      comparisons += 1;
      const found = values[index] === operation.value;
      push(values, found ? `Found ${operation.value}` : `Compare index ${index}`, found ? `The value at index ${index} matches ${operation.value}.` : `Compare ${values[index]} with ${operation.value}, then continue right.`, `array[${index}] ${found ? "===" : "!=="} ${operation.value}`, [index], { index: String(index), current: String(values[index]), target: String(operation.value) });
      if (found) { result = index; break; }
    }
    if (result === null) push(values, "Value not found", `${operation.value} is not in the array.`, "Search exhausted the array and returns -1.", [], { target: String(operation.value) });
  }
  return { structure, operation, steps, result, finalValues: values };
};

export type SortingAlgorithmId = "bubble-sort" | "selection-sort" | "insertion-sort" | "merge-sort" | "quick-sort";

export interface SortingDefinition {
  id: SortingAlgorithmId;
  name: string;
  description: string;
  best: string;
  average: string;
  worst: string;
  space: string;
  stable: boolean;
}

export interface SortingStep {
  id: string;
  values: number[];
  operation: string;
  explanation: string;
  technicalExplanation: string;
  activeIndices: number[];
  sortedIndices: number[];
  variables: Record<string, string>;
  comparisons: number;
  swaps: number;
}

export const sortingAlgorithms: SortingDefinition[] = [
  { id: "bubble-sort", name: "Bubble Sort", description: "Repeatedly swap adjacent values that are out of order.", best: "O(n)", average: "O(n²)", worst: "O(n²)", space: "O(1)", stable: true },
  { id: "selection-sort", name: "Selection Sort", description: "Select the smallest remaining value and place it next.", best: "O(n²)", average: "O(n²)", worst: "O(n²)", space: "O(1)", stable: false },
  { id: "insertion-sort", name: "Insertion Sort", description: "Grow a sorted prefix by inserting each next value into place.", best: "O(n)", average: "O(n²)", worst: "O(n²)", space: "O(1)", stable: true },
  { id: "merge-sort", name: "Merge Sort", description: "Divide the array, sort each half, then merge the ordered halves.", best: "O(n log n)", average: "O(n log n)", worst: "O(n log n)", space: "O(n)", stable: true },
  { id: "quick-sort", name: "Quick Sort", description: "Partition around a pivot and recursively sort both sides.", best: "O(n log n)", average: "O(n log n)", worst: "O(n²)", space: "O(log n)", stable: false },
];

export const generateSortingSteps = (input: number[], algorithm: SortingAlgorithmId): SortingStep[] => {
  const values = [...input];
  const steps: SortingStep[] = [];
  const sorted = new Set<number>();
  let comparisons = 0;
  let swaps = 0;
  const push = (operation: string, explanation: string, technicalExplanation: string, activeIndices: number[], variables: Record<string, string>) => {
    steps.push({ id: `sort-step-${steps.length}`, values: [...values], operation, explanation, technicalExplanation, activeIndices, sortedIndices: [...sorted].sort((a, b) => a - b), variables, comparisons, swaps });
  };
  if (!values.length) { push("Empty input", "Add values to see the sorting process.", "The algorithm returns an empty array without performing comparisons.", [], {}); return steps; }

  if (algorithm === "bubble-sort") {
    for (let end = values.length - 1; end > 0; end -= 1) {
      let changed = false;
      for (let index = 0; index < end; index += 1) {
        comparisons += 1;
        if (values[index] > values[index + 1]) {
          [values[index], values[index + 1]] = [values[index + 1], values[index]]; swaps += 1; changed = true;
          push("Swap adjacent values", `${values[index]} moves before ${values[index + 1]} because the pair was out of order.`, `swap(values[${index}], values[${index + 1}])`, [index, index + 1], { index: String(index), end: String(end) });
        } else push("Compare adjacent values", `${values[index]} is already before ${values[index + 1]}.`, `values[${index}] <= values[${index + 1}]`, [index, index + 1], { index: String(index), end: String(end) });
      }
      sorted.add(end); push(`Finalize index ${end}`, `The largest remaining value has bubbled to index ${end}.`, `The suffix after index ${end - 1} is sorted.`, [end], { end: String(end) });
      if (!changed) break;
    }
  } else if (algorithm === "selection-sort") {
    for (let start = 0; start < values.length - 1; start += 1) {
      let minimum = start;
      for (let index = start + 1; index < values.length; index += 1) {
        comparisons += 1; push("Find minimum", `${values[index]} is compared with the current minimum.`, `if (values[${index}] < values[${minimum}]) minimum = ${index}`, [minimum, index], { start: String(start), minimum: String(minimum), index: String(index) });
        if (values[index] < values[minimum]) minimum = index;
      }
      if (minimum !== start) { [values[start], values[minimum]] = [values[minimum], values[start]]; swaps += 1; push("Place minimum", `Move the smallest remaining value into position ${start}.`, `swap(values[${start}], values[${minimum}])`, [start, minimum], { start: String(start), minimum: String(minimum) }); }
      sorted.add(start);
    }
  } else if (algorithm === "insertion-sort") {
    sorted.add(0);
    for (let index = 1; index < values.length; index += 1) {
      const value = values[index]; let cursor = index - 1;
      while (cursor >= 0) { comparisons += 1; push("Compare with sorted prefix", `${value} is compared with ${values[cursor]} in the sorted prefix.`, `while values[${cursor}] > key`, [cursor, cursor + 1], { cursor: String(cursor), key: String(value) }); if (values[cursor] <= value) break; values[cursor + 1] = values[cursor]; swaps += 1; cursor -= 1; }
      values[cursor + 1] = value; sorted.add(index); push("Insert into prefix", `Place ${value} into its sorted position.`, `values[${cursor + 1}] = key`, [cursor + 1], { position: String(cursor + 1), key: String(value) });
    }
  } else {
    const merge = (left: number, right: number) => {
      if (left >= right) return;
      const middle = Math.floor((left + right) / 2); merge(left, middle); merge(middle + 1, right);
      const copy = values.slice(left, right + 1); let first = 0; let second = middle - left + 1; let write = left;
      while (first <= middle - left && second <= right - left) { comparisons += 1; if (copy[first] <= copy[second]) values[write] = copy[first++]; else values[write] = copy[second++]; push("Merge values", `Choose the smaller front value for position ${write}.`, `write values[${write}] from the active half`, [write], { left: String(left), middle: String(middle), right: String(right) }); write += 1; }
      while (first <= middle - left) values[write++] = copy[first++]; while (second <= right - left) values[write++] = copy[second++];
      for (let index = left; index <= right; index += 1) sorted.add(index);
    };
    const partition = (left: number, right: number): number => { const pivot = values[right]; let store = left; for (let index = left; index < right; index += 1) { comparisons += 1; push("Compare with pivot", `${values[index]} is compared with pivot ${pivot}.`, `values[${index}] < pivot`, [index, right], { left: String(left), right: String(right), pivot: String(pivot) }); if (values[index] < pivot) { [values[index], values[store]] = [values[store], values[index]]; swaps += 1; store += 1; } } [values[store], values[right]] = [values[right], values[store]]; swaps += 1; push("Place pivot", `Place pivot ${pivot} between its smaller and larger values.`, `pivot moves to index ${store}`, [store], { pivot: String(pivot), position: String(store) }); return store; };
    if (algorithm === "merge-sort") merge(0, values.length - 1); else { const quick = (left: number, right: number) => { if (left >= right) return; const pivot = partition(left, right); quick(left, pivot - 1); quick(pivot + 1, right); }; quick(0, values.length - 1); }
  }
  values.forEach((_, index) => sorted.add(index));
  push("Sorted", "Every value is now in nondecreasing order.", "The algorithm has completed and returns the sorted array.", [], {});
  return steps;
};
