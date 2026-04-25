const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  env: {
    isElectron: true,
    backendUrl:
      process.env.CODESIGHT_BACKEND_URL ?? "http://127.0.0.1:4000",
    platform: process.platform,
  },
  openFile: () => ipcRenderer.invoke("desktop:open-file"),
  saveFile: (payload) => ipcRenderer.invoke("desktop:save-file", payload),
  saveSnippetLocally: (payload) =>
    ipcRenderer.invoke("desktop:save-snippet-locally", payload),
  getLocalSnippets: () => ipcRenderer.invoke("desktop:get-local-snippets"),
  openLocalSnippet: () => ipcRenderer.invoke("desktop:open-local-snippet"),
  onMenuAction: (callback) => {
    const handler = (_event, action) => {
      callback(action);
    };

    ipcRenderer.on("menu:action", handler);

    return () => {
      ipcRenderer.removeListener("menu:action", handler);
    };
  },
});
