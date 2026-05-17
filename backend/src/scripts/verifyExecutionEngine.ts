import { executeCodeDirect } from "../services/executeService";
import type { SupportedLanguage } from "../types/execution";

interface VerificationCase {
  name: string;
  language: SupportedLanguage;
  code: string;
  stdin?: string;
  expectedOutput: string;
}

const verificationCases: VerificationCase[] = [
  {
    name: "javascript recursion with stdin",
    language: "javascript",
    stdin: "6\n",
    expectedOutput: "720",
    code: `const fs = require("fs");
const input = fs.readFileSync(0, "utf8").trim();
const n = Number(input);
function fact(value) {
  if (value <= 1) return 1;
  return value * fact(value - 1);
}
console.log(fact(n));`,
  },
  {
    name: "c arrays and pointers",
    language: "c",
    stdin: "5\n1 2 3 4 5\n",
    expectedOutput: "15",
    code: `#include <stdio.h>

int sum(int *values, int n) {
    int total = 0;
    for (int i = 0; i < n; i++) {
        total += values[i];
    }
    return total;
}

int main(void) {
    int n;
    scanf("%d", &n);
    int values[32];
    for (int i = 0; i < n; i++) {
        scanf("%d", &values[i]);
    }
    printf("%d\\n", sum(values, n));
    return 0;
}`,
  },
  {
    name: "cpp bfs with stl",
    language: "cpp",
    expectedOutput: "0 1 1 2 3",
    code: `#include <bits/stdc++.h>
using namespace std;

int main() {
    vector<vector<int>> graph = {
        {1, 2},
        {0, 3},
        {0, 3},
        {1, 2, 4},
        {3}
    };
    vector<int> dist(graph.size(), -1);
    queue<int> q;
    dist[0] = 0;
    q.push(0);

    while (!q.empty()) {
        int node = q.front();
        q.pop();
        for (int next : graph[node]) {
            if (dist[next] == -1) {
                dist[next] = dist[node] + 1;
                q.push(next);
            }
        }
    }

    for (size_t i = 0; i < dist.size(); i++) {
        if (i) cout << " ";
        cout << dist[i];
    }
    cout << "\\n";
    return 0;
}`,
  },
  {
    name: "java scanner with class autodetect",
    language: "java",
    stdin: "5\n",
    expectedOutput: "120",
    code: `import java.util.Scanner;

public class FactorialRunner {
    private static long factorial(int n) {
        if (n <= 1) {
            return 1;
        }
        return n * factorial(n - 1);
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n = scanner.nextInt();
        System.out.println(factorial(n));
    }
}`,
  },
  {
    name: "python recursion with stdin",
    language: "python",
    stdin: "7\n",
    expectedOutput: "13",
    code: `def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

n = int(input().strip())
print(fib(n))`,
  },
];

const normalizeOutput = (value: string) =>
  value.replace(/\r\n/g, "\n").trim();

const run = async () => {
  let failures = 0;

  for (const testCase of verificationCases) {
    const trace = await executeCodeDirect(
      testCase.code,
      testCase.language,
      testCase.stdin ?? "",
    );

    const normalizedOutput = normalizeOutput(trace.output);
    const expectedOutput = normalizeOutput(testCase.expectedOutput);

    if (trace.status === "runtime_missing") {
      console.log(
        `[SKIP] ${testCase.language} ${testCase.name}: ${trace.diagnostics[0]?.summary ?? trace.error}`,
      );
      continue;
    }

    if (trace.status !== "completed" || normalizedOutput !== expectedOutput) {
      failures += 1;
      console.error(`[FAIL] ${testCase.language} ${testCase.name}`);
      console.error(`  status: ${trace.status}`);
      console.error(`  mode: ${trace.mode.selected}/${trace.mode.traceStrategy}`);
      console.error(`  expected: ${expectedOutput}`);
      console.error(`  actual: ${normalizedOutput || "<empty>"}`);
      if (trace.error) {
        console.error(`  error: ${trace.error}`);
      }
      continue;
    }

    if (trace.traceFrames.length === 0) {
      failures += 1;
      console.error(`[FAIL] ${testCase.language} ${testCase.name}`);
      console.error("  trace frames: none generated");
      console.error(`  trace summary: ${trace.traceSummary.message}`);
      continue;
    }

    console.log(
      `[PASS] ${testCase.language} ${testCase.name} (${trace.executionTime}ms, mode=${trace.mode.selected}/${trace.mode.traceStrategy}, frames=${trace.traceFrames.length}, quality=${trace.traceSummary.quality})`,
    );
  }

  if (failures > 0) {
    process.exitCode = 1;
    return;
  }

  console.log("Verification completed without engine regressions.");
};

void run();
