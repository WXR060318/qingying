import { spawn, execFile, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";

export interface BackendStatus {
  running: boolean;
  url: string;
  port: number;
  pid: number | null;
  mode: "development" | "production";
  error: string | null;
  phase: "idle" | "checking" | "starting" | "waiting" | "ready" | "error";
  message: string;
  progress: number;
}

interface StartOptions {
  appRoot: string;
  resourcesPath: string;
  userDataPath: string;
  isPackaged: boolean;
  onStatusChange?: (status: BackendStatus) => void;
}

const DEFAULT_PORT = 8765;
const APP_NAME = "青影智筛";

let backendProcess: ChildProcessWithoutNullStreams | null = null;
let backendPort = DEFAULT_PORT;
let backendError: string | null = null;
let startPromise: Promise<BackendStatus> | null = null;
let userDataDir = "";
let appRootDir = "";
let resourcesDir = "";
let packagedRuntime = false;
let backendPhase: BackendStatus["phase"] = "idle";
let backendMessage = "正在准备本地后端";
let backendProgress = 0;
let statusListener: ((status: BackendStatus) => void) | undefined;

export async function startBackend(options: StartOptions): Promise<BackendStatus> {
  userDataDir = options.userDataPath;
  appRootDir = options.appRoot;
  resourcesDir = options.resourcesPath;
  packagedRuntime = options.isPackaged;
  statusListener = options.onStatusChange;

  if (startPromise) return startPromise;
  startPromise = doStartBackend();
  return startPromise;
}

export async function stopBackend(): Promise<void> {
  startPromise = null;
  if (!backendProcess) return;

  const processToStop = backendProcess;
  backendProcess = null;

  appendLog(`Stopping backend pid=${processToStop.pid ?? "unknown"}`);
  if (process.platform === "win32" && processToStop.pid) {
    await new Promise<void>((resolve) => {
      execFile("taskkill", ["/pid", String(processToStop.pid), "/T", "/F"], () => resolve());
    });
    return;
  }

  if (!processToStop.killed) {
    processToStop.kill("SIGTERM");
  }
}

export function getBackendUrl(): string {
  return `http://127.0.0.1:${backendPort}`;
}

export function getBackendStatus(): BackendStatus {
  return {
    running: backendPhase === "ready",
    url: getBackendUrl(),
    port: backendPort,
    pid: backendProcess?.pid ?? null,
    mode: isDev() ? "development" : "production",
    error: backendError,
    phase: backendPhase,
    message: backendMessage,
    progress: backendProgress,
  };
}

async function doStartBackend(): Promise<BackendStatus> {
  backendError = null;
  ensureLogDir();
  updateStatus("checking", "正在检查本地后端端口", 8);

  const preferredPort = readConfiguredPort();
  backendPort = await resolveBackendPort(preferredPort);
  if (await isBackendHealthy(backendPort)) {
    appendLog(`Reusing healthy backend on port ${backendPort}`);
    updateStatus("ready", "本地后端已连接", 100);
    return getBackendStatus();
  }

  const command = resolveBackendCommand();
  if (!command) {
    backendError = isDev()
      ? "未找到可用 Python 解释器或 backend/run.py。请先安装后端依赖。"
      : "未找到打包后的后端可执行文件。请先运行后端 PyInstaller 打包脚本。";
    appendLog(backendError);
    updateStatus("error", backendError, 100);
    return getBackendStatus();
  }

  appendLog(`Starting backend: ${command.command} ${command.args.join(" ")}`);
  updateStatus(
    "starting",
    isDev() ? "正在启动开发后端服务" : "正在启动内置 Python 后端，首次启动可能需要几十秒",
    24,
  );
  backendProcess = spawn(command.command, command.args, {
    cwd: command.cwd,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
      QINGYING_BACKEND_PORT: String(backendPort),
      QINGYING_USER_DATA_DIR: userDataDir,
      QINGYING_APP_NAME: APP_NAME,
      QINGYING_RELOAD: "0",
    },
    windowsHide: true,
  });

  backendProcess.stdout.on("data", (chunk) => {
    appendLog(`[backend stdout] ${chunk.toString().trimEnd()}`);
  });
  backendProcess.stderr.on("data", (chunk) => {
    appendLog(`[backend stderr] ${chunk.toString().trimEnd()}`);
  });
  backendProcess.on("error", (error) => {
    backendError = `后端进程启动失败：${error.message}`;
    appendLog(backendError);
    updateStatus("error", backendError, 100);
  });
  backendProcess.on("exit", (code, signal) => {
    appendLog(`Backend exited code=${code ?? "null"} signal=${signal ?? "null"}`);
    if (backendProcess) {
      backendProcess = null;
      if (code !== 0 && code !== null) {
        backendError = `后端进程异常退出，退出码 ${code}`;
        updateStatus("error", backendError, 100);
      }
    }
  });

  updateStatus("waiting", "正在等待后端健康检查通过", 45);
  const ready = await waitForHealthyBackend(backendPort, 180000);
  if (!ready) {
    backendError = "后端启动超时，请查看日志了解原因。";
    appendLog(backendError);
    updateStatus("error", backendError, 100);
  } else {
    updateStatus("ready", "本地后端已连接", 100);
  }
  return getBackendStatus();
}

