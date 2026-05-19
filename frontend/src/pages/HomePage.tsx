import {
  type MouseEvent,
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import clsx from "clsx";
import { CodeSightLogo } from "../components/CodeSightLogo";
import { ExecutionVisualizer } from "../components/ExecutionVisualizer";
import { FeedbackPanel } from "../components/FeedbackPanel";
import { FooterBar } from "../components/FooterBar";
import { HelpPanel } from "../components/HelpPanel";
import { PlaybackDock } from "../components/PlaybackDock";
import { RuntimeManagerPanel } from "../components/RuntimeManagerPanel";
import { ToastViewport } from "../components/ToastViewport";
import { useAuth } from "../hooks/useAuth";
import { usePlayback } from "../hooks/usePlayback";
import {
  saveFeedbackRecord,
  type FeedbackCategory,
} from "../services/feedbackService";
import { createExecutionHistory, listExecutionHistory } from "../services/historyService";
import {
  createSnippet,
  deleteSnippet as deleteSnippetRecord,
  getSnippetById,
  listSnippets,
  updateSnippet,
} from "../services/snippetService";
import {
  executeCodeRequest,
  fetchRuntimeHealth,
  fetchRuntimeManager,
  type RuntimeManagerSnapshot,
} from "../utils/api";
import type { ExecutionStep, ExecutionTrace } from "../engine/types";
import { normalizeAuthEmail, validateEmailAddress } from "../utils/auth";
import type {
  CodeSnippet,
  ExecutionHistoryRecord,
  Notice,
  SupportedLanguage,
} from "../utils/types";
import {
  buildSuggestedFileName,
  inferLanguageFromPath,
  type MenuActionEvent,
  type RecentFileRecord,
} from "../utils/desktop";
import {
  formatDate,
  formatDuration,
  formatMemoryUsage,
} from "../utils/formatters";
import { createRendererLogger, logExecutionTrace } from "../utils/logger";
import { createVisualizationModel } from "../visualization/model";

const createClientLogId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createEmptyTrace = (language: SupportedLanguage): ExecutionTrace => ({
  executionId: createClientLogId(),
  traceId: createClientLogId(),
  startedAt: new Date().toISOString(),
  completedAt: null,
  steps: [],
  traceFrames: [],
  traceSummary: {
    available: false,
    frameCount: 0,
    quality: "empty",
    source: "uninitialized",
    status: "empty",
    message: "Run your program to generate a visualization timeline.",
    error: "",
  },
  output: "",
  outputLines: [],
  error: "",
  executionTime: 0,
  timedOut: false,
  language,
  status: "completed",
  failurePhase: null,
  phases: {
    compile: null,
    run: null,
    trace: null,
  },
  mode: {
    selected: "trace",
    autoSelected: true,
    reason: "CodeSight has not analyzed this program yet.",
    traceStrategy: "full",
  },
  limits: {
    queueConcurrency: 1,
    queueDepthLimit: 0,
    compileTimeoutMs: 0,
    runTimeoutMs: 0,
    traceTimeoutMs: 0,
    memoryLimitMb: 0,
    cpuLimit: 0,
    pidsLimit: 0,
  },
  metrics: {
    queueTimeMs: 0,
    executionTimeMs: 0,
    compileTimeMs: 0,
    runTimeMs: 0,
    peakMemoryBytes: null,
    peakMemoryKb: null,
  },
  diagnostics: [],
  logs: {
    system: [],
    entries: [],
  },
  stdin: {
    provided: false,
    lineCount: 0,
    charCount: 0,
    preview: "",
  },
});

const languageLabels: Record<SupportedLanguage, string> = {
  javascript: "JavaScript",
  python: "Python",
  c: "C",
  cpp: "C++",
  java: "Java",
};

const monacoLanguageMap: Record<SupportedLanguage, string> = {
  javascript: "javascript",
  python: "python",
  c: "c",
  cpp: "cpp",
  java: "java",
};

const languageFiles: Record<SupportedLanguage, string> = {
  javascript: "main.js",
  python: "main.py",
  c: "main.c",
  cpp: "main.cpp",
  java: "Main.java",
};

const languageRunLabels: Record<SupportedLanguage, string> = {
  javascript: "Node.js",
  python: "Python",
  c: "C",
  cpp: "C++",
  java: "Java",
};

type WorkspaceTab = "explorer" | "debugger" | "visualizer";
type ThemeMode = "noctis" | "graphite";
type FooterTone = "neutral" | "info" | "success" | "warning" | "error";
type SectionKey =
  | "guide"
  | "variables"
  | "memory"
  | "flow"
  | "library"
  | "account";

interface RuntimeHealthSnapshot {
  connection: "checking" | "online" | "offline";
  executorMode: "local" | "remote";
  executionProvider: string;
  runtimeManager: RuntimeManagerSnapshot | null;
}

const defaultRuntimeHealth: RuntimeHealthSnapshot = {
  connection: "checking",
  executorMode: "local",
  executionProvider: "local",
  runtimeManager: null,
};

const monacoThemeMap: Record<ThemeMode, string> = {
  noctis: "codesight-noctis",
  graphite: "codesight-graphite",
};

const railItems: Array<{
  label: string;
  section: SectionKey;
  tab: WorkspaceTab;
  icon: string;
}> = [
  {
    label: "Explorer",
    section: "guide",
    tab: "explorer",
    icon: "folder_open",
  },
  {
    label: "Visualizer",
    section: "flow",
    tab: "visualizer",
    icon: "insights",
  },
  {
    label: "History",
    section: "library",
    tab: "explorer",
    icon: "history",
  },
  {
    label: "Settings",
    section: "account",
    tab: "explorer",
    icon: "settings",
  },
];

const LANGUAGE_PRESETS: Record<
  SupportedLanguage,
  { title: string; code: string; headline: string; description: string }
> = {
  javascript: {
    title: "Square Accumulator",
    headline: "Trace JavaScript state line by line inside a focused workbench.",
    description:
      "Run code on the backend, scrub the execution timeline, and inspect variables as they change.",
    code: `function square(value) {
  const result = value * value;
  return result;
}

let total = 0;

for (let i = 1; i <= 3; i++) {
  total = total + square(i);
}

console.log("total", total);`,
  },
  python: {
    title: "Fibonacci Explorer",
    headline: "Watch Python execution unfold with variable snapshots and step playback.",
    description:
      "Use the editor, timeline, and memory view together to understand how each statement changes runtime state.",
    code: `def calculate_fibonacci(n):
    if n <= 1:
        return n
    else:
        return calculate_fibonacci(n - 1) + calculate_fibonacci(n - 2)


n_terms = 10
fib_sequence = []

for i in range(n_terms):
    fib_sequence.append(calculate_fibonacci(i))

print("Fibonacci Sequence:", fib_sequence)`,
  },
  c: {
    title: "Array Sum in C",
    headline: "Compile and inspect low-level programs in the same workspace.",
    description:
      "Use the same execution surface for compiled languages, with output capture and room for richer runtime views later.",
    code: `#include <stdio.h>

int main(void) {
    int values[] = {1, 2, 3, 4};
    int total = 0;

    for (int i = 0; i < 4; i++) {
        total += values[i];
    }

    printf("total %d\\n", total);
    return 0;
}`,
  },
  cpp: {
    title: "Vector Sum in C++",
    headline: "Run C++ safely and keep the same debugging rhythm.",
    description:
      "Switch languages without leaving the workbench, then inspect output, timing, and captured runtime context.",
    code: `#include <iostream>
#include <vector>

int main() {
    std::vector<int> values{1, 2, 3, 4};
    int total = 0;

    for (int value : values) {
        total += value;
    }

    std::cout << "total " << total << std::endl;
    return 0;
}`,
  },
  java: {
    title: "Java Loop Demo",
    headline: "Compile Java in a consistent visual debugger shell.",
    description:
      "Use one interface for editing, running, saving, and revisiting execution history across languages.",
    code: `public class Main {
    public static void main(String[] args) {
        int total = 0;

        for (int i = 1; i <= 4; i++) {
            total += i;
        }

        System.out.println("total " + total);
    }
}`,
  },
};

const summarizeOutput = (lines: string[]) => {
  if (lines.length === 0) {
    return "No console output yet.";
  }

  return lines[lines.length - 1];
};

const normalizeTracePayload = (incomingTrace: ExecutionTrace): ExecutionTrace => {
  const frames =
    incomingTrace.traceFrames?.length > 0
      ? incomingTrace.traceFrames
      : incomingTrace.steps ?? [];

  return {
    ...incomingTrace,
    steps: frames,
    traceFrames: frames,
    traceSummary: incomingTrace.traceSummary ?? {
      available: frames.length > 0,
      frameCount: frames.length,
      quality: frames.length > 0 ? "full" : "empty",
      source: "legacy-response",
      status: frames.length > 0 ? "ready" : "empty",
      message:
        frames.length > 0
          ? `Playback is ready with ${frames.length} execution frame${frames.length === 1 ? "" : "s"}.`
          : "Run your program to generate a visualization timeline.",
      error: "",
    },
  };
};

const buildPlainEnglishSummary = (lineText: string, language: SupportedLanguage) => {
  const trimmed = lineText.trim();

  if (!trimmed) {
    return `Press Run and CodeSight will explain the ${languageLabels[language]} code one executed line at a time.`;
  }

  if (
    trimmed.startsWith("for ") ||
    trimmed.startsWith("for(") ||
    trimmed.startsWith("while ") ||
    trimmed.startsWith("while(")
  ) {
    return "This line repeats a block of work. The program will come back here until the loop finishes.";
  }

  if (trimmed.startsWith("if ") || trimmed.startsWith("if(")) {
    return "This line checks a condition and decides which path the program should follow next.";
  }

  if (
    trimmed.includes("print(") ||
    trimmed.includes("console.log") ||
    trimmed.includes("printf(") ||
    trimmed.includes("System.out.println")
  ) {
    return "This line sends information to the output area so the user can see a result.";
  }

  if (trimmed.startsWith("return")) {
    return "This line sends a value back from the current function so the rest of the program can use it.";
  }

  if (
    trimmed.includes(".append(") ||
    trimmed.includes(".push(") ||
    trimmed.includes("add(")
  ) {
    return "This line adds a new item into a list or collection, so the stored data grows by one step.";
  }

  if (
    trimmed.startsWith("def ") ||
    trimmed.startsWith("function ") ||
    trimmed.includes(" main(")
  ) {
    return "This line defines a reusable block of code. Nothing runs here until the program calls it.";
  }

  if (trimmed.includes("=") && !trimmed.includes("==") && !trimmed.includes("!=")) {
    return "This line stores a value in memory or updates an existing variable.";
  }

  return "This line is part of the program flow. Use the highlighted variables and timeline to see its effect.";
};

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], .monaco-editor textarea',
    ),
  );

