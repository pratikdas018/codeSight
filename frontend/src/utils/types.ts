export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  lastSeenAt?: string;
}

export type SupportedLanguage =
  | "javascript"
  | "python"
  | "c"
  | "cpp"
  | "java";

export type ExecutionStatus = "completed" | "error" | "timeout";

export interface Workspace {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  userId: string;
  theme: "system" | "light" | "dark";
  editorFontSize: number;
  autoSave: boolean;
  telemetryEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CodeSnippet {
  id: string;
  userId: string;
  workspaceId?: string;
  title: string;
  language: SupportedLanguage;
  code: string;
  description?: string | null;
  createdAt: string;
  updatedAt?: string;
  lastOpenedAt?: string | null;
  executionCount?: number;
}

export interface ExecutionHistoryRecord {
  id: string;
  userId: string;
  workspaceId?: string | null;
  snippetId: string;
  output?: string | null;
  executionTime: number;
  createdAt: string;
  runtimeStatus: ExecutionStatus;
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
