import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { ExecutionTimeline } from "../../types/execution";
import { removeDirectory } from "../../utils/removeDirectory";

const execFileAsync = promisify(execFile);
const defaultExecutionTimeoutMs = 10000;
const executionMaxBuffer = 1024 * 1024;

const pythonRunnerTemplate = (
  encodedUserCode: string,
  encodedUserInput: string,
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

linecache.cache[FILENAME] = (
    len(USER_CODE),
    None,
    [line + "\\n" for line in USER_CODE.splitlines()],
    FILENAME,
)

steps = []
error_message = None

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
    if frame.f_code.co_filename != FILENAME:
        return tracer

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
}))
`;

interface PythonCommand {
  command: string;
  args: string[];
}

const getPythonCandidates = (): PythonCommand[] => {
  const configuredExecutable = process.env.PYTHON_EXECUTABLE?.trim();

  if (configuredExecutable) {
    const [command, ...args] = configuredExecutable.split(/\s+/);
    return [{ command, args }];
  }

  return [
    { command: "python", args: [] },
    { command: "py", args: ["-3"] },
  ];
};

export const executePython = async (
  code: string,
  stdin = "",
  timeoutMs = defaultExecutionTimeoutMs,
): Promise<ExecutionTimeline> => {
  const tempDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "codesight-python-"),
  );
  const runnerPath = path.join(tempDirectory, "runner.py");
  const encodedUserCode = Buffer.from(code, "utf8").toString("base64");
  const encodedUserInput = Buffer.from(stdin, "utf8").toString("base64");

  await fs.writeFile(
    runnerPath,
    pythonRunnerTemplate(encodedUserCode, encodedUserInput),
    "utf8",
  );

  try {
    let lastError: unknown = null;

    for (const candidate of getPythonCandidates()) {
      try {
        const { stdout } = await execFileAsync(
          candidate.command,
          [...candidate.args, runnerPath],
          {
            timeout: timeoutMs,
            maxBuffer: executionMaxBuffer,
          },
        );

        const parsedTrace = JSON.parse(stdout) as ExecutionTimeline;

        return {
          steps: parsedTrace.steps ?? [],
          output: parsedTrace.output ?? [],
          ...(parsedTrace.error ? { error: parsedTrace.error } : {}),
        };
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: string }).code === "ENOENT"
        ) {
          lastError = error;
          continue;
        }

        const stderr =
          typeof error === "object" &&
          error !== null &&
          "stderr" in error &&
          typeof (error as { stderr?: string }).stderr === "string"
            ? (error as { stderr: string }).stderr
            : "";

        if (
          candidate.command === "python" &&
          /Python was not found; run without arguments to install/i.test(stderr)
        ) {
          lastError = error;
          continue;
        }

        if (
          typeof error === "object" &&
          error !== null &&
          "stdout" in error &&
          typeof (error as { stdout?: string }).stdout === "string"
        ) {
          const stdout = (error as { stdout: string }).stdout;

          try {
            const parsedTrace = JSON.parse(stdout) as ExecutionTimeline;
            return {
              steps: parsedTrace.steps ?? [],
              output: parsedTrace.output ?? [],
              ...(parsedTrace.error ? { error: parsedTrace.error } : {}),
            };
          } catch {
            if (
              "code" in (error as object) &&
              (error as { code?: string }).code === "ETIMEDOUT"
            ) {
              throw new Error(`Python execution timed out after ${timeoutMs}ms.`);
            }
            throw error;
          }
        }

        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: string }).code === "ETIMEDOUT"
        ) {
          throw new Error(`Python execution timed out after ${timeoutMs}ms.`);
        }

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
