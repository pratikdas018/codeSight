import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from "electron";
import type {
  MenuItemConstructorOptions,
  MessageBoxOptions,
  OpenDialogOptions,
  SaveDialogOptions,
} from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";

type SupportedLanguage = "javascript" | "python" | "c" | "cpp" | "java";

interface DesktopFilePayload {
  filePath?: string | null;
  content: string;
  suggestedName: string;
}

interface DesktopRunPayload {
  code: string;
  language: SupportedLanguage;
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

const isDev = !app.isPackaged;
const devRendererUrl =
  process.env.ELECTRON_RENDERER_URL ?? "http://127.0.0.1:5173";
const devBackendUrl =
  process.env.CODESIGHT_BACKEND_URL ?? "http://127.0.0.1:4000";
const productionBackendPort = Number(
  process.env.CODESIGHT_DESKTOP_BACKEND_PORT ?? 4010,
);

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

const getIconPath = () => path.join(__dirname, "..", "assets", "icon.png");
const getSplashPath = () => path.join(__dirname, "..", "splash.html");
const getFrontendEntry = () =>
  path.join(app.getAppPath(), "frontend", "dist", "index.html");
const getBackendAppPath = (...segments: string[]) =>
  path.join(app.getAppPath(), "backend", ...segments);
const getSnippetDirectory = () =>
  path.join(app.getPath("userData"), snippetDirectoryName);
const getRecentFilesStorePath = () =>
  path.join(app.getPath("userData"), recentFilesStoreName);
const getBackendUrl = () =>
  isDev ? devBackendUrl : `http://127.0.0.1:${productionBackendPort}`;

const buildDesktopEnvironment = () => {
  return {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(productionBackendPort),
    EXECUTOR_MODE: "local",
    EXECUTION_PROVIDER: process.env.EXECUTION_PROVIDER ?? "auto",
    CODESIGHT_BACKEND_URL: `http://127.0.0.1:${productionBackendPort}`,
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
  if (isDev || backendServer) {
    return;
  }

  Object.assign(process.env, buildDesktopEnvironment());
  delete process.env.FRONTEND_URL;

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
    resizable: false,
    show: false,
    alwaysOnTop: true,
    icon: getIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  void splashWindow.loadFile(getSplashPath());
  splashWindow.once("ready-to-show", () => {
    splashWindow?.show();
  });
};

const createMainWindow = async () => {
  process.env.CODESIGHT_BACKEND_URL = getBackendUrl();

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
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: isDev,
      spellcheck: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowedPrefix = isDev ? devRendererUrl : "file://";

    if (!url.startsWith(allowedPrefix)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  if (isDev) {
    await mainWindow.loadURL(devRendererUrl);
  } else {
    await mainWindow.loadFile(getFrontendEntry());
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();

    if (isDev) {
      mainWindow?.webContents.openDevTools({ mode: "detach" });
    }

    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
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

  if (isDev) {
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

ipcMain.handle("desktop:run-code", async (_event, payload: DesktopRunPayload) =>
  invokeBackend("/execute", payload),
);

ipcMain.handle(
  "desktop:open-file",
  async (_event, payload?: { filePath?: string | null }) => {
    if (payload?.filePath) {
      return loadFileFromPath(payload.filePath);
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

ipcMain.handle("desktop:save-file", async (_event, payload: DesktopFilePayload) => {
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

ipcMain.handle(
  "desktop:save-snippet-locally",
  async (
    _event,
    payload: { title: string; language: SupportedLanguage; code: string },
  ): Promise<LocalSnippetRecord> => {
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

ipcMain.handle(
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

ipcMain.handle("desktop:open-local-snippet", async () => {
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

ipcMain.handle("desktop:get-recent-files", async () => readRecentFiles());

app.whenReady().then(async () => {
  app.setAppUserModelId("com.codesight.desktop");
  await startEmbeddedBackend();
  await buildMenu();
  createSplashWindow();
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  await stopEmbeddedBackend();
});
