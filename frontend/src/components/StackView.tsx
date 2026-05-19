import { memo, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { StackFrameModel } from "../memory/types";
import { StackFrame } from "./StackFrame";

interface StackViewProps {
  frames: StackFrameModel[];
  compact?: boolean;
  registerNode?: (id: string) => (element: HTMLElement | null) => void;
}

export const StackView = memo(
  ({ frames, compact = false, registerNode }: StackViewProps) => {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const orderedFrames = useMemo(() => frames, [frames]);

    return (
      <section className="rounded-[1.45rem] border border-[var(--cs-border)] bg-[rgba(10,12,10,0.82)] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
              Stack Memory
            </div>
            <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
              Newest frames stay on top, with recursion depth and live locals visible.
            </p>
          </div>
          <span className="rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--cs-text-muted)]">
            {frames.length} frame{frames.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="workbench-scrollbar mt-4 max-h-[30rem] space-y-3 overflow-y-auto pr-1">
          {frames.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--cs-border)] px-4 py-5 text-sm leading-6 text-[var(--cs-text-muted)]">
              Function frames will appear here as soon as execution enters a traced scope.
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {orderedFrames.map((frame) => (
                <StackFrame
                  key={frame.id}
                  frame={frame}
                  compact={compact}
                  collapsed={collapsed[frame.id] ?? compact}
                  onToggle={() =>
                    setCollapsed((current) => ({
                      ...current,
                      [frame.id]: !(current[frame.id] ?? compact),
                    }))
                  }
                  registerNode={registerNode}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </section>
    );
  },
);

StackView.displayName = "StackView";
