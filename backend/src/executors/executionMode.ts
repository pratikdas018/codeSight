import type {
  ExecutionModeSelection,
  SupportedLanguage,
  TraceStrategy,
} from "../types/execution";
import { languageExecutionConfigs } from "./languageConfigs";

interface SourceComplexityProfile {
  lineCount: number;
  charCount: number;
  loopCount: number;
  branchCount: number;
  recursionSignals: number;
  importCount: number;
  advancedConstructCount: number;
  asyncSignals: number;
  classCount: number;
  hasStdin: boolean;
  complexityScore: number;
}

export interface ExecutionModePlan {
  selection: ExecutionModeSelection;
  traceTimeoutMs: number;
  maxTraceSteps: number;
  profile: SourceComplexityProfile;
}

const countMatches = (value: string, matcher: RegExp) => {
  const matches = value.match(matcher);
  return matches ? matches.length : 0;
};

const analyzeSourceComplexity = (
  language: SupportedLanguage,
  code: string,
  stdin: string,
): SourceComplexityProfile => {
  const normalizedCode = code.replace(/\r\n/g, "\n");
  const lineCount = normalizedCode.split("\n").length;
  const charCount = normalizedCode.length;
  const loopCount = countMatches(
    normalizedCode,
    /\b(for|while|do)\b|for\s*\(|while\s*\(/g,
  );
  const branchCount = countMatches(
    normalizedCode,
    /\b(if|else if|switch|case|catch)\b/g,
  );
  const importCount = countMatches(
    normalizedCode,
    /\b(import|include|require|using|package)\b/g,
  );
  const asyncSignals = countMatches(
    normalizedCode,
    /\b(async|await|Promise|setTimeout|setInterval)\b/g,
  );
  const classCount = countMatches(
    normalizedCode,
    /\b(class|struct|interface)\b/g,
  );

  const recursionPatternsByLanguage: Record<SupportedLanguage, RegExp[]> = {
    javascript: [
      /function\s+([A-Za-z_]\w*)\s*\([^)]*\)\s*\{[\s\S]*?\b\1\s*\(/g,
      /const\s+([A-Za-z_]\w*)\s*=\s*\([^)]*\)\s*=>[\s\S]*?\b\1\s*\(/g,
    ],
    python: [
      /def\s+([A-Za-z_]\w*)\s*\([^)]*\):[\s\S]*?\b\1\s*\(/g,
    ],
    c: [
      /\b([A-Za-z_]\w*)\s*\([^;{}]*\)\s*\{[\s\S]*?\b\1\s*\(/g,
    ],
    cpp: [
      /\b([A-Za-z_]\w*)\s*\([^;{}]*\)\s*(?:const\s*)?\{[\s\S]*?\b\1\s*\(/g,
    ],
    java: [
      /\b(?:public|private|protected|static|final|\s)+\s*[A-Za-z_<>\[\]]+\s+([A-Za-z_]\w*)\s*\([^;{}]*\)\s*\{[\s\S]*?\b\1\s*\(/g,
    ],
  };

  const advancedPatternsByLanguage: Record<SupportedLanguage, RegExp> = {
    javascript: /\b(Map|Set|WeakMap|WeakSet|async|await|Promise|generator|yield|class|prototype)\b/g,
    python: /\b(defaultdict|deque|heapq|bisect|functools|dataclass|yield|async|await|networkx)\b/g,
    c: /\b(struct|typedef|malloc|calloc|realloc|free|fopen|fscanf|fprintf|qsort)\b/g,
    cpp: /\b(vector|map|set|unordered_map|unordered_set|priority_queue|deque|stack|queue|pair|tuple|sort|lower_bound|upper_bound|dfs|bfs|dijkstra|segment|trie)\b/g,
    java: /\b(ArrayList|HashMap|HashSet|PriorityQueue|Deque|LinkedList|Scanner|BufferedReader|StringBuilder|extends|implements)\b/g,
  };

  const recursionSignals = recursionPatternsByLanguage[language].reduce(
    (total, pattern) => total + countMatches(normalizedCode, pattern),
    0,
  );
  const advancedConstructCount = countMatches(
    normalizedCode,
    advancedPatternsByLanguage[language],
  );
  const hasStdin = stdin.trim().length > 0;

  const complexityScore =
    Math.min(6, Math.floor(lineCount / 40)) +
    Math.min(5, Math.floor(charCount / 1500)) +
    Math.min(5, loopCount) +
    Math.min(4, branchCount) +
    recursionSignals * 3 +
    Math.min(6, advancedConstructCount * 2) +
    asyncSignals * 2 +
    Math.min(3, importCount) +
    Math.min(3, classCount) +
    (hasStdin ? 1 : 0);

  return {
    lineCount,
    charCount,
    loopCount,
    branchCount,
    recursionSignals,
    importCount,
    advancedConstructCount,
    asyncSignals,
    classCount,
    hasStdin,
    complexityScore,
  };
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const buildSelection = (
  selected: ExecutionModeSelection["selected"],
  traceStrategy: TraceStrategy,
  reason: string,
): ExecutionModeSelection => ({
  selected,
  autoSelected: true,
  reason,
  traceStrategy,
});

export const createExecutionModePlan = (
  language: SupportedLanguage,
  code: string,
  stdin: string,
): ExecutionModePlan => {
  const profile = analyzeSourceComplexity(language, code, stdin);
  const baseTraceTimeoutMs = languageExecutionConfigs[language].traceTimeoutMs;

  if (language === "javascript") {
    if (profile.asyncSignals > 0 || /\bimport\s|\bexport\s/.test(code)) {
      return {
        selection: buildSelection(
          "safe",
          "skipped",
          "Safe mode selected because JavaScript async or module-heavy programs are executed normally but skipped for educational tracing.",
        ),
        traceTimeoutMs: baseTraceTimeoutMs,
        maxTraceSteps: 0,
        profile,
      };
    }

    if (profile.hasStdin) {
      return {
        selection: buildSelection(
          "safe",
          "skipped",
          "Safe mode selected because stdin-driven JavaScript programs run reliably, but the lightweight trace engine does not replay input safely yet.",
        ),
        traceTimeoutMs: baseTraceTimeoutMs,
        maxTraceSteps: 0,
        profile,
      };
    }

    if (profile.complexityScore <= 8 && profile.lineCount <= 90) {
      return {
        selection: buildSelection(
          "trace",
          "full",
          "Trace mode selected because the JavaScript program is small enough for full step-by-step visualization.",
        ),
        traceTimeoutMs: clamp(baseTraceTimeoutMs + profile.loopCount * 250, 4_000, 10_000),
        maxTraceSteps: 240,
        profile,
      };
    }

    return {
      selection: buildSelection(
        profile.complexityScore >= 16 ? "performance" : "safe",
        "skipped",
        "CodeSight prioritized reliable JavaScript execution over best-effort tracing because the program is too complex for the educational interpreter.",
      ),
      traceTimeoutMs: baseTraceTimeoutMs,
      maxTraceSteps: 0,
      profile,
    };
  }

  if (language === "python") {
    if (profile.complexityScore <= 9 && profile.lineCount <= 120) {
      return {
        selection: buildSelection(
          "trace",
          "full",
          "Trace mode selected because the Python program is a good fit for full runtime tracing.",
        ),
        traceTimeoutMs: clamp(baseTraceTimeoutMs + profile.recursionSignals * 1_000, 5_000, 15_000),
        maxTraceSteps: 450,
        profile,
      };
    }

    if (profile.complexityScore <= 17 && profile.lineCount <= 220) {
      return {
        selection: buildSelection(
          "safe",
          "best_effort",
          "Safe mode selected because the Python program may recurse deeply or manipulate larger structures, so tracing is capped to protect execution reliability.",
        ),
        traceTimeoutMs: clamp(baseTraceTimeoutMs + 2_000 + profile.loopCount * 250, 6_000, 16_000),
        maxTraceSteps: 180,
        profile,
      };
    }

    return {
      selection: buildSelection(
        "performance",
        "skipped",
        "Performance mode selected because the Python program is complex enough that tracing would be more likely to interfere with successful execution.",
      ),
      traceTimeoutMs: baseTraceTimeoutMs,
      maxTraceSteps: 0,
      profile,
    };
  }

  if (profile.complexityScore <= 7 && profile.lineCount <= 85 && profile.advancedConstructCount <= 1) {
    return {
      selection: buildSelection(
        "trace",
        "full",
        "Trace mode selected because the program is simple enough for a lightweight walkthrough after execution.",
      ),
      traceTimeoutMs: clamp(baseTraceTimeoutMs + profile.loopCount * 200, 4_000, 8_000),
      maxTraceSteps: 160,
      profile,
    };
  }

  if (profile.complexityScore <= 13 && profile.lineCount <= 160) {
    return {
      selection: buildSelection(
        "safe",
        "skipped",
        "Safe mode selected because the compiled-language walkthrough would be misleading for this program, so CodeSight is prioritizing compile and run correctness.",
      ),
      traceTimeoutMs: baseTraceTimeoutMs,
      maxTraceSteps: 0,
      profile,
    };
  }

  return {
    selection: buildSelection(
      "performance",
      "skipped",
      "Performance mode selected because the program is large or algorithmically dense, so CodeSight is focusing on reliable compilation and execution.",
    ),
    traceTimeoutMs: baseTraceTimeoutMs,
    maxTraceSteps: 0,
    profile,
  };
};
