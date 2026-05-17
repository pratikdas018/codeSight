import path from "node:path";

export interface CommandCandidate {
  command: string;
  args?: string[];
}

export interface RuntimeCheckDefinition {
  id: "nodejs" | "python" | "java" | "gcc" | "gpp";
  label: string;
  guidance: string;
  checks: Array<{
    key: "node" | "python" | "java" | "javac" | "gcc" | "g++";
    label: string;
    versionArgs: string[];
    candidates: CommandCandidate[];
  }>;
}

const buildConfiguredCandidates = (value?: string | null): CommandCandidate[] => {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return [];
  }

  const [command, ...args] = normalizedValue.split(/\s+/);
  return [{ command, args }];
};

const getJavaHomeBinCandidate = (binaryName: "java" | "javac") => {
  const javaHome = process.env.JAVA_HOME?.trim();

  if (!javaHome) {
    return [];
  }

  const executable =
    process.platform === "win32"
      ? path.join(javaHome, "bin", `${binaryName}.exe`)
      : path.join(javaHome, "bin", binaryName);

  return [{ command: executable }];
};

export const getNodeCandidates = (): CommandCandidate[] => [
  ...buildConfiguredCandidates(process.env.NODE_EXECUTABLE),
  { command: "node" },
];

export const getPythonCandidates = (): CommandCandidate[] => [
  ...buildConfiguredCandidates(process.env.PYTHON_EXECUTABLE),
  { command: "python" },
  { command: "python3" },
];

export const getGccCandidates = (): CommandCandidate[] => [
  ...buildConfiguredCandidates(process.env.GCC_EXECUTABLE),
  { command: "gcc" },
];

export const getGppCandidates = (): CommandCandidate[] => [
  ...buildConfiguredCandidates(process.env.GPP_EXECUTABLE),
  { command: "g++" },
];

export const getJavacCandidates = (): CommandCandidate[] => [
  ...buildConfiguredCandidates(process.env.JAVAC_EXECUTABLE),
  ...getJavaHomeBinCandidate("javac"),
  { command: "javac" },
];

export const getJavaCandidates = (): CommandCandidate[] => [
  ...buildConfiguredCandidates(process.env.JAVA_EXECUTABLE),
  ...getJavaHomeBinCandidate("java"),
  { command: "java" },
];

export const runtimeCheckDefinitions: RuntimeCheckDefinition[] = [
  {
    id: "nodejs",
    label: "Node.js",
    guidance:
      "Install Node.js and make sure `node --version` works in your terminal.",
    checks: [
      {
        key: "node",
        label: "node",
        versionArgs: ["--version"],
        candidates: getNodeCandidates(),
      },
    ],
  },
  {
    id: "python",
    label: "Python",
    guidance:
      "Install Python 3 and make sure `python --version` or `python3 --version` works in your terminal.",
    checks: [
      {
        key: "python",
        label: "python",
        versionArgs: ["--version"],
        candidates: getPythonCandidates(),
      },
    ],
  },
  {
    id: "java",
    label: "Java",
    guidance:
      "Install a JDK and make sure both `java -version` and `javac -version` work in your terminal.",
    checks: [
      {
        key: "java",
        label: "java",
        versionArgs: ["-version"],
        candidates: getJavaCandidates(),
      },
      {
        key: "javac",
        label: "javac",
        versionArgs: ["-version"],
        candidates: getJavacCandidates(),
      },
    ],
  },
  {
    id: "gcc",
    label: "GCC",
    guidance:
      "Install GCC and make sure `gcc --version` works in your terminal.",
    checks: [
      {
        key: "gcc",
        label: "gcc",
        versionArgs: ["--version"],
        candidates: getGccCandidates(),
      },
    ],
  },
  {
    id: "gpp",
    label: "G++",
    guidance:
      "Install G++ and make sure `g++ --version` works in your terminal.",
    checks: [
      {
        key: "g++",
        label: "g++",
        versionArgs: ["--version"],
        candidates: getGppCandidates(),
      },
    ],
  },
];