function resolveBackendCommand():
  | { command: string; args: string[]; cwd: string }
  | null {
  if (isDev()) {
    const backendDir = path.join(appRootDir, "backend");
    const runFile = path.join(backendDir, "run.py");
    if (!fs.existsSync(runFile)) return null;
    const python = resolvePython();
    if (!python) return null;
    return { command: python, args: ["run.py"], cwd: backendDir };
  }

  const runtimeName = "qingying-backend-runtime";
  const runtimeExecutableName = process.platform === "win32" ? `${runtimeName}.exe` : runtimeName;
  const runtimeExecutable = path.join(
    resourcesDir,
    "backend",
    runtimeName,
    runtimeExecutableName,
  );
  if (fs.existsSync(runtimeExecutable)) {
    return { command: runtimeExecutable, args: [], cwd: path.dirname(runtimeExecutable) };
  }

  const legacyExecutableName = process.platform === "win32" ? "qingying-backend.exe" : "qingying-backend";
  const legacyExecutable = path.join(resourcesDir, "backend", legacyExecutableName);
  if (fs.existsSync(legacyExecutable)) {
    return { command: legacyExecutable, args: [], cwd: path.dirname(legacyExecutable) };
  }
  return null;
}

function resolvePython(): string | null {
  const candidates = [
    path.join(appRootDir, ".venv", "bin", "python"),
    path.join(appRootDir, ".venv", "Scripts", "python.exe"),
    "python3",
    "python",
  ];
  return candidates.find((candidate) => candidate === "python3" || candidate === "python" || fs.existsSync(candidate)) ?? null;
}

async function resolveBackendPort(preferredPort: number): Promise<number> {
  if (await isBackendHealthy(preferredPort)) return preferredPort;
  if (await isPortAvailable(preferredPort)) return preferredPort;

  for (let port = DEFAULT_PORT + 1; port <= DEFAULT_PORT + 100; port += 1) {
    if (await isBackendHealthy(port)) return port;
    if (await isPortAvailable(port)) return port;
  }
  return preferredPort;
}

function readConfiguredPort(): number {
  const envPort = Number(process.env.QINGYING_BACKEND_PORT);
  if (Number.isInteger(envPort) && envPort > 0) return envPort;

  const configPath = path.join(userDataDir, "config.json");
  try {
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, "utf-8")) as { backendPort?: string | number };
      const configured = Number(raw.backendPort);
      if (Number.isInteger(configured) && configured > 0) return configured;
    }
  } catch (error) {
    appendLog(`Failed to read backend port from config: ${(error as Error).message}`);
  }
  return DEFAULT_PORT;
}

function waitForHealthyBackend(port: number, timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const tick = async () => {
      if (await isBackendHealthy(port)) {
        resolve(true);
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        resolve(false);
        return;
      }
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(98, 45 + Math.round((elapsed / timeoutMs) * 50));
      updateStatus("waiting", "正在等待后端启动完成，首次启动会稍慢", progress);
      setTimeout(tick, 350);
    };
    void tick();
  });
}

function isBackendHealthy(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const request = http.get(`http://127.0.0.1:${port}/health`, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.setTimeout(700, () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function isDev(): boolean {
  return process.env.NODE_ENV === "development" || !packagedRuntime;
}

function ensureLogDir(): void {
  fs.mkdirSync(path.join(userDataDir, "logs"), { recursive: true });
}

function appendLog(message: string): void {
  if (!userDataDir) return;
  try {
    ensureLogDir();
    fs.appendFileSync(
      path.join(userDataDir, "logs", "electron.log"),
      `${new Date().toISOString()} ${message}\n`,
      "utf-8",
    );
  } catch {
    // Logging must never prevent the app from opening.
  }
}

function updateStatus(phase: BackendStatus["phase"], message: string, progress: number): void {
  backendPhase = phase;
  backendMessage = message;
  backendProgress = Math.max(0, Math.min(100, progress));
  statusListener?.(getBackendStatus());
}
