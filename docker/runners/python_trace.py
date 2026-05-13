import contextlib
import json
import linecache
import pathlib
import sys
import traceback
from types import FrameType


if len(sys.argv) != 2:
    raise SystemExit("Usage: python_trace.py <script>")


source_path = pathlib.Path(sys.argv[1]).resolve()
filename = str(source_path)
user_code = source_path.read_text(encoding="utf-8")

linecache.cache[filename] = (
    len(user_code),
    None,
    [line + "\n" for line in user_code.splitlines()],
    filename,
)

steps = []
error_message = ""


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

        normalized = self._buffer.replace("\r\n", "\n")
        if normalized.endswith("\n"):
            return normalized.split("\n")[:-1]
        return normalized.split("\n")

    def text(self):
        return self._buffer


console_output = TraceOutput()


def safe_repr(value):
    try:
        rendered = repr(value)
    except Exception:
        rendered = "<unrepresentable>"

    if len(rendered) > 160:
        return rendered[:157] + "..."

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
            if key in seen or should_skip(key) or key == "__builtins__":
                continue

            seen.add(key)
            snapshots.append(
                {
                    "name": key,
                    "scope": scope_name,
                    "value": safe_repr(value),
                }
            )

    snapshots.sort(key=lambda item: item["name"])
    return snapshots


def serialize_stack(frame: FrameType):
    frames = []
    current = frame

    while current and current.f_code.co_filename == filename:
        scope_name = "global" if current.f_code.co_name == "<module>" else current.f_code.co_name
        locals_snapshot = []

        for key, value in current.f_locals.items():
            if should_skip(key) or key == "__builtins__":
                continue

            locals_snapshot.append(
                {
                    "name": key,
                    "scope": scope_name,
                    "value": safe_repr(value),
                }
            )

        locals_snapshot.sort(key=lambda item: item["name"])
        frames.append(
            {
                "name": scope_name,
                "locals": locals_snapshot,
            }
        )
        current = current.f_back

    return frames


def describe_line(frame: FrameType):
    scope_name = "global" if frame.f_code.co_name == "<module>" else frame.f_code.co_name
    return f"Executing Python line {frame.f_lineno} in {scope_name}."


def tracer(frame, event, arg):
    if frame.f_code.co_filename != filename:
        return tracer

    if event == "line":
        steps.append(
            {
                "line": frame.f_lineno,
                "description": describe_line(frame),
                "explanation": describe_line(frame),
                "variables": serialize_scope(frame),
                "stack": serialize_stack(frame),
                "output": console_output.snapshot(),
            }
        )
    elif event == "return" and frame.f_code.co_name != "<module>":
        steps.append(
            {
                "line": frame.f_lineno,
                "description": f"{frame.f_code.co_name} returned {safe_repr(arg)}.",
                "explanation": f"{frame.f_code.co_name} returned {safe_repr(arg)}.",
                "variables": serialize_scope(frame),
                "stack": serialize_stack(frame),
                "output": console_output.snapshot(),
            }
        )

    return tracer


namespace = {
    "__builtins__": __builtins__,
    "__name__": "__main__",
}

try:
    compiled = compile(user_code, filename, "exec")
    sys.settrace(tracer)
    with contextlib.redirect_stdout(console_output):
        exec(compiled, namespace, namespace)
except Exception:
    error_message = traceback.format_exc().strip()
finally:
    sys.settrace(None)

print(
    json.dumps(
        {
            "steps": steps,
            "output": console_output.text(),
            "error": error_message,
        }
    )
)
