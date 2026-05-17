import {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  safeStorage,
  shell,
} from "electron";
import type {
  MenuItemConstructorOptions,
  MessageBoxOptions,
  OpenDialogOptions,
  SaveDialogOptions,
} from "electron";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

type SupportedLanguage = "javascript" | "python" | "c" | "cpp" | "java";

interface DesktopFilePayload {
  filePath?: string | null;
  content: string;
  suggestedName: string;
}

interface DesktopRunPayload {
  code: string;
  language: SupportedLanguage;
  stdin?: string;
}

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

interface RecentFileRecord {
  filePath: string;
  name: string;
  lastOpenedAt: string;
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

interface PersistedAuthValue {
  mode: "safeStorage" | "plain";
  value: string;
}

type SystemLogLevel = "error" | "warn" | "info" | "debug";

interface SystemLogEntry {
  timestamp: string;
  level: SystemLogLevel;
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

const shouldUseDevServer =
  !app.isPackaged && Boolean(process.env.ELECTRON_RENDERER_URL?.trim());
const devRendererUrl =
  process.env.ELECTRON_RENDERER_URL ?? "http://127.0.0.1:5180";
const devBackendUrl =
  process.env.CODESIGHT_BACKEND_URL ?? "http://127.0.0.1:4000";
const shouldAutoOpenDevTools =
  shouldUseDevServer || process.env.CODESIGHT_OPEN_DEVTOOLS === "true";
const productionBackendPort = Number(
  process.env.CODESIGHT_DESKTOP_BACKEND_PORT ?? 4010,
);
const logLevelPriority: Record<SystemLogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};
const parseSystemLogLevel = (value: string | undefined): SystemLogLevel | null => {
  switch (value?.trim().toLowerCase()) {
    case "error":
    case "warn":
    case "info":
    case "debug":
      return value.trim().toLowerCase() as SystemLogLevel;
    default:
      return null;
  }
};
const verboseDesktopLogging =
  process.env.CODESIGHT_VERBOSE_LOGS?.trim().toLowerCase() === "true";
const desktopLogLevel =
  parseSystemLogLevel(process.env.CODESIGHT_LOG_LEVEL) ??
  parseSystemLogLevel(process.env.LOG_LEVEL) ??
  (verboseDesktopLogging ? "debug" : app.isPackaged ? "error" : "warn");
const shouldForwardRendererConsole =
  process.env.CODESIGHT_FORWARD_RENDERER_CONSOLE?.trim().toLowerCase() === "true";

const snippetDirectoryName = "local-snippets";
const recentFilesStoreName = "recent-files.json";
const maxRecentFiles = 8;
const codeFilters = [
  {
    name: "Code Files",
    extensions: [
      "js",
      "ts",
      "jsx",
      "tsx",
      "py",
      "c",
      "cpp",
      "cc",
      "cxx",
      "java",
      "json",
      "txt",
    ],
  },
  { name: "All Files", extensions: ["*"] },
];

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let backendServer: { close: (callback: () => void) => void } | null = null;
let hasRevealedMainWindow = false;
const systemLogBacklog: SystemLogEntry[] = [];
const maxSystemLogBacklog = 200;
const shouldEmitDesktopLog = (level: SystemLogLevel) =>
  logLevelPriority[level] <= logLevelPriority[desktopLogLevel];

const getDesktopLogFilePath = () => {
  const baseDirectory = app.isReady()
    ? path.join(app.getPath("userData"), "logs")
    : path.join(os.tmpdir(), "CodeSight");

  mkdirSync(baseDirectory, { recursive: true });
  return path.join(baseDirectory, "desktop-startup.log");
};

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ""}`.trim();
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const normalizeDetailValue = (
  value: unknown,
): string | number | boolean | null => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "undefined") {
    return null;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const buildSystemLogEntry = (
  level: SystemLogLevel,
  scope: string,
  message: string,
  details?: Record<string, unknown>,
  error?: unknown,
): SystemLogEntry => {
  const serializedError = error ? serializeError(error) : "";

  return {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    ...(serializedError ? { stack: serializedError } : {}),
    ...(details
      ? {
          details: Object.fromEntries(
            Object.entries(details).map(([key, value]) => [
              key,
              normalizeDetailValue(value),
            ]),
          ),
        }
      : {}),
  };
};

const emitRendererSystemLog = (entry: SystemLogEntry) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("codesight:system-log", entry);
    return;
  }

  systemLogBacklog.push(entry);
  if (systemLogBacklog.length > maxSystemLogBacklog) {
    systemLogBacklog.splice(0, systemLogBacklog.length - maxSystemLogBacklog);
  }
};

const flushRendererSystemLogs = () => {
  if (!mainWindow || mainWindow.isDestroyed() || systemLogBacklog.length === 0) {
    return;
  }

  for (const entry of systemLogBacklog.splice(0, systemLogBacklog.length)) {
    mainWindow.webContents.send("codesight:system-log", entry);
  }
};

const writeSystemLog = (
  level: SystemLogLevel,
  scope: string,
  message: string,
  details?: Record<string, unknown>,
  error?: unknown,
) => {
  const entry = buildSystemLogEntry(level, scope, message, details, error);
  const lines = [
    `[${entry.timestamp}] [${entry.scope}] [${entry.level}] ${entry.message}`,
    entry.details ? JSON.stringify(entry.details) : "",
    entry.stack ?? "",
  ].filter(Boolean);

  if (level === "error") {
    if (shouldEmitDesktopLog(level)) {
      console.error(`[${scope}] ${message}`, details ?? {}, error ?? "");
    }
  } else if (level === "warn") {
    if (shouldEmitDesktopLog(level)) {
      console.warn(`[${scope}] ${message}`, details ?? {}, error ?? "");
    }
  } else if (level === "debug") {
    if (shouldEmitDesktopLog(level)) {
      console.debug(`[${scope}] ${message}`, details ?? {}, error ?? "");
    }
  } else if (shouldEmitDesktopLog(level)) {
    console.info(`[${scope}] ${message}`, details ?? {}, error ?? "");
  }

  try {
    appendFileSync(getDesktopLogFilePath(), `${lines.join("\n")}\n`, "utf8");
  } catch {
    return;
  } finally {
    if (shouldEmitDesktopLog(level)) {
      emitRendererSystemLog(entry);
    }
  }
};

const logDesktopMessage = (message: string, error?: unknown) => {
  writeSystemLog("info", "ELECTRON_MAIN", message, undefined, error);
};

const sleep = (durationMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });

const getCompiledAppRoot = () => path.resolve(__dirname, "..", "..");
const getIconPath = () => path.join(__dirname, "..", "assets", "icon.png");
const getSplashPath = () => path.join(__dirname, "..", "splash.html");
const getPreloadPath = () => path.join(__dirname, "preload.js");
const getFrontendEntry = () =>
  path.join(getCompiledAppRoot(), "frontend", "dist", "index.html");
const getBackendAppPath = (...segments: string[]) =>
  path.join(getCompiledAppRoot(), "backend", ...segments);
const getSnippetDirectory = () =>
  path.join(app.getPath("userData"), snippetDirectoryName);
const getRecentFilesStorePath = () =>
  path.join(app.getPath("userData"), recentFilesStoreName);
const getAuthStorageStorePath = () =>
  path.join(app.getPath("userData"), "auth-storage.json");
const getBackendUrl = () =>
  shouldUseDevServer
    ? devBackendUrl
    : `http://127.0.0.1:${productionBackendPort}`;
