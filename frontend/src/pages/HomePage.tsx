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
import { ArrayVisualizer } from "../components/ArrayVisualizer";
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
import { executeCodeRequest } from "../utils/api";
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
import { formatDate } from "../utils/formatters";
import { createVisualizationModel } from "../visualization/model";

const createEmptyTrace = (language: SupportedLanguage): ExecutionTrace => ({
  steps: [],
  output: "",
  outputLines: [],
  error: "",
  executionTime: 0,
  timedOut: false,
  language,
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
type SectionKey =
  | "guide"
  | "variables"
  | "memory"
  | "flow"
  | "library"
  | "account";

const sideRailIcons = ["folder", "search", "account_tree", "extension"] as const;

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
    useState<WorkspaceTab>("debugger");
  const [activeRailSection, setActiveRailSection] =
    useState<SectionKey>("variables");
  const [focusMode, setFocusMode] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [language, setLanguage] = useState<SupportedLanguage>("python");
  const [title, setTitle] = useState(LANGUAGE_PRESETS.python.title);
  const [code, setCode] = useState(LANGUAGE_PRESETS.python.code);
  const [trace, setTrace] = useState<ExecutionTrace>(createEmptyTrace("python"));
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [snippets, setSnippets] = useState<CodeSnippet[]>([]);
  const [history, setHistory] = useState<ExecutionHistoryRecord[]>([]);
  const [currentSnippetId, setCurrentSnippetId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isManagingDesktopFiles, setIsManagingDesktopFiles] = useState(false);
  const [desktopFilePath, setDesktopFilePath] = useState<string | null>(null);
  const [desktopFileName, setDesktopFileName] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFileRecord[]>([]);
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
    setIsExecuting(true);

    try {
      const nextTrace = await executeCodeRequest(code, language);
      setTrace(nextTrace);
      setCurrentStepIndex(0);
      setIsPlaying(false);
      setActiveWorkspaceTab(nextTrace.steps.length > 0 ? "debugger" : "explorer");
      setActiveRailSection(nextTrace.steps.length > 0 ? "variables" : "guide");

      if (nextTrace.error) {
        setNotice({
          tone: "error",
          message: `${languageLabels[language]} run failed in ${nextTrace.executionTime}ms. ${nextTrace.error}`,
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
      setTrace({
        ...createEmptyTrace(language),
        error: error instanceof Error ? error.message : "Unable to execute code.",
      });
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Unable to execute code.",
      });
    } finally {
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

    const sectionMap = {
      guide: guideSectionRef,
      variables: variablesSectionRef,
      memory: memorySectionRef,
      flow: flowSectionRef,
      library: librarySectionRef,
      account: accountSectionRef,
    };

    sectionMap[section].current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
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
  const debugTabActive = activeWorkspaceTab === "debugger";
  const explorerTabActive = activeWorkspaceTab === "explorer";
  const visualizerTabActive = activeWorkspaceTab === "visualizer";

  return (
    <main className="min-h-screen bg-[#0b0e14] text-[#e1e2eb]">
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-white/10 bg-[#0b0e14]/85 px-4 shadow-[0_20px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-4 sm:gap-8">
          <button
            type="button"
            onClick={() => scrollToSection("guide", "explorer")}
            className="bg-gradient-to-r from-cyan-400 to-indigo-500 bg-clip-text text-left text-lg font-bold tracking-tight text-transparent"
          >
            CodeSight
          </button>
          <nav className="hidden items-center gap-6 md:flex">
            <button
              type="button"
              onClick={() => scrollToSection("guide", "explorer")}
              className={clsx(
                "text-sm transition hover:text-slate-200",
                explorerTabActive
                  ? "border-b-2 border-cyan-400 pb-1 font-semibold text-cyan-400"
                  : "text-slate-400",
              )}
            >
              Explorer
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("variables", "debugger")}
              className={clsx(
                "text-sm transition hover:text-slate-200",
                debugTabActive
                  ? "border-b-2 border-cyan-400 pb-1 font-semibold text-cyan-400"
                  : "text-slate-400",
              )}
            >
              Debugger
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("flow", "visualizer")}
              className={clsx(
                "text-sm transition hover:text-slate-200",
                visualizerTabActive
                  ? "border-b-2 border-cyan-400 pb-1 font-semibold text-cyan-400"
                  : "text-slate-400",
              )}
            >
              Visualizer
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {isDesktop ? (
            <>
              <button
                type="button"
                onClick={() => {
                  void openDesktopFile();
                }}
                disabled={isManagingDesktopFiles}
                className="rounded-md border border-white/10 bg-[#1f2229] px-3 py-2 text-sm text-slate-100 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => {
                  void saveDesktopFile();
                }}
                disabled={isManagingDesktopFiles}
                className="rounded-md border border-white/10 bg-[#1f2229] px-3 py-2 text-sm text-slate-100 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isManagingDesktopFiles ? "Working..." : "Save File"}
              </button>
            </>
          ) : null}

          <label className="hidden items-center gap-2 rounded-md border border-white/10 bg-[#1d2026] px-3 py-1.5 text-sm text-slate-200 md:flex">
            <span className="font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.18em] text-cyan-300">
              {languageRunLabels[language]}
            </span>
            <select
              value={language}
              onChange={(event) =>
                handleLanguageChange(event.target.value as SupportedLanguage)
              }
              className="bg-transparent text-sm text-slate-200 outline-none"
            >
              {Object.entries(languageLabels).map(([value, label]) => (
                <option key={value} value={value} className="bg-slate-900">
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
            className="rounded-md border border-white/10 bg-[#272a31] px-4 py-2 text-sm text-slate-100 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              void runCode();
            }}
            disabled={isExecuting}
            className="flex items-center gap-2 rounded-md bg-gradient-to-r from-cyan-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-65"
          >
            <span className="material-symbols-outlined text-sm">play_arrow</span>
            {isExecuting ? "Running..." : "Run"}
          </button>

          <div className="ml-1 hidden items-center gap-2 border-l border-white/10 pl-3 sm:flex">
            <button
              type="button"
              onClick={() => {
                setFocusMode((current) => !current);
                setNotice({
                  tone: "success",
                  message:
                    "Focus mode dims secondary panels so beginners can concentrate on the current step.",
                });
              }}
              className={clsx(
                "rounded-md p-2 text-slate-400 transition hover:bg-white/5 hover:text-slate-200",
                focusMode ? "bg-cyan-500/10 text-cyan-300" : "",
              )}
              aria-label="Toggle focus mode"
              title="Toggle focus mode"
            >
              <span className="material-symbols-outlined text-[20px]">settings</span>
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("guide", "explorer")}
              className="rounded-md p-2 text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
              aria-label="Workbench help"
              title="Workbench help"
            >
              <span className="material-symbols-outlined text-[20px]">help_outline</span>
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("account", "explorer")}
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-cyan-500/35 to-indigo-500/35 text-xs font-semibold text-white"
            >
              {user?.email?.slice(0, 1).toUpperCase() ?? "G"}
            </button>
          </div>
        </div>
      </header>

      {isDesktop ? (
        <div className="fixed inset-x-0 top-16 z-40 flex min-h-10 items-center justify-between border-b border-white/10 bg-[#10141c]/90 px-4 py-2 text-xs text-slate-400 backdrop-blur md:px-6">
          <div className="min-w-0">
            <span className="font-mono uppercase tracking-[0.2em] text-slate-500">
              Workspace
            </span>
            <span className="ml-3 truncate text-slate-200">
              {desktopFilePath ?? "Unsaved local file"}
            </span>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            {recentFiles.slice(0, 3).map((entry) => (
              <button
                key={entry.filePath}
                type="button"
                onClick={() => {
                  void openDesktopFile(entry.filePath);
                }}
                className="rounded-full border border-white/10 px-3 py-1 text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-200"
              >
                {entry.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={clsx("flex", isDesktop ? "pt-[6.5rem]" : "pt-16")}>
        <nav
          className={clsx(
            "fixed left-0 hidden w-16 flex-col items-center gap-5 border-r border-white/10 bg-[#0b0e14] py-4 md:flex",
            isDesktop ? "top-[6.5rem] h-[calc(100vh-104px)]" : "top-16 h-[calc(100vh-64px)]",
          )}
        >
          {sideRailIcons.map((icon, index) => {
            const actions: Array<{
              icon: (typeof sideRailIcons)[number];
              section: SectionKey;
              tab: WorkspaceTab;
              label: string;
            }> = [
              { icon: "folder", section: "library", tab: "explorer", label: "Saved snippets" },
              { icon: "search", section: "guide", tab: "explorer", label: "Beginner guide" },
              { icon: "account_tree", section: "flow", tab: "visualizer", label: "Execution story" },
              { icon: "extension", section: "variables", tab: "debugger", label: "Variable inspector" },
            ];
            const action = actions[index];
            const isActive = activeRailSection === action.section;

            return (
              <button
                key={icon}
                type="button"
                onClick={() => scrollToSection(action.section, action.tab)}
                className={clsx(
                  "relative flex h-12 w-12 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-slate-200",
                  isActive ? "bg-white/5 text-cyan-400" : "",
                )}
                aria-label={action.label}
                title={action.label}
              >
                {isActive ? (
                  <span className="absolute inset-y-0 left-0 w-[2px] rounded-full bg-cyan-400" />
                ) : null}
                <span className="material-symbols-outlined text-[22px]">{icon}</span>
              </button>
            );
          })}
        </nav>

        <div
          className={clsx(
            "flex flex-1 flex-col md:ml-16",
            isDesktop ? "min-h-[calc(100vh-104px)]" : "min-h-[calc(100vh-64px)]",
          )}
        >
          <div className="flex flex-1 flex-col overflow-hidden pb-28 xl:flex-row">
            <motion.section
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              className={clsx(
                "flex min-h-[420px] flex-col border-b border-white/10 bg-[#10131a] xl:w-[42%] xl:border-b-0 xl:border-r",
                focusMode ? "xl:w-[40%]" : "",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#191c22] px-4 py-3">
                <div className="flex min-w-[220px] flex-1 items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-slate-500">
                    description
                  </span>
                  <span className="font-['JetBrains_Mono'] text-sm text-slate-300">
                    {languageFiles[language]}
                  </span>
                </div>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Snippet title"
                  className="min-w-[180px] flex-1 border-none bg-transparent text-right text-sm font-medium text-slate-200 outline-none placeholder:text-slate-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#151921] px-4 py-3">
                <button
                  type="button"
                  onClick={focusEditorForPaste}
                  className="rounded-md border border-white/10 bg-[#1d2026] px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-200 transition hover:border-cyan-400/40 hover:text-cyan-200"
                >
                  Paste Code
                </button>
                <button
                  type="button"
                  onClick={loadStarterExample}
                  className="rounded-md border border-white/10 bg-[#1d2026] px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-200 transition hover:border-cyan-400/40 hover:text-cyan-200"
                >
                  Load Example
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection("guide", "explorer")}
                  className="rounded-md border border-white/10 bg-[#1d2026] px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-200 transition hover:border-cyan-400/40 hover:text-cyan-200"
                >
                  Learn This Screen
                </button>
                <div className="ml-auto text-xs text-slate-500">
                  Paste code, press <span className="text-slate-300">Run</span>, then use the footer to step through it.
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                <Editor
                  height="100%"
                  defaultLanguage={monacoLanguageMap[language]}
                  language={monacoLanguageMap[language]}
                  value={code}
                  onChange={(value) => setCode(value ?? "")}
                  onMount={handleEditorMount}
                  theme="vs-dark"
                  options={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 14,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    lineNumbersMinChars: 3,
                    padding: { top: 16, bottom: 24 },
                    roundedSelection: false,
                    wordWrap: "on",
                    overviewRulerBorder: false,
                  }}
                />
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              className="workbench-scrollbar flex-1 overflow-y-auto bg-[#10131a] p-4 sm:p-6"
            >
              <div className="space-y-6">
                <section
                  ref={guideSectionRef}
                  className="rounded-lg border border-cyan-400/15 bg-[linear-gradient(135deg,rgba(14,18,28,0.95),rgba(20,32,48,0.82))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-3xl">
                      <div className="font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.18em] text-cyan-300">
                        Beginner Guide
                      </div>
                      <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
                        Understand code in plain English, one line at a time.
                      </h1>
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                        This workbench is tuned for learners: paste code, run it, then follow the current line, the changing variables, and the execution story without needing to decode everything at once.
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#151921] px-4 py-3">
                      <div className="font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.16em] text-slate-500">
                        Current View
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {activeWorkspaceTab}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-3">
                    <div className="rounded-lg border border-white/10 bg-[#151921] p-4">
                      <div className="font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.16em] text-slate-500">
                        Current Line
                      </div>
                      <div className="mt-3 font-['JetBrains_Mono'] text-sm text-cyan-200">
                        {activeStep?.line ? `Line ${activeStep.line}` : "Waiting to run"}
                      </div>
                      <p className="mt-3 break-words font-['JetBrains_Mono'] text-sm text-slate-300">
                        {activeLineCode || "Press Run to highlight the exact line the program is executing."}
                      </p>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-[#151921] p-4">
                      <div className="font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.16em] text-slate-500">
                        Plain-English Meaning
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-300">
                        {plainEnglishSummary}
                      </p>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-[#151921] p-4">
                      <div className="font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.16em] text-slate-500">
                        What Changed
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-300">
                        {changedVariableSummary}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-lg border border-white/10 bg-[#151921] p-4">
                      <div className="font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.16em] text-slate-500">
                        Your Next Three Steps
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        {beginnerChecklist.map((item, index) => (
                          <div
                            key={item}
                            className="rounded-lg border border-white/5 bg-[#0f131c] p-3"
                          >
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
                              Step {index + 1}
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-300">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-[#151921] p-4">
                      <div className="font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.16em] text-slate-500">
                        Helpful Buttons
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={focusEditorForPaste}
                          className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-400"
                        >
                          Focus Editor
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollToSection("variables", "debugger")}
                          className="rounded-md border border-white/10 bg-[#1d2026] px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-400/40 hover:text-cyan-200"
                        >
                          See Variables
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollToSection("flow", "visualizer")}
                          className="rounded-md border border-white/10 bg-[#1d2026] px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-400/40 hover:text-cyan-200"
                        >
                          See Execution Story
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <section
                  ref={variablesSectionRef}
                  className="rounded-lg border border-white/10 bg-[rgba(25,28,34,0.72)] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-[#e1e2eb]">Variables</h2>
                    <span className="rounded bg-[#1d2026] px-2 py-1 font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.14em] text-slate-400">
                      Scope: {featuredVariables[0]?.scope ?? "global"}
                    </span>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-3">
                    {featuredVariables.length === 0 ? (
                      <div className="rounded border border-white/5 bg-[#272a31] p-4 text-sm text-slate-400 lg:col-span-3">
                        Run your code to populate the variable inspector.
                      </div>
                    ) : (
                      featuredVariables.map((variable, index) => (
                        <div
                          key={variable.id}
                          className={clsx(
                            "relative overflow-hidden rounded border p-3",
                            index === 2 || variable.change !== "unchanged"
                              ? "border-cyan-400/20 bg-[#272a31]"
                              : "border-white/5 bg-[#272a31]",
                          )}
                        >
                          {index === 2 || variable.change !== "unchanged" ? (
                            <div className="absolute inset-0 bg-cyan-400/5" />
                          ) : null}
                          <div className="relative z-10">
                            <div className="mb-1 font-['JetBrains_Mono'] text-sm text-slate-400">
                              {variable.name}
                            </div>
                            <div className="break-words font-['JetBrains_Mono'] text-sm text-[#e1e2eb]">
                              {variable.currentValue}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section
                  ref={memorySectionRef}
                  className="rounded-lg border border-white/10 bg-[rgba(25,28,34,0.72)] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl"
                >
                  <h2 className="mb-4 text-xl font-semibold text-[#e1e2eb]">Memory Stack</h2>
                  <div className="flex min-h-[280px] flex-col gap-6 xl:flex-row xl:items-end xl:justify-center">
                    <div className="flex flex-1 flex-col gap-2">
                      {stackFrames.length === 0 ? (
                        <div className="rounded border border-white/10 bg-[#1d2026] p-4 text-sm text-slate-400">
                          No call frames yet. Execute the current file to build the stack.
                        </div>
                      ) : (
                        <>
                          {stackFrames.map((frame, index) => {
                            const isActive = index === 0;

                            return (
                              <div
                                key={`${frame.line}-${index}`}
                                className={clsx(
                                  "rounded p-3 text-center font-['JetBrains_Mono'] text-sm",
                                  isActive
                                    ? "relative border border-cyan-400/50 bg-cyan-400/10 text-cyan-300 shadow-[0_0_15px_rgba(0,209,255,0.22)]"
                                    : "border border-white/10 bg-[#1d2026] text-slate-400",
                                  index === 1 ? "opacity-80" : "",
                                  index >= 2 ? "opacity-55" : "",
                                )}
                              >
                                {`line ${frame.line}()`}
                              </div>
                            );
                          })}
                          <div className="rounded border border-white/10 bg-[#1d2026] p-3 text-center font-['JetBrains_Mono'] text-sm text-[#e1e2eb]">
                            __main__
                          </div>
                        </>
                      )}
                    </div>

                    <div className="mx-auto flex h-32 w-32 shrink-0 items-center justify-center rounded-full border border-cyan-400/30 bg-[#272a31]">
                      <div className="text-center">
                        <span className="mb-1 block font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          Returning
                        </span>
                        <span className="font-['JetBrains_Mono'] text-2xl text-cyan-300">
                          {featuredVariables[0]?.currentValue ?? summarizeOutput(consoleOutput)}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 rounded-lg border border-white/10 bg-[#151921] p-4">
                      <div className="mb-2 font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.16em] text-slate-500">
                        Heap Preview
                      </div>
                      {primaryArray ? (
                        <div className="space-y-3">
                          <div className="font-['JetBrains_Mono'] text-sm text-slate-300">
                            {primaryArray.name}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {primaryArray.items.slice(0, 10).map((item) => (
                              <div
                                key={item.motionId}
                                className={clsx(
                                  "min-w-[44px] rounded border px-3 py-2 text-center font-['JetBrains_Mono'] text-sm",
                                  item.changed
                                    ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                                    : "border-white/10 bg-[#1d2026] text-slate-300",
                                )}
                              >
                                {item.label}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">
                          Arrays and objects will appear here when the current step exposes them.
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                <section
                  ref={flowSectionRef}
                  className="rounded-lg border border-white/5 bg-[#191c22] p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-cyan-400/20">
                      <span className="material-symbols-outlined text-sm text-cyan-300">
                        smart_toy
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="mb-1 text-sm font-semibold text-[#e1e2eb]">
                        {trace.steps.length === 0
                          ? "Workbench ready"
                          : `Step ${currentStepIndex + 1}: ${primaryStatus}`}
                      </h3>
                      <p className="text-sm leading-6 text-slate-400">{secondaryStatus}</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-white/10 bg-[rgba(25,28,34,0.72)] p-5 backdrop-blur-xl">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.16em] text-slate-500">
                        Execution Story
                      </div>
                      <div className="mt-1 text-xl font-semibold text-[#e1e2eb]">
                        What happened before, during, and after this step
                      </div>
                    </div>
                    <span className="rounded bg-[#1d2026] px-2 py-1 text-xs text-slate-400">
                      {trace.steps.length === 0 ? "Run required" : `${flowWindow.length} nearby steps`}
                    </span>
                  </div>

                  {flowWindow.length === 0 ? (
                    <div className="rounded-lg border border-white/5 bg-[#151921] p-4 text-sm text-slate-400">
                      After you run the code, this area becomes a simple story of the nearby steps so beginners can follow the flow without scanning the full file.
                    </div>
                  ) : (
                    <div className="grid gap-3 lg:grid-cols-3">
                      {flowWindow.map((step) => {
                        const isActiveStep = step === activeStep;

                        return (
                          <button
                            key={`${step.line}-${step.description}-${step.explanation ?? ""}`}
                            type="button"
                            onClick={() => {
                              const nextIndex = trace.steps.indexOf(step);
                              if (nextIndex >= 0) {
                                stopPlayback();
                                setActiveWorkspaceTab("visualizer");
                                setActiveRailSection("flow");
                                setCurrentStepIndex(nextIndex);
                              }
                            }}
                            className={clsx(
                              "rounded-lg border p-4 text-left transition",
                              isActiveStep
                                ? "border-cyan-400/40 bg-cyan-400/10"
                                : "border-white/5 bg-[#151921] hover:border-white/15",
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-['JetBrains_Mono'] text-xs uppercase tracking-[0.14em] text-slate-400">
                                Line {step.line}
                              </span>
                              {isActiveStep ? (
                                <span className="rounded bg-cyan-400/15 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-cyan-200">
                                  Current
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-3 text-sm font-semibold text-[#e1e2eb]">
                              {step.description}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-400">
                              {step.explanation ?? "This step is part of the execution story."}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="rounded-lg border border-white/10 bg-[rgba(25,28,34,0.72)] p-5 backdrop-blur-xl">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.16em] text-slate-500">
                        Array Motion
                      </div>
                      <div className="mt-1 text-xl font-semibold text-[#e1e2eb]">
                        Watch elements move as the algorithm changes them
                      </div>
                    </div>
                    <span className="rounded bg-[#1d2026] px-2 py-1 text-xs text-slate-400">
                      {visualizationModel.arrays.length === 0
                        ? "No arrays yet"
                        : `${visualizationModel.arrays.length} tracked`}
                    </span>
                  </div>
                  <p className="mb-4 text-sm leading-6 text-slate-400">
                    When an array changes, the tiles below move to their new positions. This makes reversing, swapping, and pointer-based algorithms much easier to feel.
                  </p>
                  <ArrayVisualizer
                    arrays={visualizationModel.arrays}
                    focusMode={focusMode}
                    themeMode="dark"
                  />
                </section>

                <div className="grid gap-6 2xl:grid-cols-[0.9fr_1.1fr_0.9fr]">
                  <section className="rounded-lg border border-white/10 bg-[rgba(25,28,34,0.72)] p-5 backdrop-blur-xl">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          Console
                        </div>
                        <div className="mt-1 text-lg font-semibold text-[#e1e2eb]">
                          Output Stream
                        </div>
                      </div>
                      <span className="rounded bg-[#1d2026] px-2 py-1 text-xs text-slate-400">
                        {consoleOutput.length} line{consoleOutput.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-[#0b0e14] p-3 font-['JetBrains_Mono'] text-sm text-slate-300">
                      {trace.error ? (
                        <p className="whitespace-pre-wrap break-words text-rose-300">
                          {trace.error}
                        </p>
                      ) : consoleOutput.length === 0 ? (
                        <p className="text-slate-500">No console output yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {consoleOutput.slice(-8).map((line, index) => (
                            <p key={`${line}-${index}`} className="break-all">
                              {line}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>

                  <section
                    ref={librarySectionRef}
                    className="rounded-lg border border-white/10 bg-[rgba(25,28,34,0.72)] p-5 backdrop-blur-xl"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          Saved Snippets
                        </div>
                        <div className="mt-1 text-lg font-semibold text-[#e1e2eb]">
                          Workspace Library
                        </div>
                      </div>
                      <span className="rounded bg-[#1d2026] px-2 py-1 text-xs text-slate-400">
                        {isRefreshing ? "Syncing..." : `${snippets.length} total`}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {snippets.length === 0 ? (
                        <p className="rounded border border-white/5 bg-[#151921] px-4 py-5 text-sm text-slate-400">
                          Sign in and save a snippet to build your personal library.
                        </p>
                      ) : (
                        snippets.slice(0, 5).map((snippet) => (
                          <div
                            key={snippet.id}
                            className={clsx(
                              "rounded border px-4 py-3 transition",
                              currentSnippetId === snippet.id
                                ? "border-cyan-400/35 bg-cyan-400/10"
                                : "border-white/5 bg-[#151921] hover:border-white/15",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  void loadSnippet(snippet.id);
                                }}
                                className="min-w-0 flex-1 text-left"
                              >
                                <div className="truncate text-sm font-semibold text-[#e1e2eb]">
                                  {snippet.title}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {formatDate(snippet.createdAt)}
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <span className="rounded bg-[#1d2026] px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-300">
                                    {snippet.language}
                                  </span>
                                  <span className="rounded bg-cyan-400/10 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-cyan-200">
                                    {snippet.executionCount ?? 0} runs
                                  </span>
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void deleteSnippet(snippet.id, snippet.title);
                                }}
                                className="rounded border border-white/10 bg-[#10141d] px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-slate-400 transition hover:border-rose-400/35 hover:text-rose-200"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section
                    ref={accountSectionRef}
                    className="rounded-lg border border-white/10 bg-[rgba(25,28,34,0.72)] p-5 backdrop-blur-xl"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          {user ? "Account" : "Sign In"}
                        </div>
                        <div className="mt-1 text-lg font-semibold text-[#e1e2eb]">
                          {user ? user.email : "Save your workbench state"}
                        </div>
                      </div>
                      {user ? (
                        <button
                          type="button"
                          onClick={() => {
                            void handleLogout();
                          }}
                          className="rounded border border-white/10 bg-[#151921] px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5"
                        >
                          Log out
                        </button>
                      ) : (
                        <div className="flex rounded bg-[#151921] p-1">
                          {(["signup", "login"] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setAuthMode(mode)}
                              className={clsx(
                                "rounded px-3 py-1.5 text-xs uppercase tracking-[0.12em] transition",
                                authMode === mode
                                  ? "bg-cyan-500 text-white"
                                  : "text-slate-400 hover:text-slate-200",
                              )}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {user ? (
                      <div className="space-y-3">
                        <p className="text-sm text-slate-400">
                          Snippets and run history will stay attached to your account.
                        </p>
                        <div className="rounded border border-white/5 bg-[#151921] p-4">
                          <div className="font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.16em] text-slate-500">
                            Recent History
                          </div>
                          <div className="mt-3 space-y-3">
                            {history.length === 0 ? (
                              <p className="text-sm text-slate-400">
                                Saved run history appears here after you execute a saved snippet.
                              </p>
                            ) : (
                              history.slice(0, 3).map((entry) => (
                                <div key={entry.id} className="rounded border border-white/5 bg-[#0f131c] p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-semibold text-[#e1e2eb]">
                                      {entry.codeSnippet.title}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {formatDate(entry.createdAt)}
                                    </div>
                                  </div>
                                  <p className="mt-2 max-h-10 overflow-hidden font-['JetBrains_Mono'] text-xs leading-5 text-slate-400">
                                    {entry.output || "No console output captured."}
                                  </p>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    ) : isAuthLoading ? (
                      <div className="rounded border border-white/5 bg-[#151921] p-4 text-sm text-slate-400">
                        Restoring your Supabase session...
                      </div>
                    ) : (
                      <form onSubmit={handleAuthSubmit} className="space-y-3">
                        <input
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="Email address"
                          className="w-full rounded border border-white/10 bg-[#151921] px-3 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40"
                          required
                        />
                        <input
                          type="password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Password"
                          className="w-full rounded border border-white/10 bg-[#151921] px-3 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40"
                          required
                          minLength={6}
                        />
                        <button
                          type="submit"
                          disabled={isAuthenticating || isAuthLoading}
                          className="w-full rounded bg-gradient-to-r from-cyan-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
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
                          <div className="rounded border border-amber-400/20 bg-amber-400/10 px-3 py-3 text-sm text-amber-100">
                            <p>
                              Confirm <span className="font-semibold">{pendingConfirmationEmail}</span> from your inbox before logging in and saving snippets.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                void handleResendConfirmation();
                              }}
                              className="mt-3 rounded border border-amber-300/25 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-50 transition hover:bg-white/10"
                            >
                              Resend confirmation
                            </button>
                          </div>
                        ) : null}
                      </form>
                    )}
                  </section>
                </div>

              </div>
            </motion.section>
          </div>
        </div>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#151921]/90 px-4 py-3 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 xl:flex-row xl:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <span className="whitespace-nowrap font-['JetBrains_Mono'] text-xs text-slate-500">
              Step {trace.steps.length === 0 ? 0 : currentStepIndex + 1}/{trace.steps.length}
            </span>
            <div
              onClick={handleTimelineClick}
              className="relative h-2 flex-1 cursor-pointer rounded-full bg-[#32353c]"
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(0,209,255,0.5)]"
                style={{ width: `${timelineProgress}%` }}
              />
              {trace.steps.length > 0 ? (
                <div
                  className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-cyan-400 bg-white"
                  style={{ left: `calc(${timelineProgress}% - 6px)` }}
                />
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-6">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={currentStepIndex <= 0}
              className="flex items-center gap-2 rounded-lg p-2 text-slate-400 transition hover:bg-cyan-500/10 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[26px]">skip_previous</span>
              <span className="text-[11px] uppercase tracking-[0.16em]">Back</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveWorkspaceTab("visualizer");
                setActiveRailSection("flow");
                togglePlayback();
              }}
              disabled={trace.steps.length === 0}
              className="flex items-center gap-2 rounded-lg p-2 text-cyan-400 transition hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[32px]">
                {isPlaying ? "pause_circle" : "play_circle"}
              </span>
              <span className="text-[11px] uppercase tracking-[0.16em]">
                {isPlaying ? "Pause" : "Play"}
              </span>
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={
                trace.steps.length === 0 || currentStepIndex >= trace.steps.length - 1
              }
              className="flex items-center gap-2 rounded-lg p-2 text-slate-400 transition hover:bg-cyan-500/10 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[26px]">skip_next</span>
              <span className="text-[11px] uppercase tracking-[0.16em]">Next</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 rounded-lg p-2 text-slate-400 transition hover:bg-cyan-500/10 hover:text-slate-200"
            >
              <span className="material-symbols-outlined text-[24px]">restart_alt</span>
              <span className="text-[11px] uppercase tracking-[0.16em]">Reset</span>
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-2 rounded-lg p-2 text-slate-400 transition hover:bg-cyan-500/10 hover:text-slate-200"
            >
              <span className="material-symbols-outlined text-[24px]">ios_share</span>
              <span className="text-[11px] uppercase tracking-[0.16em]">Export</span>
            </button>
            <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">
              <span className="font-['Space_Grotesk'] uppercase tracking-[0.12em]">
                Speed
              </span>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.25"
                value={playbackRate}
                onChange={(event) => setPlaybackRate(Number(event.target.value))}
                className="w-24 accent-cyan-400"
              />
              <span className="w-10 text-right font-['JetBrains_Mono'] text-slate-300">
                {playbackRate.toFixed(2)}x
              </span>
            </label>
          </div>
        </div>
      </footer>
      <ToastViewport notice={notice} onDismiss={() => setNotice(null)} />
    </main>
  );
};
