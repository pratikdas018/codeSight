import { promises as fs } from "node:fs";

const sleep = (durationMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });

const retryableErrorCodes = new Set([
  "EBUSY",
  "ENOTEMPTY",
  "EPERM",
  "EMFILE",
  "ENFILE",
]);

export const removeDirectory = async (directoryPath: string) => {
  const maxAttempts = process.platform === "win32" ? 8 : 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await fs.rm(directoryPath, {
        recursive: true,
        force: true,
        maxRetries: 2,
        retryDelay: 100,
      });
      return;
    } catch (error) {
      const errorCode =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code?: string }).code === "string"
          ? (error as { code: string }).code
          : "";

      if (!retryableErrorCodes.has(errorCode) || attempt === maxAttempts) {
        console.warn(
          `[codesight] Unable to remove temporary directory ${directoryPath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return;
      }

      await sleep(attempt * 150);
    }
  }
};