const getSessionDataPath = () =>
  path.join(
    process.env.LOCALAPPDATA ?? os.tmpdir(),
    "CodeSight",
    "SessionData",
  );

mkdirSync(getSessionDataPath(), { recursive: true });
app.setPath("sessionData", getSessionDataPath());

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

const validateDesktopBundle = () => {
  if (shouldUseDevServer) {
    return;
  }

  const requiredFiles = [
    { label: "frontend entry", filePath: getFrontendEntry() },
    { label: "preload script", filePath: getPreloadPath() },
    { label: "embedded backend", filePath: getBackendAppPath("dist", "app.js") },
    { label: "window icon", filePath: getIconPath() },
    { label: "splash screen", filePath: getSplashPath() },
  ];

  logDesktopMessage(
    `Validating desktop bundle with __dirname=${__dirname}, appPath=${app.getAppPath()}, resourcesPath=${process.resourcesPath}.`,
  );

  for (const requiredFile of requiredFiles) {
    const exists = existsSync(requiredFile.filePath);
    logDesktopMessage(
      `Checked ${requiredFile.label}: ${requiredFile.filePath} (${exists ? "found" : "missing"}).`,
    );

    if (!exists) {
      throw new Error(
        `Missing packaged ${requiredFile.label} at ${requiredFile.filePath}.`,
      );
    }
  }
};

