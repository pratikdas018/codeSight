import { app } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  CancellationToken,
  autoUpdater,
  type ProgressInfo,
  type UpdateInfo,
} from "electron-updater";

export type UpdateStatus =
  | "unsupported"
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "cancelled"
  | "error";

export interface UpdateState {
  currentVersion: string;
  latestVersion: string | null;
  releaseName: string | null;
  releaseDate: string | null;
  releaseNotes: string[];
  status: UpdateStatus;
  message: string;
  progressPercent: number;
  bytesPerSecond: number;
  transferredBytes: number;
  totalBytes: number;
  lastCheckedAt: string | null;
  errorMessage: string | null;
  updateAvailable: boolean;
  updateDownloaded: boolean;
}

interface PersistedUpdateState {
  lastCheckedAt: string | null;
}

interface UpdateServiceOptions {
  onStateChange: (state: UpdateState) => void;
  logger: (
    level: "error" | "warn" | "info" | "debug",
    scope: string,
    message: string,
    details?: Record<string, unknown>,
    error?: unknown,
  ) => void;
}

const updateStoreFileName = "update-state.json";
const updateScope = "AUTO_UPDATE";

const defaultUnsupportedMessage =
  "Auto-updates are only available in packaged desktop builds.";
const startupCheckDelayMs = 2_500;

const isSupportedPlatform = (platform: NodeJS.Platform) =>
  platform === "win32" || platform === "darwin" || platform === "linux";

