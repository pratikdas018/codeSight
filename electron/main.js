const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const sanitizeFileName = require("node:path").basename;

const isDev = !app.isPackaged;
const devRendererUrl =
  process.env.ELECTRON_RENDERER_URL ?? "http://127.0.0.1:5173";
const devBackendUrl =
  process.env.CODESIGHT_BACKEND_URL ?? "http://127.0.0.1:4000";
const productionBackendPort = Number(
  process.env.CODESIGHT_DESKTOP_BACKEND_PORT ?? 4010,
);

let mainWindow = null;
let splashWindow = null;
let backendServer = null;
let prismaClient = null;

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

const snippetDirectoryName = "local-snippets";

const getIconPath = () => {
  const pngIcon = path.join(__dirname, "assets", "icon.png");
  return pngIcon;
};

const getFrontendEntry = () =>
  path.join(app.getAppPath(), "frontend", "dist", "index.html");

const getBackendUrl = () =>
  isDev
    ? devBackendUrl
    : `http://127.0.0.1:${productionBackendPort}`;

const sendMenuAction = (action) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("menu:action", action);
};

const ensureSnippetDirectory = async () => {
  const snippetDirectory = path.join(app.getPath("userData"), snippetDirectoryName);
  await fs.mkdir(snippetDirectory, { recursive: true });
  return snippetDirectory;
};

const buildDesktopEnvironment = () => {
  const databasePath = path.join(app.getPath("userData"), "codesight-desktop.db");

  return {
    ...process.env,
    PORT: String(productionBackendPort),
    DATABASE_URL: `file:${databasePath}`,
    JWT_SECRET: process.env.JWT_SECRET ?? "codesight-desktop-secret",
    EXECUTION_PROVIDER: process.env.EXECUTION_PROVIDER ?? "local",
    CODESIGHT_BACKEND_URL: `http://127.0.0.1:${productionBackendPort}`,
  };
};

const startEmbeddedBackend = async () => {
  if (isDev || backendServer) {
    return;
  }

  Object.assign(process.env, buildDesktopEnvironment());

  require(path.join(app.getAppPath(), "backend", "scripts", "ensureSqliteSchema.js"));

  const backendAppModule = require(path.join(
    app.getAppPath(),
    "backend",
    "dist",
    "app.js",
  ));
  const prismaModule = require(path.join(
    app.getAppPath(),
    "backend",
    "dist",
    "services",
    "prisma.js",
  ));
  const backendApp = backendAppModule.default ?? backendAppModule;
  prismaClient = prismaModule.prisma;

  await prismaClient.$connect();

  await new Promise((resolve, reject) => {
    backendServer = backendApp.listen(productionBackendPort, "127.0.0.1", () => {
      resolve();
    });

    backendServer.on("error", reject);
  });
};

const stopEmbeddedBackend = async () => {
  if (backendServer) {
    await new Promise((resolve) => {
      backendServer.close(() => resolve());
    });
    backendServer = null;
  }

  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
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

  splashWindow.loadFile(path.join(__dirname, "splash.html"));
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
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(getFrontendEntry());
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();

    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

const buildMenu = () => {
  const template = [
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
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New File",
          accelerator: "CmdOrCtrl+N",
          click: () => sendMenuAction("file:new"),
        },
        {
          label: "Open File",
          accelerator: "CmdOrCtrl+O",
          click: () => sendMenuAction("file:open"),
        },
        {
          label: "Load Local Snippet",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => sendMenuAction("file:load-local-snippet"),
        },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => sendMenuAction("file:save"),
        },
        {
          label: "Save Snippet Locally",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => sendMenuAction("file:save-local-snippet"),
        },
        { type: "separator" },
        process.platform === "darwin" ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Run",
      submenu: [
        {
          label: "Run Code",
          accelerator: "F5",
          click: () => sendMenuAction("run:execute"),
        },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle DevTools",
          accelerator: process.platform === "darwin" ? "Alt+Command+I" : "Ctrl+Shift+I",
          click: () => {
            mainWindow?.webContents.toggleDevTools();
          },
        },
        { role: "reload" },
        { role: "forceReload" },
        { role: "togglefullscreen" },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

ipcMain.handle("desktop:open-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Open Code File",
    properties: ["openFile"],
    filters: codeFilters,
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  const content = await fs.readFile(filePath, "utf8");

  return {
    canceled: false,
    filePath,
    name: path.basename(filePath),
    content,
  };
});

ipcMain.handle("desktop:save-file", async (_event, payload) => {
  let targetPath = payload.filePath;

  if (!targetPath) {
    const saveResult = await dialog.showSaveDialog(mainWindow, {
      title: "Save File",
      defaultPath: payload.suggestedName,
      filters: codeFilters,
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { canceled: true };
    }

    targetPath = saveResult.filePath;
  }

  await fs.writeFile(targetPath, payload.content, "utf8");

  return {
    canceled: false,
    filePath: targetPath,
    name: path.basename(targetPath),
  };
});

ipcMain.handle("desktop:save-snippet-locally", async (_event, payload) => {
  const directory = await ensureSnippetDirectory();
  const safeTitle = sanitizeFileName(
    `${payload.title || "snippet"}-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  )
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();
  const filePath = path.join(directory, `${safeTitle}.codesight.json`);
  const snippetPayload = {
    id: safeTitle,
    title: payload.title,
    language: payload.language,
    code: payload.code,
    createdAt: new Date().toISOString(),
    source: "local",
  };

  await fs.writeFile(filePath, JSON.stringify(snippetPayload, null, 2), "utf8");

  return {
    ...snippetPayload,
    filePath,
  };
});

ipcMain.handle("desktop:get-local-snippets", async () => {
  const directory = await ensureSnippetDirectory();
  const files = await fs.readdir(directory);
  const snippets = await Promise.all(
    files
      .filter((fileName) => fileName.endsWith(".codesight.json"))
      .map(async (fileName) => {
        const filePath = path.join(directory, fileName);
        const raw = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(raw);

        return {
          id: parsed.id ?? fileName,
          title: parsed.title ?? fileName.replace(".codesight.json", ""),
          language: parsed.language ?? "javascript",
          code: parsed.code ?? "",
          createdAt: parsed.createdAt ?? new Date().toISOString(),
          filePath,
          source: "local",
        };
      }),
  );

  return snippets.sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
});

ipcMain.handle("desktop:open-local-snippet", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Open Local CodeSight Snippet",
    properties: ["openFile"],
    filters: [
      { name: "CodeSight Snippets", extensions: ["codesight.json", "json"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);

  return {
    canceled: false,
    filePath,
    snippet: {
      id: parsed.id ?? path.basename(filePath),
      title: parsed.title ?? path.basename(filePath),
      language: parsed.language ?? "javascript",
      code: parsed.code ?? "",
      createdAt: parsed.createdAt ?? new Date().toISOString(),
      source: "local",
    },
  };
});

app.whenReady().then(async () => {
  await startEmbeddedBackend();
  buildMenu();
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