const buildDesktopEnvironment = () => {
  return {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(productionBackendPort),
    EXECUTOR_MODE: "local",
    EXECUTION_PROVIDER: "local",
    CODESIGHT_BACKEND_URL: `http://127.0.0.1:${productionBackendPort}`,
    REMOTE_EXECUTOR_URL:
      process.env.REMOTE_EXECUTOR_URL ??
      process.env.CODESIGHT_DESKTOP_REMOTE_EXECUTOR_URL,
    EXECUTOR_SHARED_SECRET:
      process.env.EXECUTOR_SHARED_SECRET ??
      process.env.CODESIGHT_DESKTOP_EXECUTOR_SHARED_SECRET,
  };
};

const normalizeWindowTitle = (fileName?: string | null) =>
  fileName ? `${fileName} - CodeSight` : "CodeSight";

const sendMenuAction = (action: MenuActionEvent) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("menu:action", action);
};

const setWindowTitle = (fileName?: string | null) => {
  mainWindow?.setTitle(normalizeWindowTitle(fileName));
};

const handleIpc = <T>(
  channel: string,
  handler: (
    event: Electron.IpcMainInvokeEvent,
    payload?: unknown,
  ) => Promise<T> | T,
) => {
  ipcMain.handle(channel, async (event, payload) => {
    try {
      return await handler(event, payload);
    } catch (error) {
      writeSystemLog(
        "error",
        "IPC",
        `IPC handler failed for ${channel}.`,
        {
          channel,
        },
        error,
      );
      throw error;
    }
  });
};

const readAuthStorageStore = async () => {
  const storePath = getAuthStorageStorePath();

  try {
    const raw = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, PersistedAuthValue>;

    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return {};
    }

    writeSystemLog(
      "error",
      "AUTH_STORAGE",
      "Unable to read auth storage store.",
      undefined,
      error,
    );
    return {};
  }
};

const writeAuthStorageStore = async (
  store: Record<string, PersistedAuthValue>,
) => {
  const storePath = getAuthStorageStorePath();
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
};

const encryptPersistedAuthValue = (value: string): PersistedAuthValue => {
  if (safeStorage.isEncryptionAvailable()) {
    return {
      mode: "safeStorage",
      value: safeStorage.encryptString(value).toString("base64"),
    };
  }

  return {
    mode: "plain",
    value,
  };
};

const decryptPersistedAuthValue = (entry: PersistedAuthValue | undefined) => {
  if (!entry) {
    return null;
  }

  if (entry.mode === "safeStorage") {
    return safeStorage.decryptString(Buffer.from(entry.value, "base64"));
  }

  return entry.value;
};

const ensureSnippetDirectory = async () => {
  const directory = getSnippetDirectory();
  await fs.mkdir(directory, { recursive: true });
  return directory;
};

const ensureRecentFileStore = async () => {
  const storePath = getRecentFilesStorePath();

  try {
    await fs.access(storePath);
  } catch {
    await fs.writeFile(storePath, "[]", "utf8");
  }

  return storePath;
};

