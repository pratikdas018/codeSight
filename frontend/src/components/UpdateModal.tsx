import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { LoadingSpinner } from "./LoadingSpinner";
import type { UpdateState } from "../utils/updates";

interface UpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updateState: UpdateState;
  onCheckForUpdates: () => void | Promise<void>;
  onDownloadUpdate: () => void | Promise<void>;
  onCancelDownload: () => void | Promise<void>;
  onQuitAndInstall: () => void | Promise<void>;
}

const formatReleaseDate = (value: string | null) => {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

const formatSpeed = (bytesPerSecond: number) => {
  if (bytesPerSecond <= 0) {
    return null;
  }

  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let size = bytesPerSecond;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
};

const formatProgressLabel = (percent: number) =>
  `${Math.max(0, Math.min(100, Math.round(percent)))}%`;

export const UpdateModal = ({
  open,
  onOpenChange,
  updateState,
  onCheckForUpdates,
  onDownloadUpdate,
  onCancelDownload,
  onQuitAndInstall,
}: UpdateModalProps) => {
  const releaseDate = formatReleaseDate(updateState.releaseDate);
  const latestVersion = updateState.latestVersion ?? updateState.currentVersion;
  const canClose = updateState.status !== "downloading";
  const progressLabel = formatProgressLabel(updateState.progressPercent);
  const speedLabel = formatSpeed(updateState.bytesPerSecond);
  const title =
    updateState.status === "downloaded"
      ? "Update ready to install"
      : updateState.status === "downloading"
        ? "Downloading update"
        : updateState.status === "cancelled"
          ? "Download paused"
          : updateState.status === "error"
            ? "Update issue"
            : "Update Available";
  const description =
    updateState.status === "downloaded"
      ? "Update downloaded successfully. Restart application to install."
      : updateState.status === "cancelled"
        ? "The update was paused before installation."
        : updateState.status === "error"
          ? updateState.errorMessage ?? updateState.message
          : `CodeSight v${latestVersion} is available.`;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !canClose) {
          return;
        }

        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="w-[min(92vw,720px)] overflow-hidden border-[rgba(114,255,112,0.18)] bg-[radial-gradient(circle_at_top_left,rgba(114,255,112,0.16),transparent_34%),linear-gradient(180deg,rgba(12,18,12,0.98),rgba(7,10,7,0.98))] p-0">
        <div className="border-b border-[rgba(114,255,112,0.12)] px-6 py-6 sm:px-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[rgba(114,255,112,0.18)] bg-[rgba(114,255,112,0.08)] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[var(--cs-primary-bright)]">
            <span aria-hidden="true">🚀</span>
            Update Center
          </div>
          <DialogHeader>
            <DialogTitle className="text-[1.85rem] tracking-[-0.05em]">{title}</DialogTitle>
            <DialogDescription className="max-w-2xl text-[15px] leading-7">
              {description}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
            <span className="rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[var(--cs-text)]">
              Current v{updateState.currentVersion}
            </span>
            <span className="rounded-full border border-[rgba(114,255,112,0.14)] bg-[rgba(114,255,112,0.08)] px-3 py-1.5 text-[var(--cs-primary-bright)]">
              Latest v{latestVersion}
            </span>
            {releaseDate ? (
              <span className="rounded-full border border-[var(--cs-border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[var(--cs-text-muted)]">
                {releaseDate}
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-6 px-6 py-6 sm:px-8">
          {updateState.releaseNotes.length > 0 ? (
            <section className="rounded-[1.4rem] border border-[var(--cs-border)] bg-[rgba(255,255,255,0.025)] p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cs-text-subtle)]">
                What's New
              </div>
              <div className="mt-3 space-y-2">
                {updateState.releaseNotes.map((note) => (
                  <div key={note} className="flex items-start gap-3 text-sm leading-6 text-[var(--cs-text-muted)]">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--cs-primary-bright)]" />
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {updateState.status === "downloading" ? (
            <section className="rounded-[1.4rem] border border-[rgba(114,255,112,0.14)] bg-[rgba(114,255,112,0.05)] p-5">
              <div className="flex items-center gap-3 text-[var(--cs-text)]">
                <LoadingSpinner className="h-4 w-4 text-[var(--cs-primary-bright)]" />
                <span className="text-sm font-medium">Downloading update...</span>
              </div>
              <div className="mt-4 overflow-hidden rounded-full border border-[rgba(114,255,112,0.18)] bg-[rgba(255,255,255,0.03)]">
                <div
                  className="h-3 rounded-full bg-[linear-gradient(90deg,#72ff70_0%,#00ff41_100%)] transition-[width] duration-300"
                  style={{ width: `${Math.max(2, updateState.progressPercent)}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--cs-text-muted)]">
                <span>{progressLabel}</span>
                <span>{speedLabel ?? "Preparing transfer..."}</span>
              </div>
            </section>
          ) : null}

          {updateState.status === "cancelled" ? (
            <div className="rounded-[1.4rem] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              Update download cancelled. You can resume it whenever you're ready.
            </div>
          ) : null}

          {updateState.status === "error" ? (
            <div className="rounded-[1.4rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {updateState.errorMessage ?? updateState.message}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm leading-6 text-[var(--cs-text-muted)]">
              {updateState.status === "downloaded"
                ? "Restart CodeSight to finish installation."
                : updateState.message}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {updateState.status === "available" ? (
                <>
                  <Button variant="secondary" onClick={() => onOpenChange(false)}>
                    Later
                  </Button>
                  <Button onClick={onDownloadUpdate}>Update Now</Button>
                </>
              ) : null}

              {updateState.status === "downloading" ? (
                <>
                  <Button variant="secondary" onClick={onCancelDownload}>
                    Cancel Download
                  </Button>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Hide
                  </Button>
                </>
              ) : null}

              {updateState.status === "downloaded" ? (
                <Button onClick={onQuitAndInstall}>Restart &amp; Install</Button>
              ) : null}

              {updateState.status === "cancelled" ? (
                <>
                  <Button variant="secondary" onClick={() => onOpenChange(false)}>
                    Later
                  </Button>
                  <Button onClick={onDownloadUpdate}>Resume Download</Button>
                </>
              ) : null}

              {updateState.status === "error" ? (
                <>
                  <Button variant="secondary" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                  <Button
                    onClick={
                      updateState.updateAvailable ? onDownloadUpdate : onCheckForUpdates
                    }
                  >
                    {updateState.updateAvailable ? "Try Download Again" : "Try Again"}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
