# CodeSight Deployment Guide

## Desktop Runtime Model

CodeSight desktop releases now execute code with local machine tools instead of Docker containers.

Required tools:

- `node --version`
- `python --version` or `python3 --version`
- `java -version`
- `javac -version`
- `gcc --version`
- `g++ --version`

The embedded backend probes these commands at startup and exposes the results to the Runtime Manager panel in the renderer.

## Local Desktop Smoke Test

```bash
npm install
npm run build
npm run electron:start
```

## Development Loop

```bash
npm run dev
npm run electron:dev
```

## Backend Health Endpoints

- `GET /health` returns backend health plus cached runtime-manager data.
- `GET /runtimes` returns the current runtime snapshot.
- `GET /runtimes?refresh=1` forces a fresh runtime probe.

## Packaging Notes

- Electron always uses the embedded backend in packaged desktop builds.
- Execution uses `child_process.spawn()` through the local executor.
- Compile, run, trace, stdout, stderr, exit code, and timing data are preserved per phase.

## Render / Hosted API

If you still deploy the standalone backend, the host machine must have the same local runtimes installed and available on `PATH` because CodeSight no longer depends on Docker runner images.