const readRecentFiles = async (): Promise<RecentFileRecord[]> => {
  const storePath = await ensureRecentFileStore();

  try {
    const raw = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as RecentFileRecord[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    const existingEntries = await Promise.all(
      parsed.map(async (entry) => {
        try {
          await fs.access(entry.filePath);
          return entry;
        } catch {
          return null;
        }
      }),
    );

    return existingEntries.filter((entry): entry is RecentFileRecord => entry !== null);
  } catch {
    return [];
  }
};

const writeRecentFiles = async (entries: RecentFileRecord[]) => {
  const storePath = await ensureRecentFileStore();
  await fs.writeFile(storePath, JSON.stringify(entries, null, 2), "utf8");
};

const updateRecentFiles = async (filePath: string) => {
  const nextEntry: RecentFileRecord = {
    filePath,
    name: path.basename(filePath),
    lastOpenedAt: new Date().toISOString(),
  };
  const existingEntries = await readRecentFiles();
  const dedupedEntries = existingEntries.filter(
    (entry) => entry.filePath !== filePath,
  );
  const nextEntries = [nextEntry, ...dedupedEntries].slice(0, maxRecentFiles);

  await writeRecentFiles(nextEntries);
  if (process.platform === "win32" || process.platform === "darwin") {
    app.addRecentDocument(filePath);
  }
  await buildMenu();
};

const loadFileFromPath = async (filePath: string) => {
  const content = await fs.readFile(filePath, "utf8");
  const name = path.basename(filePath);

  await updateRecentFiles(filePath);
  setWindowTitle(name);

  return {
    canceled: false,
    filePath,
    name,
    content,
  };
};

const invokeBackend = async <T>(pathname: string, payload?: unknown) => {
  try {
    const response = await fetch(`${getBackendUrl()}${pathname}`, {
      method: payload ? "POST" : "GET",
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });

    const data = (await response.json().catch(() => ({}))) as T & {
      message?: string;
    };

    if (!response.ok) {
      throw new Error(data.message ?? `Backend request failed for ${pathname}.`);
    }

    return data;
  } catch (error) {
    writeSystemLog(
      "error",
      "BACKEND_BRIDGE",
      `Backend invocation failed for ${pathname}.`,
      {
        pathname,
        backendUrl: getBackendUrl(),
        hasPayload: Boolean(payload),
      },
      error,
    );
    throw error;
  }
};

const showAboutDialog = async () => {
  const options: MessageBoxOptions = {
    type: "info",
    title: "About CodeSight",
    message: `CodeSight ${app.getVersion()}`,
    detail:
      "Desktop code tracing workspace built with Electron, React, Monaco, and a local execution backend.",
    buttons: ["OK"],
  };

  if (mainWindow) {
    await dialog.showMessageBox(mainWindow, options);
    return;
  }

  await dialog.showMessageBox(options);
};

const startEmbeddedBackend = async () => {
  if (shouldUseDevServer || backendServer) {
    return;
  }

  Object.assign(process.env, buildDesktopEnvironment());
  delete process.env.FRONTEND_URL;

  try {
    logDesktopMessage("Starting embedded backend.");

    const backendAppModule = require(getBackendAppPath("dist", "app.js")) as {
      default?: {
        listen: (
          port: number,
          host: string,
          callback: () => void,
        ) => { close: (callback: () => void) => void; on: (event: string, cb: (error: Error) => void) => void };
      };
    };
    const backendApp = backendAppModule.default;

    if (!backendApp) {
      throw new Error("Unable to bootstrap the embedded backend.");
    }

    await new Promise<void>((resolve, reject) => {
      const server = backendApp.listen(
        productionBackendPort,
        "127.0.0.1",
        resolve,
      );

      server.on("error", reject);
      backendServer = server;
    });

    logDesktopMessage(
      `Embedded backend is listening on http://127.0.0.1:${productionBackendPort}.`,
    );
  } catch (error) {
    writeSystemLog(
      "error",
      "EMBEDDED_BACKEND",
      "Embedded backend failed to start.",
      undefined,
      error,
    );
    throw error;
  }
};

const stopEmbeddedBackend = async () => {
  if (backendServer) {
    await new Promise<void>((resolve) => {
      backendServer?.close(resolve);
    });
    backendServer = null;
  }
};

const createSplashWindow = () => {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    transparent: true,
    resizable: true,
    maximizable: true,
    minimizable: true,
    show: false,
    alwaysOnTop: true,
    icon: getIconPath(),
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  void splashWindow.loadFile(getSplashPath());
  splashWindow.once("ready-to-show", () => {
    splashWindow?.show();
  });
};

const loadRendererWithRetry = async (
  targetWindow: BrowserWindow,
  targetUrl: string,
) => {
  const maxAttempts = shouldUseDevServer ? 5 : 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      if (attempt > 1) {
        logDesktopMessage(
          `Retrying renderer load (${attempt}/${maxAttempts}) for ${targetUrl}.`,
        );
      }

      await targetWindow.loadURL(targetUrl);
      return;
    } catch (error) {
      lastError = error;
      writeSystemLog(
        "warn",
        "RENDERER",
        `Renderer load attempt ${attempt} failed for ${targetUrl}.`,
        {
          attempt,
          maxAttempts,
          targetUrl,
        },
        error,
      );

      if (attempt < maxAttempts) {
        await sleep(700);
      }
    }
  }

  throw lastError;
};

