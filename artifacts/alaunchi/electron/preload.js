import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // Window controls
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),

  // Minecraft operations
  getInstalledModpacks: () => ipcRenderer.invoke("mc:get-installed-modpacks"),
  installModpack: (args) => ipcRenderer.invoke("mc:install-modpack", args),
  updateModpack: (args) => ipcRenderer.invoke("mc:update-modpack", args),
  launchMinecraft: (args) => ipcRenderer.invoke("mc:launch", args),
  checkJava: () => ipcRenderer.invoke("mc:check-java"),

  // Microsoft Auth (Device Code Flow)
  startDeviceCodeAuth: () => ipcRenderer.invoke("ms:device-code-auth"),
  pollToken: (args) => ipcRenderer.invoke("ms:poll-token", args),
  xboxAuth: (args) => ipcRenderer.invoke("ms:xbox-auth", args),
  xstsAuth: (args) => ipcRenderer.invoke("ms:xsts-auth", args),
  minecraftAuth: (args) => ipcRenderer.invoke("ms:mc-auth", args),
  getMinecraftProfile: (args) => ipcRenderer.invoke("ms:mc-profile", args),

  // File system / settings
  readSettings: () => ipcRenderer.invoke("fs:read-settings"),
  writeSettings: (settings) => ipcRenderer.invoke("fs:write-settings", settings),
  readAuth: () => ipcRenderer.invoke("fs:read-auth"),
  writeAuth: (auth) => ipcRenderer.invoke("fs:write-auth", auth),
  clearAuth: () => ipcRenderer.invoke("fs:clear-auth"),

  // GitHub
  fetchModpacks: (args) => ipcRenderer.invoke("github:fetch-modpacks", args),
  createRelease: (args) => ipcRenderer.invoke("github:create-release", args),

  // Events from main process
  onInstallProgress: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("install-progress", handler);
    return () => ipcRenderer.removeListener("install-progress", handler);
  },
  onLaunchStatus: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("launch-status", handler);
    return () => ipcRenderer.removeListener("launch-status", handler);
  },
});
