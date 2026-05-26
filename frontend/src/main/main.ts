import { app, BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 720,
    title: "青影智筛",
    backgroundColor: "#F4F7F8",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
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
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle("dialog:select-export-folder", async () => {
  const options: OpenDialogOptions = {
    title: "选择导出目录",
    properties: ["openDirectory", "createDirectory"],
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

app.whenReady().then(async () => {
  await ensureBackend();
  createWindow();

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
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
});

async function ensureBackend() {
  if (await isBackendHealthy()) return;
  const backendDir = path.resolve(__dirname, "../../backend");
  const python = resolvePython();
  if (!python || !fs.existsSync(backendDir)) return;
  backendProcess = spawn(python, ["run.py"], {
    cwd: backendDir,
    env: { ...process.env, QINGYING_RELOAD: "0" },
    stdio: "ignore",
  });
  await waitForBackend(4500);
}

function resolvePython() {
  const candidates = [
    path.resolve(__dirname, "../../.venv/bin/python"),
    path.resolve(__dirname, "../../.venv/Scripts/python.exe"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? "python3";
}

async function waitForBackend(timeoutMs: number) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isBackendHealthy()) return true;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}

function isBackendHealthy(): Promise<boolean> {
  return new Promise((resolve) => {
    const request = http.get("http://127.0.0.1:8000/api/health", (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.setTimeout(500, () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}