const createMainWindow = async () => {
  process.env.CODESIGHT_BACKEND_URL = getBackendUrl();
  const frontendEntry = getFrontendEntry();
  hasRevealedMainWindow = false;

  mainWindow = new BrowserWindow({
    width: 1540,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    backgroundColor: "#0b0e14",
    title: "CodeSight",
    icon: getIconPath(),
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: true,
      spellcheck: false,
    },
  });

  mainWindow.webContents.on("did-start-loading", () => {
    logDesktopMessage("Renderer started loading.");
  });

  mainWindow.webContents.on("did-finish-load", () => {
    logDesktopMessage(
      `Renderer finished loading ${mainWindow?.webContents.getURL() ?? frontendEntry}.`,
    );
    flushRendererSystemLogs();

    // `ready-to-show` can be flaky with dev-server loads and heavy renderer startup.
    // Reveal the main window once the document has finished loading as a fallback.
    setTimeout(() => {
      if (!hasRevealedMainWindow) {
        logDesktopMessage("Revealing main window using did-finish-load fallback.");
        revealMainWindow();
      }
    }, 150);
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      writeSystemLog(
        "error",
        "RENDERER",
        `Renderer failed to load ${validatedURL} (${errorCode}: ${errorDescription}).`,
        {
          errorCode,
          errorDescription,
          validatedURL,
        },
      );
    },
  );

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    logDesktopMessage(
      `Renderer process exited (${details.reason}, exitCode=${details.exitCode}).`,
    );
  });

  mainWindow.webContents.on("unresponsive", () => {
    logDesktopMessage("Renderer became unresponsive.");
  });

  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    writeSystemLog(
      "error",
      "PRELOAD",
      `Preload script failed: ${preloadPath}.`,
      {
        preloadPath,
      },
      error,
    );
  });

  mainWindow.webContents.on("console-message", (details) => {
    if (!shouldForwardRendererConsole) {
      return;
    }

    const { level, message, lineNumber, sourceId } = details;
    writeSystemLog(
      level === "error" ? "error" : level === "warning" ? "warn" : "debug",
      "RENDERER_CONSOLE",
      `Renderer console ${sourceId}:${lineNumber}`,
      {
        consoleLevel: level,
        sourceId,
        lineNumber,
        message,
      },
    );
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event: Electron.Event, url: string) => {
    const allowedPrefix = shouldUseDevServer ? devRendererUrl : "file://";

    if (!url.startsWith(allowedPrefix)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  if (shouldUseDevServer) {
    await loadRendererWithRetry(mainWindow, devRendererUrl);
  } else {
    logDesktopMessage(`Loading packaged frontend from ${frontendEntry}.`);
    await loadRendererWithRetry(
      mainWindow,
      pathToFileURL(frontendEntry).toString(),
    );
  }

  mainWindow.once("ready-to-show", () => {
    logDesktopMessage("Revealing main window using ready-to-show.");
    revealMainWindow();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

const revealMainWindow = () => {
  if (!mainWindow || mainWindow.isDestroyed() || hasRevealedMainWindow) {
    return;
  }

  hasRevealedMainWindow = true;
  mainWindow.show();
  mainWindow.focus();

  if (shouldAutoOpenDevTools) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
};

const focusExistingWindow = () => {
  const targetWindow = mainWindow ?? splashWindow;

  if (!targetWindow || targetWindow.isDestroyed()) {
    return;
  }

  if (targetWindow.isMinimized()) {
    targetWindow.restore();
  }

  targetWindow.show();
  targetWindow.focus();
};

const buildMenu = async () => {
  const recentFiles = await readRecentFiles();
  const recentFileItems: MenuItemConstructorOptions[] =
    recentFiles.length > 0
      ? recentFiles.map((entry) => ({
          label: entry.name,
          sublabel: entry.filePath,
          click: () =>
            sendMenuAction({
              type: "file:open-recent",
              filePath: entry.filePath,
            }),
        }))
      : [{ label: "No Recent Files", enabled: false }];

  const fileMenu: MenuItemConstructorOptions = {
    label: "File",
    submenu: [
      {
        label: "New File",
        accelerator: "CmdOrCtrl+N",
        click: () => sendMenuAction({ type: "file:new" }),
      },
      {
        label: "Open File",
        accelerator: "CmdOrCtrl+O",
        click: () => sendMenuAction({ type: "file:open" }),
      },
      {
        label: "Open Recent",
        submenu: recentFileItems,
      },
      {
        label: "Save",
        accelerator: "CmdOrCtrl+S",
        click: () => sendMenuAction({ type: "file:save" }),
      },
      {
        label: "Save Snippet Locally",
        accelerator: "CmdOrCtrl+Shift+S",
        click: () => sendMenuAction({ type: "file:save-local-snippet" }),
      },
      {
        label: "Load Local Snippet",
        accelerator: "CmdOrCtrl+Shift+O",
        click: () => sendMenuAction({ type: "file:load-local-snippet" }),
      },
      { type: "separator" },
      process.platform === "darwin" ? { role: "close" } : { role: "quit", label: "Exit" },
    ],
  };

  const runMenu: MenuItemConstructorOptions = {
    label: "Run",
    submenu: [
      {
        label: "Run Code",
        accelerator: "F5",
        click: () => sendMenuAction({ type: "run:execute" }),
      },
    ],
  };

  const viewSubmenu: MenuItemConstructorOptions[] = [
    {
      label: "Toggle DevTools",
      accelerator:
        process.platform === "darwin" ? "Alt+Command+I" : "Ctrl+Shift+I",
      click: () => {
        mainWindow?.webContents.toggleDevTools();
      },
    },
    { role: "zoomIn", label: "Zoom In" },
    { role: "zoomOut", label: "Zoom Out" },
    { role: "resetZoom", label: "Reset Zoom" },
    { role: "togglefullscreen", label: "Toggle Full Screen" },
  ];

  if (shouldUseDevServer) {
    viewSubmenu.splice(1, 0, { type: "separator" }, { role: "reload" });
  }

  const helpMenu: MenuItemConstructorOptions = {
    label: "Help",
    submenu: [
      {
        label: "About",
        click: () => {
          void showAboutDialog();
        },
      },
    ],
  };

  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    fileMenu,
    runMenu,
    {
      label: "View",
      submenu: viewSubmenu,
    },
    helpMenu,
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

handleIpc("desktop:run-code", async (_event, payload) =>
  invokeBackend("/execute", payload as DesktopRunPayload),
);

handleIpc(
  "desktop:open-file",
  async (_event, payload) => {
    const request = payload as { filePath?: string | null } | undefined;
    if (request?.filePath) {
      return loadFileFromPath(request.filePath);
    }

    const options: OpenDialogOptions = {
      title: "Open Code File",
      properties: ["openFile"],
      filters: codeFilters,
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    return loadFileFromPath(result.filePaths[0]);
  },
);

handleIpc("desktop:save-file", async (_event, rawPayload) => {
  const payload = rawPayload as DesktopFilePayload;
  let targetPath = payload.filePath ?? null;

  if (!targetPath) {
    const options: SaveDialogOptions = {
      title: "Save File",
      defaultPath: payload.suggestedName,
      filters: codeFilters,
    };
    const saveResult = mainWindow
      ? await dialog.showSaveDialog(mainWindow, options)
      : await dialog.showSaveDialog(options);

    if (saveResult.canceled || !saveResult.filePath) {
      return { canceled: true };
    }

    targetPath = saveResult.filePath;
  }

  await fs.writeFile(targetPath, payload.content, "utf8");
  await updateRecentFiles(targetPath);
  setWindowTitle(path.basename(targetPath));

  return {
    canceled: false,
    filePath: targetPath,
    name: path.basename(targetPath),
  };
});

handleIpc(
  "desktop:save-snippet-locally",
  async (
    _event,
    rawPayload,
  ): Promise<LocalSnippetRecord> => {
    const payload = rawPayload as {
      title: string;
      language: SupportedLanguage;
      code: string;
    };
    const directory = await ensureSnippetDirectory();
    const safeTitle = path
      .basename(
        `${payload.title || "snippet"}-${new Date().toISOString().replace(/[:.]/g, "-")}`,
      )
      .replace(/[<>:"/\\|?*]+/g, "-")
      .replace(/\s+/g, "-")
      .toLowerCase();
    const filePath = path.join(directory, `${safeTitle}.codesight.json`);
    const snippetPayload = {
      id: safeTitle,
      title: payload.title || "Untitled snippet",
      language: payload.language,
      code: payload.code,
      createdAt: new Date().toISOString(),
      source: "local" as const,
      filePath,
    };

    await fs.writeFile(filePath, JSON.stringify(snippetPayload, null, 2), "utf8");

    return snippetPayload;
  },
);

handleIpc(
  "desktop:get-local-snippets",
  async (): Promise<LocalSnippetRecord[]> => {
    const directory = await ensureSnippetDirectory();
    const files = await fs.readdir(directory);
    const snippets = await Promise.all(
      files
        .filter((fileName) => fileName.endsWith(".codesight.json"))
        .map(async (fileName) => {
          const filePath = path.join(directory, fileName);
          const raw = await fs.readFile(filePath, "utf8");
          const parsed = JSON.parse(raw) as Partial<LocalSnippetRecord>;

          return {
            id: parsed.id ?? fileName,
            title: parsed.title ?? fileName.replace(".codesight.json", ""),
            language: parsed.language ?? "javascript",
            code: parsed.code ?? "",
            createdAt: parsed.createdAt ?? new Date().toISOString(),
            filePath,
            source: "local" as const,
          };
        }),
    );

    return snippets.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  },
);

handleIpc("desktop:open-local-snippet", async () => {
  const options: OpenDialogOptions = {
    title: "Open Local CodeSight Snippet",
    properties: ["openFile"],
    filters: [
      { name: "CodeSight Snippets", extensions: ["json"] },
      { name: "All Files", extensions: ["*"] },
    ],
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<LocalSnippetRecord>;

  return {
    canceled: false,
    filePath,
    snippet: {
      id: parsed.id ?? path.basename(filePath),
      title: parsed.title ?? path.basename(filePath, path.extname(filePath)),
      language: parsed.language ?? "javascript",
      code: parsed.code ?? "",
      createdAt: parsed.createdAt ?? new Date().toISOString(),
      filePath,
      source: "local" as const,
    },
  };
});

handleIpc("desktop:get-recent-files", async () => readRecentFiles());

handleIpc("auth-storage:get", async (_event, rawKey) => {
  const key = rawKey as string;
  const store = await readAuthStorageStore();

  try {
    return decryptPersistedAuthValue(store[key]);
  } catch (error) {
    writeSystemLog(
      "error",
      "AUTH_STORAGE",
      `Unable to decrypt auth storage key "${key}".`,
      {
        key,
      },
      error,
    );
    delete store[key];
    await writeAuthStorageStore(store);
    return null;
  }
});

handleIpc(
  "auth-storage:set",
  async (_event, rawPayload) => {
    const payload = rawPayload as { key: string; value: string };
    const store = await readAuthStorageStore();
    store[payload.key] = encryptPersistedAuthValue(payload.value);
    await writeAuthStorageStore(store);
  },
);

handleIpc("auth-storage:remove", async (_event, rawKey) => {
  const key = rawKey as string;
  const store = await readAuthStorageStore();

  if (key in store) {
    delete store[key];
    await writeAuthStorageStore(store);
  }
});

const getSenderWindow = (event: Electron.IpcMainInvokeEvent) =>
  BrowserWindow.fromWebContents(event.sender);

handleIpc("window:minimize", async (event) => {
  getSenderWindow(event)?.minimize();
});

handleIpc("window:toggle-maximize", async (event) => {
  const senderWindow = getSenderWindow(event);

  if (!senderWindow) {
    return false;
  }

  if (senderWindow.isMaximized()) {
    senderWindow.unmaximize();
    return false;
  }

  senderWindow.maximize();
  return true;
});

handleIpc("window:is-maximized", async (event) =>
  getSenderWindow(event)?.isMaximized() ?? false,
);

handleIpc("window:close", async (event) => {
  getSenderWindow(event)?.close();
});

app.on("second-instance", () => {
  logDesktopMessage("Second instance requested. Focusing the existing window.");
  focusExistingWindow();
});

app.whenReady().then(async () => {
  try {
    logDesktopMessage("CodeSight desktop startup initiated.");
    app.setAppUserModelId("com.codesight.desktop");
    validateDesktopBundle();
    await startEmbeddedBackend();
    await buildMenu();
    createSplashWindow();
    await createMainWindow();
    logDesktopMessage("Main window created successfully.");

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createMainWindow();
        return;
      }

      focusExistingWindow();
    });
  } catch (error) {
    writeSystemLog(
      "error",
      "ELECTRON_MAIN",
      "Desktop startup failed.",
      undefined,
      error,
    );
    throw error;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  await stopEmbeddedBackend();
});

process.on("uncaughtException", (error) => {
  writeSystemLog(
    "error",
    "ELECTRON_MAIN",
    "Uncaught exception in Electron main process.",
    undefined,
    error,
  );
});

process.on("unhandledRejection", (reason) => {
  writeSystemLog(
    "error",
    "ELECTRON_MAIN",
    "Unhandled promise rejection in Electron main process.",
    undefined,
    reason,
  );
});
