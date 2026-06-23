/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_EMAIL_CONFIRMATION_REQUIRED?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_CODESIGHT_LOG_LEVEL?: string;
  readonly VITE_CODESIGHT_VERBOSE_LOGS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type SupportedLanguage = "javascript" | "python" | "c" | "cpp" | "java";

interface DesktopFilePayload {
  canceled: boolean;
  filePath?: string;
  name?: string;
  content?: string;
}

interface LocalSnippetRecord {
  id: string;
  title: string;
  language: SupportedLanguage;
  code: string;
  createdAt: string;
  filePath: string;
  source: "local";
}

type MenuAction =
  | "file:new"
  | "file:open"
  | "file:open-recent"
  | "file:save"
  | "file:save-local-snippet"
  | "file:load-local-snippet"
  | "run:execute";

interface MenuActionEvent {
  type: MenuAction;
  filePath?: string;
}

interface RecentFileRecord {
  filePath: string;
  name: string;
  lastOpenedAt: string;
}

interface SystemLogEntry {
  timestamp: string;
  level: "error" | "warn" | "info" | "debug";
  scope: string;
  message: string;
  executionId?: string;
  traceId?: string;
  phase?: "compile" | "run" | "trace" | "system";
  language?: SupportedLanguage;
  command?: string;
  filePath?: string;
  durationMs?: number | null;
  exitCode?: number | null;
  signal?: string | null;
  stdout?: string;
  stderr?: string;
  stack?: string;
  details?: Record<string, string | number | boolean | null>;
}

interface Window {
  electronAPI?: {
    env: {
      isElectron: boolean;
      backendUrl: string;
      nodeEnv: string;
      supabaseUrl?: string;
      supabaseAnonKey?: string;
      supabaseEmailConfirmationRequired?: string;
      siteUrl?: string;
      platform: string;
      version: string;
      logging: {
        level: "error" | "warn" | "info" | "debug";
        verbose: boolean;
      };
    };
    authStorage: {
      getItem: (key: string) => Promise<string | null>;
      setItem: (key: string, value: string) => Promise<void>;
      removeItem: (key: string) => Promise<void>;
    };
    runCode: (payload: {
      code: string;
      language: SupportedLanguage;
      stdin?: string;
    }) => Promise<import("./engine/types").ExecutionTrace>;
    openFile: (filePath?: string | null) => Promise<DesktopFilePayload>;
    saveFile: (payload: {
      filePath: string | null;
      content: string;
      suggestedName: string;
    }) => Promise<DesktopFilePayload>;
    saveSnippetLocally: (payload: {
      title: string;
      language: SupportedLanguage;
      code: string;
    }) => Promise<LocalSnippetRecord>;
    getLocalSnippets: () => Promise<LocalSnippetRecord[]>;
    getRecentFiles: () => Promise<RecentFileRecord[]>;
    getAppVersion: () => Promise<string>;
    getUpdateState: () => Promise<import("./utils/updates").UpdateState | null>;
    checkForUpdates: () => Promise<import("./utils/updates").UpdateState | null>;
    downloadUpdate: () => Promise<import("./utils/updates").UpdateState | null>;
    cancelUpdateDownload: () => Promise<import("./utils/updates").UpdateState | null>;
    quitAndInstallUpdate: () => Promise<void>;
    openLocalSnippet: () => Promise<{
      canceled: boolean;
      filePath?: string;
      snippet?: LocalSnippetRecord;
    }>;
    onSystemLog: (callback: (entry: SystemLogEntry) => void) => () => void;
    onMenuAction: (callback: (action: MenuActionEvent) => void) => () => void;
    onUpdateStateChanged: (
      callback: (state: import("./utils/updates").UpdateState) => void,
    ) => () => void;
  };
}
