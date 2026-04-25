# CodeSight

CodeSight is a full-stack learning workspace with a Monaco editor, React frontend, Express backend, SQLite persistence, and a Docker-isolated execution engine.

## Stack

- Frontend: React + TypeScript + Vite + Tailwind CSS + Monaco Editor
- Backend: Node.js + Express + Prisma + SQLite
- Execution engine: Docker containers with per-language runtime images

## Supported Languages

- JavaScript
- Python
- C
- C++
- Java

## Execution Model

- `POST /execute` accepts:

```json
{
  "code": "print('hello')",
  "language": "python"
}
```

- The backend writes the code to a temp workspace.
- It selects the right Docker image for the language.
- It runs the compile and/or execute command inside a locked-down container.
- It captures stdout, stderr, execution time, and optional step data.

## API Response

```json
{
  "language": "python",
  "output": "hello\n",
  "outputLines": ["hello"],
  "error": "",
  "executionTime": 42,
  "timedOut": false,
  "steps": []
}
```

`steps` is populated for Python via tracing and for JavaScript via the existing educational interpreter when execution succeeds.

## Security Controls

- Docker isolation per run
- `--network none`
- CPU limit
- memory limit
- PID limit
- read-only root filesystem
- dropped Linux capabilities
- `no-new-privileges`
- hard execution timeout

Default limits are configured in `backend/.env.example`:

- `EXECUTION_TIMEOUT_MS=5000`
- `EXECUTION_MEMORY_LIMIT=256m`
- `EXECUTION_CPU_LIMIT=0.5`
- `EXECUTION_PIDS_LIMIT=64`

## Docker Images

The repo includes:

- [docker/Dockerfile.node](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/docker/Dockerfile.node)
- [docker/Dockerfile.python](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/docker/Dockerfile.python)
- [docker/Dockerfile.cpp](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/docker/Dockerfile.cpp)
- [docker/Dockerfile.java](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/docker/Dockerfile.java)

C and C++ share the same compiler image.

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create env files

```bash
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

Backend env values:

```env
PORT=4000
DATABASE_URL="file:./dev.db"
JWT_SECRET="replace-with-a-long-random-secret"
FRONTEND_URL="http://localhost:5173"
DOCKER_BIN="docker"
EXECUTION_PROVIDER="auto"
NODE_EXECUTOR_IMAGE="codesight-node-runner"
PYTHON_EXECUTOR_IMAGE="codesight-python-runner"
CPP_EXECUTOR_IMAGE="codesight-cpp-runner"
JAVA_EXECUTOR_IMAGE="codesight-java-runner"
EXECUTION_TIMEOUT_MS=5000
EXECUTION_MEMORY_LIMIT="256m"
EXECUTION_CPU_LIMIT="0.5"
EXECUTION_PIDS_LIMIT=64
```

Frontend env:

```env
VITE_API_BASE_URL="http://localhost:4000"
```

### 3. Build the runner images

From the repo root:

```bash
npm run docker:build
```

Or use the helper scripts:

- PowerShell: `./docker/build-images.ps1`
- Bash: `./docker/build-images.sh`

### 4. Start the app

```bash
npm run dev
```

Apps:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## Compile and Run Commands

- JavaScript: `node main.js`
- Python: `python3 /opt/codesight/python_trace.py /workspace/main.py`
- C: `gcc /workspace/main.c -O2 -std=c11 -o /workspace/program && /workspace/program`
- C++: `g++ /workspace/main.cpp -O2 -std=c++17 -o /workspace/program && /workspace/program`
- Java: `javac /workspace/Main.java && java -cp /workspace Main`

## Notes

- `EXECUTION_PROVIDER="auto"` tries Docker first and falls back to local runtimes if Docker is unavailable on your machine.
- Set `EXECUTION_PROVIDER="docker"` to require containers only.
- Set `EXECUTION_PROVIDER="local"` for local-runtime development without Docker.
- Python returns structured step data through `sys.settrace()`.
- JavaScript keeps best-effort step data through the existing interpreter while runtime execution happens in Docker.
- C, C++, and Java currently return output, errors, and timing, with `steps` left empty so the API stays extendable for future visualization work.
