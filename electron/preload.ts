import { contextBridge, ipcRenderer } from "electron";

type SupportedLanguage = "javascript" | "python" | "c" | "cpp" | "java";
type DesktopLogLevel = "error" | "warn" | "info" | "debug";

interface MenuActionEvent {
  type:
    | "file:new"
    | "file:open"
    | "file:open-recent"
    | "file:save"
    | "file:save-local-snippet"
    | "file:load-local-snippet"
    | "run:execute";
  filePath?: string;
}

interface SystemLogEntry {
  timestamp: string;
  level: DesktopLogLevel;
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

type UpdateStatus =
  | "unsupported"
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "cancelled"
  | "error";

interface UpdateState {
  currentVersion: string;
  latestVersion: string | null;
  releaseName: string | null;
  releaseDate: string | null;
  releaseNotes: string[];
  status: UpdateStatus;
  message: string;
  progressPercent: number;
  bytesPerSecond: number;
  transferredBytes: number;
  totalBytes: number;
  lastCheckedAt: string | null;
  errorMessage: string | null;
  updateAvailable: boolean;
  updateDownloaded: boolean;
}

const parseLogLevel = (value: string | undefined): DesktopLogLevel | null => {
  switch (value?.trim().toLowerCase()) {
    case "error":
    case "warn":
    case "info":
    case "debug":
      return value.trim().toLowerCase() as DesktopLogLevel;
    default:
      return null;
  }
};

const verboseLoggingEnabled =
  process.env.CODESIGHT_VERBOSE_LOGS?.trim().toLowerCase() === "true";
const preloadLogLevel =
  parseLogLevel(process.env.CODESIGHT_LOG_LEVEL) ??
  parseLogLevel(process.env.LOG_LEVEL) ??
  (verboseLoggingEnabled
    ? "debug"
    : (process.env.NODE_ENV ?? "development") === "production"
      ? "error"
      : "warn");

process.on("uncaughtException", (error) => {
  console.error("[PRELOAD] Uncaught exception", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("[PRELOAD] Unhandled promise rejection", reason);
});

contextBridge.exposeInMainWorld("electronAPI", {
  env: {
    isElectron: true,
    backendUrl:
      process.env.CODESIGHT_BACKEND_URL ?? "http://127.0.0.1:4000",
    nodeEnv: process.env.NODE_ENV ?? "development",
    supabaseUrl: process.env.VITE_SUPABASE_URL,
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY,
    supabaseEmailConfirmationRequired:
      process.env.VITE_SUPABASE_EMAIL_CONFIRMATION_REQUIRED,
    siteUrl: process.env.VITE_SITE_URL,
    platform: process.platform,
    version: process.env.npm_package_version,
    logging: {
      level: preloadLogLevel,
      verbose: verboseLoggingEnabled,
    },
  },
  authStorage: {
    getItem: (key: string) => ipcRenderer.invoke("auth-storage:get", key),
    setItem: (key: string, value: string) =>
      ipcRenderer.invoke("auth-storage:set", { key, value }),
    removeItem: (key: string) => ipcRenderer.invoke("auth-storage:remove", key),
  },
  runCode: (payload: { code: string; language: SupportedLanguage; stdin?: string }) =>
    ipcRenderer.invoke("desktop:run-code", payload),
  openFile: (filePath?: string | null) =>
    ipcRenderer.invoke("desktop:open-file", { filePath }),
  saveFile: (payload: {
    filePath: string | null;
    content: string;
    suggestedName: string;
  }) => ipcRenderer.invoke("desktop:save-file", payload),
  saveSnippetLocally: (payload: {
    title: string;
    language: SupportedLanguage;
    code: string;
  }) => ipcRenderer.invoke("desktop:save-snippet-locally", payload),
  getLocalSnippets: () => ipcRenderer.invoke("desktop:get-local-snippets"),
  openLocalSnippet: () => ipcRenderer.invoke("desktop:open-local-snippet"),
  getRecentFiles: () => ipcRenderer.invoke("desktop:get-recent-files"),
  getAppVersion: () => ipcRenderer.invoke("desktop:get-app-version") as Promise<string>,
  getUpdateState: () => ipcRenderer.invoke("desktop:get-update-state"),
  checkForUpdates: () => ipcRenderer.invoke("desktop:check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("desktop:download-update"),
  cancelUpdateDownload: () => ipcRenderer.invoke("desktop:cancel-update-download"),
  quitAndInstallUpdate: () => ipcRenderer.invoke("desktop:quit-and-install-update"),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.invoke("window:toggle-maximize"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  isWindowMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  onSystemLog: (callback: (entry: SystemLogEntry) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      entry: SystemLogEntry,
    ) => {
      callback(entry);
    };

    ipcRenderer.on("codesight:system-log", handler);

    return () => {
      ipcRenderer.removeListener("codesight:system-log", handler);
    };
  },
  onMenuAction: (callback: (action: MenuActionEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: MenuActionEvent) => {
      callback(action);
    };

    ipcRenderer.on("menu:action", handler);

    return () => {
      ipcRenderer.removeListener("menu:action", handler);
    };
  },
  onUpdateStateChanged: (callback: (state: UpdateState) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      state: UpdateState,
    ) => {
      callback(state);
    };

    ipcRenderer.on("updates:state-changed", handler);

    return () => {
      ipcRenderer.removeListener("updates:state-changed", handler);
    };
  },
});
