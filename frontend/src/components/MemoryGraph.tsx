import { useMemo } from "react";
import { scalePoint } from "d3-scale";
import { motion } from "framer-motion";
import clsx from "clsx";
import type {
  HeapNode,
  MemoryLink,
  ThemeMode,
  VisualVariable,
} from "../visualization/types";

interface MemoryGraphProps {
  variables: VisualVariable[];
  heapNodes: HeapNode[];
  links: MemoryLink[];
  focusMode: boolean;
  themeMode: ThemeMode;
}

export const MemoryGraph = ({
  variables,
  heapNodes,
  links,
  focusMode,
  themeMode,
}: MemoryGraphProps) => {
  const isDark = themeMode === "dark";

  const layout = useMemo(() => {
    const stackVariables = variables.slice(0, 6);
    const graphHeight = Math.max(
      320,
      Math.max(stackVariables.length, heapNodes.length) * 92 + 100,
    );
    const stackScale = scalePoint<string>()
      .domain(stackVariables.map((variable) => variable.id))
      .range([90, graphHeight - 60])
      .padding(0.8);
    const heapScale = scalePoint<string>()
      .domain(heapNodes.map((node) => node.id))
      .range([90, graphHeight - 60])
      .padding(0.8);

    return {
      graphHeight,
      stackVariables,
      stackScale,
      heapScale,
    };
  }, [heapNodes, variables]);

  if (variables.length === 0) {
    return (
      <div
        className={clsx(
          "rounded-[1.7rem] border border-dashed px-5 py-10 text-sm",
          isDark
            ? "border-slate-700 bg-slate-900/60 text-slate-400"
            : "border-slate-200 bg-slate-50/80 text-slate-500",
        )}
      >
        Memory structure appears here when execution produces variables.
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "rounded-[1.7rem] border p-4",
        isDark
          ? "border-slate-700/70 bg-slate-900/80"
          : "border-white/70 bg-white/90",
        focusMode && heapNodes.length === 0 ? "opacity-70" : "",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p
            className={clsx(
              "font-mono text-xs uppercase tracking-[0.24em]",
              isDark ? "text-slate-400" : "text-slate-400",
            )}
          >
            Memory Model
          </p>
          <h3
            className={clsx(
              "mt-2 text-lg font-semibold",
              isDark ? "text-slate-100" : "text-ink",
            )}
          >
            Stack and heap map
          </h3>
        </div>
        <div className="flex gap-2">
          <span
            className={clsx(
              "rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em]",
              isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600",
            )}
          >
            {variables.length} stack vars
          </span>
          <span
            className={clsx(
              "rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em]",
              isDark ? "bg-violet-500/15 text-violet-200" : "bg-violet-100 text-violet-700",
            )}
          >
            {heapNodes.length} heap nodes
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 780 ${layout.graphHeight}`}
          className="h-[360px] w-full min-w-[680px]"
          role="img"
          aria-label="Memory graph"
        >
          <defs>
            <marker
              id="codesight-arrow"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="5"
              orient="auto"
            >
              <path d="M0,0 L10,5 L0,10 z" fill={isDark ? "#38bdf8" : "#0f172a"} />
            </marker>
          </defs>

          <text
            x="48"
            y="42"
            fill={isDark ? "#94a3b8" : "#64748b"}
            className="font-mono text-[11px] uppercase tracking-[0.22em]"
          >
            Stack
          </text>
          <text
            x="430"
            y="42"
            fill={isDark ? "#94a3b8" : "#64748b"}
            className="font-mono text-[11px] uppercase tracking-[0.22em]"
          >
            Heap
          </text>

          {layout.stackVariables.map((variable) => {
            const y = layout.stackScale(variable.id) ?? 90;
            const isComposite = variable.isComposite;

            return (
              <g key={variable.id}>
                <rect
                  x="36"
                  y={y - 28}
                  width="230"
                  height="58"
                  rx="18"
                  fill={
                    variable.emphasis
                      ? isDark
                        ? "rgba(251, 191, 36, 0.12)"
                        : "rgba(254, 243, 199, 1)"
                      : isDark
                        ? "rgba(15, 23, 42, 0.9)"
                        : "rgba(255, 255, 255, 0.95)"
                  }
                  stroke={
                    variable.emphasis
                      ? isDark
                        ? "rgba(251,191,36,0.42)"
                        : "rgba(245,158,11,0.35)"
                      : isDark
                        ? "rgba(100,116,139,0.35)"
                        : "rgba(203,213,225,1)"
                  }
                  strokeWidth="1.5"
                />
                <text
                  x="58"
                  y={y - 2}
                  fill={isDark ? "#f8fafc" : "#102035"}
                  className="text-sm font-semibold"
                >
                  {variable.name}
                </text>
                <text
                  x="58"
                  y={y + 16}
                  fill={isDark ? "#94a3b8" : "#64748b"}
                  className="font-mono text-[11px]"
                >
                  {isComposite ? "ref -> heap" : variable.parsedValue.display}
                </text>
              </g>
            );
          })}

          {heapNodes.map((node) => {
            const y = layout.heapScale(node.id) ?? 90;
            const boxHeight = Math.max(72, node.rows.length * 22 + 28);

            return (
              <g key={node.id}>
                <rect
                  x="416"
                  y={y - boxHeight / 2}
                  width="300"
                  height={boxHeight}
                  rx="24"
                  fill={isDark ? "rgba(30,41,59,0.92)" : "rgba(248,250,252,0.98)"}
                  stroke={
                    node.emphasized
                      ? isDark
                        ? "rgba(168,85,247,0.48)"
                        : "rgba(139,92,246,0.28)"
                      : isDark
                        ? "rgba(100,116,139,0.35)"
                        : "rgba(203,213,225,1)"
                  }
                  strokeWidth="1.5"
                />
                <text
                  x="440"
                  y={y - boxHeight / 2 + 26}
                  fill={isDark ? "#e2e8f0" : "#102035"}
                  className="text-sm font-semibold"
                >
                  {node.label}
                </text>
                {node.rows.map((row, rowIndex) => (
                  <g key={`${node.id}-${row.id}`}>
                    <text
                      x="440"
                      y={y - boxHeight / 2 + 54 + rowIndex * 20}
                      fill={isDark ? "#94a3b8" : "#64748b"}
                      className="font-mono text-[11px]"
                    >
                      {row.key}
                    </text>
                    <text
                      x="520"
                      y={y - boxHeight / 2 + 54 + rowIndex * 20}
                      fill={isDark ? "#f8fafc" : "#0f172a"}
                      className="font-mono text-[11px]"
                    >
                      {row.value}
                    </text>
                  </g>
                ))}
              </g>
            );
          })}

          {links.map((link) => {
            const sourceY = layout.stackScale(link.sourceId) ?? 90;
            const targetY = layout.heapScale(link.targetId) ?? 90;

            return (
              <motion.path
                key={`${link.sourceId}-${link.targetId}`}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
                d={`M266,${sourceY} C350,${sourceY} 336,${targetY} 416,${targetY}`}
                fill="none"
                stroke={link.emphasized ? (isDark ? "#38bdf8" : "#102035") : isDark ? "#64748b" : "#cbd5e1"}
                strokeWidth={link.emphasized ? 2.4 : 1.5}
                markerEnd="url(#codesight-arrow)"
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
};
