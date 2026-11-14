# AlgoLoom / CodeSight Testing Strategy

## Baseline discovered before Prompt 2

The repository had no configured unit-test runner, integration-test runner, browser E2E runner, ESLint configuration, or lint script. Existing validation consisted of TypeScript production builds and `backend`'s `verify:engine` script.

The available baseline was recorded before changes:

- `npm run build`: passed.
- `npm run verify:engine --prefix backend`: environment-sensitive partial result. JavaScript and C passed; C++ compilation timed out; Java and Python were skipped because required local runtimes were unavailable.
- Unit/integration/E2E/lint commands: unavailable because no scripts or configured suites existed.

## Test layers added

### Backend integration tests

`backend/tests/execution.integration.test.ts` starts the real Express app on an ephemeral loopback port and tests:

- liveness and request correlation headers;
- JavaScript execution, output, and trace-frame generation;
- invalid language and empty-code validation;
- malformed JSON safety;
- child-process timeout termination.

These tests use Node's built-in `node:test` runner and the already-installed workspace `tsx` loader. No test dependency was added.

### Frontend domain regression test

`frontend/tests/visualization.test.ts` tests the pure `createExecutionClassroomFrame` contract for source-line selection, variable changes, stack frames, heap blocks, and explanations. It intentionally avoids browser rendering because no DOM/E2E runner is currently installed.

## Workflow coverage matrix

The detailed workflow matrix is in [REGRESSION_MATRIX.md](./REGRESSION_MATRIX.md). Backend and pure-domain workflows are automated. Browser-only flows remain manual until a browser test runner is approved and added.

## Test commands

```bash
npm test
npm run build
npm run verify:engine --prefix backend
```

`npm test` runs backend and frontend test suites. `npm run build` remains the type-check and production-build gate because the packages' build scripts run `tsc` before bundling.

## Future smallest additions

If UI automation becomes necessary, add Playwright as a dev dependency and create one authenticated smoke fixture against a staging Supabase project. Do not add a full component-testing stack until the first UI regression requires it; the current pure-domain tests provide useful coverage without introducing jsdom or testing-library maintenance.

## Test hygiene and safety

- Tests use ephemeral ports and temporary runtime workspaces.
- No Supabase credentials or production endpoints are used.
- Execution tests use bounded code, output, and timeout values.
- Assertions validate user-safe error messages rather than internal stack traces.
- Tests do not log passwords, tokens, or user source code beyond the intentional small fixture output.

