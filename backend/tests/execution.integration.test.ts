import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import app from "../src/app";
import { startHttpServer } from "../src/utils/server";
import { runCommandWithLimits } from "../src/executors/runCommandWithLimits";

let server: Server;
let baseUrl = "";

before(async () => {
  server = await startHttpServer(app, 0, "test backend", "127.0.0.1");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

const postExecute = async (body: Record<string, string>) =>
  fetch(`${baseUrl}/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test("health and liveness expose usable status and request correlation", async () => {
  const live = await fetch(`${baseUrl}/live`);
  assert.equal(live.status, 200);
  assert.equal((await live.json()).status, "ok");
  assert.ok(live.headers.get("x-request-id"));
});

test("JavaScript execution returns trace frames and captured output", async () => {
  const response = await postExecute({
    language: "javascript",
    code: "let total = 1; total = total + 2; console.log(total);",
  });

  assert.equal(response.status, 200);
  const trace = await response.json();
  assert.equal(trace.status, "completed");
  assert.ok(trace.traceFrames.length > 0);
  assert.ok(trace.outputLines.includes("3"));
  assert.equal(trace.traceSummary.frameCount, trace.traceFrames.length);
});

test("invalid execution requests return safe client errors", async () => {
  const empty = await postExecute({ language: "javascript", code: "   " });
  assert.equal(empty.status, 400);
  assert.deepEqual(await empty.json(), { message: "Code is required." });

  const unsupported = await postExecute({ language: "ruby", code: "puts 1" });
  assert.equal(unsupported.status, 400);
  assert.match((await unsupported.json()).message, /Unsupported language/);
});

test("malformed JSON does not expose an internal stack trace", async () => {
  const response = await fetch(`${baseUrl}/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not-json",
  });

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.deepEqual(payload, { message: "Request body must be valid JSON." });
});

test("child execution is terminated at the configured timeout", async () => {
  const result = await runCommandWithLimits({
    command: process.execPath,
    args: ["-e", "setInterval(() => {}, 1000)"],
    timeoutMs: 100,
    outputLimitBytes: 1024,
  });

  assert.equal(result.timedOut, true);
  assert.equal(result.outputLimitExceeded, false);
});
