export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export type SupportedLanguage =
  | "javascript"
  | "python"
  | "c"
  | "cpp"
  | "java";

export interface CodeSnippet {
  id: string;
  userId: string;
  title: string;
  language: SupportedLanguage;
  code: string;
  createdAt: string;
  executionCount?: number;
}

export interface ExecutionHistoryRecord {
  id: string;
  userId: string;
  snippetId: string;
  output?: string | null;
  executionTime: number;
  createdAt: string;
  codeSnippet: {
    id: string;
    title: string;
    language: SupportedLanguage;
    code: string;
  };
}

export interface Notice {
  tone: "success" | "error";
  message: string;
}