const sanitizeReleaseLine = (line: string) =>
  line
    .replace(/^[\s>*-]+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/[`#*_]/g, "")
    .trim();

const extractReleaseNotes = (
  releaseNotes: UpdateInfo["releaseNotes"],
  releaseName: string | null,
) => {
  const noteLines =
    typeof releaseNotes === "string"
      ? releaseNotes.split(/\r?\n/)
      : (releaseNotes ?? []).flatMap((entry) =>
          (entry.note ?? "").split(/\r?\n/),
        );

  const cleanedLines = noteLines
    .map(sanitizeReleaseLine)
    .filter(
      (line) =>
        Boolean(line) &&
        !/^release\s*v?\d/i.test(line) &&
        line.toLowerCase() !== (releaseName ?? "").trim().toLowerCase(),
    );

  if (cleanedLines.length > 0) {
    return cleanedLines.slice(0, 5);
  }

  return ["Performance improvements and bug fixes."];
};

const isConnectivityError = (message: string) =>
  [
    "internet_disconnected",
    "enotfound",
    "econnrefused",
    "econnreset",
    "etimedout",
    "timeout",
    "network",
    "socket hang up",
    "unable to connect",
  ].some((token) => message.includes(token));

const isGitHubApiError = (message: string) =>
  [
    "github",
    "api rate limit",
    "403",
    "404",
    "429",
    "500",
    "unable to find latest version",
    "no published versions on github",
    "cannot find latest",
  ].some((token) => message.includes(token));

const normalizeUpdateErrorMessage = (
  error: unknown,
  action: "check" | "download",
) => {
  const serialized =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "");
  const normalized = serialized.toLowerCase();

  if (isConnectivityError(normalized)) {
    return action === "check"
      ? "CodeSight could not check for updates. Verify your internet connection and try again."
      : "CodeSight could not download the update because the network connection was interrupted.";
  }

  if (isGitHubApiError(normalized)) {
    return action === "check"
      ? "GitHub Releases could not be reached for update information. Try again in a few minutes."
      : "GitHub Releases returned an error while downloading the update. Please retry shortly.";
  }

  return action === "check"
    ? "CodeSight ran into a problem while checking for updates."
    : "CodeSight ran into a problem while downloading the update.";
};

export class UpdateService {
  private state: UpdateState = {
    currentVersion: app.getVersion(),
    latestVersion: null,
    releaseName: null,
    releaseDate: null,
    releaseNotes: [],
    status:
      app.isPackaged && isSupportedPlatform(process.platform)
        ? "idle"
        : "unsupported",
    message:
      app.isPackaged && isSupportedPlatform(process.platform)
        ? "Update service is ready."
        : defaultUnsupportedMessage,
    progressPercent: 0,
    bytesPerSecond: 0,
    transferredBytes: 0,
    totalBytes: 0,
    lastCheckedAt: null,
    errorMessage: null,
    updateAvailable: false,
    updateDownloaded: false,
  };

  private readonly onStateChange: UpdateServiceOptions["onStateChange"];
  private readonly logger: UpdateServiceOptions["logger"];
  private downloadCancellationToken: CancellationToken | null = null;
  private hasRegisteredListeners = false;
  private checkInFlight: Promise<UpdateState> | null = null;
  private downloadInFlight: Promise<UpdateState> | null = null;

  constructor({ onStateChange, logger }: UpdateServiceOptions) {
    this.onStateChange = onStateChange;
    this.logger = logger;
  }

  async initialize() {
    this.state = {
      ...this.state,
      currentVersion: app.getVersion(),
    };

    const persistedState = await this.readPersistedState();
    this.state = {
      ...this.state,
      lastCheckedAt: persistedState.lastCheckedAt,
    };

    if (!this.isSupported()) {
      this.emitState();
      return;
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowPrerelease = false;
    autoUpdater.logger = {
      info: (message: string) =>
        this.logger("info", updateScope, "Updater info.", { message }),
      warn: (message: string) =>
        this.logger("warn", updateScope, "Updater warning.", { message }),
      error: (message: string) =>
        this.logger("error", updateScope, "Updater error.", { message }),
      debug: (message: string) =>
        this.logger("debug", updateScope, "Updater debug.", { message }),
    };

    this.registerListeners();
    this.emitState();
  }

  getState() {
    return this.state;
  }

  scheduleStartupCheck() {
    if (!this.isSupported()) {
      return;
    }

    setTimeout(() => {
      void this.checkForUpdates(false);
    }, startupCheckDelayMs);
  }

  async checkForUpdates(manual = false) {
    if (!this.isSupported()) {
      return this.state;
    }

    if (this.checkInFlight) {
      return this.checkInFlight;
    }

    this.checkInFlight = (async () => {
      this.setState({
        status: "checking",
        message: "Checking GitHub Releases for updates...",
        errorMessage: null,
      });

      try {
        await autoUpdater.checkForUpdates();
      } catch (error) {
        const errorMessage = normalizeUpdateErrorMessage(error, "check");
        this.logger(
          "error",
          updateScope,
          "Update check failed.",
          {
            manual,
          },
          error,
        );
        this.setState({
          status: "error",
          message: errorMessage,
          errorMessage,
          updateAvailable: false,
          updateDownloaded: false,
          progressPercent: 0,
        });
      } finally {
        await this.markLastChecked();
        this.checkInFlight = null;
      }

      return this.state;
    })();

    return this.checkInFlight;
  }

  async downloadUpdate() {
    if (!this.isSupported()) {
      return this.state;
    }

    if (this.downloadInFlight) {
      return this.downloadInFlight;
    }

    this.downloadCancellationToken = new CancellationToken();
    this.setState({
      status: "downloading",
      message: "Downloading update...",
      errorMessage: null,
      progressPercent: 0,
      bytesPerSecond: 0,
      transferredBytes: 0,
      totalBytes: 0,
    });

    this.downloadInFlight = (async () => {
      try {
        await autoUpdater.downloadUpdate(this.downloadCancellationToken ?? undefined);
      } catch (error) {
        if (this.downloadCancellationToken?.cancelled) {
          this.logger("info", updateScope, "Update download cancelled by user.");
        } else {
          const errorMessage = normalizeUpdateErrorMessage(error, "download");
          this.logger(
            "error",
            updateScope,
            "Update download failed.",
            undefined,
            error,
          );
          this.setState({
            status: "error",
            message: errorMessage,
            errorMessage,
          });
        }
      } finally {
        this.downloadCancellationToken = null;
        this.downloadInFlight = null;
      }

      return this.state;
    })();

    return this.downloadInFlight;
  }

  cancelUpdateDownload() {
    if (!this.downloadCancellationToken) {
      return this.state;
    }

    this.downloadCancellationToken.cancel();
    return this.state;
  }

  quitAndInstall() {
    if (!this.isSupported() || !this.state.updateDownloaded) {
      return;
    }

    this.logger("info", updateScope, "Installing downloaded update.");
    autoUpdater.quitAndInstall(false, true);
  }

  private isSupported() {
    return app.isPackaged && isSupportedPlatform(process.platform);
  }

  private registerListeners() {
    if (this.hasRegisteredListeners) {
      return;
    }

    this.hasRegisteredListeners = true;

    autoUpdater.on("checking-for-update", () => {
      this.setState({
        status: "checking",
        message: "Checking GitHub Releases for updates...",
        errorMessage: null,
      });
    });

    autoUpdater.on("update-available", (info) => {
      this.setStateFromInfo(info, {
        status: "available",
        message: `CodeSight v${info.version} is available.`,
        updateAvailable: true,
        updateDownloaded: false,
        progressPercent: 0,
      });
    });

    autoUpdater.on("update-not-available", (info) => {
      this.setStateFromInfo(info, {
        status: "not-available",
        message: "You're already on the latest version.",
        updateAvailable: false,
        updateDownloaded: false,
        progressPercent: 0,
      });
    });

    autoUpdater.on("download-progress", (progress) => {
      this.applyDownloadProgress(progress);
    });

    autoUpdater.on("update-downloaded", (info) => {
      this.setStateFromInfo(info, {
        status: "downloaded",
        message: "Update downloaded successfully. Restart application to install.",
        progressPercent: 100,
        updateAvailable: true,
        updateDownloaded: true,
        errorMessage: null,
      });
    });

    autoUpdater.on("update-cancelled", (info) => {
      this.setStateFromInfo(info, {
        status: "cancelled",
        message: "Update download cancelled.",
        errorMessage: null,
        progressPercent: 0,
        bytesPerSecond: 0,
      });
    });

    autoUpdater.on("error", (error) => {
      const action =
        this.state.status === "downloading" ? "download" : "check";
      const errorMessage = normalizeUpdateErrorMessage(error, action);
      this.logger(
        "error",
        updateScope,
        "Updater emitted an error event.",
        {
          action,
        },
        error,
      );
      this.setState({
        status: "error",
        message: errorMessage,
        errorMessage,
      });
    });
  }

  private applyDownloadProgress(progress: ProgressInfo) {
    this.setState({
      status: "downloading",
      message: "Downloading update...",
      progressPercent: Number(progress.percent.toFixed(1)),
      bytesPerSecond: progress.bytesPerSecond,
      transferredBytes: progress.transferred,
      totalBytes: progress.total,
      errorMessage: null,
    });
  }

  private setStateFromInfo(info: UpdateInfo, patch: Partial<UpdateState>) {
    this.setState({
      latestVersion: info.version,
      releaseName: info.releaseName ?? null,
      releaseDate: info.releaseDate ?? null,
      releaseNotes: extractReleaseNotes(info.releaseNotes, info.releaseName ?? null),
      ...patch,
    });
  }

  private setState(patch: Partial<UpdateState>) {
    this.state = {
      ...this.state,
      ...patch,
    };
    this.emitState();
  }

  private emitState() {
    this.onStateChange(this.state);
  }

  private getStorePath() {
    return path.join(app.getPath("userData"), updateStoreFileName);
  }

  private async readPersistedState(): Promise<PersistedUpdateState> {
    try {
      const raw = await fs.readFile(this.getStorePath(), "utf8");
      const parsed = JSON.parse(raw) as PersistedUpdateState;
      return {
        lastCheckedAt:
          typeof parsed?.lastCheckedAt === "string" ? parsed.lastCheckedAt : null,
      };
    } catch {
      return {
        lastCheckedAt: null,
      };
    }
  }

  private async writePersistedState(state: PersistedUpdateState) {
    await fs.writeFile(this.getStorePath(), JSON.stringify(state, null, 2), "utf8");
  }

  private async markLastChecked() {
    const lastCheckedAt = new Date().toISOString();
    this.state = {
      ...this.state,
      lastCheckedAt,
    };
    this.emitState();
    await this.writePersistedState({ lastCheckedAt });
  }
}
