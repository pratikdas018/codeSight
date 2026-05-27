import { memo, useEffect, useRef, type MutableRefObject } from "react";
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

const sectionClass =
  "rounded-[1.4rem] border border-[var(--cs-border)] bg-[rgba(8,11,8,0.92)] p-4 shadow-[0_16px_34px_rgba(0,0,0,0.22)]";

const scrollAreaClass =
  "workbench-scrollbar mt-4 max-h-[18rem] space-y-3 overflow-y-auto pr-1";

const runtimeTone: Record<ExecutionTrace["status"], string> = {
  queued: "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)]",
  running:
    "border-[rgba(114,255,112,0.24)] bg-[rgba(114,255,112,0.1)] text-[var(--cs-primary-bright)]",
  completed:
    "border-[rgba(114,255,112,0.24)] bg-[rgba(114,255,112,0.1)] text-[var(--cs-primary-bright)]",
  compile_error: "border-amber-300/18 bg-amber-300/10 text-amber-100",
  runtime_missing: "border-amber-300/18 bg-amber-300/10 text-amber-100",
  runtime_error: "border-rose-300/18 bg-rose-300/10 text-rose-100",
  timed_out: "border-rose-300/18 bg-rose-300/10 text-rose-100",
  memory_limit: "border-orange-300/18 bg-orange-300/10 text-orange-100",
  trace_failure: "border-sky-300/18 bg-sky-300/10 text-sky-100",
  internal_error: "border-rose-300/18 bg-rose-300/10 text-rose-100",
};

const diffTone: Record<
  MemoryDiffState | ExecutionInspectorEntry["change"],
  string
> = {
  allocated: "border-emerald-300/24 bg-emerald-300/10",
  freed: "border-rose-300/24 bg-rose-300/10",
  updated: "border-amber-300/24 bg-amber-300/10",
  added: "border-emerald-300/24 bg-emerald-300/10",
  removed: "border-rose-300/24 bg-rose-300/10",
  unchanged: "border-[rgba(255,255,255,0.05)] bg-[rgba(12,15,12,0.96)]",
};

const chipClass =
  "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em]";

const centerItemInContainer = (
  container: HTMLElement | null,
  element: HTMLElement | null | undefined,
) => {
  if (!container || !element) {
    return;
  }

  const targetTop =
    element.offsetTop - container.clientHeight / 2 + element.clientHeight / 2;

  container.scrollTo({
    top: Math.max(0, targetTop),
    behavior: "smooth",
  });
};

const assignRevealTarget = (
  mapRef: MutableRefObject<Map<string, HTMLElement>>,
  id: string,
) => (node: HTMLElement | null) => {
  if (node) {
    mapRef.current.set(id, node);
    return;
  }

  mapRef.current.delete(id);
};

