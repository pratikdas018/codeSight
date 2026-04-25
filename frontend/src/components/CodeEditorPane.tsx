import { useEffect, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import clsx from "clsx";
import type { SupportedLanguage } from "../utils/types";
import type { ThemeMode } from "../visualization/types";

interface CodeEditorPaneProps {
  code: string;
  title: string;
  language: SupportedLanguage;
  activeLine?: number;
  explanation?: string;
  onCodeChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onLanguageChange: (value: SupportedLanguage) => void;
  onRun: () => void;
  onSave: () => void;
  themeMode: ThemeMode;
  focusMode: boolean;
  isRunning: boolean;
  isSaving: boolean;
  canSave: boolean;
}

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

export const CodeEditorPane = ({
  code,
  title,
  language,
  activeLine,
  explanation,
  onCodeChange,
  onTitleChange,
  onLanguageChange,
  onRun,
  onSave,
  themeMode,
  focusMode,
  isRunning,
  isSaving,
  canSave,
}: CodeEditorPaneProps) => {
  const isDark = themeMode === "dark";
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef =
    useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const explanationNodeRef = useRef<HTMLDivElement | null>(null);
  const explanationPositionRef = useRef<Monaco.Position | null>(null);
  const explanationWidgetRef = useRef<Monaco.editor.IContentWidget | null>(null);

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

    if (!activeLine) {
      decorationsRef.current.set([]);
      return;
    }

    decorationsRef.current.set([
      {
        range: new monaco.Range(activeLine, 1, activeLine, 1),
        options: {
          isWholeLine: true,
          className: "current-execution-line",
          linesDecorationsClassName: "current-execution-gutter",
        },
      },
    ]);
    editor.revealLineInCenter(activeLine);
  }, [activeLine]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const explanationNode = explanationNodeRef.current;
    const explanationWidget = explanationWidgetRef.current;

    if (!editor || !monaco || !explanationNode || !explanationWidget) {
      return;
    }

    if (!activeLine || !explanation) {
      explanationNode.style.display = "none";
      explanationPositionRef.current = null;
      editor.layoutContentWidget(explanationWidget);
      return;
    }

    explanationNode.style.display = "block";
    explanationNode.className = clsx(
      "codesight-explanation-widget",
      isDark ? "codesight-explanation-widget-dark" : "",
      focusMode ? "codesight-explanation-widget-focus" : "",
    );

    const titleNode = document.createElement("p");
    titleNode.className = "codesight-explanation-title";
    titleNode.textContent = `Line ${activeLine}`;

    const bodyNode = document.createElement("p");
    bodyNode.className = "codesight-explanation-body";
    bodyNode.textContent = explanation;

    explanationNode.replaceChildren(titleNode, bodyNode);
    explanationPositionRef.current = new monaco.Position(activeLine, 1);
    editor.layoutContentWidget(explanationWidget);
  }, [activeLine, explanation, focusMode, isDark]);

  useEffect(
    () => () => {
      if (editorRef.current && explanationWidgetRef.current) {
        editorRef.current.removeContentWidget(explanationWidgetRef.current);
      }
    },
    [],
  );

  return (
    <section
      className={clsx(
        "flex h-full flex-col overflow-hidden rounded-[2rem] border shadow-panel backdrop-blur transition",
        isDark
          ? "border-slate-700/70 bg-slate-900/85"
          : "border-white/60 bg-white/80",
        focusMode ? "ring-1 ring-amber-300/60" : "",
      )}
    >
      <div
        className={clsx(
          "flex flex-wrap items-center gap-3 border-b px-5 py-4",
          isDark ? "border-slate-700" : "border-slate-200",
        )}
      >
        <div className="min-w-[220px] flex-1">
          <p
            className={clsx(
              "font-mono text-xs uppercase tracking-[0.3em]",
              isDark ? "text-slate-400" : "text-slate-500",
            )}
          >
            {languageLabels[language]} Workspace
          </p>
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Snippet title"
            className={clsx(
              "mt-2 w-full border-none bg-transparent text-lg font-semibold outline-none",
              isDark ? "text-slate-100" : "text-ink",
            )}
          />
        </div>

        <label
          className={clsx(
            "flex items-center gap-2 rounded-full border px-3 py-2 text-sm",
            isDark
              ? "border-slate-600 bg-slate-800 text-slate-100"
              : "border-slate-300 bg-white text-slate-700",
          )}
        >
          <span
            className={clsx(
              "font-mono text-xs uppercase tracking-[0.2em]",
              isDark ? "text-slate-400" : "text-slate-400",
            )}
          >
            Language
          </span>
          <select
            value={language}
            onChange={(event) =>
              onLanguageChange(event.target.value as SupportedLanguage)
            }
            className="bg-transparent outline-none"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="c">C</option>
            <option value="cpp">C++</option>
            <option value="java">Java</option>
          </select>
        </label>

        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || isSaving}
          className={clsx(
            "rounded-full border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
            isDark
              ? "border-slate-600 text-slate-100 hover:border-amber-300 hover:text-amber-200"
              : "border-slate-300 text-slate-700 hover:border-ink hover:text-ink",
          )}
        >
          {isSaving ? "Saving..." : "Save Code"}
        </button>
        <button
          type="button"
          onClick={onRun}
          disabled={isRunning}
          className={clsx(
            "rounded-full px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
            isDark
              ? "bg-amber-400 text-slate-950 hover:bg-amber-300"
              : "bg-glow text-ink hover:bg-amber-300",
          )}
        >
          {isRunning ? "Running..." : "Run"}
        </button>
      </div>

      <div className="min-h-[420px] flex-1">
        <Editor
          height="100%"
          defaultLanguage={monacoLanguageMap[language]}
          language={monacoLanguageMap[language]}
          value={code}
          onChange={(value) => onCodeChange(value ?? "")}
          onMount={handleEditorMount}
          theme={isDark ? "vs-dark" : "vs"}
          options={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbersMinChars: 3,
            padding: { top: 18, bottom: 18 },
            roundedSelection: false,
          }}
        />
      </div>
    </section>
  );
};
