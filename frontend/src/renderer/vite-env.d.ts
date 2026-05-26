/// <reference types="vite/client" />

interface Window {
  __QINGYING_BACKEND_URL__?: string;
  qingying?: {
    selectFolder: () => Promise<string | null>;
    selectExportFolder: () => Promise<string | null>;
    getBackendUrl: () => Promise<string>;
    getBackendStatus: () => Promise<{
      running: boolean;
      url: string;
      port: number;
      pid: number | null;
      mode: "development" | "production";
      error: string | null;
      phase: "idle" | "checking" | "starting" | "waiting" | "ready" | "error";
      message: string;
      progress: number;
    }>;
    onBackendStatus: (
      callback: (status: {
        running: boolean;
        url: string;
        port: number;
        pid: number | null;
        mode: "development" | "production";
        error: string | null;
        phase: "idle" | "checking" | "starting" | "waiting" | "ready" | "error";
        message: string;
        progress: number;
      }) => void,
    ) => () => void;
  };
}
