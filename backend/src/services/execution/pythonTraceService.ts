import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { StructuredLogger } from "../../logging/logger";
import type { ExecutionTimeline } from "../../types/execution";
import { getPythonCandidates } from "../../executors/runtimeCatalog";
import { runCommandWithLimits } from "../../executors/runCommandWithLimits";
import { removeDirectory } from "../../utils/removeDirectory";

const defaultExecutionTimeoutMs = 10000;
const executionMaxBuffer = 1024 * 1024;

const pythonRunnerTemplate = (
  encodedUserCode: string,
  encodedUserInput: string,
  maxSteps: number,
) => `
import base64
import contextlib
import io
import json
import linecache
import sys
import traceback
from types import FrameType

FILENAME = "<codesight>"
USER_CODE = base64.b64decode("${encodedUserCode}").decode("utf-8")
USER_STDIN = base64.b64decode("${encodedUserInput}").decode("utf-8")
MAX_STEPS = ${maxSteps}

linecache.cache[FILENAME] = (
    len(USER_CODE),
    None,
    [line + "\\n" for line in USER_CODE.splitlines()],
    FILENAME,
)

steps = []
error_message = None
trace_truncated = False

class TraceOutput:
    def __init__(self):
        self._buffer = ""

    def write(self, value):
        if not isinstance(value, str):
            value = str(value)
        self._buffer += value
        return len(value)

    def flush(self):
        return None

    def snapshot(self):
        if not self._buffer:
            return []
        normalized = self._buffer.replace("\\r\\n", "\\n")
        return normalized.split("\\n")[:-1] if normalized.endswith("\\n") else normalized.split("\\n")

console_output = TraceOutput()

def safe_repr(value):
    try:
        rendered = repr(value)
    except Exception:
        rendered = "<unrepresentable>"
    if len(rendered) > 120:
        return rendered[:117] + "..."
    return rendered

def should_skip(name):
    return name.startswith("__") and name.endswith("__")

def serialize_scope(frame: FrameType):
    snapshots = []
    seen = set()
    local_scope_name = "global" if frame.f_code.co_name == "<module>" else frame.f_code.co_name

    for scope_name, mapping in [
        (local_scope_name, frame.f_locals),
        ("global", frame.f_globals),
    ]:
        for key, value in mapping.items():
            if key in seen or should_skip(key):
                continue
            if key == "__builtins__":
                continue
            seen.add(key)
            snapshots.append({
                "name": key,
                "scope": scope_name,
                "value": safe_repr(value),
            })

    snapshots.sort(key=lambda item: item["name"])
    return snapshots

def serialize_stack(frame: FrameType):
    frames = []
    current = frame

    while current and current.f_code.co_filename == FILENAME:
        scope_name = "global" if current.f_code.co_name == "<module>" else current.f_code.co_name
        locals_snapshot = []

        for key, value in current.f_locals.items():
            if should_skip(key) or key == "__builtins__":
                continue
            locals_snapshot.append({
                "name": key,
                "scope": scope_name,
                "value": safe_repr(value),
            })

        locals_snapshot.sort(key=lambda item: item["name"])
        frames.append({
            "name": scope_name,
            "locals": locals_snapshot,
        })
        current = current.f_back

    return frames

def build_description(frame: FrameType):
    scope_name = "global" if frame.f_code.co_name == "<module>" else frame.f_code.co_name
    return f"Executing Python line {frame.f_lineno} in {scope_name}."

def tracer(frame, event, arg):
    global trace_truncated

    if frame.f_code.co_filename != FILENAME:
        return tracer

    if trace_truncated:
        return None

    if event == "line":
        steps.append({
            "line": frame.f_lineno,
            "description": build_description(frame),
            "variables": serialize_scope(frame),
            "stack": serialize_stack(frame),
            "output": console_output.snapshot(),
        })
    elif event == "return" and frame.f_code.co_name != "<module>":
        steps.append({
            "line": frame.f_lineno,
            "description": f"{frame.f_code.co_name} returned {safe_repr(arg)}.",
            "variables": serialize_scope(frame),
            "stack": serialize_stack(frame),
            "output": console_output.snapshot(),
        })

    if len(steps) >= MAX_STEPS:
        trace_truncated = True
        return None

    return tracer

namespace = {
    "__builtins__": __builtins__,
    "__name__": "__main__",
}

try:
    compiled = compile(USER_CODE, FILENAME, "exec")
    sys.settrace(tracer)
    sys.stdin = io.StringIO(USER_STDIN)
    with contextlib.redirect_stdout(console_output):
        exec(compiled, namespace, namespace)
except Exception:
    error_message = traceback.format_exc().strip()
finally:
    sys.settrace(None)

print(json.dumps({
    "steps": steps,
    "output": console_output.snapshot(),
    "error": error_message,
    "truncated": trace_truncated,
}))
`;

