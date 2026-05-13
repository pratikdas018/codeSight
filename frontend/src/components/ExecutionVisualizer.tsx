import { memo, type ReactElement, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import clsx from "clsx";
import type { ExecutionStep, ExecutionTrace } from "../engine/types";
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

const changeToneClasses: Record<string, string> = {
  added: "border-emerald-300/20 bg-emerald-300/8 text-emerald-100",
  updated: "border-cyan-300/20 bg-cyan-300/8 text-cyan-100",
  unchanged: "border-white/8 bg-[#0a1524] text-slate-300",
  removed: "border-rose-300/20 bg-rose-300/8 text-rose-100",
};

const executionStatusTone: Record<string, string> = {
  queued: "border-white/8 bg-white/[0.03] text-slate-300",
  running: "border-cyan-300/18 bg-cyan-300/10 text-cyan-100",
  completed: "border-emerald-300/18 bg-emerald-300/10 text-emerald-100",
  compile_error: "border-amber-300/18 bg-amber-300/10 text-amber-100",
  runtime_error: "border-rose-300/18 bg-rose-300/10 text-rose-100",
  timed_out: "border-rose-300/18 bg-rose-300/10 text-rose-100",
  internal_error: "border-rose-300/18 bg-rose-300/10 text-rose-100",
};

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
    <section className="rounded-[1.45rem] border border-white/8 bg-[rgba(8,17,29,0.72)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
            {sectionTitle}
          </div>
          <p className="mt-1 text-sm text-slate-400">{helper}</p>
        </div>
        <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-400">
          {variables.length}
        </span>
      </div>

      <LayoutGroup>
        <div className="mt-4 space-y-2.5">
          {variables.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm leading-6 text-slate-400">
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
                            "0 0 0 rgba(99,231,255,0)",
                            "0 10px 28px rgba(99,231,255,0.12)",
                            "0 0 0 rgba(99,231,255,0)",
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
                        <span className="truncate font-medium text-white">
                          {variable.name}
                        </span>
                        <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                          {variable.valueType}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                        {variable.scope}
                      </div>
                    </div>

                    <span className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                      {variable.change}
                    </span>
                  </div>

                  <div className="mt-3 rounded-xl border border-white/6 bg-[#07111f]/90 px-3 py-2.5 font-mono text-xs leading-6 text-slate-100">
                    {variable.currentValue}
                  </div>

                  <AnimatePresence initial={false}>
                    {isChanged && variable.previousValue ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-400"
                      >
                        <span className="font-mono text-slate-500">
                          {variable.previousValue}
                        </span>
                        <span className="text-cyan-200">to</span>
                        <span className="font-mono text-slate-200">
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
    <section className="rounded-[1.45rem] border border-white/8 bg-[rgba(8,17,29,0.72)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
            Call Stack
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Active frame first, with local variables close at hand.
          </p>
        </div>
        <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-400">
          {frames.length}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {frames.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm leading-6 text-slate-400">
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
                  ? "border-cyan-300/24 bg-cyan-300/8"
                  : "border-white/8 bg-[#0a1524]",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-white">
                    {frame.isGlobal ? "global scope" : `${frame.name}()`}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                    {frame.locals.length} local{frame.locals.length === 1 ? "" : "s"}
                  </div>
                </div>

                <span
                  className={clsx(
                    "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]",
                    frame.isActive
                      ? "border-cyan-300/20 bg-cyan-300/12 text-cyan-100"
                      : "border-white/8 bg-white/[0.03] text-slate-400",
                  )}
                >
                  {frame.isActive ? "active" : frame.isGlobal ? "root" : "waiting"}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {frame.locals.length === 0 ? (
                  <div className="rounded-xl border border-white/6 bg-[#07111f]/90 px-3 py-2 text-xs text-slate-500">
                    No local variables at this step.
                  </div>
                ) : (
                  frame.locals.map((local) => (
                    <div
                      key={`${frame.id}-${local.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-[#07111f]/90 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-mono text-xs text-slate-200">
                          {local.name}
                        </div>
                        <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                          {local.valueType}
                        </div>
                      </div>
                      <div className="max-w-[12rem] truncate font-mono text-xs text-slate-400">
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
    <section className="rounded-[1.45rem] border border-white/8 bg-[rgba(8,17,29,0.72)] p-4">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
          Memory View
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Arrays, objects, and references stay compact so the editor can remain primary.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {arrays.length === 0 && heapNodes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm leading-6 text-slate-400">
            Composite values like arrays and objects render here as soon as they appear.
          </div>
        ) : null}

        {arrays.map((array) => (
          <motion.div
            key={array.id}
            layout
            className="rounded-2xl border border-white/8 bg-[#0a1524] p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium text-white">{array.name}</div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
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
                        ? "border-cyan-300/18 bg-cyan-300/10 text-cyan-100"
                        : "border-white/8 bg-white/[0.03] text-slate-400",
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
                        ? "border-cyan-300/20 bg-cyan-300/10"
                        : "border-white/8 bg-[#07111f]",
                    )}
                  >
                    <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      {item.index}
                    </div>
                    <div className="mt-1 font-mono text-xs text-slate-100">
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
              className="rounded-2xl border border-white/8 bg-[#0a1524] p-3"
            >
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-slate-500">
                <span className="font-mono text-cyan-200">{sourceName}</span>
                <span className="h-px flex-1 bg-gradient-to-r from-cyan-300/40 to-transparent" />
                <span>{node.kind}</span>
              </div>

              <div className="mt-3 rounded-xl border border-white/6 bg-[#07111f]/90 px-3 py-2.5">
                <div className="mb-2 font-medium text-white">{node.label}</div>
                <div className="space-y-1.5">
                  {node.rows.map((row) => (
                    <div
                      key={`${node.id}-${row.key}`}
                      className="grid grid-cols-[auto,1fr] gap-3 text-xs"
                    >
                      <span className="font-mono text-slate-500">{row.key}</span>
                      <span className="break-all font-mono text-slate-300">
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
      return steps.slice(start, Math.min(steps.length, currentStepIndex + 4)).map((step, index) => ({
        step,
        actualIndex: start + index,
      }));
    }, [currentStepIndex, steps]);

    return (
      <section className="rounded-[1.45rem] border border-white/8 bg-[rgba(8,17,29,0.72)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
              Execution Flow
            </div>
            <p className="mt-1 text-sm text-slate-400">
              The current line, nearby steps, and output all stay in sync during playback.
            </p>
          </div>
          <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-400">
            {steps.length}
          </span>
        </div>

        <div className="mt-4 space-y-2.5">
          {nearbySteps.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm leading-6 text-slate-400">
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
                      ? "border-cyan-300/20 bg-cyan-300/10"
                      : "border-white/8 bg-[#0a1524] hover:border-white/14",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      line {step.line}
                    </span>
                    <span
                      className={clsx(
                        "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]",
                        isActive
                          ? "border-cyan-300/20 bg-cyan-300/12 text-cyan-100"
                          : "border-white/8 bg-white/[0.03] text-slate-400",
                      )}
                    >
                      {isActive ? "now" : `step ${actualIndex + 1}`}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
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
  }: {
    trace: ExecutionTrace;
    isExecuting: boolean;
  }) => {
    const phases = [trace.phases.compile, trace.phases.run].filter(
      (phase): phase is NonNullable<ExecutionTrace["phases"]["compile"]> =>
        Boolean(phase),
    );

    return (
      <section className="rounded-[1.45rem] border border-white/8 bg-[rgba(8,17,29,0.72)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
              Runtime Status
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Compile and execution phases are reported separately so failures are easier to debug.
            </p>
          </div>
          <span
            className={clsx(
              "rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.14em]",
              executionStatusTone[trace.status] ?? executionStatusTone.running,
            )}
          >
            {isExecuting ? "running" : trace.status.replace(/_/g, " ")}
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/6 bg-[#07111f]/90 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Timing
            </div>
            <div className="mt-2 text-sm text-slate-200">
              total {trace.executionTime}ms
            </div>
            <div className="mt-1 text-xs text-slate-400">
              queue {trace.metrics.queueTimeMs}ms, compile {trace.metrics.compileTimeMs}ms, run {trace.metrics.runTimeMs}ms
            </div>
            {typeof trace.metrics.peakMemoryKb === "number" ? (
              <div className="mt-1 text-xs text-slate-400">
                peak memory {trace.metrics.peakMemoryKb} KB
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/6 bg-[#07111f]/90 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Limits
            </div>
            <div className="mt-2 text-sm text-slate-200">
              run {trace.limits.runTimeoutMs}ms, compile {trace.limits.compileTimeoutMs}ms
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {trace.limits.memoryLimitMb}MB, {trace.limits.cpuLimit} CPU, {trace.limits.pidsLimit} pids
            </div>
          </div>

          <div className="rounded-2xl border border-white/6 bg-[#07111f]/90 px-3 py-3 sm:col-span-2">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Program Input
            </div>
            <div className="mt-2 text-sm text-slate-200">
              {trace.stdin.provided
                ? `${trace.stdin.lineCount} line${trace.stdin.lineCount === 1 ? "" : "s"}, ${trace.stdin.charCount} chars`
                : "No stdin provided"}
            </div>
            {trace.stdin.preview ? (
              <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-white/6 bg-[#0a1524] px-3 py-2 font-mono text-xs text-slate-300">
                {trace.stdin.preview}
              </pre>
            ) : null}
          </div>
        </div>

        {trace.diagnostics.length > 0 ? (
          <div className="mt-4 space-y-2">
            {trace.diagnostics.map((diagnostic, index) => (
              <div
                key={`${diagnostic.category}-${index}`}
                className="rounded-2xl border border-rose-300/16 bg-rose-300/10 px-3 py-3"
              >
                <div className="text-xs uppercase tracking-[0.16em] text-rose-100">
                  {diagnostic.summary}
                </div>
                <p className="mt-2 text-sm leading-6 text-rose-50">
                  {diagnostic.detail}
                </p>
                {diagnostic.suggestion ? (
                  <p className="mt-2 text-xs leading-5 text-rose-100/80">
                    {diagnostic.suggestion}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {phases.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm leading-6 text-slate-400">
              Run the program to inspect compilation and execution details.
            </div>
          ) : (
            phases.map((phase) => (
              <div
                key={phase.phase}
                className="rounded-2xl border border-white/8 bg-[#0a1524] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium capitalize text-white">
                      {phase.phase} phase
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      {phase.durationMs}ms
                      {typeof phase.exitCode === "number" ? `, exit ${phase.exitCode}` : ""}
                    </div>
                  </div>
                  <span
                    className={clsx(
                      "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]",
                      phase.status === "completed"
                        ? "border-emerald-300/18 bg-emerald-300/10 text-emerald-100"
                        : phase.status === "timed_out"
                          ? "border-rose-300/18 bg-rose-300/10 text-rose-100"
                          : phase.status === "skipped"
                            ? "border-white/8 bg-white/[0.03] text-slate-400"
                            : "border-amber-300/18 bg-amber-300/10 text-amber-100",
                    )}
                  >
                    {phase.status.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="mt-3 rounded-xl border border-white/6 bg-[#07111f]/90 px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                    Command
                  </div>
                  <div className="mt-2 break-all font-mono text-xs text-slate-300">
                    {phase.command}
                  </div>
                </div>

                {phase.stdout ? (
                  <div className="mt-3 rounded-xl border border-white/6 bg-[#07111f]/90 px-3 py-2.5">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      Output
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-slate-300">
                      {phase.stdout}
                    </pre>
                  </div>
                ) : null}

                {phase.stderr ? (
                  <div className="mt-3 rounded-xl border border-rose-300/14 bg-rose-300/8 px-3 py-2.5">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-rose-100">
                      Error stream
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
    const latestConsole = consoleOutput.slice(-3);
    const renderedSections: Record<VisualizerSection, ReactElement> = {
      variables: (
        <VariableStateList
          sectionTitle="Variable State"
          helper="Current value, scope, and type are kept visible without oversized cards."
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
      <aside className="flex min-h-[28rem] flex-col overflow-hidden rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(10,20,35,0.94),rgba(7,16,29,0.98))] shadow-[0_20px_60px_rgba(1,8,18,0.34)]">
        <div className="border-b border-white/8 px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
            Visualization Assistant
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-300">
              {steps.length === 0 ? "Idle" : `Step ${currentStepIndex + 1}/${steps.length}`}
            </span>
            <span className="rounded-full border border-cyan-300/16 bg-cyan-300/8 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-cyan-100">
              {changedVariables.length} change{changedVariables.length === 1 ? "" : "s"}
            </span>
            <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-400">
              {model.stackFrames.length} frame{model.stackFrames.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="workbench-scrollbar flex-1 overflow-y-auto px-4 py-4">
          <RuntimePanel trace={trace} isExecuting={isExecuting} />

          <motion.section
            layout
            className="mt-4 rounded-[1.45rem] border border-white/8 bg-[rgba(8,17,29,0.72)] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                Explanation
              </div>
              <div className="font-mono text-[11px] text-slate-500">
                {step?.line ? `Line ${step.line}` : "Waiting"}
              </div>
            </div>

            <p className="mt-3 text-sm leading-7 text-slate-200">
              {plainEnglishSummary}
            </p>

            <div className="mt-3 rounded-2xl border border-white/6 bg-[#07111f]/90 px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Current line
              </div>
              <div className="mt-2 font-mono text-xs leading-6 text-slate-100">
                {activeLineCode ||
                  "Run the program to pin the current line and explain the change."}
              </div>
            </div>

            {latestConsole.length > 0 ? (
              <div className="mt-3 rounded-2xl border border-white/6 bg-[#07111f]/90 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Console
                </div>
                <div className="mt-2 space-y-1 font-mono text-xs leading-6 text-slate-300">
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

          <div className="mt-4 xl:hidden">
            <div className="mb-3 flex flex-wrap gap-2">
              {sectionOrder.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setMobileSection(section.key)}
                  className={clsx(
                    "rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] transition",
                    mobileSection === section.key
                      ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
                      : "border-white/8 bg-white/[0.03] text-slate-400",
                  )}
                >
                  {section.label}
                </button>
              ))}
            </div>
            {renderedSections[mobileSection]}
          </div>

          <div className="mt-4 hidden space-y-4 xl:block">
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