const getActiveFunctionName = (step: ExecutionStep | null) => {
  const activeCall = [...(step?.functionCalls ?? [])]
    .sort((left, right) => right.depth - left.depth)
    .find((call) => call.event === "active" || call.event === "enter");

  if (activeCall?.name) {
    return activeCall.name;
  }

  const frameName = step?.stack?.[0]?.name;

  if (frameName && frameName !== "global") {
    return frameName;
  }

  return "global scope";
};

const getStepLineNumber = (step: ExecutionStep | null) => {
  const candidate = step?.line ?? step?.lineNumber ?? 0;
  return candidate > 0 ? candidate : null;
};

interface HomePageProps {
  onGlobalNotice?: (notice: Notice) => void;
}

export const HomePage = ({ onGlobalNotice }: HomePageProps) => {
  const rendererLogger = useMemo(
    () => createRendererLogger("WORKBENCH"),
    [],
  );
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<WorkspaceTab>("explorer");
  const [activeRailSection, setActiveRailSection] =
    useState<SectionKey>("guide");
  const [focusMode, setFocusMode] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showProgramInput, setShowProgramInput] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "noctis";
    }

    return window.localStorage.getItem("codesight-theme") === "graphite"
      ? "graphite"
      : "noctis";
  });
  const [language, setLanguage] = useState<SupportedLanguage>("python");
  const [title, setTitle] = useState(LANGUAGE_PRESETS.python.title);
  const [code, setCode] = useState(LANGUAGE_PRESETS.python.code);
  const [programInput, setProgramInput] = useState("");
  const [trace, setTrace] = useState<ExecutionTrace>(createEmptyTrace("python"));
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [snippets, setSnippets] = useState<CodeSnippet[]>([]);
  const [history, setHistory] = useState<ExecutionHistoryRecord[]>([]);
  const [currentSnippetId, setCurrentSnippetId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionElapsedMs, setExecutionElapsedMs] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isManagingDesktopFiles, setIsManagingDesktopFiles] = useState(false);
  const [desktopFilePath, setDesktopFilePath] = useState<string | null>(null);
  const [desktopFileName, setDesktopFileName] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFileRecord[]>([]);
  const [runtimeHealth, setRuntimeHealth] =
    useState<RuntimeHealthSnapshot>(defaultRuntimeHealth);
  const [isRefreshingRuntimeManager, setIsRefreshingRuntimeManager] =
    useState(false);
  const { user, logout } = useAuth();
  const isDesktop = Boolean(window.electronAPI?.env.isElectron);

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef =
    useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const revealFrameRef = useRef<number | null>(null);
  const executionStartedAtRef = useRef<number | null>(null);
  const explanationNodeRef = useRef<HTMLDivElement | null>(null);
  const explanationPositionRef = useRef<Monaco.Position | null>(null);
  const explanationWidgetRef = useRef<Monaco.editor.IContentWidget | null>(null);
  const guideSectionRef = useRef<HTMLDivElement | null>(null);
  const variablesSectionRef = useRef<HTMLDivElement | null>(null);
  const memorySectionRef = useRef<HTMLDivElement | null>(null);
  const flowSectionRef = useRef<HTMLDivElement | null>(null);
  const librarySectionRef = useRef<HTMLDivElement | null>(null);
  const accountSectionRef = useRef<HTMLDivElement | null>(null);

  const stepDurationMs = Math.round(900 / playbackRate);
  const playbackFrames =
    trace.traceFrames.length > 0 ? trace.traceFrames : trace.steps;

  const { isPlaying, togglePlayback, stopPlayback, setIsPlaying } = usePlayback(
    playbackFrames.length,
    setCurrentStepIndex,
    stepDurationMs,
  );

  useEffect(() => {
    document.documentElement.dataset.codesightTheme = themeMode;
    window.localStorage.setItem("codesight-theme", themeMode);
    monacoRef.current?.editor.setTheme(monacoThemeMap[themeMode]);
  }, [themeMode]);

  useEffect(() => {
    if (!isExecuting || executionStartedAtRef.current === null) {
      return;
    }

    const timer = window.setInterval(() => {
      if (executionStartedAtRef.current === null) {
        return;
      }

      setExecutionElapsedMs(Date.now() - executionStartedAtRef.current);
    }, 120);

    return () => {
      window.clearInterval(timer);
    };
  }, [isExecuting]);

  useEffect(() => {
    let isMounted = true;

    const loadRuntimeHealth = async () => {
      try {
        const health = await fetchRuntimeHealth();

        if (!isMounted) {
          return;
        }

        setRuntimeHealth({
          connection: "online",
          executorMode: health.executorMode,
          executionProvider: health.executionProvider,
          runtimeManager: health.runtimeManager,
        });
      } catch {
        if (!isMounted) {
          return;
        }

        rendererLogger.debug("Runtime health polling failed.", {
          backendUrl: window.electronAPI?.env.backendUrl ?? "",
        });

        setRuntimeHealth((current) => ({
          ...current,
          connection: "offline",
        }));
      }
    };

    void loadRuntimeHealth();
    const poller = window.setInterval(() => {
      void loadRuntimeHealth();
    }, 30_000);

    return () => {
      isMounted = false;
      window.clearInterval(poller);
    };
  }, []);

  const refreshRuntimeManager = useEffectEvent(async () => {
    setIsRefreshingRuntimeManager(true);

    try {
      const runtimeManager = await fetchRuntimeManager({ refresh: true });
      setRuntimeHealth((current) => ({
        ...current,
        connection: "online",
        runtimeManager,
      }));
    } catch {
      setRuntimeHealth((current) => ({
        ...current,
        connection: "offline",
      }));
      rendererLogger.error(
        "Runtime Manager refresh failed in the renderer.",
        undefined,
        {
          backendUrl: window.electronAPI?.env.backendUrl ?? "",
        },
      );
      setNotice({
        tone: "error",
        message:
          "CodeSight could not refresh local runtime status. Make sure the embedded backend is still running.",
      });
    } finally {
      setIsRefreshingRuntimeManager(false);
    }
  });

  const activeStep = playbackFrames[currentStepIndex] ?? null;
  const previousStep =
    currentStepIndex > 0 ? playbackFrames[currentStepIndex - 1] ?? null : null;
  const activeLineNumber = getStepLineNumber(activeStep);
  const currentFunctionName = getActiveFunctionName(activeStep);
  const consoleOutput =
    activeStep?.stdout ??
    activeStep?.output ??
    (playbackFrames.length > 0
      ? playbackFrames[playbackFrames.length - 1]?.stdout ??
        playbackFrames[playbackFrames.length - 1]?.output ??
        trace.outputLines
      : trace.outputLines);
  const visualizationModel = useMemo(
    () => createVisualizationModel(activeStep, previousStep),
    [activeStep, previousStep],
  );

  const trackedVariables = useMemo(
    () =>
      [...visualizationModel.variables].sort((left, right) => {
        const leftScore =
          Number(left.change !== "unchanged") * 3 +
          Number(left.isComposite) * 2 +
          Number(left.isPointer);
        const rightScore =
          Number(right.change !== "unchanged") * 3 +
          Number(right.isComposite) * 2 +
          Number(right.isPointer);

        return rightScore - leftScore;
      }),
    [visualizationModel.variables],
  );

  const featuredVariables = trackedVariables.slice(0, 3);
  const changedVariables = trackedVariables.filter(
    (variable) => variable.change !== "unchanged",
  );
  const primaryArray = visualizationModel.arrays[0] ?? null;
  const stackFrames = playbackFrames
    .slice(Math.max(0, currentStepIndex - 2), currentStepIndex + 1)
    .reverse();
  const flowWindow = playbackFrames.slice(
    Math.max(0, currentStepIndex - 2),
    Math.min(playbackFrames.length, currentStepIndex + 3),
  );
  const timelineProgress =
    playbackFrames.length <= 1
      ? playbackFrames.length === 1
        ? 100
        : 0
      : (currentStepIndex / (playbackFrames.length - 1)) * 100;
  const deferredCode = useDeferredValue(code);
  const codeLines = useMemo(() => deferredCode.split(/\r?\n/), [deferredCode]);
  const activeLineCode =
    activeStep?.codeLine?.trim() ||
    (activeLineNumber
      ? codeLines[activeLineNumber - 1]?.trim() ?? ""
      : "");
  const plainEnglishSummary = buildPlainEnglishSummary(activeLineCode, language);
  const playbackSummary =
    activeStep?.explanation ??
    activeStep?.description ??
    (playbackFrames.length > 0
      ? "Step through the timeline to keep the editor and runtime panels in sync."
      : "Run your program to generate a guided execution story.");
  const changedVariableSummary =
    changedVariables.length > 0
      ? changedVariables
          .slice(0, 3)
          .map((variable) => `${variable.name} = ${variable.currentValue}`)
          .join(" | ")
      : playbackFrames.length === 0
        ? "No variables yet. Press Run to capture state changes."
        : "This step did not change any tracked variables.";
  const beginnerChecklist =
    playbackFrames.length === 0
      ? [
          "Paste code or use the starter example.",
          "Pick the correct language from the top bar.",
          "Press Run to create the execution story.",
        ]
      : [
          "Use Back, Play, and Next to move through the story.",
          "Read the plain-English explanation before looking at the raw code.",
          "Watch the variable cards to see what changed on this step.",
        ];

  const enrichSnippetsWithExecutionCounts = (
    snippetList: CodeSnippet[],
    historyList: ExecutionHistoryRecord[],
  ) => {
    const counts = historyList.reduce<Map<string, number>>((accumulator, entry) => {
      accumulator.set(
        entry.snippetId,
        (accumulator.get(entry.snippetId) ?? 0) + 1,
      );
      return accumulator;
    }, new Map<string, number>());

    return snippetList.map((snippet) => ({
      ...snippet,
      executionCount: counts.get(snippet.id) ?? 0,
    }));
  };

  const refreshWorkspaceData = async () => {
    if (!user) {
      setSnippets([]);
      setHistory([]);
      return;
    }

    setIsRefreshing(true);

    try {
      const [snippetList, historyList] = await Promise.all([
        listSnippets(user.id),
        listExecutionHistory(user.id),
      ]);

      setSnippets(enrichSnippetsWithExecutionCounts(snippetList, historyList));
      setHistory(historyList);
    } finally {
      setIsRefreshing(false);
    }
  };

  const refreshRecentFiles = async () => {
    if (!window.electronAPI) {
      return;
    }

    const nextRecentFiles = await window.electronAPI.getRecentFiles();
    setRecentFiles(nextRecentFiles);
  };

  const resetWorkspace = (nextLanguage: SupportedLanguage) => {
    setTrace(createEmptyTrace(nextLanguage));
    setCurrentStepIndex(0);
    setCurrentSnippetId(null);
    setActiveWorkspaceTab("explorer");
    setActiveRailSection("guide");
  };

  const applyEditorDocument = ({
    nextLanguage,
    nextTitle,
    nextCode,
    nextFilePath,
    nextFileName,
  }: {
    nextLanguage: SupportedLanguage;
    nextTitle: string;
    nextCode: string;
    nextFilePath: string | null;
    nextFileName: string | null;
  }) => {
    stopPlayback();
    setIsPlaying(false);

    startTransition(() => {
      setLanguage(nextLanguage);
      setTitle(nextTitle);
      setCode(nextCode);
      setDesktopFilePath(nextFilePath);
      setDesktopFileName(nextFileName);
      resetWorkspace(nextLanguage);
    });
  };

  const createNewDesktopFile = () => {
    applyEditorDocument({
      nextLanguage: language,
      nextTitle: "Untitled",
      nextCode: "",
      nextFilePath: null,
      nextFileName: null,
    });
    setNotice({
      tone: "success",
      message: "Started a new local file in the desktop workspace.",
    });
  };

  const openDesktopFile = async (filePath?: string) => {
    if (!window.electronAPI) {
      return;
    }

    setIsManagingDesktopFiles(true);

    try {
      const result = await window.electronAPI.openFile(filePath);

      if (result.canceled || typeof result.content !== "string") {
        return;
      }

      const resolvedPath = result.filePath ?? filePath ?? null;
      const resolvedName =
        result.name ??
        (resolvedPath ? resolvedPath.split(/[/\\]/).pop() ?? null : null);
      const nextLanguage = inferLanguageFromPath(
        resolvedPath ?? resolvedName ?? languageFiles[language],
      );
      const nextTitle =
        resolvedName?.replace(/\.[^.]+$/, "") || LANGUAGE_PRESETS[nextLanguage].title;

      applyEditorDocument({
        nextLanguage,
        nextTitle,
        nextCode: result.content,
        nextFilePath: resolvedPath,
        nextFileName: resolvedName,
      });
      await refreshRecentFiles();
      setNotice({
        tone: "success",
        message: `Loaded "${resolvedName ?? "local file"}" into the editor.`,
      });
    } catch (error) {
      rendererLogger.error("Desktop file open failed.", error, {
        requestedPath: filePath ?? "",
      });
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Unable to open the file.",
      });
    } finally {
      setIsManagingDesktopFiles(false);
    }
  };

  const saveDesktopFile = async () => {
    if (!window.electronAPI) {
      return;
    }

    setIsManagingDesktopFiles(true);

    try {
      const result = await window.electronAPI.saveFile({
        filePath: desktopFilePath,
        content: code,
        suggestedName: buildSuggestedFileName(title, language),
      });

      if (result.canceled) {
        return;
      }

      const nextFileName = result.name ?? desktopFileName ?? buildSuggestedFileName(title, language);
      setDesktopFilePath(result.filePath ?? desktopFilePath);
      setDesktopFileName(nextFileName);
      await refreshRecentFiles();
      setNotice({
        tone: "success",
        message: `Saved "${nextFileName}" to your device.`,
      });
    } catch (error) {
      rendererLogger.error("Desktop file save failed.", error, {
        filePath: desktopFilePath ?? "",
        language,
      });
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Unable to save the file.",
      });
    } finally {
      setIsManagingDesktopFiles(false);
    }
  };

  const saveDesktopSnippet = async () => {
    if (!window.electronAPI) {
      return;
    }

    setIsManagingDesktopFiles(true);

    try {
      const savedSnippet = await window.electronAPI.saveSnippetLocally({
        title: title.trim() || "Untitled snippet",
        language,
        code,
      });

      setNotice({
        tone: "success",
        message: `Saved "${savedSnippet.title}" as a local CodeSight snippet.`,
      });
    } catch (error) {
      rendererLogger.error("Local snippet save failed.", error, {
        language,
      });
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to save the local snippet.",
      });
    } finally {
      setIsManagingDesktopFiles(false);
    }
  };

  const openLocalDesktopSnippet = async () => {
    if (!window.electronAPI) {
      return;
    }

    setIsManagingDesktopFiles(true);

    try {
      const result = await window.electronAPI.openLocalSnippet();

      if (result.canceled || !result.snippet) {
        return;
      }

      applyEditorDocument({
        nextLanguage: result.snippet.language,
        nextTitle: result.snippet.title,
        nextCode: result.snippet.code,
        nextFilePath: result.filePath ?? result.snippet.filePath,
        nextFileName:
          (result.filePath ?? result.snippet.filePath).split(/[/\\]/).pop() ?? null,
      });
      setNotice({
        tone: "success",
        message: `Loaded local snippet "${result.snippet.title}".`,
      });
    } catch (error) {
      rendererLogger.error("Local snippet open failed.", error);
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load the local snippet.",
      });
    } finally {
      setIsManagingDesktopFiles(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setSnippets([]);
      setHistory([]);
      setCurrentSnippetId(null);
      return;
    }

    refreshWorkspaceData().catch((error) => {
      rendererLogger.error("Workspace data refresh failed.", error, {
        userId: user.id,
      });
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load account data.",
      });
    });
  }, [user]);

  const handleDesktopMenuAction = useEffectEvent((event: MenuActionEvent) => {
    switch (event.type) {
      case "file:new":
        createNewDesktopFile();
        return;
      case "file:open":
        void openDesktopFile();
        return;
      case "file:open-recent":
        if (event.filePath) {
          void openDesktopFile(event.filePath);
        }
        return;
      case "file:save":
        void saveDesktopFile();
        return;
      case "file:save-local-snippet":
        void saveDesktopSnippet();
        return;
      case "file:load-local-snippet":
        void openLocalDesktopSnippet();
        return;
      case "run:execute":
        void runCode();
        return;
    }
  });

  useEffect(() => {
    if (!window.electronAPI) {
      return;
    }

    refreshRecentFiles().catch(() => undefined);
    const unsubscribe = window.electronAPI.onMenuAction((event) => {
      handleDesktopMenuAction(event);
    });

    return unsubscribe;
  }, [handleDesktopMenuAction]);

  useEffect(() => {
    if (currentStepIndex >= playbackFrames.length && playbackFrames.length > 0) {
      setCurrentStepIndex(playbackFrames.length - 1);
    }
  }, [currentStepIndex, playbackFrames.length]);

  useEffect(() => {
    if (isExecuting) {
      return;
    }

    if (playbackFrames.length > 0) {
      rendererLogger.runtime("Playback frames initialized in the renderer.", {
        executionId: trace.executionId,
        traceId: trace.traceId,
        language: trace.language,
        frameCount: playbackFrames.length,
        traceStatus: trace.traceSummary.status,
        traceQuality: trace.traceSummary.quality,
      });
      return;
    }

    if (trace.status === "completed") {
      rendererLogger.warn("Execution completed without playback frames in the renderer.", {
        executionId: trace.executionId,
        traceId: trace.traceId,
        language: trace.language,
        traceStatus: trace.traceSummary.status,
        traceError: trace.traceSummary.error,
      });
    }
  }, [
    isExecuting,
    playbackFrames.length,
    rendererLogger,
    trace.executionId,
    trace.language,
    trace.status,
    trace.traceId,
    trace.traceSummary.error,
    trace.traceSummary.quality,
    trace.traceSummary.status,
  ]);

  const focusDiagnostic = useEffectEvent(
    (diagnostic: ExecutionTrace["diagnostics"][number]) => {
      if (!diagnostic.line) {
        return;
      }

      const editor = editorRef.current;
      const monaco = monacoRef.current;

      if (!editor || !monaco) {
        return;
      }

      const column = Math.max(1, diagnostic.column ?? 1);
      editor.focus();
      editor.setPosition({ lineNumber: diagnostic.line, column });
      editor.revealPositionInCenter(
        { lineNumber: diagnostic.line, column },
        monaco.editor.ScrollType.Smooth,
      );
    },
  );

  const syncEditorToLine = useEffectEvent((lineNumber: number, column = 1) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (!editor || !monaco || lineNumber < 1) {
      return;
    }

    if (typeof revealFrameRef.current === "number") {
      window.cancelAnimationFrame(revealFrameRef.current);
    }

    revealFrameRef.current = window.requestAnimationFrame(() => {
      const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
      const editorHeight = editor.getLayoutInfo().height;
      const targetTop = Math.max(
        0,
        editor.getTopForLineNumber(lineNumber) -
          editorHeight / 2 +
          lineHeight / 2,
      );

      editor.setScrollTop(targetTop, monaco.editor.ScrollType.Smooth);
      editor.revealPositionInCenter(
        {
          lineNumber,
          column: Math.max(1, column),
        },
        monaco.editor.ScrollType.Smooth,
      );
      editor.setPosition({
        lineNumber,
        column: Math.max(1, column),
      });
      revealFrameRef.current = null;
    });
  });

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    decorationsRef.current = editor.createDecorationsCollection([]);
    explanationNodeRef.current = document.createElement("div");

    monaco.editor.defineTheme("codesight-noctis", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "5F7562", fontStyle: "italic" },
        { token: "keyword", foreground: "72FF70" },
        { token: "string", foreground: "B6FFD0" },
        { token: "number", foreground: "9EF58A" },
        { token: "type.identifier", foreground: "D9FFE2" },
      ],
      colors: {
        "editor.background": "#090c09",
        "editorGutter.background": "#090c09",
        "editorLineNumber.foreground": "#4F6353",
        "editorLineNumber.activeForeground": "#E7FFE8",
        "editor.selectionBackground": "#17331C",
        "editor.inactiveSelectionBackground": "#101A12",
        "editor.lineHighlightBackground": "#0F140F",
        "editorCursor.foreground": "#72FF70",
        "editorIndentGuide.background1": "#17221A",
        "editorIndentGuide.activeBackground1": "#28432F",
      },
    });
    monaco.editor.defineTheme("codesight-graphite", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6E8171", fontStyle: "italic" },
        { token: "keyword", foreground: "7CFF7A" },
        { token: "string", foreground: "C6FFD9" },
        { token: "number", foreground: "AFF599" },
        { token: "type.identifier", foreground: "F0FFF0" },
      ],
      colors: {
        "editor.background": "#0b0f0b",
        "editorGutter.background": "#0b0f0b",
        "editorLineNumber.foreground": "#5B6C5F",
        "editorLineNumber.activeForeground": "#ECFFE9",
        "editor.selectionBackground": "#1A2B1E",
        "editor.inactiveSelectionBackground": "#131813",
        "editor.lineHighlightBackground": "#101510",
        "editorCursor.foreground": "#8DFF8A",
        "editorIndentGuide.background1": "#1A221B",
        "editorIndentGuide.activeBackground1": "#33553B",
      },
    });
    monaco.editor.setTheme(monacoThemeMap[themeMode]);

    explanationWidgetRef.current = {
      getId: () => "codesight-explanation-widget",
      getDomNode: () => explanationNodeRef.current as HTMLDivElement,
      getPosition: () =>
        explanationPositionRef.current
          ? {
              position: explanationPositionRef.current,
              preference: [
                monaco.editor.ContentWidgetPositionPreference.ABOVE,
                monaco.editor.ContentWidgetPositionPreference.BELOW,
              ],
            }
          : null,
    };

    editor.addContentWidget(
      explanationWidgetRef.current as Monaco.editor.IContentWidget,
    );
  };

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (!editor || !monaco || !decorationsRef.current) {
      return;
    }

    if (!activeLineNumber) {
      decorationsRef.current.set([]);
      return;
    }

    decorationsRef.current.set([
      {
        range: new monaco.Range(activeLineNumber, 1, activeLineNumber, 1),
        options: {
          isWholeLine: true,
          className: "current-execution-line",
          linesDecorationsClassName: "current-execution-gutter",
        },
      },
    ]);
    syncEditorToLine(activeLineNumber);
  }, [activeLineNumber, currentStepIndex, syncEditorToLine]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const explanationNode = explanationNodeRef.current;
    const explanationWidget = explanationWidgetRef.current;

    if (!editor || !monaco || !explanationNode || !explanationWidget) {
      return;
    }

    if (!activeLineNumber || !activeStep.explanation) {
      explanationNode.style.display = "none";
      explanationPositionRef.current = null;
      editor.layoutContentWidget(explanationWidget);
      return;
    }

    explanationNode.style.display = "block";
    explanationNode.className = clsx(
      "codesight-explanation-widget",
      focusMode ? "codesight-explanation-widget-focus" : "",
    );

    const titleNode = document.createElement("p");
    titleNode.className = "codesight-explanation-title";
    titleNode.textContent = `Line ${activeLineNumber}`;

    const bodyNode = document.createElement("p");
    bodyNode.className = "codesight-explanation-body";
    bodyNode.textContent = activeStep.explanation;

    explanationNode.replaceChildren(titleNode, bodyNode);
    explanationPositionRef.current = new monaco.Position(activeLineNumber, 1);
    editor.layoutContentWidget(explanationWidget);
    syncEditorToLine(activeLineNumber);
  }, [activeLineNumber, activeStep?.explanation, currentStepIndex, focusMode, syncEditorToLine]);

  useEffect(
    () => () => {
      if (typeof revealFrameRef.current === "number") {
        window.cancelAnimationFrame(revealFrameRef.current);
      }

      if (editorRef.current && explanationWidgetRef.current) {
        editorRef.current.removeContentWidget(explanationWidgetRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();

    if (!editor || !monaco || !model) {
      return;
    }

    const markers = trace.diagnostics
      .filter((diagnostic) => typeof diagnostic.line === "number")
      .map((diagnostic) => ({
        startLineNumber: Math.max(1, diagnostic.line ?? 1),
        startColumn: Math.max(1, diagnostic.column ?? 1),
        endLineNumber: Math.max(
          1,
          diagnostic.endLine ?? diagnostic.line ?? 1,
        ),
        endColumn: Math.max(
          2,
          diagnostic.endColumn ??
            (diagnostic.column ?? 1) + 1,
        ),
        severity:
          diagnostic.severity === "warning"
            ? monaco.MarkerSeverity.Warning
            : diagnostic.severity === "info"
              ? monaco.MarkerSeverity.Info
              : monaco.MarkerSeverity.Error,
        source: diagnostic.source,
        code: diagnostic.code,
        message: [diagnostic.summary, diagnostic.detail]
          .filter(Boolean)
          .join("\n\n"),
      }));

    monaco.editor.setModelMarkers(model, "codesight-runtime", markers);

    return () => {
      monaco.editor.setModelMarkers(model, "codesight-runtime", []);
    };
  }, [language, trace.diagnostics]);

  const runCode = async () => {
    stopPlayback();
    executionStartedAtRef.current = Date.now();
    setExecutionElapsedMs(0);
    setIsExecuting(true);

    try {
      const rawTrace = await executeCodeRequest(code, language, programInput);
      const nextTrace = normalizeTracePayload(rawTrace);
      logExecutionTrace(nextTrace, {
        trigger: "runCode",
      });
      setTrace(nextTrace);
      setExecutionElapsedMs(nextTrace.executionTime);
      setRuntimeHealth((current) => ({
        ...current,
        connection: "online",
      }));
      setCurrentStepIndex(0);
      setIsPlaying(false);
      const nextPlaybackFrames =
        nextTrace.traceFrames.length > 0 ? nextTrace.traceFrames : nextTrace.steps;

      setActiveWorkspaceTab(nextPlaybackFrames.length > 0 ? "debugger" : "explorer");
      setActiveRailSection(nextPlaybackFrames.length > 0 ? "variables" : "guide");

      if (nextTrace.status !== "completed") {
        const primaryDiagnostic = nextTrace.diagnostics[0];
        const timeoutHint =
          nextTrace.timedOut && !programInput.trim()
            ? " If your program expects input, add it in the Program Input box before running again."
            : "";
        setNotice({
          tone: "error",
          message: `${languageLabels[language]} ${nextTrace.status.replace(/_/g, " ")} in ${nextTrace.executionTime}ms. ${((primaryDiagnostic?.summary ?? nextTrace.error) || "Execution failed.")}${timeoutHint}`,
        });
        if (primaryDiagnostic?.line) {
          focusDiagnostic(primaryDiagnostic);
        }

        if (nextTrace.status === "runtime_missing") {
          void refreshRuntimeManager();
        }
      } else {
        setNotice({
          tone: "success",
          message:
            nextPlaybackFrames.length > 0
              ? nextTrace.traceSummary.status === "fallback"
                ? `${languageLabels[language]} execution completed in ${nextTrace.executionTime}ms with ${nextPlaybackFrames.length} fallback frames. ${nextTrace.traceSummary.error || nextTrace.traceSummary.message}`
                : `${languageLabels[language]} execution completed in ${nextTrace.executionTime}ms with ${nextPlaybackFrames.length} frames.`
              : `${languageLabels[language]} execution completed in ${nextTrace.executionTime}ms.`,
        });
      }

      if (!user || !currentSnippetId) {
        return;
      }

      try {
        await createExecutionHistory({
          userId: user.id,
          snippetId: currentSnippetId,
          output:
            nextTrace.output ||
            nextTrace.outputLines.join("\n") ||
            undefined,
          executionTime: nextTrace.executionTime,
        });
        await refreshWorkspaceData();
      } catch (error) {
        rendererLogger.error(
          "Execution history persistence failed after a completed run.",
          error,
          {
            snippetId: currentSnippetId,
            language,
          },
        );
        setNotice({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Execution ran, but history could not be saved.",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to execute code.";
      rendererLogger.error("Run request failed in the renderer.", error, {
        language,
        hasProgramInput: Boolean(programInput.trim()),
      });

      setTrace({
        ...createEmptyTrace(language),
        error: message,
      });
      setExecutionElapsedMs(0);
      if (/fetch|network|backend request failed/i.test(message)) {
        setRuntimeHealth((current) => ({
          ...current,
          connection: "offline",
        }));
      }
      setNotice({
        tone: "error",
        message,
      });
    } finally {
      executionStartedAtRef.current = null;
      setIsExecuting(false);
    }
  };

  const saveCode = async () => {
    if (!user) {
      setNotice({
        tone: "error",
        message: "Your session expired. Log in again to save snippets.",
      });
      return;
    }

    setIsSaving(true);

    try {
      const snippetPayload = {
        userId: user.id,
        title: title.trim() || "Untitled snippet",
        language,
        code,
      };
      const savedSnippet = currentSnippetId
        ? await updateSnippet(currentSnippetId, snippetPayload)
        : await createSnippet(snippetPayload);

      setCurrentSnippetId(savedSnippet.id);
      setTitle(savedSnippet.title);
      await refreshWorkspaceData();
      setNotice({
        tone: "success",
        message: `${currentSnippetId ? "Updated" : "Saved"} "${savedSnippet.title}" to your dashboard.`,
      });
    } catch (error) {
      rendererLogger.error("Cloud snippet save failed.", error, {
        currentSnippetId: currentSnippetId ?? "",
        language,
      });
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to save code.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const loadSnippet = async (snippetId: string) => {
    if (!user) {
      return;
    }

    try {
      const snippet = await getSnippetById(snippetId, user.id);
      stopPlayback();
      setLanguage(snippet.language);
      setCurrentSnippetId(snippet.id);
      setTitle(snippet.title);
      setCode(snippet.code);
      setDesktopFilePath(null);
      setDesktopFileName(null);
      setTrace(createEmptyTrace(snippet.language));
      setCurrentStepIndex(0);
      setNotice({
        tone: "success",
        message: `Loaded "${snippet.title}" into the editor.`,
      });
    } catch (error) {
      rendererLogger.error("Snippet load failed.", error, {
        snippetId,
      });
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Unable to load snippet.",
      });
    }
  };

  const deleteSnippet = async (snippetId: string, snippetTitle: string) => {
    if (!user) {
      return;
    }

    try {
      await deleteSnippetRecord(snippetId, user.id);
      if (currentSnippetId === snippetId) {
        setCurrentSnippetId(null);
      }
      await refreshWorkspaceData();
      setNotice({
        tone: "success",
        message: `Deleted "${snippetTitle}" from your library.`,
      });
    } catch (error) {
      rendererLogger.error("Snippet delete failed.", error, {
        snippetId,
      });
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Unable to delete snippet.",
      });
    }
  };

  const handleLanguageChange = (nextLanguage: SupportedLanguage) => {
    stopPlayback();
    setIsPlaying(false);
    setLanguage(nextLanguage);
    setTitle(LANGUAGE_PRESETS[nextLanguage].title);
    setCode(LANGUAGE_PRESETS[nextLanguage].code);
    setDesktopFilePath(null);
    setDesktopFileName(null);
    setTrace(createEmptyTrace(nextLanguage));
    setCurrentStepIndex(0);
    setCurrentSnippetId(null);
    setNotice({
      tone: "success",
      message: `Switched to ${languageLabels[nextLanguage]} mode.`,
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
      onGlobalNotice?.({
        tone: "success",
        message: "Signed out of your Supabase session.",
      });
    } catch (error) {
      rendererLogger.error("Logout failed.", error);
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to log out.",
      });
    }
  };

  const handleTimelineClick = (event: MouseEvent<HTMLDivElement>) => {
    if (playbackFrames.length === 0) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const nextIndex = Math.round(ratio * Math.max(playbackFrames.length - 1, 0));
    setIsHelpOpen(false);
    setIsFeedbackOpen(false);
    stopPlayback();
    setActiveWorkspaceTab("visualizer");
    setActiveRailSection("flow");
    setCurrentStepIndex(nextIndex);
  };

  const scrollToSection = (section: SectionKey, tab: WorkspaceTab) => {
    setIsHelpOpen(false);
    setIsFeedbackOpen(false);
    setActiveWorkspaceTab(tab);
    setActiveRailSection(section);
  };

  const openHelpPanel = () => {
    setIsFeedbackOpen(false);
    setIsHelpOpen(true);
  };

  const openFeedbackPanel = () => {
    setIsHelpOpen(false);
    setIsFeedbackOpen(true);
  };

  const closeWorkspacePanels = () => {
    setIsHelpOpen(false);
    setIsFeedbackOpen(false);
  };

  const jumpToPlaybackIndex = (
    nextIndex: number,
    tab: WorkspaceTab = "visualizer",
    section: SectionKey = "flow",
  ) => {
    closeWorkspacePanels();
    stopPlayback();
    setActiveWorkspaceTab(tab);
    setActiveRailSection(section);
    setCurrentStepIndex(
      Math.max(0, Math.min(nextIndex, Math.max(playbackFrames.length - 1, 0))),
    );
  };

  const handlePrevious = () => {
    if (playbackFrames.length === 0) {
      return;
    }

    jumpToPlaybackIndex(currentStepIndex - 1, "debugger", "variables");
  };

  const handleNext = () => {
    if (playbackFrames.length === 0) {
      return;
    }

    jumpToPlaybackIndex(currentStepIndex + 1, "debugger", "variables");
  };

  const handleReset = () => {
    closeWorkspacePanels();
    stopPlayback();
    setActiveWorkspaceTab("explorer");
    setActiveRailSection("guide");
    setCurrentStepIndex(0);
  };

  const handleTogglePlayback = () => {
    if (playbackFrames.length === 0) {
      return;
    }

    closeWorkspacePanels();
    setActiveWorkspaceTab("visualizer");
    setActiveRailSection("flow");

    if (!isPlaying && currentStepIndex >= playbackFrames.length - 1) {
      setCurrentStepIndex(0);
    }

    togglePlayback();
  };

  const loadStarterExample = () => {
    stopPlayback();
    setTitle(LANGUAGE_PRESETS[language].title);
    setCode(LANGUAGE_PRESETS[language].code);
    setDesktopFilePath(null);
    setDesktopFileName(null);
    setTrace(createEmptyTrace(language));
    setCurrentStepIndex(0);
    setCurrentSnippetId(null);
    setActiveWorkspaceTab("explorer");
    setActiveRailSection("guide");
    setNotice({
      tone: "success",
      message: `Loaded a beginner-friendly ${languageLabels[language]} example.`,
    });
  };

  const focusEditorForPaste = () => {
    editorRef.current?.focus();
    setNotice({
      tone: "success",
      message: "Paste your code into the editor, then press Run to see each line execute.",
    });
  };

  const handleExport = () => {
    const payload = {
      title,
      language,
      trace,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `codesight-${language}-trace.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleFeedbackSubmit = async ({
    category,
    email,
    message,
  }: {
    category: FeedbackCategory;
    email: string;
    message: string;
  }) => {
    const normalizedEmail = normalizeAuthEmail(email);
    const emailError = validateEmailAddress(normalizedEmail);

    if (emailError) {
      setNotice({
        tone: "error",
        message: emailError,
      });
      return;
    }

    if (!message.trim()) {
      setNotice({
        tone: "error",
        message: "Add a few details so the feedback is actionable.",
      });
      return;
    }

    setIsSubmittingFeedback(true);

    try {
      saveFeedbackRecord({
        category,
        email: normalizedEmail,
        message: message.trim(),
        context: {
          appVersion: isDesktop
            ? window.electronAPI?.env.version ?? "1.0.0"
            : "web-preview",
          currentLine: activeLineNumber,
          environment: isDesktop ? "desktop" : "web",
          language,
          stepCount: playbackFrames.length,
          traceStatus: trace.status,
          userId: user?.id ?? null,
        },
      });
      setIsFeedbackOpen(false);
      setNotice({
        tone: "success",
        message:
          "Feedback saved locally. Thanks for helping improve CodeSight.",
      });
    } catch (error) {
      rendererLogger.error("Feedback persistence failed.", error, {
        category,
        language,
      });
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to save feedback locally.",
      });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (isHelpOpen || isFeedbackOpen)) {
        event.preventDefault();
        closeWorkspacePanels();
        return;
      }

      if (isHelpOpen || isFeedbackOpen) {
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        if (isDesktop) {
          void saveDesktopFile();
        } else {
          void saveCode();
        }
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        handleTogglePlayback();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNext();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePrevious();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    handleNext,
    handlePrevious,
    handleTogglePlayback,
    isDesktop,
    isFeedbackOpen,
    isHelpOpen,
    saveCode,
    saveDesktopFile,
  ]);

  const primaryStatus = activeStep?.description ?? LANGUAGE_PRESETS[language].headline;
  const secondaryStatus =
    activeStep?.explanation ??
    (playbackFrames.length === 0
      ? LANGUAGE_PRESETS[language].description
      : "Use the timeline to move through the captured execution state.");
  const activeSidebarLabel =
    railItems.find((item) => item.section === activeRailSection)?.label ?? "Explorer";
  const installedRuntimeCount = runtimeHealth.runtimeManager?.installedCount ?? 0;
  const totalRuntimeCount = runtimeHealth.runtimeManager?.items.length ?? 5;
  const missingRuntimeCount =
    runtimeHealth.runtimeManager?.missingCount ??
    Math.max(0, totalRuntimeCount - installedRuntimeCount);
  const runStateLabel = isExecuting
    ? "Execution running"
    : trace.status === "compile_error"
      ? "Compilation failed"
      : trace.status === "runtime_missing"
        ? "Required runtime missing"
      : trace.status === "runtime_error"
        ? "Runtime failed"
        : trace.status === "memory_limit"
          ? "Memory limit exceeded"
          : trace.status === "trace_failure"
            ? "Trace generation failed"
        : trace.status === "timed_out"
          ? "Execution timed out"
          : playbackFrames.length > 0 || trace.outputLines.length > 0
            ? "Trace captured"
            : "Workbench idle";
  const runStateDetail = isExecuting
    ? "Compiling and running with locally installed tools."
    : (trace.traceSummary.error ||
      trace.diagnostics[0]?.summary) ??
      (trace.error
        ? trace.error
        : trace.traceSummary.message && trace.traceSummary.status !== "empty"
          ? trace.traceSummary.message
        : playbackFrames.length > 0
          ? `${playbackFrames.length} timeline frames ready for playback.`
          : "Choose a language, edit code, and capture a fresh execution trace.");
  const featuredOutput = consoleOutput.slice(-5);
  const historyPreview = history.slice(0, 5);
  const accountInitial = user?.email?.slice(0, 1).toUpperCase() ?? "G";
  const conciseVariables = trackedVariables.slice(0, 8);
  const compactFlowSteps = flowWindow.slice(0, 4);
  const changedArrayItems = primaryArray?.items.filter((item) => item.changed).slice(0, 6) ?? [];
  const insightMode =
    activeRailSection === "library"
      ? "history"
      : activeRailSection === "account"
        ? "settings"
      : activeRailSection === "flow"
        ? "visualizer"
        : "learning";
  const footerExecutionTone: FooterTone = isExecuting
    ? "info"
    : trace.status === "completed"
      ? "success"
    : trace.status === "compile_error"
      ? "warning"
      : trace.status === "runtime_missing" ||
          trace.status === "runtime_error" ||
          trace.status === "memory_limit" ||
          trace.status === "trace_failure" ||
          trace.status === "timed_out" ||
          trace.status === "internal_error"
        ? "error"
        : "neutral";
  const footerExecutionLabel = isExecuting
    ? `Running ${languageLabels[language]}...`
    : trace.status === "compile_error"
      ? `${languageLabels[language]} Compile Error`
      : trace.status === "runtime_missing"
        ? "Runtime Missing"
      : trace.status === "runtime_error"
        ? `${languageLabels[language]} Runtime Error`
        : trace.status === "memory_limit"
          ? `${languageLabels[language]} Memory Limit`
          : trace.status === "trace_failure"
            ? `${languageLabels[language]} Trace Failure`
        : trace.status === "timed_out"
          ? `${languageLabels[language]} Timed Out`
          : trace.status === "internal_error"
            ? "Execution Error"
            : "Ready";
  const runtimeLabel =
    runtimeHealth.connection === "offline"
      ? "Runtime Offline"
      : runtimeHealth.connection === "checking"
        ? "Checking Runtimes"
        : missingRuntimeCount > 0
          ? `Missing ${missingRuntimeCount}/${totalRuntimeCount} Runtimes`
          : `Local Runtime ${installedRuntimeCount}/${totalRuntimeCount}`;
  const runtimeTone: FooterTone =
    runtimeHealth.connection === "offline"
      ? "error"
      : runtimeHealth.connection === "checking"
        ? "info"
        : missingRuntimeCount > 0
          ? "warning"
          : "success";
  const runtimeIcon =
    runtimeHealth.connection === "offline"
      ? "cloud_off"
      : runtimeHealth.connection === "checking"
        ? "hourglass_top"
        : missingRuntimeCount > 0
          ? "warning"
          : "terminal";
  const footerExecutionTime = isExecuting
    ? `${Math.max(0, executionElapsedMs)}ms`
    : formatDuration(trace.executionTime);
  const footerMemoryUsage = formatMemoryUsage(trace.metrics.peakMemoryKb);
  const footerCurrentLine = activeLineNumber ? `Line ${activeLineNumber}` : "Line --";
  const appVersionLabel = isDesktop
    ? `v${window.electronAPI?.env.version ?? "1.0.0"}`
    : "Web Preview";

  return (
    <main className="min-h-screen bg-[var(--cs-bg)] text-[var(--cs-text)]">
      <header className="sticky top-0 z-50 border-b border-[var(--cs-border)] bg-[rgba(6,9,6,0.9)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1900px] items-center justify-between gap-4 px-3 py-3 sm:px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3 lg:gap-6">
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)] transition hover:border-[var(--cs-border-strong)] hover:text-[var(--cs-text)]"
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isSidebarCollapsed ? "right_panel_open" : "left_panel_close"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("guide", "explorer")}
              className="min-w-0 text-left"
            >
              <CodeSightLogo compact />
            </button>

            <div className="hidden items-center gap-2 rounded-[1.1rem] border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-1 md:flex">
              <button
                type="button"
                onClick={() => scrollToSection("guide", "explorer")}
                className={clsx(
                  "rounded-[0.9rem] px-4 py-2 text-sm transition",
                  activeRailSection === "guide"
                    ? "bg-[rgba(114,255,112,0.12)] text-[var(--cs-primary-bright)] shadow-[0_0_18px_rgba(114,255,112,0.08)]"
                    : "text-[var(--cs-text-muted)] hover:text-[var(--cs-text)]",
                )}
              >
                Explorer
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("flow", "visualizer")}
                className={clsx(
                  "rounded-[0.9rem] px-4 py-2 text-sm transition",
                  activeRailSection === "flow"
                    ? "bg-[rgba(114,255,112,0.12)] text-[var(--cs-primary-bright)] shadow-[0_0_18px_rgba(114,255,112,0.08)]"
                    : "text-[var(--cs-text-muted)] hover:text-[var(--cs-text)]",
                )}
              >
                Debugger
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("library", "explorer")}
                className={clsx(
                  "rounded-[0.9rem] px-4 py-2 text-sm transition",
                  activeRailSection === "library"
                    ? "bg-[rgba(114,255,112,0.12)] text-[var(--cs-primary-bright)] shadow-[0_0_18px_rgba(114,255,112,0.08)]"
                    : "text-[var(--cs-text-muted)] hover:text-[var(--cs-text)]",
                )}
              >
                Terminal
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="hidden items-center gap-2 rounded-xl border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-sm text-[var(--cs-text-muted)] md:flex">
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">Runtime</span>
              <select
                value={language}
                onChange={(event) => handleLanguageChange(event.target.value as SupportedLanguage)}
                className="bg-transparent text-sm text-[var(--cs-text)] outline-none"
              >
                {Object.entries(languageLabels).map(([value, label]) => (
                  <option key={value} value={value} className="bg-[#0b0f0b] text-[var(--cs-text)]">
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={handleExport}
              className="cs-button h-10 rounded-xl px-3"
            >
              Export
            </button>
            <button
              type="button"
              onClick={() => {
                void saveCode();
              }}
              disabled={isSaving}
              className="cs-button h-10 rounded-xl px-3 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                void runCode();
              }}
              disabled={isExecuting}
              className="cs-button cs-button-primary h-10 rounded-xl px-4 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
              {isExecuting ? "Running..." : "Run trace"}
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("account", "explorer")}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-sm font-semibold text-[var(--cs-text)] transition hover:border-[var(--cs-border-strong)]"
            >
              {accountInitial}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1900px] px-3 pb-48 pt-4 sm:px-4 lg:px-6">
        <div
          className={clsx(
            "grid gap-4",
            playbackFrames.length > 0
              ? "xl:grid-cols-[auto,minmax(0,1fr),clamp(25rem,31vw,36rem)]"
              : "xl:grid-cols-[auto,minmax(0,1fr),clamp(22rem,26vw,29rem)]",
          )}
        >
          <aside
            className={clsx(
              "cs-panel cs-panel-strong flex h-fit flex-row gap-2 p-2 xl:min-h-[calc(100vh-11rem)] xl:flex-col xl:justify-between",
              isSidebarCollapsed ? "xl:w-[76px]" : "xl:w-[210px]",
            )}
          >
            <div className="flex min-w-0 flex-1 flex-row gap-2 xl:flex-col">
              {!isSidebarCollapsed ? (
                <div className="hidden rounded-[1.35rem] border border-[var(--cs-border)] bg-[linear-gradient(180deg,rgba(17,20,17,0.95),rgba(10,12,10,0.96))] p-4 xl:block">
                  <div className="flex items-center gap-3">
                    <CodeSightLogo iconOnly compact />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[var(--cs-text)]">
                        {title || "Project Alpha"}
                      </div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
                        {appVersionLabel}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={isDesktop ? createNewDesktopFile : loadStarterExample}
                    className="cs-button mt-4 w-full justify-center rounded-xl px-3"
                  >
                    <span className="material-symbols-outlined text-[16px]">account_tree</span>
                    New workspace
                  </button>
                </div>
              ) : null}

              <div className="flex min-w-0 flex-1 flex-row gap-2 xl:flex-col">
                {railItems.map((item) => {
                  const isActive = activeRailSection === item.section;

                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => scrollToSection(item.section, item.tab)}
                      className={clsx(
                        "flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition",
                        isActive
                          ? "border-[rgba(114,255,112,0.22)] bg-[rgba(114,255,112,0.08)] text-[var(--cs-primary-bright)] shadow-[inset_0_0_0_1px_rgba(114,255,112,0.04)]"
                          : "border-transparent text-[var(--cs-text-muted)] hover:border-[var(--cs-border)] hover:bg-[rgba(255,255,255,0.02)] hover:text-[var(--cs-text)]",
                        isSidebarCollapsed ? "justify-center xl:px-0" : "",
                      )}
                    >
                      <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                      {!isSidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {!isSidebarCollapsed ? (
              <div className="hidden border-t border-[var(--cs-border)] pt-3 xl:block">
                <div className="px-1">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">Workspace</div>
                  <div className="mt-2 text-sm text-[var(--cs-text)]">{runStateLabel}</div>
                  <div className="mt-1 text-xs leading-5 text-[var(--cs-text-subtle)]">
                    {desktopFileName ?? languageFiles[language]}
                  </div>
                </div>
                {isDesktop ? (
                  <div className="mt-3 space-y-2">
                    <button type="button" onClick={createNewDesktopFile} className="cs-button w-full justify-start rounded-xl px-3">
                      New file
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void openDesktopFile();
                      }}
                      disabled={isManagingDesktopFiles}
                      className="cs-button w-full justify-start rounded-xl px-3 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Open file
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void saveDesktopFile();
                      }}
                      disabled={isManagingDesktopFiles}
                      className="cs-button w-full justify-start rounded-xl px-3 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Save file
                    </button>
                  </div>
                ) : null}

                <div className="mt-4 space-y-2 border-t border-[var(--cs-border)] pt-3">
                  <button
                    type="button"
                    onClick={openHelpPanel}
                    aria-haspopup="dialog"
                    aria-expanded={isHelpOpen}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-[var(--cs-text-muted)] transition hover:bg-[rgba(255,255,255,0.02)] hover:text-[var(--cs-text)]"
                  >
                    <span className="material-symbols-outlined text-[18px]">help_outline</span>
                    Help
                  </button>
                  <button
                    type="button"
                    onClick={openFeedbackPanel}
                    aria-haspopup="dialog"
                    aria-expanded={isFeedbackOpen}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-[var(--cs-text-muted)] transition hover:bg-[rgba(255,255,255,0.02)] hover:text-[var(--cs-text)]"
                  >
                    <span className="material-symbols-outlined text-[18px]">chat_bubble_outline</span>
                    Feedback
                  </button>
                </div>
              </div>
            ) : null}
          </aside>

          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="cs-panel cs-panel-strong flex min-h-[calc(100vh-11rem)] flex-col overflow-hidden rounded-[1.9rem] shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
          >
            <div className="border-b border-[var(--cs-border)] bg-[linear-gradient(180deg,rgba(12,14,12,0.98),rgba(10,12,10,0.94))] px-4 py-4 sm:px-5">
              <div className="mb-4 flex items-center gap-2 border-b border-[var(--cs-border)] pb-3">
                <div className="flex items-center gap-2 rounded-t-xl border border-[var(--cs-border)] bg-[rgba(255,255,255,0.025)] px-3 py-1.5 text-xs text-[var(--cs-primary-bright)] shadow-[0_12px_26px_rgba(0,0,0,0.2)]">
                  <span className="material-symbols-outlined text-[14px]">description</span>
                  {desktopFileName ?? languageFiles[language]}
                  <span className="material-symbols-outlined text-[14px] text-[var(--cs-text-subtle)]">close</span>
                </div>
                <div className="hidden items-center gap-2 rounded-t-xl px-3 py-1.5 text-xs text-[var(--cs-text-subtle)] md:flex">
                  <span className="material-symbols-outlined text-[14px]">code</span>
                  {languageLabels[language]}
                </div>
              </div>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 text-xs uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
                    Desktop workspace security
                  </div>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Snippet title"
                    className="w-full border-none bg-transparent text-[clamp(1.25rem,1.05rem+0.55vw,1.9rem)] font-semibold tracking-[-0.05em] text-[var(--cs-text)] outline-none placeholder:text-[var(--cs-text-subtle)]"
                  />
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cs-text-muted)]">
                    {primaryStatus}
                  </p>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--cs-text-subtle)]">
                    {secondaryStatus}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={focusEditorForPaste} className="cs-button rounded-xl px-3">
                    Focus editor
                  </button>
                  <button type="button" onClick={loadStarterExample} className="cs-button rounded-xl px-3">
                    Example
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFocusMode((current) => !current);
                      setNotice({
                        tone: "success",
                        message: focusMode
                          ? "Balanced layout restored."
                          : "Focus mode enabled. The editor stays dominant while the teaching panels soften.",
                      });
                    }}
                    className={clsx(
                      "cs-button rounded-xl px-3",
                      focusMode ? "border-[rgba(114,255,112,0.22)] bg-[rgba(114,255,112,0.08)] text-[var(--cs-primary-bright)]" : "",
                    )}
                  >
                    {focusMode ? "Focus mode" : "Balanced mode"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--cs-border)] px-4 py-3 text-sm sm:px-5">
              <span className="rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-3 py-1.5 text-[var(--cs-text)]">
                {languageRunLabels[language]}
              </span>
              <span className="rounded-full border border-[rgba(114,255,112,0.12)] bg-[rgba(114,255,112,0.06)] px-3 py-1.5 text-[var(--cs-primary-soft)]">
                {runStateDetail}
              </span>
              {conciseVariables.length > 0 ? (
                <span className="rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-3 py-1.5 text-[var(--cs-text-muted)]">
                  {conciseVariables.length} tracked variables
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setShowProgramInput((current) => !current)}
                className="ml-auto rounded-full border border-[var(--cs-border)] px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-[var(--cs-text-muted)] transition hover:border-[var(--cs-border-strong)] hover:text-[var(--cs-text)]"
              >
                {showProgramInput ? "Hide input" : "Show input"}
              </button>
            </div>

            {showProgramInput ? (
              <div className="border-b border-[var(--cs-border)] px-4 py-4 sm:px-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm text-[var(--cs-text-muted)]">
                    Add stdin for programs that use `input()`, `scanf`, `cin`, or `Scanner`.
                  </div>
                  <button
                    type="button"
                    onClick={() => setProgramInput("")}
                    className="text-xs uppercase tracking-[0.16em] text-[var(--cs-text-subtle)] transition hover:text-[var(--cs-text)]"
                  >
                    Clear
                  </button>
                </div>
                <textarea
                  value={programInput}
                  onChange={(event) => setProgramInput(event.target.value)}
                  placeholder={"Example:\n5\n10 20 30 40 50"}
                  className="cs-input h-24 resize-y rounded-xl font-mono text-sm"
                />
              </div>
            ) : null}

            <div className="relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(114,255,112,0.06),transparent_24%),linear-gradient(180deg,rgba(12,15,12,0.88),rgba(8,10,8,0.98))]">
              <Editor
                height="100%"
                defaultLanguage={monacoLanguageMap[language]}
                language={monacoLanguageMap[language]}
                value={code}
                onChange={(value) => setCode(value ?? "")}
                onMount={handleEditorMount}
                theme={monacoThemeMap[themeMode]}
                options={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 15,
                  minimap: { enabled: true, scale: 1, showSlider: "mouseover" },
                  scrollBeyondLastLine: false,
                  lineNumbersMinChars: 3,
                  padding: { top: 18, bottom: 18 },
                  roundedSelection: false,
                  wordWrap: "on",
                  overviewRulerBorder: false,
                  renderLineHighlight: "all",
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                }}
              />
              <div className="editor-focus-overlay" aria-hidden="true" />
            </div>
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: 0.04, ease: "easeOut" }}
            className={clsx(
              insightMode === "history" || insightMode === "settings"
                ? "cs-panel cs-panel-strong min-h-[28rem] overflow-hidden"
                : "min-h-[28rem]",
              focusMode && insightMode !== "settings" ? "opacity-90" : "",
            )}
          >
            {insightMode === "history" || insightMode === "settings" ? (
              <>
                <div className="border-b border-[var(--cs-border)] px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
                    {activeSidebarLabel}
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-[var(--cs-text)]">
                    {insightMode === "history" ? "Saved work" : "Workspace settings"}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--cs-text-muted)]">
                    {insightMode === "history"
                      ? "Open past snippets and recent runs without leaving the editor."
                      : "Manage your account and sync preferences."}
                  </p>
                </div>

                <div className="workbench-scrollbar h-[calc(100%-96px)] overflow-y-auto p-4">
                  {insightMode === "history" ? (
                <section ref={librarySectionRef} className="space-y-3">
                  {snippets.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-4 text-sm text-[var(--cs-text-muted)]">
                      Sign in and save a snippet to build a reusable history.
                    </div>
                  ) : (
                    snippets.slice(0, 5).map((snippet) => (
                      <div
                        key={snippet.id}
                        className={clsx(
                          "rounded-xl border px-4 py-3 transition",
                          currentSnippetId === snippet.id
                            ? "border-[rgba(114,255,112,0.22)] bg-[rgba(114,255,112,0.08)]"
                            : "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] hover:border-[var(--cs-border-strong)]",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            void loadSnippet(snippet.id);
                          }}
                          className="w-full text-left"
                        >
                          <div className="truncate text-sm font-medium text-[var(--cs-text)]">{snippet.title}</div>
                          <div className="mt-1 text-xs text-[var(--cs-text-subtle)]">{formatDate(snippet.createdAt)}</div>
                          <div className="mt-3 flex items-center gap-2 text-xs text-[var(--cs-text-muted)]">
                            <span>{snippet.language}</span>
                            <span>•</span>
                            <span>{snippet.executionCount ?? 0} runs</span>
                          </div>
                        </button>
                      </div>
                    ))
                  )}

                  {historyPreview.length > 0 ? (
                    <div className="pt-3">
                      <div className="mb-2 text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
                        Recent output
                      </div>
                      <div className="space-y-2">
                        {historyPreview.map((entry) => (
                          <div key={entry.id} className="rounded-xl border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-3">
                            <div className="text-sm text-[var(--cs-text)]">{entry.codeSnippet.title}</div>
                            <div className="mt-1 text-xs text-[var(--cs-text-subtle)]">{formatDate(entry.createdAt)}</div>
                            <p className="mt-2 max-h-12 overflow-hidden font-mono text-xs leading-5 text-[var(--cs-text-muted)]">
                              {entry.output || "No console output captured."}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : (
                <section ref={accountSectionRef} className="space-y-4">
                  {isDesktop ? (
                    <div className="rounded-xl border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">Local workspace</div>
                      <div className="mt-2 text-sm leading-6 text-[var(--cs-text-muted)]">
                        {desktopFilePath ?? "No local file selected yet."}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void saveDesktopSnippet();
                          }}
                          disabled={isManagingDesktopFiles}
                          className="cs-button rounded-xl px-3 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Save local snippet
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void openLocalDesktopSnippet();
                          }}
                          disabled={isManagingDesktopFiles}
                          className="cs-button rounded-xl px-3 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Open local snippet
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {isDesktop ? (
                    <RuntimeManagerPanel
                      runtimeManager={runtimeHealth.runtimeManager}
                      isLoading={
                        runtimeHealth.connection === "checking" ||
                        isRefreshingRuntimeManager
                      }
                      onRefresh={() => {
                        void refreshRuntimeManager();
                      }}
                    />
                  ) : null}

                  <div className="rounded-xl border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">Signed in</div>
                    <div className="mt-2 text-sm text-[var(--cs-text)]">{user?.email ?? "Authenticated user"}</div>
                    <p className="mt-2 text-sm leading-6 text-[var(--cs-text-muted)]">
                      This workspace is only available after a valid CodeSight session is restored.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        void handleLogout();
                      }}
                      className="cs-button mt-4 rounded-xl px-3"
                    >
                      Log out
                    </button>
                  </div>
                </section>
              )}
                </div>
              </>
            ) : (
              <ExecutionVisualizer
                trace={trace}
                step={activeStep}
                previousStep={previousStep}
                steps={playbackFrames}
                currentStepIndex={currentStepIndex}
                activeLineCode={activeLineCode}
                plainEnglishSummary={plainEnglishSummary}
                consoleOutput={consoleOutput}
                error={trace.error || undefined}
                isExecuting={isExecuting}
                onDiagnosticSelect={(diagnostic) => {
                  focusDiagnostic(diagnostic);
                  setActiveWorkspaceTab("visualizer");
                  setActiveRailSection("flow");
                }}
                onStepSelect={(nextIndex) => {
                  jumpToPlaybackIndex(nextIndex, "visualizer", "flow");
                }}
              />
            )}
          </motion.aside>
        </div>
      </div>

      <HelpPanel open={isHelpOpen} onClose={closeWorkspacePanels} />
      <FeedbackPanel
        open={isFeedbackOpen}
        onClose={closeWorkspacePanels}
        initialEmail={user?.email ?? ""}
        isSubmitting={isSubmittingFeedback}
        onSubmit={handleFeedbackSubmit}
      />
      <PlaybackDock
        stepCount={playbackFrames.length}
        currentStepIndex={currentStepIndex}
        activeLine={activeLineNumber ?? undefined}
        currentFunctionName={currentFunctionName}
        isPlaying={isPlaying}
        playbackRate={playbackRate}
        stepSummary={playbackSummary}
        onPlaybackRateChange={setPlaybackRate}
        onStepScrub={(nextIndex) => {
          jumpToPlaybackIndex(nextIndex, "visualizer", "flow");
        }}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onTogglePlayback={handleTogglePlayback}
        onReset={handleReset}
      />
      <FooterBar
        languageLabel={languageLabels[language]}
        executionStatusLabel={footerExecutionLabel}
        executionStatusTone={footerExecutionTone}
        executionTimeLabel={footerExecutionTime}
        memoryUsageLabel={footerMemoryUsage}
        currentLineLabel={footerCurrentLine}
        runtimeLabel={runtimeLabel}
        runtimeTone={runtimeTone}
        runtimePulse={runtimeHealth.connection !== "online"}
        runtimeIcon={runtimeIcon}
        appVersionLabel={appVersionLabel}
        themeMode={themeMode}
        onThemeToggle={() =>
          setThemeMode((current) =>
            current === "noctis" ? "graphite" : "noctis",
          )
        }
        onOpenSettings={() => scrollToSection("account", "explorer")}
      />
      <ToastViewport notice={notice} onDismiss={() => setNotice(null)} />
    </main>
  );
};