export const executePython = async (
  code: string,
  stdin = "",
  timeoutMs = defaultExecutionTimeoutMs,
  maxSteps = 400,
  logger?: StructuredLogger,
): Promise<ExecutionTimeline> => {
  const tempDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "codesight-python-"),
  );
  const runnerPath = path.join(tempDirectory, "runner.py");
  const encodedUserCode = Buffer.from(code, "utf8").toString("base64");
  const encodedUserInput = Buffer.from(stdin, "utf8").toString("base64");

  await fs.writeFile(
    runnerPath,
    pythonRunnerTemplate(encodedUserCode, encodedUserInput, maxSteps),
    "utf8",
  );
  logger?.trace("Prepared Python trace runner script.", {
    phase: "trace",
    filePath: runnerPath,
      details: {
        tempDirectory,
        sourceBytes: Buffer.byteLength(code, "utf8"),
        stdinBytes: Buffer.byteLength(stdin, "utf8"),
        maxSteps,
      },
    });

  try {
    let lastError: unknown = null;

    for (const candidate of getPythonCandidates()) {
      logger?.trace("Attempting Python trace runner candidate.", {
        phase: "trace",
        command: [candidate.command, ...(candidate.args ?? []), runnerPath].join(" "),
        filePath: runnerPath,
      });
      try {
        const result = await runCommandWithLimits({
          command: candidate.command,
          args: [...(candidate.args ?? []), runnerPath],
          timeoutMs,
          outputLimitBytes: executionMaxBuffer,
          logger,
          phase: "trace",
          language: "python",
          filePath: runnerPath,
        });
        const stdout = result.stdout;
        const stderr = result.stderr;

        if (result.timedOut) {
          throw new Error(`Python execution timed out after ${timeoutMs}ms.`);
        }

        if (
          /^python(?:3(?:\.exe)?)?(?:\.exe)?$/i.test(candidate.command) &&
          /Python was not found; run without arguments to install/i.test(stderr)
        ) {
          lastError = new Error(stderr.trim() || "Python runtime was not found.");
          continue;
        }

        if (result.exitCode !== 0 && !stdout.trim()) {
          throw new Error(
            stderr.trim() ||
              `Python trace runner exited with code ${result.exitCode ?? "unknown"}.`,
          );
        }

        let parsedTrace: ExecutionTimeline;

        try {
          parsedTrace = JSON.parse(stdout) as ExecutionTimeline;
        } catch (error) {
          logger?.error("Python trace parser failed to decode runner output.", error, {
            phase: "trace",
            command: [candidate.command, ...(candidate.args ?? []), runnerPath].join(" "),
            filePath: runnerPath,
            stdout,
            stderr,
          });
          throw error;
        }

        logger?.trace("Python trace runner completed successfully.", {
          phase: "trace",
          command: [candidate.command, ...(candidate.args ?? []), runnerPath].join(" "),
          filePath: runnerPath,
          stdout,
          stderr,
          details: {
            capturedSteps: parsedTrace.steps?.length ?? 0,
            capturedOutputLines: parsedTrace.output?.length ?? 0,
            traceError: parsedTrace.error ?? "",
            truncated: parsedTrace.truncated ?? false,
          },
        });

        return {
          steps: parsedTrace.steps ?? [],
          output: parsedTrace.output ?? [],
          truncated: parsedTrace.truncated ?? false,
          ...(parsedTrace.error ? { error: parsedTrace.error } : {}),
        };
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          ((error as { code?: string }).code === "ENOENT" ||
            ((error as { code?: string }).code === "EACCES" &&
              process.platform === "win32"))
        ) {
          lastError = error;
          continue;
        }

        logger?.error("Python trace runner candidate failed.", error, {
          phase: "trace",
          command: [candidate.command, ...(candidate.args ?? []), runnerPath].join(" "),
          filePath: runnerPath,
        });

        throw error;
      }
    }

    throw new Error(
      lastError instanceof Error
        ? lastError.message
        : "Python runtime was not found.",
    );
  } finally {
    await removeDirectory(tempDirectory);
  }
};
