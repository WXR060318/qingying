import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("qingying", {
  selectFolder: () => ipcRenderer.invoke("dialog:select-folder"),
  selectExportFolder: () => ipcRenderer.invoke("dialog:select-export-folder"),
});
