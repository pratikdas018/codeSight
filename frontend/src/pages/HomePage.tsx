import {
  type FormEvent,
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
import { ExecutionVisualizer } from "../components/ExecutionVisualizer";
import { FooterBar } from "../components/FooterBar";
import { PlaybackDock } from "../components/PlaybackDock";
import { ToastViewport } from "../components/ToastViewport";
import { useAuth } from "../hooks/useAuth";
import { usePlayback } from "../hooks/usePlayback";
import { createExecutionHistory, listExecutionHistory } from "../services/historyService";
import {
  createSnippet,
  deleteSnippet as deleteSnippetRecord,
  getSnippetById,
  listSnippets,
  updateSnippet,
} from "../services/snippetService";
import { executeCodeRequest, fetchRuntimeHealth } from "../utils/api";
import type { ExecutionTrace } from "../engine/types";
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
import { createVisualizationModel } from "../visualization/model";

const createEmptyTrace = (language: SupportedLanguage): ExecutionTrace => ({
  steps: [],
  output: "",
  outputLines: [],
  error: "",
  executionTime: 0,
  timedOut: false,
  language,
  status: "completed",
  phases: {
    compile: null,
    run: null,
  },
  limits: {
    queueConcurrency: 1,
    queueDepthLimit: 0,
    compileTimeoutMs: 0,
    runTimeoutMs: 0,
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
}

const defaultRuntimeHealth: RuntimeHealthSnapshot = {
  connection: "checking",
  executorMode: "local",
  executionProvider: "local",
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
    label: "Guide",
    section: "guide",
    tab: "explorer",
    icon: "menu_book",
  },
  {
    label: "Flow",
    section: "flow",
    tab: "visualizer",
    icon: "timeline",
  },
  {
    label: "Library",
    section: "library",
    tab: "explorer",
    icon: "history",
  },
  {
    label: "Account",
    section: "account",
    tab: "explorer",
    icon: "person",
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

export const HomePage = () => {
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<WorkspaceTab>("explorer");
  const [activeRailSection, setActiveRailSection] =
    useState<SectionKey>("guide");
  const [focusMode, setFocusMode] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showProgramInput, setShowProgramInput] = useState(false);
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
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const {
    session,
    user,
    pendingConfirmationEmail,
    isLoading: isAuthLoading,
    isAuthenticating,
    authenticate,
    resendConfirmation,
    logout,
  } = useAuth();
  const isDesktop = Boolean(window.electronAPI?.env.isElectron);

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef =
    useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
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
  const { isPlaying, togglePlayback, stopPlayback, setIsPlaying } = usePlayback(
    trace.steps.length,
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
        });
      } catch {
        if (!isMounted) {
          return;
        }

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

  const activeStep = trace.steps[currentStepIndex] ?? null;
  const previousStep =
    currentStepIndex > 0 ? trace.steps[currentStepIndex - 1] ?? null : null;
  const consoleOutput =
    activeStep?.output ??
    (trace.steps.length > 0
      ? trace.steps[trace.steps.length - 1]?.output ?? trace.outputLines
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
  const stackFrames = trace.steps
    .slice(Math.max(0, currentStepIndex - 2), currentStepIndex + 1)
    .reverse();
  const flowWindow = trace.steps.slice(
    Math.max(0, currentStepIndex - 2),
    Math.min(trace.steps.length, currentStepIndex + 3),
  );
  const timelineProgress =
    trace.steps.length <= 1
      ? trace.steps.length === 1
        ? 100
        : 0
      : (currentStepIndex / (trace.steps.length - 1)) * 100;
  const deferredCode = useDeferredValue(code);
  const codeLines = useMemo(() => deferredCode.split(/\r?\n/), [deferredCode]);
  const activeLineCode =
    activeStep?.line && activeStep.line > 0
      ? codeLines[activeStep.line - 1]?.trim() ?? ""
      : "";
  const plainEnglishSummary = buildPlainEnglishSummary(activeLineCode, language);
  const changedVariableSummary =
    changedVariables.length > 0
      ? changedVariables
          .slice(0, 3)
          .map((variable) => `${variable.name} = ${variable.currentValue}`)
          .join(" | ")
      : trace.steps.length === 0
        ? "No variables yet. Press Run to capture state changes."
        : "This step did not change any tracked variables.";
  const beginnerChecklist =
    trace.steps.length === 0
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
    setIsRefreshing(true);

    try {
      const [snippetList, historyList] = await Promise.all([
        listSnippets(),
        listExecutionHistory(),
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
    if (!session?.user || !user) {
      setSnippets([]);
      setHistory([]);
      setCurrentSnippetId(null);
      return;
    }

    refreshWorkspaceData().catch((error) => {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load account data.",
      });
    });
  }, [session, user]);

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
    if (currentStepIndex >= trace.steps.length && trace.steps.length > 0) {
      setCurrentStepIndex(trace.steps.length - 1);
    }
  }, [currentStepIndex, trace.steps.length]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    decorationsRef.current = editor.createDecorationsCollection([]);
    explanationNodeRef.current = document.createElement("div");

    monaco.editor.defineTheme("codesight-noctis", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "607089", fontStyle: "italic" },
        { token: "keyword", foreground: "63E7FF" },
        { token: "string", foreground: "8FFFD6" },
        { token: "number", foreground: "6CB6FF" },
        { token: "type.identifier", foreground: "8ABFFF" },
      ],
      colors: {
        "editor.background": "#08111E",
        "editorGutter.background": "#08111E",
        "editorLineNumber.foreground": "#4F627A",
        "editorLineNumber.activeForeground": "#D4F7FF",
        "editor.selectionBackground": "#12314D",
        "editor.inactiveSelectionBackground": "#0D2338",
        "editor.lineHighlightBackground": "#0A1727",
        "editorCursor.foreground": "#8FFFD6",
        "editorIndentGuide.background1": "#13263C",
        "editorIndentGuide.activeBackground1": "#1F4566",
      },
    });
    monaco.editor.defineTheme("codesight-graphite", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6D7B8E", fontStyle: "italic" },
        { token: "keyword", foreground: "72D1FF" },
        { token: "string", foreground: "A7F3D0" },
        { token: "number", foreground: "8ABFFF" },
        { token: "type.identifier", foreground: "9DB7D5" },
      ],
      colors: {
        "editor.background": "#0A1118",
        "editorGutter.background": "#0A1118",
        "editorLineNumber.foreground": "#556579",
        "editorLineNumber.activeForeground": "#E1EFFA",
        "editor.selectionBackground": "#173047",
        "editor.inactiveSelectionBackground": "#12273A",
        "editor.lineHighlightBackground": "#0E1824",
        "editorCursor.foreground": "#9BE7FF",
        "editorIndentGuide.background1": "#182838",
        "editorIndentGuide.activeBackground1": "#29465F",
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

    if (!activeStep?.line) {
      decorationsRef.current.set([]);
      return;
    }

    decorationsRef.current.set([
      {
        range: new monaco.Range(activeStep.line, 1, activeStep.line, 1),
        options: {
          isWholeLine: true,
          className: "current-execution-line",
          linesDecorationsClassName: "current-execution-gutter",
        },
      },
    ]);
    editor.revealLineInCenter(activeStep.line);
  }, [activeStep?.line]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const explanationNode = explanationNodeRef.current;
    const explanationWidget = explanationWidgetRef.current;

    if (!editor || !monaco || !explanationNode || !explanationWidget) {
      return;
    }

    if (!activeStep?.line || !activeStep.explanation) {
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
    titleNode.textContent = `Line ${activeStep.line}`;

    const bodyNode = document.createElement("p");
    bodyNode.className = "codesight-explanation-body";
    bodyNode.textContent = activeStep.explanation;

    explanationNode.replaceChildren(titleNode, bodyNode);
    explanationPositionRef.current = new monaco.Position(activeStep.line, 1);
    editor.layoutContentWidget(explanationWidget);
  }, [activeStep?.explanation, activeStep?.line, focusMode]);

  useEffect(
    () => () => {
      if (editorRef.current && explanationWidgetRef.current) {
        editorRef.current.removeContentWidget(explanationWidgetRef.current);
      }
    },
    [],
  );

  const runCode = async () => {
    stopPlayback();
    executionStartedAtRef.current = Date.now();
    setExecutionElapsedMs(0);
    setIsExecuting(true);

    try {
      const nextTrace = await executeCodeRequest(code, language, programInput);
      setTrace(nextTrace);
      setExecutionElapsedMs(nextTrace.executionTime);
      setRuntimeHealth((current) => ({
        ...current,
        connection: "online",
      }));
      setCurrentStepIndex(0);
      setIsPlaying(false);
      setActiveWorkspaceTab(nextTrace.steps.length > 0 ? "debugger" : "explorer");
      setActiveRailSection(nextTrace.steps.length > 0 ? "variables" : "guide");

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
      } else {
        setNotice({
          tone: "success",
          message:
            nextTrace.steps.length > 0
              ? `${languageLabels[language]} execution completed in ${nextTrace.executionTime}ms with ${nextTrace.steps.length} steps.`
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
        message: pendingConfirmationEmail
          ? `Confirm ${pendingConfirmationEmail} from your inbox, then log in before saving snippets.`
          : "Create an account or log in before saving snippets.",
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
      const snippet = await getSnippetById(snippetId);
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

  const handleAuthenticate = async (
    mode: "login" | "signup",
    authEmail: string,
    authPassword: string,
  ) => {
    try {
      const result = await authenticate(mode, authEmail, authPassword);

      if (result.status === "pending_confirmation") {
        setAuthMode("login");
        setNotice({
          tone: "success",
          message: `Account created for ${result.email}. Confirm the email from your inbox, then log in to save snippets.`,
        });
        return;
      }

      setNotice({
        tone: "success",
        message: `${mode === "signup" ? "Welcome" : "Welcome back"}, ${result.user.email}.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Authentication failed.",
      });
    }
  };

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await handleAuthenticate(authMode, email, password);
    setPassword("");
  };

  const handleLogout = async () => {
    try {
      await logout();
      setNotice({
        tone: "success",
        message: "Signed out of your Supabase session.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to log out.",
      });
    }
  };

  const handleResendConfirmation = async () => {
    try {
      await resendConfirmation(email.trim() || undefined);
      setNotice({
        tone: "success",
        message: `Confirmation email sent to ${email.trim() || pendingConfirmationEmail}.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to resend confirmation email.",
      });
    }
  };

  const handleTimelineClick = (event: MouseEvent<HTMLDivElement>) => {
    if (trace.steps.length === 0) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const nextIndex = Math.round(ratio * Math.max(trace.steps.length - 1, 0));
    stopPlayback();
    setActiveWorkspaceTab("visualizer");
    setActiveRailSection("flow");
    setCurrentStepIndex(nextIndex);
  };

  const scrollToSection = (section: SectionKey, tab: WorkspaceTab) => {
    setActiveWorkspaceTab(tab);
    setActiveRailSection(section);
  };

  const handlePrevious = () => {
    stopPlayback();
    setActiveWorkspaceTab("debugger");
    setActiveRailSection("variables");
    setCurrentStepIndex((current) => Math.max(0, current - 1));
  };

  const handleNext = () => {
    if (trace.steps.length === 0) {
      return;
    }

    stopPlayback();
    setActiveWorkspaceTab("debugger");
    setActiveRailSection("variables");
    setCurrentStepIndex((current) =>
      Math.min(trace.steps.length - 1, current + 1),
    );
  };

  const handleReset = () => {
    stopPlayback();
    setActiveWorkspaceTab("explorer");
    setActiveRailSection("guide");
    setCurrentStepIndex(0);
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

  const primaryStatus = activeStep?.description ?? LANGUAGE_PRESETS[language].headline;
  const secondaryStatus =
    activeStep?.explanation ??
    (trace.steps.length === 0
      ? LANGUAGE_PRESETS[language].description
      : "Use the timeline to move through the captured execution state.");
  const activeSidebarLabel =
    railItems.find((item) => item.section === activeRailSection)?.label ?? "Explorer";
  const runStateLabel = isExecuting
    ? "Execution running"
    : trace.status === "compile_error"
      ? "Compilation failed"
      : trace.status === "runtime_error"
        ? "Runtime failed"
        : trace.status === "timed_out"
          ? "Execution timed out"
          : trace.steps.length > 0 || trace.outputLines.length > 0
            ? "Trace captured"
            : "Workbench idle";
  const runStateDetail = isExecuting
    ? "Compiling and running inside the execution sandbox."
    : trace.diagnostics[0]?.summary ??
      (trace.error
        ? trace.error
        : trace.steps.length > 0
          ? `${trace.steps.length} timeline steps ready for playback.`
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
        : trace.status === "runtime_error" ||
            trace.status === "timed_out" ||
            trace.status === "internal_error"
          ? "error"
          : "neutral";
  const footerExecutionLabel = isExecuting
    ? `Running ${languageLabels[language]}...`
    : trace.status === "compile_error"
      ? `${languageLabels[language]} Compile Error`
      : trace.status === "runtime_error"
        ? `${languageLabels[language]} Runtime Error`
        : trace.status === "timed_out"
          ? `${languageLabels[language]} Timed Out`
          : trace.status === "internal_error"
            ? "Execution Error"
            : "Ready";
  const runtimeLabel =
    runtimeHealth.connection === "offline"
      ? runtimeHealth.executionProvider === "docker"
        ? "Docker Offline"
        : "Runtime Offline"
      : runtimeHealth.connection === "checking"
        ? "Checking Runtime"
        : runtimeHealth.executorMode === "remote"
          ? "Remote Runtime"
          : runtimeHealth.executionProvider === "docker"
            ? "Docker Runtime"
            : runtimeHealth.executionProvider === "auto"
              ? "Hybrid Runtime"
              : "Local Runtime";
  const runtimeTone: FooterTone =
    runtimeHealth.connection === "offline"
      ? "error"
      : runtimeHealth.connection === "checking"
        ? "info"
        : "success";
  const runtimeIcon =
    runtimeHealth.connection === "offline"
      ? "cloud_off"
      : runtimeHealth.connection === "checking"
        ? "hourglass_top"
        : runtimeHealth.executorMode === "remote"
          ? "cloud_sync"
          : "terminal";
  const footerExecutionTime = isExecuting
    ? `${Math.max(0, executionElapsedMs)}ms`
    : formatDuration(trace.executionTime);
  const footerMemoryUsage = formatMemoryUsage(trace.metrics.peakMemoryKb);
  const footerCurrentLine = activeStep?.line ? `Line ${activeStep.line}` : "Line --";
  const appVersionLabel = isDesktop
    ? `v${window.electronAPI?.env.version ?? "1.0.0"}`
    : "Web Preview";

  return (
    <main className="min-h-screen bg-[#07111f] text-[#e5edf8]">
      <header className="sticky top-0 z-50 border-b border-white/8 bg-[rgba(7,17,31,0.88)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1900px] items-center justify-between gap-4 px-3 py-3 sm:px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-slate-300 transition hover:border-white/15 hover:text-white"
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
              <div className="text-lg font-semibold tracking-[-0.03em] text-white">
                CodeSight
              </div>
              <div className="text-xs text-slate-500">
                Clean runtime visualizations for learning code execution
              </div>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="hidden items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-slate-300 md:flex">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Runtime</span>
              <select
                value={language}
                onChange={(event) => handleLanguageChange(event.target.value as SupportedLanguage)}
                className="bg-transparent text-sm text-slate-100 outline-none"
              >
                {Object.entries(languageLabels).map(([value, label]) => (
                  <option key={value} value={value} className="bg-slate-950 text-slate-100">
                    {label}
                  </option>
                ))}
              </select>
            </label>

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
              {isExecuting ? "Running..." : "Run"}
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("account", "explorer")}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-sm font-semibold text-white transition hover:border-white/15"
            >
              {accountInitial}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1900px] px-3 pb-48 pt-4 sm:px-4 lg:px-6">
        <div className="grid gap-4 xl:grid-cols-[auto,minmax(0,1fr),clamp(22rem,26vw,29rem)]">
          <aside
            className={clsx(
              "cs-panel cs-panel-strong flex h-fit flex-row gap-2 p-2 xl:min-h-[calc(100vh-11rem)] xl:flex-col xl:justify-between",
              isSidebarCollapsed ? "xl:w-[76px]" : "xl:w-[210px]",
            )}
          >
            <div className="flex min-w-0 flex-1 flex-row gap-2 xl:flex-col">
              {railItems.map((item) => {
                const isActive = activeRailSection === item.section;

                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => scrollToSection(item.section, item.tab)}
                    className={clsx(
                      "flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                      isActive
                        ? "bg-[#111d31] text-white"
                        : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200",
                      isSidebarCollapsed ? "justify-center xl:px-0" : "",
                    )}
                  >
                    <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                    {!isSidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
                  </button>
                );
              })}
            </div>

            {!isSidebarCollapsed ? (
              <div className="hidden border-t border-white/8 pt-3 xl:block">
                <div className="px-1">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Workspace</div>
                  <div className="mt-2 text-sm text-slate-200">{runStateLabel}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
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
              </div>
            ) : null}
          </aside>

          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="cs-panel cs-panel-strong flex min-h-[calc(100vh-11rem)] flex-col overflow-hidden rounded-[1.9rem] shadow-[0_24px_70px_rgba(2,10,22,0.38)]"
          >
            <div className="border-b border-white/8 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {desktopFileName ?? languageFiles[language]}
                  </div>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Snippet title"
                    className="w-full border-none bg-transparent text-[clamp(1.15rem,1rem+0.4vw,1.55rem)] font-semibold tracking-[-0.02em] text-white outline-none placeholder:text-slate-500"
                  />
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
                      focusMode ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-100" : "",
                    )}
                  >
                    {focusMode ? "Focus mode" : "Balanced mode"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-white/8 px-4 py-3 text-sm sm:px-5">
              <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-slate-300">
                {languageRunLabels[language]}
              </span>
              <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-slate-400">
                {runStateDetail}
              </span>
              <button
                type="button"
                onClick={() => setShowProgramInput((current) => !current)}
                className="ml-auto rounded-full border border-white/8 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-slate-400 transition hover:border-white/15 hover:text-slate-200"
              >
                {showProgramInput ? "Hide input" : "Show input"}
              </button>
            </div>

            {showProgramInput ? (
              <div className="border-b border-white/8 px-4 py-4 sm:px-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm text-slate-400">
                    Add stdin for programs that use `input()`, `scanf`, `cin`, or `Scanner`.
                  </div>
                  <button
                    type="button"
                    onClick={() => setProgramInput("")}
                    className="text-xs uppercase tracking-[0.16em] text-slate-500 transition hover:text-slate-300"
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

            <div className="flex-1 overflow-hidden">
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
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  lineNumbersMinChars: 3,
                  padding: { top: 18, bottom: 18 },
                  roundedSelection: false,
                  wordWrap: "on",
                  overviewRulerBorder: false,
                  renderLineHighlight: "gutter",
                  smoothScrolling: true,
                }}
              />
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
                <div className="border-b border-white/8 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    {activeSidebarLabel}
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-white">
                    {insightMode === "history" ? "Saved work" : "Workspace settings"}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    {insightMode === "history"
                      ? "Open past snippets and recent runs without leaving the editor."
                      : "Manage your account and sync preferences."}
                  </p>
                </div>

                <div className="workbench-scrollbar h-[calc(100%-96px)] overflow-y-auto p-4">
                  {insightMode === "history" ? (
                <section ref={librarySectionRef} className="space-y-3">
                  {snippets.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
                      Sign in and save a snippet to build a reusable history.
                    </div>
                  ) : (
                    snippets.slice(0, 5).map((snippet) => (
                      <div
                        key={snippet.id}
                        className={clsx(
                          "rounded-xl border px-4 py-3 transition",
                          currentSnippetId === snippet.id
                            ? "border-cyan-300/22 bg-cyan-300/8"
                            : "border-white/8 bg-white/[0.02] hover:border-white/14",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            void loadSnippet(snippet.id);
                          }}
                          className="w-full text-left"
                        >
                          <div className="truncate text-sm font-medium text-white">{snippet.title}</div>
                          <div className="mt-1 text-xs text-slate-500">{formatDate(snippet.createdAt)}</div>
                          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
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
                      <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                        Recent output
                      </div>
                      <div className="space-y-2">
                        {historyPreview.map((entry) => (
                          <div key={entry.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                            <div className="text-sm text-white">{entry.codeSnippet.title}</div>
                            <div className="mt-1 text-xs text-slate-500">{formatDate(entry.createdAt)}</div>
                            <p className="mt-2 max-h-12 overflow-hidden font-mono text-xs leading-5 text-slate-400">
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
                    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Local workspace</div>
                      <div className="mt-2 text-sm leading-6 text-slate-400">
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

                  {user ? (
                    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Signed in</div>
                      <div className="mt-2 text-sm text-white">{user.email}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Snippets and execution history stay attached to this account.
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
                  ) : isAuthLoading ? (
                    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-sm text-slate-400">
                      Restoring your session...
                    </div>
                  ) : (
                    <form onSubmit={handleAuthSubmit} className="space-y-3 rounded-xl border border-white/8 bg-white/[0.02] p-4">
                      <div className="flex rounded-full border border-white/8 bg-[#0a1627] p-1">
                        {(["signup", "login"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setAuthMode(mode)}
                            className={clsx(
                              "flex-1 rounded-full px-3 py-2 text-xs uppercase tracking-[0.16em] transition",
                              authMode === mode
                                ? "bg-white/[0.08] text-white"
                                : "text-slate-500 hover:text-slate-300",
                            )}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="Email address"
                        className="cs-input rounded-xl"
                        required
                      />
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Password"
                        className="cs-input rounded-xl"
                        required
                        minLength={6}
                      />
                      <button
                        type="submit"
                        disabled={isAuthenticating || isAuthLoading}
                        className="cs-button cs-button-primary w-full rounded-xl disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isAuthLoading
                          ? "Restoring session..."
                          : isAuthenticating
                            ? "Working..."
                            : authMode === "signup"
                              ? "Create account"
                              : "Log in"}
                      </button>
                      {pendingConfirmationEmail ? (
                        <div className="rounded-xl border border-amber-300/16 bg-amber-300/8 p-3 text-sm text-amber-100">
                          Confirm {pendingConfirmationEmail} from your inbox before saving snippets.
                        </div>
                      ) : null}
                    </form>
                  )}
                </section>
              )}
                </div>
              </>
            ) : (
                <ExecutionVisualizer
                  trace={trace}
                  step={activeStep}
                  previousStep={previousStep}
                  steps={trace.steps}
                  currentStepIndex={currentStepIndex}
                  activeLineCode={activeLineCode}
                  plainEnglishSummary={plainEnglishSummary}
                  consoleOutput={consoleOutput}
                  error={trace.error || undefined}
                  isExecuting={isExecuting}
                  onStepSelect={(nextIndex) => {
                    stopPlayback();
                    setActiveWorkspaceTab("visualizer");
                  setActiveRailSection("flow");
                  setCurrentStepIndex(nextIndex);
                }}
              />
            )}
          </motion.aside>
        </div>
      </div>

      <PlaybackDock
        stepCount={trace.steps.length}
        currentStepIndex={currentStepIndex}
        activeLine={activeStep?.line}
        isPlaying={isPlaying}
        playbackRate={playbackRate}
        onPlaybackRateChange={setPlaybackRate}
        onStepScrub={(nextIndex) => {
          stopPlayback();
          setActiveWorkspaceTab("visualizer");
          setActiveRailSection("flow");
          setCurrentStepIndex(nextIndex);
        }}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onTogglePlayback={() => {
          setActiveWorkspaceTab("visualizer");
          setActiveRailSection("flow");
          togglePlayback();
        }}
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
