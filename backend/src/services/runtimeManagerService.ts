import type { CommandCandidate, RuntimeCheckDefinition } from "../executors/runtimeCatalog";
import { runtimeCheckDefinitions } from "../executors/runtimeCatalog";
import { runCommandWithLimits } from "../executors/runCommandWithLimits";

export interface RuntimeCommandStatus {
  key: "node" | "python" | "java" | "javac" | "gcc" | "g++";
  label: string;
  installed: boolean;
  command: string;
  version: string | null;
  error: string | null;
}

export interface RuntimeStatusItem {
  id: RuntimeCheckDefinition["id"];
  label: string;
  installed: boolean;
  version: string | null;
  guidance: string;
  commands: RuntimeCommandStatus[];
}

export interface RuntimeManagerSnapshot {
  checkedAt: string;
  installedCount: number;
  missingCount: number;
  items: RuntimeStatusItem[];
}

const probeTimeoutMs = 5_000;
const probeOutputLimitBytes = 32 * 1024;

let cachedSnapshot: RuntimeManagerSnapshot | null = null;
let activeProbe: Promise<RuntimeManagerSnapshot> | null = null;

const formatCommand = (candidate: CommandCandidate, args: string[]) =>
  [candidate.command, ...(candidate.args ?? []), ...args].join(" ");

const summarizeProbeOutput = (stdout: string, stderr: string) => {
  const firstLine = [stdout, stderr]
    .join("\n")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine ?? null;
};

const probeCandidates = async (
  label: string,
  candidates: CommandCandidate[],
  args: string[],
): Promise<RuntimeCommandStatus> => {
  let lastCommand = [label, ...args].join(" ");
  let lastError: string | null = null;

  for (const candidate of candidates) {
    const command = formatCommand(candidate, args);
    lastCommand = command;

    try {
      const result = await runCommandWithLimits({
        command: candidate.command,
        args: [...(candidate.args ?? []), ...args],
        timeoutMs: probeTimeoutMs,
        outputLimitBytes: probeOutputLimitBytes,
      });
      const version = summarizeProbeOutput(result.stdout, result.stderr);

      if (result.exitCode === 0 && !result.timedOut) {
        return {
          key: label as RuntimeCommandStatus["key"],
          label,
          installed: true,
          command,
          version,
          error: null,
        };
      }

      lastError =
        version ??
        (result.timedOut
          ? `${label} version check timed out.`
          : `${label} exited with code ${result.exitCode ?? "unknown"}.`);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (((error as { code?: string }).code === "ENOENT") ||
          ((error as { code?: string }).code === "EACCES" &&
            process.platform === "win32"))
      ) {
        lastError = `${label} is not available on PATH.`;
        continue;
      }

      lastError =
        error instanceof Error ? error.message : `${label} version check failed.`;
    }
  }

  return {
    key: label as RuntimeCommandStatus["key"],
    label,
    installed: false,
    command: lastCommand,
    version: null,
    error: lastError,
  };
};

const buildRuntimeItem = async (
  definition: RuntimeCheckDefinition,
): Promise<RuntimeStatusItem> => {
  const commands = await Promise.all(
    definition.checks.map((check) =>
      probeCandidates(check.label, check.candidates, check.versionArgs),
    ),
  );
  const installed = commands.every((command) => command.installed);
  const version = installed
    ? commands
        .map((command) => command.version)
        .filter((value): value is string => Boolean(value))
        .join(" | ")
    : null;

  return {
    id: definition.id,
    label: definition.label,
    installed,
    version,
    guidance: definition.guidance,
    commands,
  };
};

const createSnapshot = async (): Promise<RuntimeManagerSnapshot> => {
  const items = await Promise.all(runtimeCheckDefinitions.map(buildRuntimeItem));
  const installedCount = items.filter((item) => item.installed).length;

  return {
    checkedAt: new Date().toISOString(),
    installedCount,
    missingCount: items.length - installedCount,
    items,
  };
};

export const refreshRuntimeManagerSnapshot = async () => {
  if (!activeProbe) {
    activeProbe = createSnapshot()
      .then((snapshot) => {
        cachedSnapshot = snapshot;
        return snapshot;
      })
      .finally(() => {
        activeProbe = null;
      });
  }

  return activeProbe;
};

export const getRuntimeManagerSnapshot = async (options?: { refresh?: boolean }) => {
  if (options?.refresh || !cachedSnapshot) {
    return refreshRuntimeManagerSnapshot();
  }

  return cachedSnapshot;
};

export const primeRuntimeManagerSnapshot = () => {
  void refreshRuntimeManagerSnapshot().catch((error) => {
    console.error(
      `[codesight] Unable to probe local runtimes: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  });
};
