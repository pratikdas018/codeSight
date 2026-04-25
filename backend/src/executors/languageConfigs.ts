import type { SupportedLanguage } from "../types/execution";

export interface LanguageExecutionConfig {
  image: string;
  fileName: string;
  command: string;
}

const imageNames = {
  node: process.env.NODE_EXECUTOR_IMAGE ?? "codesight-node-runner",
  python: process.env.PYTHON_EXECUTOR_IMAGE ?? "codesight-python-runner",
  cpp: process.env.CPP_EXECUTOR_IMAGE ?? "codesight-cpp-runner",
  java: process.env.JAVA_EXECUTOR_IMAGE ?? "codesight-java-runner",
};

export const languageExecutionConfigs: Record<
  SupportedLanguage,
  LanguageExecutionConfig
> = {
  javascript: {
    image: imageNames.node,
    fileName: "main.js",
    command: "node /workspace/main.js",
  },
  python: {
    image: imageNames.python,
    fileName: "main.py",
    command: "python3 /opt/codesight/python_trace.py /workspace/main.py",
  },
  c: {
    image: imageNames.cpp,
    fileName: "main.c",
    command:
      "gcc /workspace/main.c -O2 -std=c11 -o /workspace/program && /workspace/program",
  },
  cpp: {
    image: imageNames.cpp,
    fileName: "main.cpp",
    command:
      "g++ /workspace/main.cpp -O2 -std=c++17 -o /workspace/program && /workspace/program",
  },
  java: {
    image: imageNames.java,
    fileName: "Main.java",
    command: "javac /workspace/Main.java && java -cp /workspace Main",
  },
};
