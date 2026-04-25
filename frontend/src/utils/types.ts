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

export interface AuthResponse {
  token: string;
  user: User;
}

export interface CodeSnippet {
  id: string;
  title: string;
  language: SupportedLanguage;
  code: string;
  createdAt: string;
  _count?: {
    executionHistories: number;
  };
}

export interface ExecutionHistoryRecord {
  id: string;
  codeSnippetId: string;
  output?: string | null;
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
