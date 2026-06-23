import { memo, useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import type { ExecutionDiagnostic, ExecutionTrace } from "../engine/types";
import type { HeapBlockModel, MemoryDiffState, StackFrameModel } from "../memory/types";
import type {
  ExecutionClassroomFrame,
  ExecutionInspectorEntry,
} from "../visualization/executionClassroom";
import { VariableTransition } from "./VariableTransition";

interface ExecutionVisualizerProps {
  trace: ExecutionTrace;
  frame: ExecutionClassroomFrame;
  isExecuting: boolean;
  focusMode: boolean;
  onDiagnosticSelect: (diagnostic: ExecutionDiagnostic) => void;
}

type InsightTab = "explanation" | "variables" | "stack" | "heap";

const diffTone: Record<
  MemoryDiffState | ExecutionInspectorEntry["change"],
  string
> = {
  allocated: "border-emerald-300/20 bg-emerald-300/8",
  freed: "border-rose-300/20 bg-rose-300/8",
  updated: "border-amber-300/20 bg-amber-300/8",
  added: "border-emerald-300/20 bg-emerald-300/8",
  removed: "border-rose-300/20 bg-rose-300/8",
  unchanged: "border-[var(--cs-border)] bg-transparent",
};

const centerItemInContainer = (
  container: HTMLElement | null,
  element: HTMLElement | null | undefined,
) => {
  if (!container || !element) return;
  const targetTop =
    element.offsetTop - container.clientHeight / 2 + element.clientHeight / 2;
  container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
};

const assignRevealTarget =
  (mapRef: RefObject<Map<string, HTMLElement>>, id: string) =>
  (node: HTMLElement | null) => {
    if (node) {
      mapRef.current.set(id, node);
    } else {
      mapRef.current.delete(id);
    }
  };

// ─── Explanation tab ─────────────────────────────────────────────────────────

const ExplanationTab = ({
  trace,
  frame,
  onDiagnosticSelect,
}: Pick<ExecutionVisualizerProps, "trace" | "onDiagnosticSelect"> & {
  frame: ExecutionClassroomFrame;
}) => (
  <div className="space-y-3">
    {/* Current executing line — hero element */}
    <div className="rounded-xl border border-[rgba(114,255,112,0.16)] bg-[rgba(10,16,10,0.96)] px-4 py-3">
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-[var(--cs-text-subtle)]">
        Executing now
      </div>
      <div className="break-words font-mono text-sm leading-6 text-[var(--cs-text)]">
        {frame.lineCode || (
          <span className="text-[var(--cs-text-subtle)]">
            Run the program to see the active line here.
          </span>
        )}
      </div>
    </div>

    {/* Explanation — the hero */}
    <div className="rounded-xl border border-[var(--cs-border)] bg-[rgba(11,14,11,0.92)] px-4 py-3">
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-[var(--cs-text-subtle)]">
        Explanation
      </div>
      <p className="text-sm leading-7 text-[var(--cs-text)]">
        {frame.explanation || (
          <span className="text-[var(--cs-text-subtle)]">
            Step through the timeline to see explanations here.
          </span>
        )}
      </p>
    </div>

    {/* Console output — compact, secondary */}
    {frame.runtime.consolePreview.length > 0 ? (
      <div className="rounded-xl border border-[var(--cs-border)] bg-[rgba(11,14,11,0.92)] px-4 py-3">
        <div className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-[var(--cs-text-subtle)]">
          Console
        </div>
        <div className="space-y-1 font-mono text-xs leading-5 text-[var(--cs-text-muted)]">
          {frame.runtime.consolePreview.map((line, index) => (
            <div key={`${line}-${index}`} className="break-all">
              {line}
            </div>
          ))}
        </div>
      </div>
    ) : null}

    {/* Diagnostics */}
    {trace.diagnostics.length > 0 ? (
      <div className="space-y-2">
        {trace.diagnostics.slice(0, 2).map((diagnostic, index) => (
          <button
            key={`${diagnostic.summary}-${index}`}
            type="button"
            onClick={() => onDiagnosticSelect(diagnostic)}
            className="w-full rounded-xl border border-rose-300/16 bg-rose-300/8 px-4 py-3 text-left transition hover:border-rose-300/28"
          >
            <div className="text-[10px] uppercase tracking-[0.18em] text-rose-300">
              {diagnostic.phase} error
            </div>
            <div className="mt-1 text-sm font-medium text-rose-100">
              {diagnostic.summary}
            </div>
            {diagnostic.line ? (
              <div className="mt-1 text-xs text-rose-200/70">
                Jump to line {diagnostic.line}
              </div>
            ) : null}
          </button>
        ))}
      </div>
    ) : null}

    {/* Runtime summary chips — compact, beneath explanation */}
    {(frame.runtime.changedVariableCount > 0 ||
      frame.runtime.stackFrameCount > 0 ||
      frame.runtime.heapBlockCount > 0) ? (
      <div className="flex flex-wrap gap-1.5 pt-1">
        {frame.runtime.changedVariableCount > 0 ? (
          <span className="rounded-full border border-[rgba(114,255,112,0.14)] bg-[rgba(114,255,112,0.06)] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--cs-primary-bright)]">
            {frame.runtime.changedVariableCount} change
            {frame.runtime.changedVariableCount === 1 ? "" : "s"}
          </span>
        ) : null}
        {frame.runtime.stackFrameCount > 0 ? (
          <span className="rounded-full border border-[var(--cs-border)] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--cs-text-subtle)]">
            {frame.runtime.stackFrameCount} frame
            {frame.runtime.stackFrameCount === 1 ? "" : "s"}
          </span>
        ) : null}
        {frame.runtime.heapBlockCount > 0 ? (
          <span className="rounded-full border border-[var(--cs-border)] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--cs-text-subtle)]">
            {frame.runtime.heapBlockCount} heap block
            {frame.runtime.heapBlockCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
    ) : null}
  </div>
);

// ─── Variables tab ────────────────────────────────────────────────────────────

const VariablesTab = ({
  frame,
  containerRef,
  nodesRef,
}: {
  frame: ExecutionClassroomFrame;
  containerRef: React.RefObject<HTMLDivElement | null>;
  nodesRef: RefObject<Map<string, HTMLElement>>;
}) => (
  <div ref={containerRef} className="workbench-scrollbar max-h-[calc(100vh-26rem)] space-y-2 overflow-y-auto pr-1">
    {frame.trackedVariables.length === 0 ? (
      <div className="rounded-xl border border-dashed border-[var(--cs-border)] px-4 py-6 text-center text-sm text-[var(--cs-text-subtle)]">
        Variables appear here once execution starts.
      </div>
    ) : (
      <AnimatePresence initial={false}>
        {frame.trackedVariables.map((variable) => (
          <div
            key={variable.id}
            ref={assignRevealTarget(nodesRef, variable.id)}
          >
            <VariableTransition variable={variable} />
          </div>
        ))}
      </AnimatePresence>
    )}
  </div>
);

// ─── Stack tab ────────────────────────────────────────────────────────────────

const StackTab = ({
  frame,
  containerRef,
  nodesRef,
  activeReturnPreview,
}: {
  frame: ExecutionClassroomFrame;
  containerRef: React.RefObject<HTMLDivElement | null>;
  nodesRef: RefObject<Map<string, HTMLElement>>;
  activeReturnPreview?: string;
}) => (
  <div ref={containerRef} className="workbench-scrollbar max-h-[calc(100vh-26rem)] space-y-2 overflow-y-auto pr-1">
    {frame.memory.stackFrames.length === 0 ? (
      <div className="rounded-xl border border-dashed border-[var(--cs-border)] px-4 py-6 text-center text-sm text-[var(--cs-text-subtle)]">
        No stack frames on this step.
      </div>
    ) : (
      frame.memory.stackFrames.map((stackFrame) => (
        <StackFrameCard
          key={stackFrame.id}
          frame={stackFrame}
          registerNode={assignRevealTarget.bind(null, nodesRef)}
          returnPreview={activeReturnPreview}
        />
      ))
    )}
  </div>
);

const StackFrameCard = ({
  frame,
  registerNode,
  returnPreview,
}: {
  frame: StackFrameModel;
  registerNode: (id: string) => (node: HTMLElement | null) => void;
  returnPreview?: string;
}) => (
  <motion.article
    ref={registerNode(frame.id)}
    layout
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, ease: "easeOut" }}
    className={clsx(
      "rounded-xl border px-3 py-3",
      diffTone[frame.diffState],
      frame.isActive ? "ring-1 ring-[rgba(114,255,112,0.18)]" : "",
    )}
  >
    <div className="flex items-center justify-between gap-2">
      <div className="font-mono text-sm text-[var(--cs-text)]">
        {frame.isGlobal ? "global" : `${frame.name}()`}
      </div>
      <span
        className={clsx(
          "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]",
          frame.isActive
            ? "border-[rgba(114,255,112,0.16)] bg-[rgba(114,255,112,0.08)] text-[var(--cs-primary-bright)]"
            : "border-[var(--cs-border)] text-[var(--cs-text-subtle)]",
        )}
      >
        {frame.isActive ? "active" : `depth ${frame.depth}`}
      </span>
    </div>

    {frame.lineNumber ? (
      <div className="mt-0.5 text-[11px] text-[var(--cs-text-subtle)]">
        Line {frame.lineNumber}
      </div>
    ) : null}

    {returnPreview && frame.isActive ? (
      <div className="mt-2 rounded-lg border border-[rgba(114,255,112,0.14)] bg-[rgba(114,255,112,0.07)] px-3 py-1.5 text-xs text-[var(--cs-primary-bright)]">
        {returnPreview}
      </div>
    ) : null}

    {(frame.parameters.length > 0 || frame.locals.length > 0) ? (
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {frame.parameters.length > 0 ? (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
              Params
            </div>
            <div className="space-y-1">
              {frame.parameters.map((slot) => (
                <div
                  key={slot.id}
                  className={clsx("rounded-lg border px-2.5 py-1.5", diffTone[slot.diffState])}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-[var(--cs-text)]">{slot.name}</span>
                    <span className="font-mono text-xs text-[var(--cs-text-muted)]">{slot.displayValue}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {frame.locals.length > 0 ? (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
              Locals
            </div>
            <div className="space-y-1">
              {frame.locals.map((slot) => (
                <div
                  key={slot.id}
                  className={clsx("rounded-lg border px-2.5 py-1.5", diffTone[slot.diffState])}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-[var(--cs-text)]">{slot.name}</span>
                    <span className="font-mono text-xs text-[var(--cs-text-muted)]">{slot.displayValue}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    ) : null}
  </motion.article>
);

// ─── Heap tab ─────────────────────────────────────────────────────────────────

const HeapTab = ({
  frame,
  containerRef,
  nodesRef,
}: {
  frame: ExecutionClassroomFrame;
  containerRef: React.RefObject<HTMLDivElement | null>;
  nodesRef: RefObject<Map<string, HTMLElement>>;
}) => (
  <div ref={containerRef} className="workbench-scrollbar max-h-[calc(100vh-26rem)] space-y-2 overflow-y-auto pr-1">
    {frame.heapBlocks.length === 0 ? (
      <div className="rounded-xl border border-dashed border-[var(--cs-border)] px-4 py-6 text-center text-sm text-[var(--cs-text-subtle)]">
        No heap allocations on this frame.
      </div>
    ) : (
      frame.heapBlocks.map((block) => (
        <HeapBlockCard
          key={block.id}
          block={block}
          registerNode={assignRevealTarget.bind(null, nodesRef)}
        />
      ))
    )}
  </div>
);

const HeapBlockCard = ({
  block,
  registerNode,
}: {
  block: HeapBlockModel;
  registerNode: (id: string) => (node: HTMLElement | null) => void;
}) => {
  const changedCells = block.cells.filter((cell) => cell.diffState !== "unchanged");

  return (
    <motion.article
      ref={registerNode(block.id)}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={clsx("rounded-xl border px-3 py-3", diffTone[block.diffState])}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-sm text-[var(--cs-text)]">{block.title}</div>
        {changedCells.length > 0 ? (
          <span className="rounded-full border border-[rgba(114,255,112,0.16)] bg-[rgba(114,255,112,0.08)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--cs-primary-bright)]">
            {changedCells.length} changed
          </span>
        ) : null}
      </div>
      <div className="mt-0.5 flex gap-2 text-[10px] uppercase tracking-[0.14em] text-[var(--cs-text-subtle)]">
        <span>{block.kind}</span>
        <span>{block.address}</span>
      </div>

      {block.cells.length > 0 ? (
        <div className="mt-2.5 space-y-1">
          {block.cells.map((cell) => (
            <motion.div
              key={cell.id}
              layout
              animate={cell.diffState !== "unchanged" ? { scale: [1, 1.02, 1] } : { scale: 1 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className={clsx("rounded-lg border px-2.5 py-1.5", diffTone[cell.diffState])}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-[var(--cs-text)]">{cell.label}</span>
                <span className="font-mono text-xs text-[var(--cs-text-muted)]">{cell.displayValue}</span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : null}
    </motion.article>
  );
};

// ─── Tab button ───────────────────────────────────────────────────────────────

const TabButton = ({
  tab,
  activeTab,
  label,
  badge,
  onClick,
}: {
  tab: InsightTab;
  activeTab: InsightTab;
  label: string;
  badge?: number;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={clsx(
      "relative flex items-center gap-1.5 px-1 pb-2.5 text-sm transition",
      tab === activeTab
        ? "text-[var(--cs-text)]"
        : "text-[var(--cs-text-subtle)] hover:text-[var(--cs-text-muted)]",
    )}
  >
    {label}
    {badge != null && badge > 0 ? (
      <span
        className={clsx(
          "rounded-full px-1.5 py-0.5 font-mono text-[9px]",
          tab === activeTab
            ? "bg-[rgba(114,255,112,0.16)] text-[var(--cs-primary-bright)]"
            : "bg-[rgba(255,255,255,0.06)] text-[var(--cs-text-subtle)]",
        )}
      >
        {badge}
      </span>
    ) : null}
    {tab === activeTab ? (
      <motion.div
        layoutId="insight-tab-indicator"
        className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[var(--cs-primary-bright)]"
        transition={{ duration: 0.2, ease: "easeInOut" }}
      />
    ) : null}
  </button>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const ExecutionVisualizer = memo(
  ({
    trace,
    frame,
    isExecuting,
    focusMode,
    onDiagnosticSelect,
  }: ExecutionVisualizerProps) => {
    const [activeTab, setActiveTab] = useState<InsightTab>("explanation");

    const variablesContainerRef = useRef<HTMLDivElement | null>(null);
    const stackContainerRef = useRef<HTMLDivElement | null>(null);
    const heapContainerRef = useRef<HTMLDivElement | null>(null);
    const variableNodesRef = useRef(new Map<string, HTMLElement>());
    const stackNodesRef = useRef(new Map<string, HTMLElement>());
    const heapNodesRef = useRef(new Map<string, HTMLElement>());

    // Auto-switch to variables tab when variables change and we're not on it
    useEffect(() => {
      if (
        frame.runtime.changedVariableCount > 0 &&
        activeTab === "explanation" &&
        !focusMode
      ) {
        // intentionally don't auto-switch — user controls tabs
      }
    }, [frame.runtime.changedVariableCount, activeTab, focusMode]);

    useEffect(() => {
      centerItemInContainer(
        variablesContainerRef.current,
        frame.focusVariableId
          ? variableNodesRef.current.get(frame.focusVariableId)
          : null,
      );
      centerItemInContainer(
        stackContainerRef.current,
        frame.focusStackFrameId
          ? stackNodesRef.current.get(frame.focusStackFrameId)
          : null,
      );
      centerItemInContainer(
        heapContainerRef.current,
        frame.focusHeapBlockId
          ? heapNodesRef.current.get(frame.focusHeapBlockId)
          : null,
      );
    }, [
      frame.focusHeapBlockId,
      frame.focusStackFrameId,
      frame.focusVariableId,
      frame.frameIndex,
    ]);

    const activeReturnPreview =
      frame.lineCode.trim().startsWith("return") && frame.activeStackFrame
        ? `Returning from ${frame.activeStackFrame.name} with ${frame.lineCode.trim().replace(/^return\s+/, "")}`
        : undefined;

    return (
      <aside
        className={clsx(
          "flex min-h-[28rem] flex-col overflow-hidden rounded-[1.6rem] border border-[var(--cs-border)] bg-[rgba(8,11,8,0.97)] shadow-[0_20px_60px_rgba(0,0,0,0.38)] transition-all",
          focusMode ? "opacity-80 hover:opacity-100" : "",
        )}
      >
        {/* Header: title + current line — one place, clear hierarchy */}
        <div className="border-b border-[var(--cs-border)] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
              Execution Insights
            </div>
            {frame.lineNumber ? (
              <span className="font-mono text-[11px] text-[var(--cs-primary-bright)]">
                Line {frame.lineNumber}
              </span>
            ) : isExecuting ? (
              <span className="font-mono text-[11px] text-sky-400">Running…</span>
            ) : null}
          </div>

          {/* Tab bar */}
          <div className="mt-3 flex gap-4 border-b border-[var(--cs-border)]">
            <TabButton
              tab="explanation"
              activeTab={activeTab}
              label="Explanation"
              onClick={() => setActiveTab("explanation")}
            />
            <TabButton
              tab="variables"
              activeTab={activeTab}
              label="Variables"
              badge={frame.trackedVariables.length}
              onClick={() => setActiveTab("variables")}
            />
            <TabButton
              tab="stack"
              activeTab={activeTab}
              label="Stack"
              badge={frame.memory.stackFrames.length}
              onClick={() => setActiveTab("stack")}
            />
            <TabButton
              tab="heap"
              activeTab={activeTab}
              label="Heap"
              badge={frame.heapBlocks.length}
              onClick={() => setActiveTab("heap")}
            />
          </div>
        </div>

        {/* Tab content */}
        <div className="workbench-scrollbar flex-1 overflow-y-auto px-4 py-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {activeTab === "explanation" ? (
                <ExplanationTab
                  trace={trace}
                  frame={frame}
                  onDiagnosticSelect={onDiagnosticSelect}
                />
              ) : activeTab === "variables" ? (
                <VariablesTab
                  frame={frame}
                  containerRef={variablesContainerRef}
                  nodesRef={variableNodesRef}
                />
              ) : activeTab === "stack" ? (
                <StackTab
                  frame={frame}
                  containerRef={stackContainerRef}
                  nodesRef={stackNodesRef}
                  activeReturnPreview={activeReturnPreview}
                />
              ) : (
                <HeapTab
                  frame={frame}
                  containerRef={heapContainerRef}
                  nodesRef={heapNodesRef}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </aside>
    );
  },
);

ExecutionVisualizer.displayName = "ExecutionVisualizer";