const RuntimePanel = ({
  trace,
  frame,
  isExecuting,
  onDiagnosticSelect,
}: Pick<ExecutionVisualizerProps, "trace" | "isExecuting" | "onDiagnosticSelect"> & {
  frame: ExecutionClassroomFrame;
}) => (
  <section className={sectionClass}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
          Runtime Status
        </div>
        <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
          Frame-level execution context stays locked to the highlighted line.
        </p>
      </div>
      <span className={clsx(chipClass, runtimeTone[trace.status])}>
        {isExecuting ? "running" : frame.runtime.statusLabel}
      </span>
    </div>

    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {[
        {
          label: "Frame",
          value:
            frame.totalFrames > 0
              ? `${frame.frameNumber}/${frame.totalFrames}`
              : "No trace",
        },
        {
          label: "Current line",
          value: frame.lineNumber ? `Line ${frame.lineNumber}` : "Waiting",
        },
        {
          label: "Function",
          value: frame.functionName,
        },
        {
          label: "Trace quality",
          value: frame.runtime.traceQuality,
        },
      ].map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[rgba(11,14,11,0.92)] px-3 py-3"
        >
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
            {item.label}
          </div>
          <div className="mt-2 text-sm font-medium text-[var(--cs-text)]">
            {item.value}
          </div>
        </div>
      ))}
    </div>

    <div className="mt-3 rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[rgba(11,14,11,0.92)] px-3 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
        Classroom sync
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--cs-text)]">
        {frame.runtime.summary}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-[rgba(114,255,112,0.14)] bg-[rgba(114,255,112,0.08)] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--cs-primary-bright)]">
          {frame.runtime.changedVariableCount} variable change
          {frame.runtime.changedVariableCount === 1 ? "" : "s"}
        </span>
        <span className="rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--cs-text-muted)]">
          {frame.runtime.stackFrameCount} stack frame
          {frame.runtime.stackFrameCount === 1 ? "" : "s"}
        </span>
        <span className="rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--cs-text-muted)]">
          {frame.runtime.heapBlockCount} heap block
          {frame.runtime.heapBlockCount === 1 ? "" : "s"}
        </span>
      </div>
    </div>

    {frame.runtime.consolePreview.length > 0 ? (
      <div className="mt-3 rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[rgba(11,14,11,0.92)] px-3 py-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
          Console
        </div>
        <div className="mt-2 space-y-1 font-mono text-xs leading-6 text-[var(--cs-text-muted)]">
          {frame.runtime.consolePreview.map((line, index) => (
            <div key={`${line}-${index}`} className="break-all">
              {line}
            </div>
          ))}
        </div>
      </div>
    ) : null}

    {trace.diagnostics.length > 0 ? (
      <div className="mt-3 space-y-2">
        {trace.diagnostics.slice(0, 2).map((diagnostic, index) => (
          <button
            key={`${diagnostic.summary}-${index}`}
            type="button"
            onClick={() => onDiagnosticSelect(diagnostic)}
            className="w-full rounded-2xl border border-rose-300/16 bg-rose-300/10 px-3 py-3 text-left transition hover:border-rose-300/30"
          >
            <div className="text-[10px] uppercase tracking-[0.18em] text-rose-100">
              {diagnostic.phase} diagnostic
            </div>
            <div className="mt-2 text-sm font-medium text-rose-50">
              {diagnostic.summary}
            </div>
            {diagnostic.line ? (
              <div className="mt-1 text-xs text-rose-100/80">
                Jump to line {diagnostic.line}
              </div>
            ) : null}
          </button>
        ))}
      </div>
    ) : null}
  </section>
);

