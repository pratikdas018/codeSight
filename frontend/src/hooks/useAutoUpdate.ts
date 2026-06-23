import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  defaultDesktopUpdateState,
  type UpdateState,
  type UpdateStatus,
} from "../utils/updates";

const modalStatuses: UpdateStatus[] = [
  "available",
  "downloading",
  "downloaded",
  "cancelled",
];

export const useAutoUpdate = () => {
  const isDesktop = Boolean(window.electronAPI?.env.isElectron);
  const [updateState, setUpdateState] = useState<UpdateState>(() =>
    isDesktop
      ? {
          ...defaultDesktopUpdateState,
          status: "idle",
          message: "Update service is loading...",
          currentVersion: window.electronAPI?.env.version ?? "1.0.0",
        }
      : defaultDesktopUpdateState,
  );

  useEffect(() => {
    if (!isDesktop || !window.electronAPI?.getAppVersion) {
      return;
    }

    void window.electronAPI.getAppVersion().then((version) => {
      setUpdateState((prev) => ({ ...prev, currentVersion: version }));
    });
  }, [isDesktop]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const previousStatusRef = useRef<UpdateStatus>(updateState.status);

  const syncUpdateState = useEffectEvent((nextState: UpdateState | null) => {
    if (!nextState) {
      return;
    }

    setUpdateState(nextState);
  });

  useEffect(() => {
    if (!isDesktop || !window.electronAPI) {
      return;
    }

    void window.electronAPI.getUpdateState().then(syncUpdateState);

    const unsubscribe = window.electronAPI.onUpdateStateChanged((nextState) => {
      syncUpdateState(nextState);
    });

    return unsubscribe;
  }, [isDesktop, syncUpdateState]);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;

    if (modalStatuses.includes(updateState.status)) {
      setIsModalOpen(true);
    } else if (
      updateState.status === "error" &&
      (previousStatus === "downloading" ||
        previousStatus === "available" ||
        previousStatus === "cancelled")
    ) {
      setIsModalOpen(true);
    } else if (updateState.status === "not-available") {
      setIsModalOpen(false);
    }

    previousStatusRef.current = updateState.status;
  }, [updateState.status]);

  const checkForUpdates = useEffectEvent(async () => {
    if (!window.electronAPI) {
      return;
    }

    const nextState = await window.electronAPI.checkForUpdates();
    syncUpdateState(nextState);
  });

  const downloadUpdate = useEffectEvent(async () => {
    if (!window.electronAPI) {
      return;
    }

    const nextState = await window.electronAPI.downloadUpdate();
    syncUpdateState(nextState);
  });

  const cancelUpdateDownload = useEffectEvent(async () => {
    if (!window.electronAPI) {
      return;
    }

    const nextState = await window.electronAPI.cancelUpdateDownload();
    syncUpdateState(nextState);
  });

  const quitAndInstallUpdate = useEffectEvent(async () => {
    if (!window.electronAPI) {
      return;
    }

    await window.electronAPI.quitAndInstallUpdate();
  });

  return {
    isDesktop,
    updateState,
    isModalOpen,
    setIsModalOpen,
    checkForUpdates,
    downloadUpdate,
    cancelUpdateDownload,
    quitAndInstallUpdate,
  };
};
