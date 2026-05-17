import { memo, type ReactElement, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import clsx from "clsx";
import type { ExecutionDiagnostic, ExecutionStep, ExecutionTrace } from "../engine/types";
import { createVisualizationModel } from "../visualization/model";

type VisualizerSection = "variables" | "stack" | "memory" | "flow";

interface ExecutionVisualizerProps {
  trace: ExecutionTrace;
  step: ExecutionStep | null;
  previousStep: ExecutionStep | null;
  steps: ExecutionStep[];
  currentStepIndex: number;
  activeLineCode: string;
  plainEnglishSummary: string;
  consoleOutput: string[];
  error?: string;
  isExecuting: boolean;
  onDiagnosticSelect: (diagnostic: ExecutionDiagnostic) => void;
  onStepSelect: (nextIndex: number) => void;
}

const sectionOrder: Array<{
  key: VisualizerSection;
  label: string;
  helper: string;
}> = [
  {
    key: "variables",
    label: "Variables",
    helper: "Track values and types",
  },
  {
    key: "stack",
    label: "Stack",
    helper: "Follow active function frames",
  },
  {
    key: "memory",
    label: "Memory",
    helper: "See references and heap state",
  },
  {
    key: "flow",
    label: "Flow",
    helper: "Jump through execution steps",
  },
];

const surfacePanelClass =
  "rounded-[1.45rem] border border-[var(--cs-border)] bg-[rgba(12,15,12,0.82)] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]";

const innerPanelClass =
  "rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(11,15,11,0.92)]";

const chipBaseClass =
  "rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.14em]";

const changeToneClasses: Record<string, string> = {
  added: "border-[rgba(114,255,112,0.22)] bg-[rgba(114,255,112,0.1)] text-[var(--cs-primary-bright)]",
  updated:
    "border-[rgba(114,255,112,0.18)] bg-[rgba(114,255,112,0.08)] text-[var(--cs-primary-soft)]",
  unchanged:
    "border-[var(--cs-border)] bg-[rgba(15,20,15,0.95)] text-[var(--cs-text-muted)]",
  removed: "border-rose-300/20 bg-rose-300/8 text-rose-100",
};

const executionStatusTone: Record<string, string> = {
  queued: "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)]",
  running:
    "border-[rgba(114,255,112,0.18)] bg-[rgba(114,255,112,0.1)] text-[var(--cs-primary-bright)]",
  completed:
    "border-[rgba(114,255,112,0.18)] bg-[rgba(114,255,112,0.1)] text-[var(--cs-primary-bright)]",
  compile_error: "border-amber-300/18 bg-amber-300/10 text-amber-100",
  runtime_missing: "border-amber-300/18 bg-amber-300/10 text-amber-100",
  runtime_error: "border-rose-300/18 bg-rose-300/10 text-rose-100",
  memory_limit: "border-orange-300/18 bg-orange-300/10 text-orange-100",
  trace_failure: "border-sky-300/18 bg-sky-300/10 text-sky-100",
  timed_out: "border-rose-300/18 bg-rose-300/10 text-rose-100",
  internal_error: "border-rose-300/18 bg-rose-300/10 text-rose-100",
};

const diagnosticTone: Record<string, string> = {
  compile: "border-amber-300/18 bg-amber-300/10 text-amber-50",
  runtime_missing: "border-amber-300/18 bg-amber-300/10 text-amber-50",
  runtime: "border-rose-300/18 bg-rose-300/10 text-rose-50",
  timeout: "border-orange-300/18 bg-orange-300/10 text-orange-50",
  memory: "border-orange-300/18 bg-orange-300/10 text-orange-50",
  trace: "border-sky-300/18 bg-sky-300/10 text-sky-50",
  internal: "border-slate-300/18 bg-slate-300/10 text-slate-50",
};

const phaseTone: Record<string, string> = {
  completed:
    "border-[rgba(114,255,112,0.18)] bg-[rgba(114,255,112,0.1)] text-[var(--cs-primary-bright)]",
  failed: "border-rose-300/18 bg-rose-300/10 text-rose-100",
  timed_out: "border-orange-300/18 bg-orange-300/10 text-orange-100",
  skipped: "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)]",
  pending: "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)]",
};

const logTone: Record<string, string> = {
  info: "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)]",
  warn: "border-amber-300/18 bg-amber-300/10 text-amber-50",
  error: "border-rose-300/18 bg-rose-300/10 text-rose-50",
  debug: "border-sky-300/18 bg-sky-300/10 text-sky-50",
};

const statusMeta: Record<
  ExecutionTrace["status"],
  { label: string; icon: string; helper: string }
> = {
  queued: {
    label: "Queued",
    icon: "schedule",
    helper: "Waiting for an execution slot.",
  },
  running: {
    label: "Running",
    icon: "autorenew",
    helper: "CodeSight is compiling, running, or tracing your program.",
  },
  completed: {
    label: "Completed",
    icon: "task_alt",
    helper: "Execution, diagnostics, and trace capture completed successfully.",
  },
  compile_error: {
    label: "Compile Error",
    icon: "build",
    helper: "The compiler rejected the source before execution started.",
  },
  runtime_missing: {
    label: "Runtime Missing",
    icon: "warning",
    helper: "A required local compiler or runtime is not installed or is missing from PATH.",
  },
  runtime_error: {
    label: "Runtime Error",
    icon: "error",
    helper: "The program started but failed while running.",
  },
  timed_out: {
    label: "Timed Out",
    icon: "timer_off",
    helper: "The active phase exceeded its time budget.",
  },
  memory_limit: {
    label: "Memory Limit",
    icon: "memory",
    helper: "The local process exceeded the configured memory budget.",
  },
  trace_failure: {
    label: "Trace Failure",
    icon: "schema",
    helper: "The code ran, but CodeSight could not build the visualization trace.",
  },
  internal_error: {
    label: "Internal Error",
    icon: "warning",
    helper: "CodeSight hit an unexpected internal failure.",
  },
};

const formatLocation = (diagnostic: ExecutionDiagnostic) => {
  if (!diagnostic.file && !diagnostic.line) {
    return null;
  }

  const fileLabel = diagnostic.file ?? "source";
  const lineLabel = diagnostic.line ? `:${diagnostic.line}` : "";
  const columnLabel = diagnostic.column ? `:${diagnostic.column}` : "";
  return `${fileLabel}${lineLabel}${columnLabel}`;
};

const formatLogDetails = (details: Record<string, string | number | boolean | null>) =>
  Object.entries(details)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("\n");

const VariableStateList = memo(
  ({
    sectionTitle,
    helper,
    variables,
  }: {
    sectionTitle: string;
    helper: string;
    variables: ReturnType<typeof createVisualizationModel>["variables"];
  }) => (
    <section className={surfacePanelClass}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
            {sectionTitle}
          </div>
          <p className="mt-1 text-sm text-[var(--cs-text-muted)]">{helper}</p>
        </div>
        <span
          className={clsx(
            chipBaseClass,
            "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)]",
          )}
        >
          {variables.length}
        </span>
      </div>

      <LayoutGroup>
        <div className="mt-4 max-h-[18rem] space-y-2.5 overflow-y-auto pr-1">
          {variables.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--cs-border)] px-4 py-5 text-sm leading-6 text-[var(--cs-text-muted)]">
              Variables appear here as soon as the trace captures runtime state.
            </div>
          ) : (
            variables.map((variable) => {
              const isChanged = variable.change !== "unchanged";

              return (
                <motion.div
                  key={variable.id}
                  layout
                  initial={false}
                  animate={
                    isChanged
                      ? {
                          boxShadow: [
                            "0 0 0 rgba(114,255,112,0)",
                            "0 12px 30px rgba(114,255,112,0.12)",
                            "0 0 0 rgba(114,255,112,0)",
                          ],
                        }
                      : {}
                  }
                  transition={{ duration: 0.42, ease: "easeOut" }}
                  className={clsx(
                    "rounded-2xl border px-3.5 py-3",
                    changeToneClasses[variable.change] ??
                      changeToneClasses.unchanged,
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-[var(--cs-text)]">
                          {variable.name}
                        </span>
                        <span className="rounded-full border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.03)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-muted)]">
                          {variable.valueType}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                        {variable.scope}
                      </div>
                    </div>

                    <span className="rounded-full border border-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--cs-text-muted)]">
                      {variable.change}
                    </span>
                  </div>

                  <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(11,15,11,0.92)] px-3 py-2.5 font-mono text-xs leading-6 text-[var(--cs-text)]">
                    {variable.currentValue}
                  </div>

                  <AnimatePresence initial={false}>
                    {isChanged && variable.previousValue ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="mt-2.5 flex items-center gap-2 text-[11px] text-[var(--cs-text-muted)]"
                      >
                        <span className="font-mono text-[var(--cs-text-subtle)]">
                          {variable.previousValue}
                        </span>
                        <span className="text-[var(--cs-primary-bright)]">to</span>
                        <span className="font-mono text-[var(--cs-text)]">
                          {variable.currentValue}
                        </span>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>
      </LayoutGroup>
    </section>
  ),
);

VariableStateList.displayName = "VariableStateList";

const StackFramesPanel = memo(
  ({
    frames,
  }: {
    frames: ReturnType<typeof createVisualizationModel>["stackFrames"];
  }) => (
    <section className={surfacePanelClass}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
            Call Stack
          </div>
          <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
            Active frame first, with local variables close at hand.
          </p>
        </div>
        <span
          className={clsx(
            chipBaseClass,
            "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)]",
          )}
        >
          {frames.length}
        </span>
      </div>

      <div className="mt-4 max-h-[18rem] space-y-3 overflow-y-auto pr-1">
        {frames.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--cs-border)] px-4 py-5 text-sm leading-6 text-[var(--cs-text-muted)]">
            Function frames show up here once the runtime enters a traced scope.
          </div>
        ) : (
          frames.map((frame) => (
            <motion.div
              key={frame.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={clsx(
                "rounded-2xl border px-3.5 py-3",
                frame.isActive
                  ? "border-[rgba(114,255,112,0.24)] bg-[rgba(114,255,112,0.08)]"
                  : "border-[var(--cs-border)] bg-[rgba(15,20,15,0.95)]",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-[var(--cs-text)]">
                    {frame.isGlobal ? "global scope" : `${frame.name}()`}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                    {frame.locals.length} local{frame.locals.length === 1 ? "" : "s"}
                  </div>
                </div>

                <span
                  className={clsx(
                    chipBaseClass,
                    frame.isActive
                      ? "border-[rgba(114,255,112,0.2)] bg-[rgba(114,255,112,0.12)] text-[var(--cs-primary-bright)]"
                      : "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)]",
                  )}
                >
                  {frame.isActive ? "active" : frame.isGlobal ? "root" : "waiting"}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {frame.locals.length === 0 ? (
                  <div className="rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(11,15,11,0.92)] px-3 py-2 text-xs text-[var(--cs-text-subtle)]">
                    No local variables at this step.
                  </div>
                ) : (
                  frame.locals.map((local) => (
                    <div
                      key={`${frame.id}-${local.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(11,15,11,0.92)] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-mono text-xs text-[var(--cs-text)]">
                          {local.name}
                        </div>
                        <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-[var(--cs-text-subtle)]">
                          {local.valueType}
                        </div>
                      </div>
                      <div className="max-w-[12rem] truncate font-mono text-xs text-[var(--cs-text-muted)]">
                        {local.currentValue}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </section>
  ),
);

StackFramesPanel.displayName = "StackFramesPanel";

const MemoryPanel = memo(
  ({
    arrays,
    heapNodes,
  }: Pick<
    ReturnType<typeof createVisualizationModel>,
    "arrays" | "heapNodes"
  >) => (
    <section className={surfacePanelClass}>
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
          Memory View
        </div>
        <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
          Arrays, objects, and references stay compact so the editor can remain primary.
        </p>
      </div>

      <div className="mt-4 max-h-[20rem] space-y-3 overflow-y-auto pr-1">
        {arrays.length === 0 && heapNodes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--cs-border)] px-4 py-5 text-sm leading-6 text-[var(--cs-text-muted)]">
            Composite values like arrays and objects render here as soon as they appear.
          </div>
        ) : null}

        {arrays.map((array) => (
          <motion.div
            key={array.id}
            layout
            className="rounded-2xl border border-[var(--cs-border)] bg-[rgba(15,20,15,0.95)] p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium text-[var(--cs-text)]">{array.name}</div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                  array
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {array.pointers.map((pointer) => (
                  <span
                    key={`${array.id}-${pointer.name}`}
                    className={clsx(
                      "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
                      pointer.active
                        ? "border-[rgba(114,255,112,0.18)] bg-[rgba(114,255,112,0.1)] text-[var(--cs-primary-bright)]"
                        : "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)]",
                    )}
                  >
                    {pointer.name}:{pointer.index}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-3 overflow-x-auto pb-1">
              <div className="flex min-w-max gap-2">
                {array.items.map((item) => (
                  <motion.div
                    key={`${array.id}-${item.motionId}`}
                    layout
                    animate={item.changed ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className={clsx(
                      "w-[3.6rem] rounded-xl border px-2 py-2 text-center",
                      item.changed
                        ? "border-[rgba(114,255,112,0.2)] bg-[rgba(114,255,112,0.1)]"
                        : "border-[var(--cs-border)] bg-[rgba(11,15,11,0.92)]",
                    )}
                  >
                    <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--cs-text-subtle)]">
                      {item.index}
                    </div>
                    <div className="mt-1 font-mono text-xs text-[var(--cs-text)]">
                      {item.label}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}

        {heapNodes.map((node) => {
          const sourceName = node.label.replace(/\[\]|\{\}/g, "");

          return (
            <motion.div
              key={node.id}
              layout
              className="rounded-2xl border border-[var(--cs-border)] bg-[rgba(15,20,15,0.95)] p-3"
            >
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                <span className="font-mono text-[var(--cs-primary-bright)]">{sourceName}</span>
                <span className="h-px flex-1 bg-gradient-to-r from-[rgba(114,255,112,0.32)] to-transparent" />
                <span>{node.kind}</span>
              </div>

              <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(11,15,11,0.92)] px-3 py-2.5">
                <div className="mb-2 font-medium text-[var(--cs-text)]">{node.label}</div>
                <div className="space-y-1.5">
                  {node.rows.map((row) => (
                    <div
                      key={`${node.id}-${row.id}`}
                      className="grid grid-cols-[auto,1fr] gap-3 text-xs"
                    >
                      <span className="font-mono text-[var(--cs-text-subtle)]">{row.key}</span>
                      <span className="break-all font-mono text-[var(--cs-text-muted)]">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  ),
);

MemoryPanel.displayName = "MemoryPanel";

const FlowPanel = memo(
  ({
    steps,
    currentStepIndex,
    onStepSelect,
  }: {
    steps: ExecutionStep[];
    currentStepIndex: number;
    onStepSelect: (nextIndex: number) => void;
  }) => {
    const nearbySteps = useMemo(() => {
      const start = Math.max(0, currentStepIndex - 2);
      return steps
        .slice(start, Math.min(steps.length, currentStepIndex + 4))
        .map((step, index) => ({
          step,
          actualIndex: start + index,
        }));
    }, [currentStepIndex, steps]);

    return (
      <section className={surfacePanelClass}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
              Execution Flow
            </div>
            <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
              The current line, nearby steps, and output all stay in sync during playback.
            </p>
          </div>
          <span
            className={clsx(
              chipBaseClass,
              "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)]",
            )}
          >
            {steps.length}
          </span>
        </div>

        <div className="mt-4 max-h-[18rem] space-y-2.5 overflow-y-auto pr-1">
          {nearbySteps.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--cs-border)] px-4 py-5 text-sm leading-6 text-[var(--cs-text-muted)]">
              Run the program to generate a clickable execution path.
            </div>
          ) : (
            nearbySteps.map(({ step, actualIndex }) => {
              const isActive = actualIndex === currentStepIndex;

              return (
                <button
                  key={`${actualIndex}-${step.line}`}
                  type="button"
                  onClick={() => onStepSelect(actualIndex)}
                  className={clsx(
                    "w-full rounded-2xl border px-3.5 py-3 text-left transition",
                    isActive
                      ? "border-[rgba(114,255,112,0.2)] bg-[rgba(114,255,112,0.1)]"
                      : "border-[var(--cs-border)] bg-[rgba(15,20,15,0.95)] hover:border-[var(--cs-border-strong)]",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                      line {step.line}
                    </span>
                    <span
                      className={clsx(
                        chipBaseClass,
                        isActive
                          ? "border-[rgba(114,255,112,0.2)] bg-[rgba(114,255,112,0.12)] text-[var(--cs-primary-bright)]"
                          : "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)]",
                      )}
                    >
                      {isActive ? "now" : `step ${actualIndex + 1}`}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--cs-text)]">
                    {step.explanation ?? step.description}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </section>
    );
  },
);

FlowPanel.displayName = "FlowPanel";

const RuntimePanel = memo(
  ({
    trace,
    isExecuting,
    onDiagnosticSelect,
    compact = false,
  }: {
    trace: ExecutionTrace;
    isExecuting: boolean;
    onDiagnosticSelect: (diagnostic: ExecutionDiagnostic) => void;
    compact?: boolean;
  }) => {
    const phases = [trace.phases.compile, trace.phases.run, trace.phases.trace].filter(
      (phase): phase is NonNullable<ExecutionTrace["phases"]["compile"]> =>
        Boolean(phase),
    );
    const meta = statusMeta[trace.status] ?? statusMeta.internal_error;

    return (
      <section className={surfacePanelClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
              Runtime Status
            </div>
            <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
              Compile, run, and trace phases are captured separately so every failure stays attributable.
            </p>
          </div>
          <div
            className={clsx(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.16em]",
              executionStatusTone[trace.status] ?? executionStatusTone.running,
            )}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isExecuting ? "autorenew" : meta.icon}
            </span>
            {isExecuting ? "running" : meta.label}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.04)] bg-[rgba(11,15,11,0.92)] px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-[var(--cs-text)]">{meta.label}</div>
              <p className="mt-1 text-sm leading-6 text-[var(--cs-text-muted)]">
                {trace.traceSummary.error || trace.diagnostics[0]?.summary || trace.traceSummary.message || meta.helper}
              </p>
            </div>
            {trace.failurePhase ? (
              <span className="rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-muted)]">
                {trace.failurePhase === "system"
                  ? "system failure"
                  : `${trace.failurePhase} phase`}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className={clsx(innerPanelClass, "px-3 py-3")}>
            <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
              Timing
            </div>
            <div className="mt-2 text-sm text-[var(--cs-text)]">
              total {trace.executionTime}ms
            </div>
            <div className="mt-1 text-xs text-[var(--cs-text-muted)]">
              queue {trace.metrics.queueTimeMs}ms, compile {trace.metrics.compileTimeMs}ms, run {trace.metrics.runTimeMs}ms
            </div>
            {typeof trace.metrics.peakMemoryKb === "number" ? (
              <div className="mt-1 text-xs text-[var(--cs-text-muted)]">
                peak memory {trace.metrics.peakMemoryKb} KB
              </div>
            ) : null}
          </div>

          <div className={clsx(innerPanelClass, "px-3 py-3")}>
            <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
              Mode
            </div>
            <div className="mt-2 text-sm capitalize text-[var(--cs-text)]">
              {trace.mode.selected} mode
            </div>
            <div className="mt-1 text-xs text-[var(--cs-text-muted)]">
              trace strategy: {trace.mode.traceStrategy.replace(/_/g, " ")}
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--cs-text-muted)]">
              {trace.mode.reason}
            </p>
          </div>

          <div className={clsx(innerPanelClass, "px-3 py-3")}>
            <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
              Trace Frames
            </div>
            <div className="mt-2 text-sm text-[var(--cs-text)]">
              {trace.traceSummary.frameCount} frame{trace.traceSummary.frameCount === 1 ? "" : "s"}
            </div>
            <div className="mt-1 text-xs capitalize text-[var(--cs-text-muted)]">
              {trace.traceSummary.quality} trace via {trace.traceSummary.source.replace(/-/g, " ")}
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--cs-text-muted)]">
              {trace.traceSummary.error || trace.traceSummary.message}
            </p>
          </div>

          {compact ? null : (
            <>
              <div className={clsx(innerPanelClass, "px-3 py-3")}>
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                  Limits
                </div>
                <div className="mt-2 text-sm text-[var(--cs-text)]">
                  run {trace.limits.runTimeoutMs}ms, compile {trace.limits.compileTimeoutMs}ms
                </div>
                <div className="mt-1 text-xs text-[var(--cs-text-muted)]">
                  trace {trace.limits.traceTimeoutMs}ms, {trace.limits.memoryLimitMb}MB, {trace.limits.cpuLimit} CPU, {trace.limits.pidsLimit} pids
                </div>
              </div>

              <div className={clsx(innerPanelClass, "px-3 py-3 sm:col-span-2")}>
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                  Program Input
                </div>
                <div className="mt-2 text-sm text-[var(--cs-text)]">
                  {trace.stdin.provided
                    ? `${trace.stdin.lineCount} line${trace.stdin.lineCount === 1 ? "" : "s"}, ${trace.stdin.charCount} chars`
                    : "No stdin provided"}
                </div>
                {trace.stdin.preview ? (
                  <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(15,20,15,0.95)] px-3 py-2 font-mono text-xs text-[var(--cs-text-muted)]">
                    {trace.stdin.preview}
                  </pre>
                ) : null}
              </div>
            </>
          )}
        </div>

        {trace.diagnostics.length > 0 ? (
          <div className="mt-4 space-y-2">
            {trace.diagnostics.map((diagnostic, index) => (
              <div
                key={`${diagnostic.category}-${index}`}
                className={clsx(
                  "w-full rounded-2xl border px-3 py-3 text-left transition",
                  diagnosticTone[diagnostic.category] ?? diagnosticTone.internal,
                  diagnostic.line ? "hover:border-[var(--cs-border-strong)]" : "",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em]">
                      {diagnostic.phase === "system"
                        ? `${diagnostic.source} diagnostics`
                        : `${diagnostic.phase} phase`}
                    </div>
                    <div className="mt-2 text-sm font-medium text-[inherit]">
                      {diagnostic.summary}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {formatLocation(diagnostic) ? (
                      <span className="rounded-full border border-current/20 bg-black/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em]">
                        {formatLocation(diagnostic)}
                      </span>
                    ) : null}
                    {diagnostic.line ? (
                      <button
                        type="button"
                        onClick={() => onDiagnosticSelect(diagnostic)}
                        className="rounded-full border border-current/20 bg-black/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] transition hover:bg-black/20"
                      >
                        Jump to line
                      </button>
                    ) : null}
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-current/10 bg-black/10 px-3 py-3 font-mono text-xs leading-6 text-[inherit]">
                  {diagnostic.detail}
                </pre>
                {diagnostic.stackTrace && diagnostic.stackTrace.length > 0 ? (
                  <details className="mt-3 rounded-xl border border-current/10 bg-black/10 px-3 py-3">
                    <summary className="cursor-pointer text-xs uppercase tracking-[0.16em]">
                      Stack trace
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-[inherit]">
                      {diagnostic.stackTrace.join("\n")}
                    </pre>
                  </details>
                ) : null}
                {diagnostic.suggestion ? (
                  <p className="mt-3 text-xs leading-5 text-[inherit]/80">
                    {diagnostic.suggestion}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {compact ? (
          <details className="mt-4 rounded-2xl border border-[var(--cs-border)] bg-[rgba(15,20,15,0.95)] px-3 py-3">
            <summary className="cursor-pointer text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
              Execution details
            </summary>
            <div className="mt-3 space-y-4">
              <div className="space-y-3">
                {phases.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--cs-border)] px-4 py-5 text-sm leading-6 text-[var(--cs-text-muted)]">
                    Run the program to inspect compilation and execution details.
                  </div>
                ) : (
                  phases.map((phase) => (
                    <div
                      key={phase.phase}
                      className="rounded-2xl border border-[var(--cs-border)] bg-[rgba(11,15,11,0.92)] p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-medium capitalize text-[var(--cs-text)]">
                            {phase.phase} phase
                          </div>
                          <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--cs-text-subtle)]">
                            {phase.durationMs}ms
                            {typeof phase.exitCode === "number" ? `, exit ${phase.exitCode}` : ""}
                          </div>
                        </div>
                        <span
                          className={clsx(
                            chipBaseClass,
                            phaseTone[phase.status] ?? phaseTone.failed,
                          )}
                        >
                          {phase.status.replace(/_/g, " ")}
                        </span>
                      </div>

                      <p className="mt-2 text-sm leading-6 text-[var(--cs-text-muted)]">
                        {phase.summary}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {trace.logs.system.length > 0 ? (
                <div className="rounded-2xl border border-fuchsia-300/14 bg-fuchsia-300/8 px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-fuchsia-100">
                    System logs
                  </div>
                  <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-fuchsia-50">
                    {trace.logs.system.join("\n")}
                  </pre>
                </div>
              ) : null}

              {trace.logs.entries.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                    Structured Runtime Logs
                  </div>
                  {trace.logs.entries.map((entry, index) => (
                    <div
                      key={`${entry.timestamp}-${entry.scope}-${index}`}
                      className={clsx(
                        "rounded-2xl border px-3 py-3",
                        logTone[entry.level] ?? logTone.info,
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em]">
                            {entry.scope}
                          </div>
                          <div className="mt-2 text-sm font-medium text-[inherit]">
                            {entry.message}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.12em]">
                          <span className="rounded-full border border-current/20 bg-black/10 px-2.5 py-1">
                            {entry.level}
                          </span>
                          {entry.phase ? (
                            <span className="rounded-full border border-current/20 bg-black/10 px-2.5 py-1">
                              {entry.phase}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {(entry.command || entry.filePath || typeof entry.durationMs === "number") ? (
                        <div className="mt-3 rounded-xl border border-current/10 bg-black/10 px-3 py-3 font-mono text-xs leading-6 text-[inherit]">
                          {entry.command ? <div>command: {entry.command}</div> : null}
                          {entry.filePath ? <div>file: {entry.filePath}</div> : null}
                          {typeof entry.durationMs === "number" ? (
                            <div>duration: {entry.durationMs}ms</div>
                          ) : null}
                          {typeof entry.exitCode === "number" ? (
                            <div>exit: {entry.exitCode}</div>
                          ) : null}
                          {entry.signal ? <div>signal: {entry.signal}</div> : null}
                        </div>
                      ) : null}

                      {entry.details ? (
                        <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-current/10 bg-black/10 px-3 py-3 font-mono text-xs leading-6 text-[inherit]">
                          {formatLogDetails(entry.details)}
                        </pre>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </details>
        ) : (
          <>
            <div className="mt-4 space-y-3">
              {phases.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--cs-border)] px-4 py-5 text-sm leading-6 text-[var(--cs-text-muted)]">
                  Run the program to inspect compilation and execution details.
                </div>
              ) : (
                phases.map((phase) => (
                  <div
                    key={phase.phase}
                    className="rounded-2xl border border-[var(--cs-border)] bg-[rgba(15,20,15,0.95)] p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-medium capitalize text-[var(--cs-text)]">
                          {phase.phase} phase
                        </div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--cs-text-subtle)]">
                          {phase.durationMs}ms
                          {typeof phase.exitCode === "number" ? `, exit ${phase.exitCode}` : ""}
                        </div>
                      </div>
                      <span
                        className={clsx(
                          chipBaseClass,
                          phaseTone[phase.status] ?? phaseTone.failed,
                        )}
                      >
                        {phase.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-[var(--cs-text-muted)]">
                      {phase.summary}
                    </p>

                    <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(11,15,11,0.92)] px-3 py-2.5">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                        Command
                      </div>
                      <div className="mt-2 break-all font-mono text-xs text-[var(--cs-text-muted)]">
                        {phase.command}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(11,15,11,0.92)] px-3 py-2.5">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                          Exit
                        </div>
                        <div className="mt-2 text-sm text-[var(--cs-text)]">
                          {typeof phase.exitCode === "number" ? `code ${phase.exitCode}` : "no exit code"}
                        </div>
                        {phase.signal ? (
                          <div className="mt-1 text-xs text-[var(--cs-text-muted)]">
                            signal {phase.signal}
                          </div>
                        ) : null}
                        {phase.oomKilled ? (
                          <div className="mt-1 text-xs text-orange-200">
                            process reported an out-of-memory termination
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(11,15,11,0.92)] px-3 py-2.5">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                          Capture
                        </div>
                        <div className="mt-2 text-sm text-[var(--cs-text)]">
                          {phase.outputLimitExceeded ? "output truncated" : "full output captured"}
                        </div>
                        <div className="mt-1 text-xs text-[var(--cs-text-muted)]">
                          stdout and stderr are preserved separately for this phase.
                        </div>
                      </div>
                    </div>

                    {phase.stdout ? (
                      <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(11,15,11,0.92)] px-3 py-2.5">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                          Stdout
                        </div>
                        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-[var(--cs-text-muted)]">
                          {phase.stdout}
                        </pre>
                      </div>
                    ) : null}

                    {phase.stderr ? (
                      <div className="mt-3 rounded-xl border border-rose-300/14 bg-rose-300/8 px-3 py-2.5">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-rose-100">
                          Stderr
                        </div>
                        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-rose-50">
                          {phase.stderr}
                        </pre>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            {trace.logs.system.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-fuchsia-300/14 bg-fuchsia-300/8 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-fuchsia-100">
                  System logs
                </div>
                <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-fuchsia-50">
                  {trace.logs.system.join("\n")}
                </pre>
              </div>
            ) : null}

            {trace.logs.entries.length > 0 ? (
              <div className="mt-4 space-y-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                  Structured Runtime Logs
                </div>
                {trace.logs.entries.map((entry, index) => (
                  <div
                    key={`${entry.timestamp}-${entry.scope}-${index}`}
                    className={clsx(
                      "rounded-2xl border px-3 py-3",
                      logTone[entry.level] ?? logTone.info,
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em]">
                          {entry.scope}
                        </div>
                        <div className="mt-2 text-sm font-medium text-[inherit]">
                          {entry.message}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.12em]">
                        <span className="rounded-full border border-current/20 bg-black/10 px-2.5 py-1">
                          {entry.level}
                        </span>
                        {entry.phase ? (
                          <span className="rounded-full border border-current/20 bg-black/10 px-2.5 py-1">
                            {entry.phase}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {(entry.command || entry.filePath || typeof entry.durationMs === "number") ? (
                      <div className="mt-3 rounded-xl border border-current/10 bg-black/10 px-3 py-3 font-mono text-xs leading-6 text-[inherit]">
                        {entry.command ? <div>command: {entry.command}</div> : null}
                        {entry.filePath ? <div>file: {entry.filePath}</div> : null}
                        {typeof entry.durationMs === "number" ? (
                          <div>duration: {entry.durationMs}ms</div>
                        ) : null}
                        {typeof entry.exitCode === "number" ? (
                          <div>exit: {entry.exitCode}</div>
                        ) : null}
                        {entry.signal ? <div>signal: {entry.signal}</div> : null}
                      </div>
                    ) : null}

                    {entry.details ? (
                      <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-current/10 bg-black/10 px-3 py-3 font-mono text-xs leading-6 text-[inherit]">
                        {formatLogDetails(entry.details)}
                      </pre>
                    ) : null}

                    {entry.stdout ? (
                      <details className="mt-3 rounded-xl border border-current/10 bg-black/10 px-3 py-3">
                        <summary className="cursor-pointer text-xs uppercase tracking-[0.16em]">
                          Stdout
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-[inherit]">
                          {entry.stdout}
                        </pre>
                      </details>
                    ) : null}

                    {entry.stderr ? (
                      <details className="mt-3 rounded-xl border border-current/10 bg-black/10 px-3 py-3">
                        <summary className="cursor-pointer text-xs uppercase tracking-[0.16em]">
                          Stderr
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-[inherit]">
                          {entry.stderr}
                        </pre>
                      </details>
                    ) : null}

                    {entry.stack ? (
                      <details className="mt-3 rounded-xl border border-current/10 bg-black/10 px-3 py-3">
                        <summary className="cursor-pointer text-xs uppercase tracking-[0.16em]">
                          Stack
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-[inherit]">
                          {entry.stack}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </section>
    );
  },
);

RuntimePanel.displayName = "RuntimePanel";

export const ExecutionVisualizer = memo(
  ({
    trace,
    step,
    previousStep,
    steps,
    currentStepIndex,
    activeLineCode,
    plainEnglishSummary,
    consoleOutput,
    error,
    isExecuting,
    onDiagnosticSelect,
    onStepSelect,
  }: ExecutionVisualizerProps) => {
    const [mobileSection, setMobileSection] =
      useState<VisualizerSection>("variables");
    const model = useMemo(
      () => createVisualizationModel(step, previousStep),
      [previousStep, step],
    );
    const changedVariables = model.variables.filter(
      (variable) => variable.change !== "unchanged",
    );
    const shouldPrioritizeVisualization = steps.length > 0;
    const latestConsole = consoleOutput.slice(-3);
    const renderedSections: Record<VisualizerSection, ReactElement> = {
      variables: (
        <VariableStateList
          sectionTitle="Variable State"
          helper="Current value, scope, and type stay visible while the editor remains dominant."
          variables={model.variables}
        />
      ),
      stack: <StackFramesPanel frames={model.stackFrames} />,
      memory: <MemoryPanel arrays={model.arrays} heapNodes={model.heapNodes} />,
      flow: (
        <FlowPanel
          steps={steps}
          currentStepIndex={currentStepIndex}
          onStepSelect={onStepSelect}
        />
      ),
    };

    return (
      <aside className="flex min-h-[28rem] flex-col overflow-hidden rounded-[1.8rem] border border-[var(--cs-border)] bg-[linear-gradient(180deg,rgba(12,14,12,0.96),rgba(7,9,7,0.98))] shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
        <div className="border-b border-[var(--cs-border)] px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--cs-text-subtle)]">
            Runtime Visualization
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={clsx(
                chipBaseClass,
                "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)]",
              )}
            >
              {steps.length === 0 ? "Idle" : `Step ${currentStepIndex + 1}/${steps.length}`}
            </span>
            <span
              className={clsx(
                chipBaseClass,
                "border-[rgba(114,255,112,0.16)] bg-[rgba(114,255,112,0.08)] text-[var(--cs-primary-bright)]",
              )}
            >
              {changedVariables.length} change{changedVariables.length === 1 ? "" : "s"}
            </span>
            <span
              className={clsx(
                chipBaseClass,
                "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)]",
              )}
            >
              {model.stackFrames.length} frame{model.stackFrames.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="workbench-scrollbar flex-1 overflow-y-auto px-4 py-4">
          <RuntimePanel
            trace={trace}
            isExecuting={isExecuting}
            onDiagnosticSelect={onDiagnosticSelect}
            compact={shouldPrioritizeVisualization}
          />

          <motion.section layout className={clsx(surfacePanelClass, "mt-4")}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
                Explanation
              </div>
              <div className="font-mono text-[11px] text-[var(--cs-text-subtle)]">
                {step?.line ? `Line ${step.line}` : "Waiting"}
              </div>
            </div>

            <p className="mt-3 text-sm leading-7 text-[var(--cs-text)]">
              {plainEnglishSummary}
            </p>

            <div className="mt-3 rounded-2xl border border-[rgba(255,255,255,0.04)] bg-[rgba(11,15,11,0.92)] px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                Current line
              </div>
              <div className="mt-2 font-mono text-xs leading-6 text-[var(--cs-text)]">
                {activeLineCode ||
                  "Run the program to pin the current line and explain the change."}
              </div>
            </div>

            {latestConsole.length > 0 ? (
              <div className="mt-3 rounded-2xl border border-[rgba(255,255,255,0.04)] bg-[rgba(11,15,11,0.92)] px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
                  Console
                </div>
                <div className="mt-2 space-y-1 font-mono text-xs leading-6 text-[var(--cs-text-muted)]">
                  {latestConsole.map((line, index) => (
                    <p key={`${line}-${index}`} className="break-all">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="mt-3 rounded-2xl border border-rose-300/16 bg-rose-300/10 px-3 py-3 text-sm leading-6 text-rose-100">
                {error}
              </div>
            ) : null}
          </motion.section>

          <div className="mt-4 lg:hidden">
            <div className="mb-3 flex flex-wrap gap-2">
              {sectionOrder.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setMobileSection(section.key)}
                  className={clsx(
                    chipBaseClass,
                    "transition",
                    mobileSection === section.key
                      ? "border-[rgba(114,255,112,0.2)] bg-[rgba(114,255,112,0.1)] text-[var(--cs-primary-bright)]"
                      : "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)]",
                  )}
                >
                  {section.label}
                </button>
              ))}
            </div>
            {renderedSections[mobileSection]}
          </div>

          <div className="mt-4 hidden space-y-4 lg:block">
            {sectionOrder.map((section) => (
              <div key={section.key}>{renderedSections[section.key]}</div>
            ))}
          </div>
        </div>
      </aside>
    );
  },
);

ExecutionVisualizer.displayName = "ExecutionVisualizer";
