# CodeSight

CodeSight is an Electron desktop code-visualization workspace built with React, Vite, Monaco, an embedded Node.js backend, and local machine runtimes.

## Supported Local Runtimes

- JavaScript: `node`
- Python: `python` or `python3`
- Java: `java` and `javac`
- C: `gcc`
- C++: `g++`

CodeSight checks these tools at startup and shows their status in the Runtime Manager panel inside the desktop app.

## Local Development

```bash
npm install
npm run dev
```

Desktop commands:

```bash
npm run electron:dev
npm run electron:start
```

- `npm run electron:dev` uses the frontend and backend dev servers.
- `npm run electron:start` builds the frontend, backend, and Electron shell, then launches the packaged-style desktop app with the embedded backend.

## Production Builds

```bash
npm run build
npm run electron:build
```

## Key Files

- Electron shell: [electron/main.ts](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/electron/main.ts)
- Embedded backend app: [backend/src/app.ts](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/backend/src/app.ts)
- Local executor: [backend/src/executors/localExecutor.ts](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/backend/src/executors/localExecutor.ts)
- Runtime detection: [backend/src/services/runtimeManagerService.ts](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/backend/src/services/runtimeManagerService.ts)
- Desktop workbench: [frontend/src/pages/HomePage.tsx](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/frontend/src/pages/HomePage.tsx)
- Runtime Manager UI: [frontend/src/components/RuntimeManagerPanel.tsx](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/frontend/src/components/RuntimeManagerPanel.tsx)
- Deployment notes: [docs/deployment.md](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/docs/deployment.md)
