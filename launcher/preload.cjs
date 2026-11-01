const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("sheboLauncher", {
  getState: () => ipcRenderer.invoke("launcher-state"),
  checkUpdate: () => ipcRenderer.invoke("check-update"),
  installUpdate: (url, version) => ipcRenderer.invoke("install-update", url, version),
  playGame: () => ipcRenderer.invoke("play-game"),
  openReleases: () => ipcRenderer.invoke("open-releases"),
  onProgress: (callback) => ipcRenderer.on("update-progress", (_event, data) => callback(data))
});
