import clsx from "clsx";
import type { RuntimeManagerSnapshot } from "../utils/api";

interface RuntimeManagerPanelProps {
  runtimeManager: RuntimeManagerSnapshot | null;
  isLoading: boolean;
  onRefresh: () => void;
}

const statusTone = (installed: boolean) =>
  installed
    ? "border-[rgba(114,255,112,0.2)] bg-[rgba(114,255,112,0.08)] text-[var(--cs-primary-bright)]"
    : "border-amber-300/18 bg-amber-300/10 text-amber-100";

const commandTone = (installed: boolean) =>
  installed
    ? "border-[rgba(255,255,255,0.04)] bg-[rgba(11,15,11,0.92)]"
    : "border-amber-300/16 bg-amber-300/8";

const formatCheckedAt = (checkedAt: string) => {
  const date = new Date(checkedAt);

  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export const RuntimeManagerPanel = ({
  runtimeManager,
  isLoading,
  onRefresh,
}: RuntimeManagerPanelProps) => {
  const installedCount = runtimeManager?.installedCount ?? 0;
  const totalCount = runtimeManager?.items.length ?? 5;
  const missingCount = runtimeManager?.missingCount ?? Math.max(0, totalCount - installedCount);

  return (
    <div className="rounded-xl border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
            Runtime Manager
          </div>
          <div className="mt-2 text-sm text-[var(--cs-text)]">
            {isLoading && !runtimeManager
              ? "Checking local runtimes..."
              : `${installedCount}/${totalCount} runtime groups ready`}
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--cs-text-muted)]">
            CodeSight uses local installed tools for JavaScript, Python, Java, C, and C++ execution.
          </p>
          {runtimeManager ? (
            <p className="mt-1 text-xs text-[var(--cs-text-subtle)]">
              Last checked at {formatCheckedAt(runtimeManager.checkedAt)}.
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="cs-button rounded-xl px-3 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Checking..." : "Refresh"}
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        {runtimeManager?.items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-[var(--cs-border)] bg-[rgba(10,13,10,0.88)] p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-[var(--cs-text)]">
                  {item.label}
                </div>
                <div className="mt-1 text-xs text-[var(--cs-text-subtle)]">
                  {item.version ?? item.guidance}
                </div>
              </div>

              <span
                className={clsx(
                  "rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em]",
                  statusTone(item.installed),
                )}
              >
                {item.installed ? "✓ Installed" : "✗ Missing"}
              </span>
            </div>

            <div className="mt-3 grid gap-2">
              {item.commands.map((command) => (
                <div
                  key={`${item.id}-${command.key}`}
                  className={clsx(
                    "rounded-lg border px-3 py-2",
                    commandTone(command.installed),
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs text-[var(--cs-text)]">
                      {command.command}
                    </span>
                    <span className="text-xs text-[var(--cs-text-subtle)]">
                      {command.installed ? command.version ?? "Detected" : "Unavailable"}
                    </span>
                  </div>
                  {!command.installed && command.error ? (
                    <p className="mt-2 text-xs leading-5 text-amber-100">
                      {command.error}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>

            {!item.installed ? (
              <p className="mt-3 text-sm leading-6 text-amber-100">
                {item.guidance}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {runtimeManager && missingCount === 0 ? (
        <p className="mt-4 text-sm leading-6 text-[var(--cs-primary-soft)]">
          All required local runtime groups are installed and ready.
        </p>
      ) : null}
    </div>
  );
};
