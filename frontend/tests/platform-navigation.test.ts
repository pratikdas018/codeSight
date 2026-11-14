import assert from "node:assert/strict";
import test from "node:test";
import { platformNavigation } from "../src/platform/navigation";

test("platform navigation exposes one entry point for every planned module", () => {
  const ids = platformNavigation.map((item) => item.id);
  const paths = platformNavigation.map((item) => item.href);

  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(paths).size, paths.length);
  assert.deepEqual(ids, [
    "home",
    "playground",
    "algorithms",
    "data-structures",
    "compiler",
    "sql-lab",
    "learn",
    "tools",
    "resources",
  ]);
});

test("the existing playground has an explicit platform route", () => {
  const playground = platformNavigation.find((item) => item.id === "playground");
  assert.equal(playground?.href, "/playground");
  assert.match(playground?.description ?? "", /visualize/i);
});

