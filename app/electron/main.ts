import { app, BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from "electron";
import path from "node:path";
import {
  getBackendStatus,
  getBackendUrl,
  startBackend,
  stopBackend,
} from "./backendManager";

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;

app.setName("青影智筛");

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1080,
    minHeight: 680,
    title: "青影智筛",
    backgroundColor: "#f1f5f9",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:5173");
  } else {
    void mainWindow.loadFile(path.join(app.getAppPath(), "frontend", "dist", "index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
}

ipcMain.handle("dialog:select-folder", async () => {
  const options: OpenDialogOptions = {
    title: "选择活动照片文件夹",
    properties: ["openDirectory"],
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
});

ipcMain.handle("dialog:select-export-folder", async () => {
  const options: OpenDialogOptions = {
    title: "选择导出目录",
    properties: ["openDirectory", "createDirectory"],
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
});

ipcMain.handle("backend:get-url", () => getBackendUrl());
ipcMain.handle("backend:get-status", () => getBackendStatus());

app.whenReady().then(async () => {
  createWindow();
  mainWindow?.webContents.once("did-finish-load", () => {
    mainWindow?.webContents.send("backend:status", getBackendStatus());
  });

  void startBackend({
    appRoot: path.resolve(__dirname, ".."),
    resourcesPath: process.resourcesPath,
    userDataPath: app.getPath("userData"),
    isPackaged: app.isPackaged,
    onStatusChange: (status) => {
      mainWindow?.webContents.send("backend:status", status);
    },
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  void stopBackend();
});