const StackFrameCard = ({
  frame,
  focusMode,
  registerNode,
  returnPreview,
}: {
  frame: StackFrameModel;
  focusMode: boolean;
  registerNode: (id: string) => (node: HTMLElement | null) => void;
  returnPreview?: string;
}) => (
  <motion.article
    ref={registerNode(frame.id)}
    layout
    initial={{ opacity: 0, y: 12 }}
    animate={{
      opacity: 1,
      y: 0,
      boxShadow:
        frame.isActive || frame.diffState !== "unchanged"
          ? [
              "0 0 0 rgba(114,255,112,0)",
              "0 18px 38px rgba(114,255,112,0.14)",
              "0 0 0 rgba(114,255,112,0)",
            ]
          : "0 12px 24px rgba(0,0,0,0.18)",
    }}
    transition={{ duration: 0.42, ease: "easeOut" }}
    className={clsx(
      "rounded-[1.25rem] border px-3 py-3",
      diffTone[frame.diffState],
      frame.isActive
        ? "ring-1 ring-[rgba(114,255,112,0.22)]"
        : "",
      focusMode && frame.isActive
        ? "shadow-[0_0_0_1px_rgba(114,255,112,0.06),0_0_28px_rgba(114,255,112,0.12)]"
        : "",
    )}
  >
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold text-[var(--cs-text)]">
            {frame.isGlobal ? "global scope" : `${frame.name}()`}
          </div>
          <span
            className={clsx(
              chipClass,
              frame.isActive
                ? "border-[rgba(114,255,112,0.18)] bg-[rgba(114,255,112,0.1)] text-[var(--cs-primary-bright)]"
                : "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-subtle)]",
            )}
          >
            {frame.isActive ? "active" : `depth ${frame.depth}`}
          </span>
          {frame.recursionDepth > 0 ? (
            <span className="rounded-full border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.03)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--cs-text-subtle)]">
              recursion {frame.recursionDepth}
            </span>
          ) : null}
        </div>
        <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
          {frame.lineNumber ? `Line ${frame.lineNumber}` : "Line pending"}
        </div>
      </div>
      {frame.returnAddress ? (
        <div className="rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--cs-text-muted)]">
          return {frame.returnAddress}
        </div>
      ) : null}
    </div>

    {returnPreview && frame.isActive ? (
      <div className="mt-3 rounded-xl border border-[rgba(114,255,112,0.14)] bg-[rgba(114,255,112,0.08)] px-3 py-2 text-xs text-[var(--cs-primary-bright)]">
        {returnPreview}
      </div>
    ) : null}

    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <div>
        <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
          Parameters
        </div>
        <div className="space-y-2">
          {frame.parameters.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--cs-border)] px-3 py-2 text-xs text-[var(--cs-text-subtle)]">
              No parameters captured.
            </div>
          ) : (
            frame.parameters.map((slot) => (
              <div
                key={slot.id}
                className={clsx(
                  "rounded-xl border px-3 py-2",
                  diffTone[slot.diffState],
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs text-[var(--cs-text)]">
                    {slot.name}
                  </span>
                  <span className="font-mono text-xs text-[var(--cs-text-muted)]">
                    {slot.displayValue}
                  </span>
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                  {slot.typeLabel}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
          Local variables
        </div>
        <div className="space-y-2">
          {frame.locals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--cs-border)] px-3 py-2 text-xs text-[var(--cs-text-subtle)]">
              No local variables captured.
            </div>
          ) : (
            frame.locals.map((slot) => (
              <div
                key={slot.id}
                className={clsx(
                  "rounded-xl border px-3 py-2",
                  diffTone[slot.diffState],
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs text-[var(--cs-text)]">
                    {slot.name}
                  </span>
                  <span className="font-mono text-xs text-[var(--cs-text-muted)]">
                    {slot.displayValue}
                  </span>
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                  {slot.typeLabel}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  </motion.article>
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
      initial={{ opacity: 0, y: 12 }}
      animate={{
        opacity: 1,
        y: 0,
        boxShadow:
          block.diffState !== "unchanged" || changedCells.length > 0
            ? [
                "0 0 0 rgba(114,255,112,0)",
                "0 18px 40px rgba(114,255,112,0.14)",
                "0 0 0 rgba(114,255,112,0)",
              ]
            : "0 12px 22px rgba(0,0,0,0.18)",
      }}
      transition={{ duration: 0.42, ease: "easeOut" }}
      className={clsx(
        "rounded-[1.25rem] border px-3 py-3",
        diffTone[block.diffState],
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--cs-text)]">
            {block.title}
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
            <span>{block.kind}</span>
            <span>{block.address}</span>
            <span>{block.summary}</span>
          </div>
        </div>
        <span
          className={clsx(
            chipClass,
            changedCells.length > 0 || block.diffState !== "unchanged"
              ? "border-[rgba(114,255,112,0.18)] bg-[rgba(114,255,112,0.1)] text-[var(--cs-primary-bright)]"
              : "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-subtle)]",
          )}
        >
          {changedCells.length} live change
          {changedCells.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {block.cells.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--cs-border)] px-3 py-2 text-xs text-[var(--cs-text-subtle)]">
            No heap fields captured.
          </div>
        ) : (
          block.cells.map((cell) => (
            <motion.div
              key={cell.id}
              layout
              animate={
                cell.diffState !== "unchanged"
                  ? { scale: [1, 1.02, 1] }
                  : { scale: 1 }
              }
              transition={{ duration: 0.36, ease: "easeOut" }}
              className={clsx(
                "rounded-xl border px-3 py-2",
                diffTone[cell.diffState],
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs text-[var(--cs-text)]">
                  {cell.label}
                </span>
                <span className="font-mono text-xs text-[var(--cs-text-muted)]">
                  {cell.displayValue}
                </span>
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                {cell.typeLabel}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.article>
  );
};

export const ExecutionVisualizer = memo(
  ({
    trace,
    frame,
    isExecuting,
    focusMode,
    onDiagnosticSelect,
  }: ExecutionVisualizerProps) => {
    const variablesContainerRef = useRef<HTMLDivElement | null>(null);
    const stackContainerRef = useRef<HTMLDivElement | null>(null);
    const heapContainerRef = useRef<HTMLDivElement | null>(null);
    const inspectorContainerRef = useRef<HTMLDivElement | null>(null);
    const variableNodesRef = useRef(new Map<string, HTMLElement>());
    const stackNodesRef = useRef(new Map<string, HTMLElement>());
    const heapNodesRef = useRef(new Map<string, HTMLElement>());
    const inspectorNodesRef = useRef(new Map<string, HTMLElement>());

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
      centerItemInContainer(
        inspectorContainerRef.current,
        frame.focusInspectorId
          ? inspectorNodesRef.current.get(frame.focusInspectorId)
          : null,
      );
    }, [
      frame.focusHeapBlockId,
      frame.focusInspectorId,
      frame.focusStackFrameId,
      frame.focusVariableId,
      frame.frameIndex,
    ]);

    const activeReturnPreview =
      frame.lineCode.trim().startsWith("return") && frame.activeStackFrame
        ? `Returning from ${frame.activeStackFrame.name} with ${frame.lineCode.trim().replace(/^return\s+/, "")}`
        : undefined;

    return (
      <aside className="flex min-h-[28rem] flex-col overflow-hidden rounded-[1.8rem] border border-[var(--cs-border)] bg-[linear-gradient(180deg,rgba(11,14,11,0.96),rgba(6,8,6,0.98))] shadow-[0_24px_70px_rgba(0,0,0,0.42)]">
        <div className="border-b border-[var(--cs-border)] px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--cs-text-subtle)]">
            Execution Dashboard
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[rgba(114,255,112,0.18)] bg-[rgba(114,255,112,0.08)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--cs-primary-bright)]">
              Frame {frame.frameNumber || "--"} / {frame.totalFrames}
            </span>
            <span className="rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-muted)]">
              {frame.lineNumber ? `Line ${frame.lineNumber}` : "Line pending"}
            </span>
            <span className="rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-muted)]">
              {frame.functionName}
            </span>
            <span className="rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-muted)]">
              {frame.eventLabel}
            </span>
          </div>
        </div>

        <div className="workbench-scrollbar flex-1 overflow-y-auto px-4 py-4">
          <RuntimePanel
            trace={trace}
            frame={frame}
            isExecuting={isExecuting}
            onDiagnosticSelect={onDiagnosticSelect}
          />

          <motion.section
            layout
            className={clsx(
              sectionClass,
              "mt-4",
              focusMode
                ? "border-[rgba(114,255,112,0.2)] shadow-[0_0_0_1px_rgba(114,255,112,0.05),0_0_36px_rgba(114,255,112,0.08)]"
                : "",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
                Current Line
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--cs-primary-bright)]">
                {frame.lineNumber ? `Line ${frame.lineNumber}` : "Waiting"}
              </div>
            </div>

            <motion.div
              animate={
                focusMode
                  ? {
                      boxShadow: [
                        "0 0 0 rgba(114,255,112,0)",
                        "0 0 28px rgba(114,255,112,0.14)",
                        "0 0 0 rgba(114,255,112,0)",
                      ],
                    }
                  : undefined
              }
              transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity }}
              className="mt-3 rounded-[1.25rem] border border-[rgba(114,255,112,0.16)] bg-[linear-gradient(180deg,rgba(10,16,10,0.96),rgba(8,12,8,0.96))] px-4 py-4"
            >
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
                Executing now
              </div>
              <div className="mt-2 break-words font-mono text-sm leading-7 text-[var(--cs-text)]">
                {frame.lineCode || "Run the program to center the active line here."}
              </div>
            </motion.div>

            <div className="mt-3 rounded-[1.25rem] border border-[rgba(255,255,255,0.05)] bg-[rgba(11,14,11,0.92)] px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
                Explanation
              </div>
              <p className="mt-2 text-sm leading-7 text-[var(--cs-text)]">
                {frame.explanation}
              </p>
            </div>
          </motion.section>

          <section className={clsx(sectionClass, "mt-4")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
                  Variable State
                </div>
                <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
                  Changed values pulse first, then stable runtime context stays nearby.
                </p>
              </div>
              <span className="rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-muted)]">
                {frame.trackedVariables.length} tracked
              </span>
            </div>

            <div ref={variablesContainerRef} className={scrollAreaClass}>
              {frame.trackedVariables.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--cs-border)] px-4 py-5 text-sm leading-6 text-[var(--cs-text-muted)]">
                  Variables will appear here once CodeSight captures execution state.
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {frame.trackedVariables.map((variable) => (
                    <div
                      key={variable.id}
                      ref={assignRevealTarget(variableNodesRef, variable.id)}
                    >
                      <VariableTransition variable={variable} />
                    </div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </section>

          <section className={clsx(sectionClass, "mt-4")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
                  Stack Memory
                </div>
                <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
                  Function calls, parameters, locals, and return flow stay synchronized with this frame.
                </p>
              </div>
              <span className="rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-muted)]">
                {frame.memory.stackFrames.length} frame
                {frame.memory.stackFrames.length === 1 ? "" : "s"}
              </span>
            </div>

            <div ref={stackContainerRef} className={scrollAreaClass}>
              {frame.memory.stackFrames.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--cs-border)] px-4 py-5 text-sm leading-6 text-[var(--cs-text-muted)]">
                  No stack frames are visible on this step.
                </div>
              ) : (
                frame.memory.stackFrames.map((stackFrame) => (
                  <StackFrameCard
                    key={stackFrame.id}
                    frame={stackFrame}
                    focusMode={focusMode}
                    registerNode={assignRevealTarget.bind(null, stackNodesRef)}
                    returnPreview={activeReturnPreview}
                  />
                ))
              )}
            </div>
          </section>

          <section className={clsx(sectionClass, "mt-4")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
                  Heap Memory
                </div>
                <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
                  Arrays, vectors, nodes, and objects reveal structure changes as playback advances.
                </p>
              </div>
              <span className="rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-muted)]">
                {frame.heapBlocks.length} block
                {frame.heapBlocks.length === 1 ? "" : "s"}
              </span>
            </div>

            <div ref={heapContainerRef} className={scrollAreaClass}>
              {frame.heapBlocks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--cs-border)] px-4 py-5 text-sm leading-6 text-[var(--cs-text-muted)]">
                  No heap changes are visible on this frame.
                </div>
              ) : (
                frame.heapBlocks.map((block) => (
                  <HeapBlockCard
                    key={block.id}
                    block={block}
                    registerNode={assignRevealTarget.bind(null, heapNodesRef)}
                  />
                ))
              )}
            </div>
          </section>

          <section className={clsx(sectionClass, "mt-4")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
                  Advanced Memory Inspector
                </div>
                <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
                  Previous values, new values, types, scope, and addresses stay locked to the active frame.
                </p>
              </div>
              <span className="rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-muted)]">
                {frame.inspectorEntries.length} entry
                {frame.inspectorEntries.length === 1 ? "" : "s"}
              </span>
            </div>

            <div ref={inspectorContainerRef} className={scrollAreaClass}>
              {frame.inspectorEntries.map((entry) => (
                <motion.article
                  key={entry.id}
                  ref={assignRevealTarget(inspectorNodesRef, entry.id)}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    boxShadow:
                      entry.change !== "unchanged"
                        ? [
                            "0 0 0 rgba(114,255,112,0)",
                            "0 14px 28px rgba(114,255,112,0.12)",
                            "0 0 0 rgba(114,255,112,0)",
                          ]
                        : "0 10px 18px rgba(0,0,0,0.16)",
                  }}
                  transition={{ duration: 0.36, ease: "easeOut" }}
                  className={clsx(
                    "rounded-[1.2rem] border px-3 py-3",
                    diffTone[entry.change],
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--cs-text)]">
                        {entry.label}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                        <span>{entry.scope}</span>
                        <span>{entry.type}</span>
                        {entry.address ? <span>{entry.address}</span> : null}
                      </div>
                    </div>
                    <span
                      className={clsx(
                        chipClass,
                        entry.change !== "unchanged"
                          ? "border-[rgba(114,255,112,0.18)] bg-[rgba(114,255,112,0.1)] text-[var(--cs-primary-bright)]"
                          : "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-subtle)]",
                      )}
                    >
                      {entry.change}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-[minmax(0,1fr),auto,minmax(0,1fr)] items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.05)] bg-[rgba(10,12,10,0.88)] px-3 py-3">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                        Previous
                      </div>
                      <div className="mt-1 truncate font-mono text-xs text-[var(--cs-text-muted)]">
                        {entry.previousValue ?? "not previously visible"}
                      </div>
                    </div>
                    <motion.div
                      animate={
                        entry.change !== "unchanged"
                          ? { scale: [1, 1.12, 1] }
                          : { scale: 1 }
                      }
                      transition={{ duration: 0.32, ease: "easeOut" }}
                      className="font-mono text-xs text-[var(--cs-primary-bright)]"
                    >
                      -&gt;
                    </motion.div>
                    <div className="min-w-0 text-right">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                        Current
                      </div>
                      <div className="mt-1 truncate font-mono text-xs text-[var(--cs-text)]">
                        {entry.currentValue}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs leading-6 text-[var(--cs-text-muted)]">
                    {entry.summary}
                  </div>
                </motion.article>
              ))}
            </div>
          </section>
        </div>
      </aside>
    );
  },
);

ExecutionVisualizer.displayName = "ExecutionVisualizer";
