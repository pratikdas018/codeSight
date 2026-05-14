import { contextBridge, ipcRenderer } from "electron";

type SupportedLanguage = "javascript" | "python" | "c" | "cpp" | "java";

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

contextBridge.exposeInMainWorld("electronAPI", {
  env: {
    isElectron: true,
    backendUrl:
      process.env.CODESIGHT_BACKEND_URL ?? "http://127.0.0.1:4000",
    supabaseUrl: process.env.VITE_SUPABASE_URL,
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY,
    supabaseEmailConfirmationRequired:
      process.env.VITE_SUPABASE_EMAIL_CONFIRMATION_REQUIRED,
    siteUrl: process.env.VITE_SITE_URL,
    platform: process.platform,
    version: process.env.npm_package_version ?? "1.0.0",
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
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.invoke("window:toggle-maximize"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  isWindowMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  onMenuAction: (callback: (action: MenuActionEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: MenuActionEvent) => {
      callback(action);
    };

    ipcRenderer.on("menu:action", handler);

    return () => {
      ipcRenderer.removeListener("menu:action", handler);
    };
  },
});
