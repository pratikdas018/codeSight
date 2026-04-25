import { motion } from "framer-motion";
import { formatDate } from "../utils/formatters";
import type { CodeSnippet, ExecutionHistoryRecord } from "../utils/types";

interface SnippetDashboardProps {
  snippets: CodeSnippet[];
  history: ExecutionHistoryRecord[];
  currentSnippetId: string | null;
  onLoadSnippet: (snippetId: string) => void;
}

export const SnippetDashboard = ({
  snippets,
  history,
  currentSnippetId,
  onLoadSnippet,
}: SnippetDashboardProps) => (
  <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
    <motion.div
      layout
      className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-panel backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
            Saved Snippets
          </p>
          <h2 className="mt-2 text-xl font-semibold text-ink">
            Reopen your exercises
          </h2>
        </div>
        <span className="rounded-full bg-mist px-3 py-1 text-xs font-medium text-ink">
          {snippets.length} total
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {snippets.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
            Sign in and save a snippet to build your personal learning library.
          </p>
        ) : (
          snippets.map((snippet) => (
            <button
              key={snippet.id}
              type="button"
              onClick={() => onLoadSnippet(snippet.id)}
              className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                currentSnippetId === snippet.id
                  ? "border-ink bg-ink text-white"
                  : "border-slate-200 bg-white hover:border-glow"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{snippet.title}</p>
                  <p
                    className={`mt-1 text-xs ${
                      currentSnippetId === snippet.id
                        ? "text-slate-200"
                        : "text-slate-500"
                    }`}
                  >
                    {formatDate(snippet.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      currentSnippetId === snippet.id
                        ? "bg-white/15 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {snippet.language}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      currentSnippetId === snippet.id
                        ? "bg-white/15 text-white"
                        : "bg-mist text-ink"
                    }`}
                  >
                    {snippet._count?.executionHistories ?? 0} runs
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </motion.div>

    <motion.div
      layout
      className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-panel backdrop-blur"
    >
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
        Recent History
      </p>
      <h2 className="mt-2 text-xl font-semibold text-ink">
        Last recorded executions
      </h2>

      <div className="mt-4 space-y-3">
        {history.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
            Saved run history appears here after you execute a saved snippet.
          </p>
        ) : (
          history.slice(0, 6).map((entry) => (
            <div
              key={entry.id}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink">
                  {entry.codeSnippet.title}
                </p>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                    {entry.codeSnippet.language}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatDate(entry.createdAt)}
                  </span>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 font-mono text-xs text-slate-600">
                {entry.output || "No console output captured."}
              </p>
            </div>
          ))
        )}
      </div>
    </motion.div>
  </section>
);
