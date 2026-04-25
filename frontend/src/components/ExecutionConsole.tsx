import { motion } from "framer-motion";
import clsx from "clsx";
import type { ThemeMode } from "../visualization/types";

interface ExecutionConsoleProps {
  output: string[];
  themeMode: ThemeMode;
  focusMode: boolean;
}

export const ExecutionConsole = ({
  output,
  themeMode,
  focusMode,
}: ExecutionConsoleProps) => {
  const isDark = themeMode === "dark";

  return (
    <motion.section
      layout
      className={clsx(
        "rounded-3xl border p-4",
        isDark
          ? "border-slate-700 bg-slate-950 text-slate-100"
          : "border-slate-200 bg-slate-950 text-slate-100",
        focusMode && output.length === 0 ? "opacity-65" : "opacity-100",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-400">
          Console
        </p>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
          {output.length} line{output.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-3 min-h-24 rounded-2xl bg-black/30 p-3 font-mono text-sm">
        {output.length === 0 ? (
          <p className="text-slate-500">No console output yet.</p>
        ) : (
          output.map((line, index) => (
            <p key={`${line}-${index}`} className="break-all">
              {line}
            </p>
          ))
        )}
      </div>
    </motion.section>
  );
};
