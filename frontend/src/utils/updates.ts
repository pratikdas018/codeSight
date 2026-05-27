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

export const defaultDesktopUpdateState: UpdateState = {
  currentVersion: "1.0.0",
  latestVersion: null,
  releaseName: null,
  releaseDate: null,
  releaseNotes: [],
  status: "unsupported",
  message: "Auto-updates are only available in the desktop app.",
  progressPercent: 0,
  bytesPerSecond: 0,
  transferredBytes: 0,
  totalBytes: 0,
  lastCheckedAt: null,
  errorMessage: null,
  updateAvailable: false,
  updateDownloaded: false,
};
