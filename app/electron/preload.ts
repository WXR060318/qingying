import { contextBridge, ipcRenderer } from "electron";
import type { BackendStatus } from "./backendManager";

contextBridge.exposeInMainWorld("qingying", {
  selectFolder: () => ipcRenderer.invoke("dialog:select-folder") as Promise<string | null>,
  selectExportFolder: () =>
    ipcRenderer.invoke("dialog:select-export-folder") as Promise<string | null>,
  getBackendUrl: () => ipcRenderer.invoke("backend:get-url") as Promise<string>,
  getBackendStatus: () => ipcRenderer.invoke("backend:get-status") as Promise<BackendStatus>,
  onBackendStatus: (callback: (status: BackendStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: BackendStatus) => callback(status);
    ipcRenderer.on("backend:status", listener);
    return () => ipcRenderer.removeListener("backend:status", listener);
  },
});
