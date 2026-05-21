# 🚀 CodeSight

<div align="center">

### Visual Debugging Workspace for Learning Programming

CodeSight is a modern desktop application that helps developers and students understand how code executes internally through interactive runtime visualization, memory inspection, execution tracing, and step-by-step explanations.

Built with **Electron**, **React**, **TypeScript**, **Vite**, **Monaco Editor**, and a local execution engine, CodeSight transforms source code into an interactive learning experience.

</div>

---

## ✨ Features

### 🔍 Interactive Code Visualization

- Execute code line-by-line
- Visualize program flow in real time
- Follow execution using an interactive timeline
- Play, pause, step forward, and step backward through execution
- Auto-scroll editor to keep the active line visible

### 🧠 Memory Visualization

Visualize memory changes as code executes:

- Stack Frames
- Function Calls
- Local Variables
- Global Variables
- Heap Allocations
- Arrays
- Vectors
- Object References
- Memory Updates

Perfect for understanding:

- Recursion
- Dynamic Memory
- Data Structures
- Function Execution
- Variable Scope

### 📖 Runtime Explanations

Every executed step includes human-readable explanations:

- Variable assignments
- Loop iterations
- Conditional evaluations
- Function calls
- Return statements
- Memory changes

Helping beginners understand *why* code behaves the way it does.

### ⚡ Multi-Language Support

Run and visualize programs locally using installed runtimes:

| Language | Runtime |
|-----------|-----------|
| JavaScript | Node.js |
| Python | Python 3 |
| Java | JDK (javac/java) |
| C | GCC |
| C++ | G++ |

### 🖥️ Desktop-First Experience

- Native Electron desktop application
- Works without Docker
- Uses local machine compilers and runtimes
- Fast startup and execution
- Optimized for large monitors and laptops

### 📂 Workspace Management

- Create new files
- Open local files
- Save code locally
- Export execution traces
- Maintain execution history
- Language-aware templates

### 🎯 Designed For

- Students learning programming
- DSA preparation
- Coding interview practice
- Debugging algorithms
- Understanding recursion
- Learning memory management
- Teaching programming concepts

---

## 🏗️ Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Monaco Editor
- React Query
- Framer Motion
- Tailwind CSS

### Desktop Layer

- Electron
- Electron IPC

### Backend

- Node.js
- Express.js
- TypeScript

### Runtime Engine

- Local Process Execution
- Runtime Detection Service
- Execution Trace Generation
- Memory Snapshot Processing

---

## Supported Local Runtimes

CodeSight automatically detects installed runtimes during startup.

### Required Tools

#### JavaScript

```bash
node --version
```

#### Python

```bash
python --version
```

or

```bash
python3 --version
```

#### Java

```bash
javac --version
java --version
```

#### C

```bash
gcc --version
```

#### C++

```bash
g++ --version
```

Runtime availability is displayed inside the Runtime Manager panel.

---

# 🚀 Getting Started

## Clone Repository

```bash
git clone https://github.com/pratikdas018/codeSight.git

cd codeSight
```

## Install Dependencies

```bash
npm install
```

---

## Development Mode

Start frontend + backend:

```bash
npm run dev
```

Launch Electron:

```bash
npm run electron:dev
```

This starts:

- Vite frontend
- Backend API
- Electron desktop shell

---

## Production Mode

Build everything:

```bash
npm run build
```

Run desktop application:

```bash
npm run electron:start
```

---

## Create Desktop Build

Generate distributable installers:

```bash
npm run electron:build
```

Build outputs:

```
release/
```

---

## 📁 Project Structure

```text
codeSight/
│
├── electron/
│   └── main.ts
│
├── frontend/
│   ├── src/components
│   ├── src/pages
│   ├── src/hooks
│   └── src/services
│
├── backend/
│   ├── src/app.ts
│   ├── src/executors
│   ├── src/services
│   └── src/routes
│
├── docs/
│   └── deployment.md
│
└── release/
```

---

## Important Files

### Electron Shell

```text
electron/main.ts
```

Controls desktop window lifecycle, IPC communication, and backend startup.

### Backend Application

```text
backend/src/app.ts
```

Main API server used by the Electron application.

### Local Executor

```text
backend/src/executors/localExecutor.ts
```

Handles compilation and execution of programs using local runtimes.

### Runtime Detection

```text
backend/src/services/runtimeManagerService.ts
```

Detects installed compilers and interpreters on the user's machine.

### Main Workspace

```text
frontend/src/pages/HomePage.tsx
```

Primary editor and visualization workspace.

### Runtime Manager

```text
frontend/src/components/RuntimeManagerPanel.tsx
```

Displays installed runtime information and health checks.

---

## Roadmap

### Current

- Multi-language execution
- Interactive timeline
- Memory visualization
- Runtime explanations
- Local runtime detection

### Planned

- Advanced heap visualizer
- Linked list visualization
- Tree visualization
- Graph traversal visualization
- Recursion call tree explorer
- AI-generated explanations
- Execution replay sharing
- Admin analytics dashboard
- Cloud synchronization

---

## Why CodeSight?

Most IDEs show only code.

CodeSight shows:

✅ How code executes

✅ How variables change

✅ How memory evolves

✅ How functions interact

✅ Why each line matters

Making programming easier to learn, debug, and understand.

---

## License

MIT License

---

Built by Pratik Das